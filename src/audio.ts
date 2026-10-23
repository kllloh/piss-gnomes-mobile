/** A handful of synthesised sounds: a hiss for pee, a squelch for hits, and a few stings. No audio files. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private hissGain!: GainNode;
  private farGain!: GainNode;
  private noise!: AudioBuffer;
  muted = false;

  /** Must be called from a tap, or phones keep the sound locked. */
  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // two always-running hisses: your own stream, and everybody else's (quieter, further away)
    const mk = (freq: number, q: number) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx!.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx!.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return g;
    };
    this.hissGain = mk(2600, 0.8);
    this.farGain = mk(1900, 0.7);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  /** Called every frame: how loud the player's stream and everyone else's should be (0..1). */
  hiss(own: boolean, others: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.hissGain.gain.setTargetAtTime(own ? 0.22 : 0, t, 0.04);
    this.farGain.gain.setTargetAtTime(Math.min(1, others) * 0.12, t, 0.08);
  }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // --- a quiet generative trance: a 7-step arpeggio over a pulsing bass, through an echo ---------------------

  private musicOn = false;
  private nextStep = 0;
  private step = 0;
  private root = 38; // MIDI D2
  private lastBeat = -9;
  private delay!: DelayNode;
  /** Which silly mode the soundtrack is dressed up as. */
  mood: 'none' | 'disco' | 'goth' | 'bogan' = 'none';

  /** 0..1, jumps on each beat and fades: the visuals pulse with it. */
  get beat(): number {
    return this.ctx ? Math.exp(-(this.ctx.currentTime - this.lastBeat) * 5) : 0;
  }

  setMood(m: 'none' | 'disco' | 'goth' | 'bogan') {
    this.mood = m;
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const bus = this.ctx.createGain();
    bus.gain.value = 0.55;
    bus.connect(this.master);
    this.delay = this.ctx.createDelay(1);
    this.delay.delayTime.value = 0.3;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.42;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(bus);
    this.bus = bus;
    this.nextStep = this.ctx.currentTime + 0.1;
    setInterval(() => this.schedule(), 80);
  }

  private bus!: GainNode;

  private note(midi: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, echo: boolean) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g);
    g.connect(this.bus);
    if (echo) g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private schedule() {
    if (!this.ctx) return;
    const SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];
    const bpm = this.mood === 'disco' ? 122 : this.mood === 'goth' ? 78 : this.mood === 'bogan' ? 118 : 108;
    const sixteenth = 60 / bpm / 4;
    while (this.nextStep < this.ctx.currentTime + 0.25) {
      const t = this.nextStep;
      const s = this.step;
      if (s % 4 === 0) { this.lastBeat = t; }
      if (s % 16 === 0 && Math.random() < 0.5) this.root = [38, 38, 41, 36, 43][Math.floor(Math.random() * 5)];
      if (this.mood === 'disco') {
        // four on the floor, off-beat hats and an octave-bouncing bass
        if (s % 4 === 0) this.tone(170, 42, 0.16, 'sine', 0.32);
        if (s % 4 === 2) this.tone(7000, 6000, 0.04, 'square', 0.04);
        if (s % 2 === 0) this.note(this.root + (s % 4 === 0 ? 0 : 12), t, 0.16, 'sawtooth', 0.14, 900, false);
        if (s % 8 === 4 || s % 8 === 7) this.note(this.root + 31 + SCALE[(s * 3) % 7], t, 0.2, 'square', 0.05, 2600, true);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      if (this.mood === 'bogan') {
        // pub rock: fuzzy power chords and a stomp
        if (s % 8 === 0 || s % 8 === 6) {
          for (const iv of [0, 7, 12]) this.note(this.root + 12 + iv, t, 0.5, 'sawtooth', 0.09, 1500, false);
          this.tone(130, 45, 0.14, 'sine', 0.3);
        }
        if (s % 8 === 4) this.tone(200, 90, 0.1, 'square', 0.12);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      if (this.mood === 'goth') {
        // slow, low and minor
        if (s % 16 === 0) this.note(this.root + 12, t, 2.4, 'sawtooth', 0.1, 500, true);
        if (s % 16 === 8) this.note(this.root + 15, t, 2.0, 'sine', 0.1, 900, true);
        if (s % 4 === 0) this.note(this.root - 12, t, 0.5, 'sine', 0.2, 300, false);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      // bass on the beat, one octave drop sometimes
      if (s % 4 === 0) this.note(this.root - (s % 8 === 0 ? 0 : 12 * (Math.random() < 0.3 ? 1 : 0)), t, 0.34, 'sawtooth', 0.2, 700, false);
      // 7-step arpeggio loop against the 16-step bar: it never lines up the same way twice
      if (s % 7 !== 3) {
        const deg = SCALE[(s * 5 + Math.floor(s / 16) * 3) % SCALE.length];
        this.note(this.root + 24 + deg, t, 0.22, 'triangle', 0.1, 2400, true);
      }
      if (s % 32 === 0) this.note(this.root + 36 + SCALE[Math.floor(Math.random() * 7)], t, 1.8, 'sine', 0.06, 3000, true);
      this.nextStep += sixteenth;
      this.step = (this.step + 1) % 224;
    }
  }

  hurt() { this.tone(240, 90, 0.16, 'square', 0.18); }
  pop() { this.tone(520, 160, 0.12, 'triangle', 0.16); }
  beep(high = false) { this.tone(high ? 880 : 520, high ? 880 : 520, 0.12, 'square', 0.14); }
  alarm() { this.tone(330, 330, 0.18, 'sawtooth', 0.12); this.tone(247, 247, 0.18, 'sawtooth', 0.12, 0.22); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.16, i * 0.13)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.96, 0.28, 'sawtooth', 0.14, i * 0.17)); }
}

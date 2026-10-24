export interface Pos {
  x: number;
  y: number;
  z: number;
}

interface HissVoice {
  gain: GainNode;
  panner: PannerNode;
}

/**
 * A handful of synthesised sounds: a hiss for pee, a squelch for hits, and a few stings. No audio files.
 * Everything that happens out in the forest is placed in 3D (HRTF panning, distance fade) around the camera,
 * so with headphones you can hear where the gnomes, farts and footsteps are.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private hissGain!: GainNode;
  private voices: HissVoice[] = [];
  private lastAt = new Map<string, number>();
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

    // your own stream hisses in the middle of your head; other gnomes' streams are placed in the world
    const mk = (freq: number, q: number, panner: PannerNode | null) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.loopStart = Math.random();
      const f = this.ctx!.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx!.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g);
      if (panner) g.connect(panner);
      else g.connect(this.master);
      src.start();
      return g;
    };
    this.hissGain = mk(2600, 0.8, null);
    for (let i = 0; i < 4; i++) {
      const panner = this.makePanner(0, 0, 0);
      this.voices.push({ gain: mk(2100 + i * 150, 0.7, panner), panner });
    }
  }

  /** A panner that fades with distance and is placed with HRTF. */
  private makePanner(x: number, y: number, z: number): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 3;
    p.rolloffFactor = 1.25;
    p.maxDistance = 90;
    this.place(p, x, y, z);
    p.connect(this.master);
    return p;
  }

  private place(p: PannerNode, x: number, y: number, z: number) {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
  }

  /** Tell the audio engine where the listener (the camera) is and which way it faces. Call every frame. */
  setListener(p: Pos, fx: number, fy: number, fz: number) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = p.x;
      L.positionY.value = p.y;
      L.positionZ.value = p.z;
      L.forwardX.value = fx;
      L.forwardY.value = fy;
      L.forwardZ.value = fz;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      const old = L as unknown as { setPosition(x: number, y: number, z: number): void; setOrientation(a: number, b: number, c: number, d: number, e: number, f: number): void };
      old.setPosition(p.x, p.y, p.z);
      old.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /** Where each peeing gnome nearby is (the nearest four get a voice), with 0..1 loudness. */
  hissOthers(list: { pos: Pos; v: number }[]) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      const src = list[i];
      if (src) {
        this.place(v.panner, src.pos.x, src.pos.y + 0.7, src.pos.z);
        v.gain.gain.setTargetAtTime(0.22 * src.v, t, 0.06);
      } else v.gain.gain.setTargetAtTime(0, t, 0.06);
    }
  }

  /** Minimum gap per kind of sound per key, so a stream of hits is not a wall of noise. */
  private ready(key: string, gap: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    if (now - (this.lastAt.get(key) ?? -9) < gap) return false;
    this.lastAt.set(key, now);
    return true;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  /** Your own stream. */
  hiss(own: boolean) {
    if (!this.ctx) return;
    this.hissGain.gain.setTargetAtTime(own ? 0.22 : 0, this.ctx.currentTime, 0.04);
  }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0, at?: Pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(at ? this.makePanner(at.x, at.y, at.z) : this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A short burst of filtered noise, in the world if `at` is given. */
  private burst(dur: number, freq: number, q: number, vol: number, at?: Pos, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    g.connect(at ? this.makePanner(at.x, at.y, at.z) : this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  // --- a quiet generative trance: a 7-step arpeggio over a pulsing bass, through an echo ---------------------

  private musicOn = false;
  private nextStep = 0;
  private step = 0;
  private root = 38; // MIDI D2
  private lastBeat = -9;
  private delay!: DelayNode;
  /** Which silly mode the soundtrack is dressed up as. */
  mood: 'none' | 'disco' | 'goth' | 'turbo' | 'upside' | 'moon' | 'slippery' | 'inferno' = 'none';

  /** 0..1, jumps on each beat and fades: the visuals pulse with it. */
  get beat(): number {
    return this.ctx ? Math.exp(-(this.ctx.currentTime - this.lastBeat) * 5) : 0;
  }

  setMood(m: 'none' | 'disco' | 'goth' | 'turbo' | 'upside' | 'moon' | 'slippery' | 'inferno') {
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
    const bpm = this.mood === 'disco' ? 122 : this.mood === 'goth' ? 78 : this.mood === 'turbo' ? 156 : this.mood === 'inferno' ? 100 : this.mood === 'upside' ? 92 : this.mood === 'moon' ? 70 : this.mood === 'slippery' ? 132 : 108;
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
      if (this.mood === 'turbo') {
        // hardcore speed techno: a pounding kick, a driving saw bassline and a fast arpeggio
        if (s % 4 === 0) this.tone(160, 40, 0.13, 'sine', 0.34);
        if (s % 2 === 1) this.tone(8000, 6500, 0.03, 'square', 0.04);
        this.note(this.root + (s % 8 < 4 ? 0 : 3), t, 0.1, 'sawtooth', 0.1, 1100, false);
        if (s % 2 === 0) this.note(this.root + 24 + SCALE[(s * 5) % 7], t, 0.09, 'square', 0.05, 3600, true);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      if (this.mood === 'inferno') {
        // doom: down-tuned power chords and a heavy double-kick
        if (s % 8 === 0 || s % 8 === 3 || s % 8 === 6) {
          for (const iv of [0, 7, 12]) this.note(this.root + iv, t, 0.42, 'sawtooth', 0.1, 900, false);
        }
        if (s % 2 === 0) this.tone(120, 38, 0.1, 'sine', 0.3);
        if (s % 8 === 4) this.tone(220, 80, 0.12, 'square', 0.12);
        if (s % 32 === 0) this.note(this.root - 12, t, 3.2, 'sawtooth', 0.09, 300, true);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      if (this.mood === 'upside') {
        // a slow, creepy descending arpeggio over a low drone
        if (s % 2 === 0) this.note(this.root + 24 + SCALE[11 - (Math.floor(s / 2) % 12)], t, 0.4, 'triangle', 0.1, 1800, true);
        if (s % 32 === 0) this.note(this.root - 12, t, 3.2, 'sawtooth', 0.09, 400, true);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      if (this.mood === 'moon') {
        // wide, floaty and spacey
        if (s % 8 === 0) this.note(this.root + 24 + SCALE[(Math.floor(s / 8) * 3) % 7], t, 1.8, 'sine', 0.12, 3000, true);
        if (s % 16 === 0) this.note(this.root + 12, t, 3, 'sine', 0.1, 1200, true);
        this.nextStep += sixteenth;
        this.step = (this.step + 1) % 224;
        continue;
      }
      if (this.mood === 'slippery') {
        // quick, bouncy plucks
        if (s % 2 === 0) this.note(this.root + 24 + SCALE[(s * 3) % 7], t, 0.12, 'triangle', 0.12, 3200, true);
        if (s % 4 === 0) this.note(this.root, t, 0.2, 'sine', 0.2, 600, false);
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

  // --- sounds placed in the forest ---
  /** Somebody else got splashed. */
  hurtAt(p: Pos, id: number) {
    if (!this.ready('hurt' + id, 0.18)) return;
    this.burst(0.12, 1300, 1.2, 0.5, p);
    this.tone(260, 110, 0.12, 'square', 0.12, 0, p);
  }
  /** Somebody else went down. */
  popAt(p: Pos) {
    this.tone(520, 120, 0.3, 'triangle', 0.4, 0, p);
    this.burst(0.35, 600, 0.8, 0.5, p);
  }
  /** A footstep: `heavy` for Nathaniel's big boots. */
  stepAt(p: Pos, heavy = false) {
    if (!this.ready('step' + (heavy ? 'h' : Math.round(p.x / 6) + ',' + Math.round(p.z / 6)), heavy ? 0.1 : 0.05)) return;
    if (heavy) { this.burst(0.18, 140, 0.7, 1.2, p, 'lowpass'); this.tone(80, 40, 0.16, 'sine', 0.5, 0, p); }
    else this.burst(0.06, 500, 0.8, 0.28, p, 'lowpass');
  }
  /** A bug lets one go. */
  fartAt(p: Pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.7);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 28;
    const lg = this.ctx.createGain();
    lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    o.connect(lp).connect(g);
    g.connect(this.makePanner(p.x, p.y, p.z));
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.8);
    lfo.stop(t + 0.8);
    this.burst(0.5, 300, 0.6, 0.5, p);
  }
  /** Somebody else grabbed a potion or a bonus. */
  grabAt(p: Pos) {
    this.tone(660, 990, 0.12, 'square', 0.25, 0, p);
    this.tone(990, 1320, 0.12, 'square', 0.2, 0.09, p);
  }
  beep(high = false) { this.tone(high ? 880 : 520, high ? 880 : 520, 0.12, 'square', 0.14); }
  alarm() { this.tone(330, 330, 0.18, 'sawtooth', 0.12); this.tone(247, 247, 0.18, 'sawtooth', 0.12, 0.22); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.16, i * 0.13)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.96, 0.28, 'sawtooth', 0.14, i * 0.17)); }
}

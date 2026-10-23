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

  hurt() { this.tone(240, 90, 0.16, 'square', 0.18); }
  pop() { this.tone(520, 160, 0.12, 'triangle', 0.16); }
  beep(high = false) { this.tone(high ? 880 : 520, high ? 880 : 520, 0.12, 'square', 0.14); }
  alarm() { this.tone(330, 330, 0.18, 'sawtooth', 0.12); this.tone(247, 247, 0.18, 'sawtooth', 0.12, 0.22); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.16, i * 0.13)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.96, 0.28, 'sawtooth', 0.14, i * 0.17)); }
}

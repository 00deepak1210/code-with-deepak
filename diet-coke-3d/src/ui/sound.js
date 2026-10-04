// The sound of a can opening, synthesised with the Web Audio API: a short
// metallic click, a hiss of high-passed noise and a crackle of popping
// bubbles. Off by default; browsers only allow audio after a user gesture.
export class Fizz {
  constructor() {
    this.enabled = false;
    this.ctx = null;
  }

  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      if (!this.ctx) this.setup();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.crack(0.45);
    }
    return this.enabled;
  }

  setup() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    const rate = ctx.sampleRate;
    // White noise for the hiss
    this.noise = ctx.createBuffer(1, rate * 1.5, rate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

    // Sparse impulses that thin out over time: bubbles popping
    this.pops = ctx.createBuffer(1, rate * 1.8, rate);
    const p = this.pops.getChannelData(0);
    for (let i = 0; i < p.length; i++) {
      const life = 1 - i / p.length;
      if (Math.random() < 0.0035 * life * life) p[i] = (Math.random() * 0.7 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
    }
  }

  envelope(peak, attack, hold, release, t) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(peak * 0.25, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  play(buffer, filters, gain, t, duration) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    let node = src;
    for (const f of filters) node = node.connect(f);
    node.connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  filter(type, frequency, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  crack(intensity = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;

    // 1. The tab snapping the score line
    this.play(this.noise, [this.filter('bandpass', 1800, 6)], this.envelope(0.9 * intensity, 0.002, 0.012, 0.05, t), t, 0.1);

    // 2. Pssst: bright hiss that opens up as the pressure escapes
    const hiss = this.filter('highpass', 2600);
    hiss.frequency.setValueAtTime(2600, t + 0.02);
    hiss.frequency.exponentialRampToValueAtTime(5200, t + 0.7);
    const air = this.filter('peaking', 7000, 1);
    air.gain.value = 5;
    this.play(this.noise, [hiss, air], this.envelope(0.55 * intensity, 0.02, 0.22, 0.75, t + 0.02), t + 0.02, 1.1);

    // 3. Fizz: a crackle of tiny bubbles
    this.play(this.pops, [this.filter('highpass', 3200)], this.envelope(0.8 * intensity, 0.05, 0.6, 1.0, t + 0.1), t + 0.1, 1.8);
  }
}

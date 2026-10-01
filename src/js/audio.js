// Semua suara disintesis pakai Web Audio, nggak ada file rekaman.
export class Sound {
  constructor() { this.ac = null; this.on = true; }

  init() {
    if (this.ac) { if (this.ac.state === "suspended") this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = (this.ac = new AC());
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6;
    this.master = ac.createGain(); this.master.gain.value = 0.9;
    this.master.connect(comp); comp.connect(ac.destination);

    // gema ruangan
    this.echo = ac.createDelay(1); this.echo.delayTime.value = 0.11;
    const fb = ac.createGain(); fb.gain.value = 0.28;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(this.master);

    this.noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const ch = this.noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

    // "wush" kontinu, volumenya ngikut kecepatan ujung
    const src = ac.createBufferSource(); src.buffer = this.noise; src.loop = true;
    this.whooshFilt = ac.createBiquadFilter(); this.whooshFilt.type = "bandpass"; this.whooshFilt.Q.value = 1.2;
    this.whooshGain = ac.createGain(); this.whooshGain.gain.value = 0;
    src.connect(this.whooshFilt); this.whooshFilt.connect(this.whooshGain); this.whooshGain.connect(this.master);
    src.start();
  }

  whoosh(mach, pitch) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const w = this.on ? Math.min(0.35, Math.max(0, mach - 0.25) * 0.4) : 0;
    this.whooshGain.gain.setTargetAtTime(w, t, 0.03);
    this.whooshFilt.frequency.setTargetAtTime(300 + Math.min(1, mach) * 1400 * pitch, t, 0.05);
  }

  burst(t, type, freq, peak, decay, send) {
    const { ac } = this;
    const s = ac.createBufferSource(); s.buffer = this.noise;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f); f.connect(g); g.connect(this.master); if (send) g.connect(this.echo);
    s.start(t, Math.random()); s.stop(t + decay + 0.05);
  }

  // power = seberapa jauh lewat Mach 1
  crack(power, pitch) {
    if (!this.ac || !this.on) return;
    const { ac } = this, t = ac.currentTime, a = Math.min(1, 0.45 + power * 0.4);
    this.burst(t, "highpass", 2400 * pitch, a, 0.045 + 0.02 / pitch, true); // letupan sonic boom
    this.burst(t, "bandpass", 900 * pitch, a * 0.6, 0.09, true);           // badan
    this.burst(t + 0.004, "lowpass", 350 * pitch, a * 0.5, 0.16, false);   // dentum
    const o = ac.createOscillator(), og = ac.createGain();                 // klik tajam
    o.type = "square"; o.frequency.value = 3200 * pitch;
    og.gain.setValueAtTime(a * 0.25, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.01);
  }

  // kena si AI: "plak" + robot ngaduh
  thud() {
    if (!this.ac || !this.on) return;
    const { ac } = this, t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.25);
    [660, 440].forEach((fq, k) => {
      const q = ac.createOscillator(), qg = ac.createGain(), tt = t + 0.12 + k * 0.1;
      q.type = "square"; q.frequency.value = fq;
      qg.gain.setValueAtTime(0.0001, tt); qg.gain.exponentialRampToValueAtTime(0.08, tt + 0.01); qg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
      q.connect(qg); qg.connect(this.master); q.start(tt); q.stop(tt + 0.1);
    });
  }
}

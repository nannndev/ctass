// Semua suara disintesis pakai Web Audio, nggak ada file rekaman.
//
// Bunyi ctarr asli itu sonic boom kecil: gelombang tekanan berbentuk "N" yang
// cuma ~1 ms, disusul desis pecahan udara dan pantulan ruangan. Jadi di sini
// tiap crack dibikin dari:
//   1. N-wave super pendek  -> "tak" yang tajam
//   2. letupan noise ~3 ms  -> "ctt" yang kering
//   3. ekor desis ~20 ms    -> "rr" sisa udara
//   4. reverb ruangan       -> biar nggak kedengeran kayak klik doang
//   5. dentum rendah        -> badan, makin berat pecutnya makin kerasa
//   6. gema jauh + lapisan khas tiap varian (rumbai, denting, tsik dobel)
// Resepnya per varian ada di variants.js (field `sound`).
export class Sound {
  constructor() { this.ac = null; this.on = true; this.volume = 1; }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ac.currentTime, 0.02);
  }

  init() {
    if (this.ac) { if (this.ac.state === "suspended") this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = (this.ac = new AC());
    this.offline = typeof OfflineAudioContext !== "undefined" && ac instanceof OfflineAudioContext;

    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 8;
    comp.attack.value = 0.001; comp.release.value = 0.12;
    this.master = ac.createGain(); this.master.gain.value = this.volume;
    this.master.connect(comp); comp.connect(ac.destination);

    // reverb ruangan dari impulse response sintetis
    this.verb = ac.createConvolver();
    this.verb.buffer = roomImpulse(ac, 1.1, 0.2);
    this.wet = ac.createGain(); this.wet.gain.value = 1;
    this.verb.connect(this.wet); this.wet.connect(this.master);

    this.noise = noiseBuffer(ac, 2);
    this.cracks = new Map(); // resep -> 4 sampel ctarr
    if (this.pending) this.prepare(this.pending);
  }

  // bikin sampel ctarr duluan biar sentakan pertama nggak telat
  prepare(snd) { if (this.ac && snd) this.samples(snd); }

  samples(snd) {
    if (!this.cracks.has(snd)) this.cracks.set(snd, [0, 1, 2, 3].map(() => crackBuffer(this.ac, snd)));
    const list = this.cracks.get(snd);
    return list[(Math.random() * list.length) | 0];
  }

  // power = seberapa jauh lewat Mach 1, snd = resep suara varian, pan = -1 (kiri) .. 1 (kanan)
  crack(power, snd, pan = 0) {
    if (!this.ac || !this.on) return;
    // WebView kadang nidurin audio (jendela disembunyiin, laptop sleep): bangunin lagi
    if (this.ac.state === "suspended" && !this.offline) this.ac.resume();
    const { ac } = this, t = ac.currentTime;
    const a = Math.min(1.25, 0.75 + power * 0.6) * (snd.gain ?? 1);
    const out = this.panner(pan);
    const rate = snd.rate * (0.95 + Math.random() * 0.1);

    // gema jauh (lembah / arena), dibikin per crack terus dilepas lagi
    let send = null;
    if (snd.echo) {
      const [time, feedback, level] = snd.echo;
      const d = ac.createDelay(1.5); d.delayTime.value = time;
      const fb = ac.createGain(); fb.gain.value = feedback;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      const lv = ac.createGain(); lv.gain.value = level;
      d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(lv); lv.connect(out);
      send = d;
      setTimeout(() => { d.disconnect(); fb.disconnect(); }, (time / (1 - feedback)) * 4000 + 500);
    }

    const play = (at, gain) => {
      const s = ac.createBufferSource();
      s.buffer = this.samples(snd);
      s.playbackRate.value = rate;
      const g = ac.createGain(); g.gain.value = gain;
      const wet = ac.createGain(); wet.gain.value = snd.wet;
      s.connect(g); g.connect(out); g.connect(wet); wet.connect(this.verb);
      if (send) g.connect(send);
      s.start(at);
    };
    play(t, a);
    if (snd.extra === "double") play(t + 0.014 + Math.random() * 0.006, a * 0.6);

    // dentum
    const [f0, f1, dur, bodyGain] = snd.body;
    const body = ac.createOscillator(), bg = ac.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(f0, t);
    body.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.75);
    bg.gain.setValueAtTime(a * bodyGain, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    body.connect(bg); bg.connect(out);
    body.start(t); body.stop(t + dur + 0.02);

    if (snd.extra === "rustle") this.rustle(t + 0.008, out, a);
    if (snd.extra === "chime") this.chime(t + 0.004, out, a);
    if (snd.extra === "swish") this.sweep(t, out, a * 0.55, "bandpass", 3600, 1100, 0.17, 1.2);
    if (snd.extra === "flame") this.sweep(t + 0.01, out, a * 0.5, "lowpass", 380, 2800, 0.32, 0.7);
    if (snd.extra === "slap") this.sweep(t, out, a * 0.8, "lowpass", 2200, 900, 0.045, 0.7);
    if (snd.extra === "zap") this.zap(t, out, a);
  }

  // noise yang filternya digeser: srak (sapu lidi), fwoosh (api), plak (sabuk)
  sweep(t, out, a, type, f0, f1, dur, q) {
    const { ac } = this;
    const n = ac.createBufferSource(); n.buffer = this.noise;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(out); g.connect(this.verb);
    n.start(t, Math.random()); n.stop(t + dur + 0.02);
  }

  // dengung listrik kabel charger
  zap(t, out, a) {
    const { ac } = this;
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.16);
    f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 1.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * a, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.2);
    this.sweep(t, out, a * 0.3, "highpass", 6000, 4000, 0.05, 0.7);
  }

  // desir rumbai jaranan yang ikut kibas
  rustle(t, out, a) {
    const { ac } = this;
    const n = ac.createBufferSource(); n.buffer = this.noise;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 4200; f.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * a, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(out);
    n.start(t, Math.random()); n.stop(t + 0.18);
  }

  // denting gaib Samandiman: beberapa nada nggak harmonis yang memudar pelan
  chime(t, out, a) {
    const { ac } = this;
    [1318, 1976, 2637, 3520].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f * (0.985 + Math.random() * 0.03);
      const tt = t + i * 0.018, len = 0.9 + Math.random() * 0.6;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.09 * a, tt + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
      o.connect(g); g.connect(out); g.connect(this.verb);
      o.start(tt); o.stop(tt + len + 0.05);
    });
  }

  // kena si AI: tamparan + "aduh" kecil
  thud(pan = 0) {
    if (!this.ac || !this.on) return;
    const { ac } = this, t = ac.currentTime, out = this.panner(pan);
    const n = ac.createBufferSource(); n.buffer = this.noise;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 0.8;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.9, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(f); f.connect(ng); ng.connect(out); ng.connect(this.verb);
    n.start(t, Math.random()); n.stop(t + 0.06);

    const o = ac.createOscillator(), og = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.15);

    [880, 587].forEach((fq, k) => {
      const q = ac.createOscillator(), qg = ac.createGain(), tt = t + 0.1 + k * 0.09;
      q.type = "triangle"; q.frequency.value = fq;
      qg.gain.setValueAtTime(0.0001, tt); qg.gain.exponentialRampToValueAtTime(0.12, tt + 0.01); qg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08);
      q.connect(qg); qg.connect(out); q.start(tt); q.stop(tt + 0.09);
    });
  }

  panner(pan) {
    if (!this.ac.createStereoPanner) return this.master;
    const p = this.ac.createStereoPanner();
    p.pan.value = clamp(pan, -0.8, 0.8);
    p.connect(this.master);
    return p;
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function noiseBuffer(ac, seconds) {
  const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Satu sampel ctarr sesuai resep varian. Tiap panggilan sedikit beda biar nggak monoton.
function crackBuffer(ac, snd) {
  const sr = ac.sampleRate, len = Math.floor(sr * Math.max(0.14, snd.tail * 6));
  const b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
  const jit = () => 0.8 + Math.random() * 0.4;
  const nDur = snd.nDur * jit(), snap = snd.snap * jit(), tail = snd.tail * jit();
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr, r = Math.random() * 2 - 1;
    const n = t < nDur ? 1 - (2 * t) / nDur : 0;
    lp += 0.45 * (r - lp); // desis agak dilembutin
    d[i] = n + r * Math.exp(-t / snap) * 0.85 + lp * Math.exp(-t / tail) * snd.tailLevel;
  }
  // buang DC biar nggak "dug" aneh di speaker, terus normalisasi
  let prevX = 0, y = 0, peak = 0;
  for (let i = 0; i < len; i++) { const x = d[i]; y = 0.996 * (y + x - prevX); prevX = x; d[i] = y; peak = Math.max(peak, Math.abs(y)); }
  for (let i = 0; i < len; i++) d[i] /= peak || 1;
  return b;
}

function roomImpulse(ac, seconds, decay) {
  const sr = ac.sampleRate, len = Math.floor(sr * seconds);
  const b = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const early = t < 0.012 ? t / 0.012 : 1;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t / decay) * early;
    }
  }
  return b;
}

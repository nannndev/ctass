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
export class Sound {
  constructor() { this.ac = null; this.on = true; }

  init() {
    if (this.ac) { if (this.ac.state === "suspended") this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = (this.ac = new AC());

    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 8;
    comp.attack.value = 0.001; comp.release.value = 0.12;
    this.master = ac.createGain(); this.master.gain.value = 1;
    this.master.connect(comp); comp.connect(ac.destination);

    // reverb ruangan dari impulse response sintetis
    this.verb = ac.createConvolver();
    this.verb.buffer = roomImpulse(ac, 1.1, 0.2);
    this.wet = ac.createGain(); this.wet.gain.value = 0.32;
    this.verb.connect(this.wet); this.wet.connect(this.master);

    this.noise = noiseBuffer(ac, 2);
    this.cracks = [0, 1, 2, 3].map(() => crackBuffer(ac));

  }

  // power = seberapa jauh lewat Mach 1, pan = -1 (kiri) .. 1 (kanan)
  crack(power, pitch, pan = 0) {
    if (!this.ac || !this.on) return;
    const { ac } = this, t = ac.currentTime;
    const a = Math.min(1.25, 0.75 + power * 0.6);
    const out = this.panner(pan);

    const s = ac.createBufferSource();
    s.buffer = this.cracks[(Math.random() * this.cracks.length) | 0];
    s.playbackRate.value = pitch * (0.94 + Math.random() * 0.12);
    const g = ac.createGain(); g.gain.value = a * (0.7 + 0.5 * pitch); // nada tinggi lebih tipis, jadi dikompensasi
    s.connect(g); g.connect(out); g.connect(this.verb);
    s.start(t);

    // dentum: pecut berat (pitch rendah) lebih kerasa badannya
    const body = ac.createOscillator(), bg = ac.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(160 * pitch, t);
    body.frequency.exponentialRampToValueAtTime(55 * pitch, t + 0.06);
    bg.gain.setValueAtTime(a * (0.55 / pitch), t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    body.connect(bg); bg.connect(out);
    body.start(t); body.stop(t + 0.1);
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

// Satu sampel ctarr. Tiap panggilan sedikit beda biar nggak monoton.
function crackBuffer(ac) {
  const sr = ac.sampleRate, len = Math.floor(sr * 0.14);
  const b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
  const nDur = 0.0009 + Math.random() * 0.0006;  // N-wave ~1 ms
  const snap = 0.0022 + Math.random() * 0.001;   // letupan
  const tail = 0.016 + Math.random() * 0.008;    // desis
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr, r = Math.random() * 2 - 1;
    const n = t < nDur ? 1 - (2 * t) / nDur : 0;
    lp += 0.45 * (r - lp); // desis agak dilembutin
    d[i] = n + r * Math.exp(-t / snap) * 0.85 + lp * Math.exp(-t / tail) * 0.35;
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

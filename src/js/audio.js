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
  constructor() {
    this.ac = null; this.on = true; this.volume = 1;
    this.files = new Map(); this.fileData = new Map(); this.decoding = new Map();
  }

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
    for (const [id, data] of this.fileData) this.decode(id, data);
    if (this.pending) this.prepare(this.pending);
  }

  // ---------- suara sendiri (file audio dari user) ----------
  // data = ArrayBuffer isi file. Didecode sekali, disimpan per id.
  addFile(id, data) {
    if (this.files.has(id) || this.fileData.has(id)) return this.decoding.get(id) || Promise.resolve(this.files.get(id));
    this.fileData.set(id, data);
    return this.ac ? this.decode(id, data) : Promise.resolve(null);
  }
  decode(id, data) {
    const p = new Promise((ok, bad) => this.ac.decodeAudioData(data.slice(0), ok, bad))
      .then((buf) => { this.files.set(id, buf); this.fileData.delete(id); this.decoding.delete(id); return buf; })
      .catch((e) => { console.warn("file suara nggak bisa dibaca", e); this.fileData.delete(id); this.decoding.delete(id); return null; });
    this.decoding.set(id, p);
    return p;
  }
  file(id) { return this.files.get(id) || null; }

  // bikin sampel ctarr duluan biar sentakan pertama nggak telat
  prepare(snd) { if (this.ac && snd) this.samples(snd); }

  samples(snd) {
    // kuncinya bentuk suaranya aja, jadi geser slider gema/nada nggak bikin sampel baru
    const key = `${snd.nDur}|${snd.snap}|${snd.tail}|${snd.tailLevel}`;
    if (!this.cracks.has(key)) this.cracks.set(key, [0, 1, 2, 3].map(() => crackBuffer(this.ac, snd)));
    const list = this.cracks.get(key);
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
    const rate = snd.rate * (snd.pitch ?? 1) * (0.95 + Math.random() * 0.1);

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

    const route = (s, gain) => {
      const g = ac.createGain(); g.gain.value = gain;
      const wet = ac.createGain(); wet.gain.value = snd.wet;
      s.connect(g); g.connect(out); g.connect(wet); wet.connect(this.verb);
      if (send) g.connect(send);
      return g;
    };

    // suara sendiri: mainin potongan file-nya (awal-akhir yang dipilih di editor)
    const fb = snd.file && this.files.get(snd.file.id);
    if (fb) {
      const s = ac.createBufferSource();
      s.buffer = fb;
      s.playbackRate.value = (snd.file.rate ?? 1) * (snd.pitch ?? 1);
      const start = clamp(snd.file.start ?? 0, 0, fb.duration);
      const end = clamp(snd.file.end ?? fb.duration, start + 0.01, fb.duration);
      route(s, a * (snd.file.gain ?? 1));
      s.start(t, start, end - start);
      return;
    }

    const play = (at, gain) => {
      const s = ac.createBufferSource();
      s.buffer = this.samples(snd);
      s.playbackRate.value = rate;
      route(s, gain);
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
    if (snd.extra === "laser") this.laser(t, out, a);
    if (snd.extra && this[FUTURE[snd.extra]]) this[FUTURE[snd.extra]](t, out, a);
  }

  // ---------- lapisan pecut futuristik ----------
  tone(t, out, type, f0, f1, dur, lv, verb) {
    const { ac } = this, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(lv, t + Math.min(0.006, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); if (verb) g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // hologram: blip digital acak + desis yang putus-putus
  glitch(t, out, a) {
    for (let k = 0; k < 6; k++) {
      const tt = t + k * 0.017 + Math.random() * 0.008, f = 200 + Math.random() * 1800;
      this.tone(tt, out, "square", f, f * (0.6 + Math.random() * 0.8), 0.014, 0.12 * a);
    }
    this.sweep(t, out, a * 0.3, "bandpass", 3200, 700, 0.09, 4);
  }
  // logam cair: denting nggak harmonis yang bergaung
  metal(t, out, a) {
    [700, 1873, 2950, 4330].forEach((f, i) => this.tone(t + i * 0.004, out, "sine", f * (0.97 + Math.random() * 0.06), f * 0.995, 0.5 + Math.random() * 0.4, 0.07 * a, true));
    this.sweep(t, out, a * 0.35, "highpass", 5000, 2500, 0.06, 0.8);
  }
  // rantai: gemerincing beberapa mata rantai + dengung energi
  chain(t, out, a) {
    let tt = t + 0.008;
    for (let k = 0; k < 5; k++) {
      const f = 2500 + Math.random() * 2600;
      this.sweep(tt, out, a * (0.25 + Math.random() * 0.25), "bandpass", f, f * 0.9, 0.035, 9);
      tt += 0.014 + Math.random() * 0.024;
    }
    const { ac } = this, o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth"; o.frequency.value = 85;
    lp.type = "lowpass"; lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 * a, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
  }
  // tesla: kretek-kretek listrik yang nyebar
  crackle(t, out, a) {
    for (let k = 0; k < 12; k++) this.sweep(t + Math.random() * 0.26, out, a * (0.15 + Math.random() * 0.35), "highpass", 2400, 2000, 0.007, 0.7);
    this.zap(t, out, a * 0.6);
  }
  // lubang hitam: bass turun dalem + desir yang nyedot
  void(t, out, a) {
    this.tone(t, out, "sine", 82, 26, 0.6, 0.9 * a);
    const { ac } = this, n = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = this.noise;
    lp.type = "lowpass"; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(70, t + 0.55);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4 * a, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    n.connect(lp); lp.connect(g); g.connect(out); g.connect(this.verb);
    n.start(t, Math.random()); n.stop(t + 0.62);
  }
  // fiber: arpeggio naik cepet, kinclong
  arp(t, out, a) {
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(t + i * 0.035, out, "triangle", f, f, 0.14, 0.12 * a, true));
  }
  // robot: dengung servo naik + hentakan logam
  servo(t, out, a) {
    const { ac } = this, o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.12);
    bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(bp); bp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
    this.tone(t + 0.11, out, "sine", 130, 48, 0.12, 0.6 * a);
    this.sweep(t + 0.11, out, a * 0.5, "lowpass", 1800, 500, 0.05, 0.7);
  }

  // dengung plasma: nada turun cepet + desis tinggi
  laser(t, out, a) {
    const { ac } = this;
    [[1900, 180, 0.16, "sine", 0.3], [950, 120, 0.2, "square", 0.06]].forEach(([f0, f1, dur, type, lv]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lv * a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); g.connect(this.verb);
      o.start(t); o.stop(t + dur + 0.02);
    });
    this.sweep(t, out, a * 0.25, "highpass", 7000, 3000, 0.08, 0.7);
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
// nama extra -> method (pecut futuristik)
const FUTURE = { glitch: "glitch", metal: "metal", chain: "chain", crackle: "crackle", void: "void", arp: "arp", servo: "servo" };

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

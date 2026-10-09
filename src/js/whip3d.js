// Gambar pecut versi 3D pakai Three.js. Cuma dimuat kalau tampilan 3D dinyalain.
// Fisikanya tetap dari physics.js (titik x, y, z), di sini cuma digambar:
//   tali kepang  -> tabung meruncing + tekstur anyaman (jaranan, sapi, bullwhip, cemeti, ...)
//   sapu lidi    -> beberapa lidi tipis yang mekar ke ujung (juga ke depan/belakang)
//   kabel        -> tabung plastik mulus + colokan di ujung
//   sabuk        -> tabung pipih + jahitan + gesper logam
//   nyala        -> pendar (samandiman, api, plasma), plasma punya inti terang
// Hasil render dibalikin sebagai canvas, terus ditempel stage.js ke canvas 2D-nya
// (jadi efek ctarr, tulisan, guncangan tetap nyatu).
import * as T from "./vendor/three.min.js";

const RAD = 10; // sisi lingkaran tabung
const SUB = 3;  // titik halus per segmen tali
const HANDLE_PTS = 10; // titik di sepanjang gagang
const TASSEL = ["#d63a2a", "#f2c23a", "#2f8f4e", "#d63a2a"];

export function createWhip3D() {
  const canvas = document.createElement("canvas");
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    return null; // WebGL nggak ada: balik ke 2D
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.autoClear = false;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 1, 10000);
  const hemi = new T.HemisphereLight(0xfff1e0, 0x3a3028, 1.9);
  const keyLight = new T.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(-0.6, 1, 1.1);
  const rimLight = new T.DirectionalLight(0xffd6a0, 1.1);
  rimLight.position.set(0.9, -0.4, -0.5);
  scene.add(hemi, keyLight, rimLight);

  const group = new T.Group();
  scene.add(group);
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });

  let W = 0, H = 0, sig = "", parts = null;

  function resize(w, h, dpr) {
    W = w; H = h;
    renderer.setPixelRatio(Math.min(dpr || 1, 1.5)); // biar ringan di layar retina
    renderer.setSize(w, h, false);
    // kamera dipasang biar bidang z = 0 pas 1:1 sama piksel layar
    const D = (h / 2) / Math.tan((camera.fov / 2) * Math.PI / 180);
    camera.aspect = w / h;
    camera.near = D * 0.2; camera.far = D * 3;
    camera.position.set(w / 2, -h / 2, D);
    camera.lookAt(w / 2, -h / 2, 0);
    camera.updateProjectionMatrix();
  }

  function setTheme(t) {
    const future = t === "future";
    hemi.color.set(future ? 0xcff6ff : 0xfff1e0);
    hemi.groundColor.set(future ? 0x1a0f2e : 0x3a3028);
    rimLight.color.set(future ? 0x4de3ff : 0xffd6a0);
    rimLight.intensity = future ? 2.2 : 1.1;
    shadowMat.color.set(future ? 0x001018 : 0x000000);
  }

  // ---------- bikin bagian-bagian pecut sesuai jenisnya ----------
  function build(v) {
    if (parts) { group.clear(); parts.dispose.forEach((d) => d.dispose()); }
    const dispose = [];
    const keep = (x) => (dispose.push(x), x);
    const kind = v.robot ? "robot" : v.chain ? "chain" : v.holo ? "holo" : v.chrome ? "chrome" : v.void ? "void"
      : v.fiber ? "fiber" : v.arcs ? "rubber" : v.strands ? "straw" : v.plug ? "plastic" : v.flat ? "leather" : v.core ? "plasma" : "braid";
    const glow = typeof v.glow === "string" ? v.glow : v.glow ? "#ffd36b" : v.arcs || null;
    const matcap = () => { const t = keep(makeTexture(128, 128)); paintMatcap(t); return t.tex; };

    // tali
    let ropeMat;
    if (kind === "braid") {
      const tex = keep(makeTexture(64, 64)); paintBraid(tex, v.rope);
      ropeMat = new T.MeshStandardMaterial({ map: tex.tex, bumpMap: tex.tex, bumpScale: 1.6, roughness: 0.48, metalness: 0.06, side: T.DoubleSide });
    } else if (kind === "leather") {
      const tex = keep(makeTexture(64, 64)); paintLeather(tex, v.rope);
      ropeMat = new T.MeshStandardMaterial({ map: tex.tex, roughness: 0.42, metalness: 0.05, side: T.DoubleSide });
    } else if (kind === "plastic") {
      ropeMat = new T.MeshStandardMaterial({ color: v.rope, roughness: 0.32, metalness: 0, side: T.DoubleSide });
    } else if (kind === "plasma") {
      ropeMat = new T.MeshStandardMaterial({ color: v.core, emissive: v.rope, emissiveIntensity: 1.4, roughness: 0.2, side: T.DoubleSide });
    } else if (kind === "holo") {
      ropeMat = new T.MeshStandardMaterial({ color: v.rope, emissive: v.rope, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide });
    } else if (kind === "chrome") {
      ropeMat = new T.MeshMatcapMaterial({ matcap: matcap(), color: v.rope, side: T.DoubleSide });
    } else if (kind === "void") {
      ropeMat = new T.MeshStandardMaterial({ color: 0x05030a, roughness: 0.25, metalness: 0.3, emissive: glow, emissiveIntensity: 0.04, side: T.DoubleSide });
    } else if (kind === "fiber") {
      ropeMat = new T.MeshStandardMaterial({ color: v.rope, emissive: 0x9fdcff, emissiveIntensity: 0.25, roughness: 0.08, transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide });
    } else if (kind === "rubber") {
      ropeMat = new T.MeshStandardMaterial({ color: v.rope, roughness: 0.55, metalness: 0.1, side: T.DoubleSide });
    } else {
      ropeMat = new T.MeshStandardMaterial({ color: v.rope, roughness: 0.75, metalness: 0, side: T.DoubleSide });
    }
    if (glow && kind === "braid") { ropeMat.emissive = new T.Color(glow); ropeMat.emissiveIntensity = v.fire ? 0.55 : 0.35; }
    keep(ropeMat);

    const tubes = [];
    const count = kind === "chain" || kind === "robot" ? 0 : v.strands || 1;
    for (let k = 0; k < count; k++) tubes.push(new Tube(group, ropeMat, v.strands ? 6 : RAD, v.flat ? 0.24 : 1, kind === "leather" ? 0.12 : 0.34));
    dispose.push(...tubes);

    // pendar: tabung lebih gede, tembus pandang, warnanya ditambahin
    let halo = null;
    if (glow) {
      const op = kind === "plasma" ? 0.28 : kind === "void" ? 0.14 : kind === "rubber" ? 0.1 : 0.2;
      // cuma sisi dalam tabung yang digambar (urutan segitiga Tube ngadep ke dalam), jadi yang keliatan
      // cuma bagian belakang pendar: inti tali tetap keliatan, pendarnya jadi aura di pinggir
      const m = keep(new T.MeshBasicMaterial({ color: glow, transparent: true, opacity: op * 1.6, blending: T.AdditiveBlending, depthWrite: false, side: T.FrontSide }));
      halo = new Tube(group, m, 8, 1, 1);
      dispose.push(halo);
    }

    // rumbai di pangkal gagang (jaranan, samandiman)
    const tassels = v.tassel ? TASSEL.map((c) => new Tube(group, keep(new T.MeshStandardMaterial({ color: c, roughness: 0.8, side: T.DoubleSide })), 5, 1, 1)) : [];
    dispose.push(...tassels);

    // gagang
    let gripMat;
    if (kind === "plasma" || kind === "robot" || kind === "chain") gripMat = new T.MeshStandardMaterial({ color: v.grip, roughness: 0.3, metalness: 0.8 });
    else if (kind === "chrome") gripMat = new T.MeshMatcapMaterial({ matcap: matcap(), color: v.grip });
    else if (kind === "rubber") gripMat = new T.MeshStandardMaterial({ color: v.grip, roughness: 0.3, metalness: 0.75 }); // gulungan tembaga
    else if (kind === "plastic") gripMat = new T.MeshStandardMaterial({ color: v.grip, roughness: 0.35 });
    else {
      const tex = keep(makeTexture(32, 64)); paintGrip(tex, v.grip);
      gripMat = new T.MeshStandardMaterial({ map: tex.tex, bumpMap: tex.tex, bumpScale: 2, roughness: 0.5, metalness: 0.05 });
    }
    gripMat.side = T.DoubleSide; // gagang = Tube, segitiganya ngadep ke dalam
    keep(gripMat);
    // gagang = tabung sepanjang kurva (bisa melengkung kalau gagangnya lentur)
    const handle = new Tube(group, gripMat, 18, 1, 1 / (HANDLE_PTS - 1));
    dispose.push(handle);
    const knob = new T.Mesh(keep(new T.SphereGeometry(1, 18, 12)), gripMat);
    const neon = kind === "plasma" ? v.rope : kind === "holo" || kind === "void" ? glow : kind === "chain" ? v.chain : kind === "rubber" ? v.arcs : null;
    const collarMat = keep(neon
      ? new T.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 1.2 })
      : new T.MeshStandardMaterial({ color: 0xb8925c, roughness: 0.3, metalness: 0.7 }));
    const collar = new T.Mesh(keep(new T.CylinderGeometry(1, 1, 1, 18, 1)), collarMat);
    group.add(knob, collar);
    if (kind === "plastic") knob.visible = false;

    // ujung
    let tip = null;
    if (v.plug) {
      tip = new T.Group();
      const body = new T.Mesh(keep(new T.BoxGeometry(13, 8, 6)), keep(new T.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.35 })));
      body.position.x = 6.5;
      const pin = new T.Mesh(keep(new T.BoxGeometry(6, 5, 2)), keep(new T.MeshStandardMaterial({ color: 0xa9a9a6, roughness: 0.25, metalness: 0.9 })));
      pin.position.x = 16;
      tip.add(body, pin);
    } else if (v.buckle) {
      tip = new T.Group();
      const metal = keep(new T.MeshStandardMaterial({ color: 0xc9a54a, roughness: 0.28, metalness: 0.95 }));
      const frame = new T.Mesh(keep(new T.TorusGeometry(9, 1.6, 6, 4)), metal);
      frame.rotation.z = Math.PI / 4; frame.scale.set(0.85, 1.15, 1); frame.position.x = 8;
      const bar = new T.Mesh(keep(new T.BoxGeometry(2, 14, 2)), metal);
      bar.position.x = 4;
      tip.add(frame, bar);
    } else if (kind === "void") {
      // cakram cahaya muter + inti hitam
      tip = new T.Group();
      const disk = new T.Mesh(keep(new T.TorusGeometry(11, 2.4, 8, 40)), keep(new T.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })));
      const rim = new T.Mesh(keep(new T.TorusGeometry(15, 0.9, 6, 40)), keep(new T.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })));
      const core = new T.Mesh(keep(new T.SphereGeometry(5.5, 16, 12)), keep(new T.MeshBasicMaterial({ color: 0x000000 })));
      tip.add(disk, rim, core);
    } else if (kind === "robot") {
      // capit dua jari
      tip = new T.Group();
      const m = keep(new T.MeshStandardMaterial({ color: 0xc9d1da, roughness: 0.3, metalness: 0.85 }));
      const g = keep(new T.BoxGeometry(14, 3, 4));
      for (const sgn of [-1, 1]) { const f = new T.Mesh(g, m); f.position.set(7, sgn * 4, 0); f.rotation.z = sgn * 0.45; tip.add(f); }
    } else if (!v.strands && kind !== "fiber" && kind !== "chain") {
      tip = new T.Mesh(keep(new T.ConeGeometry(1, 1, 8, 1)), keep(new T.MeshStandardMaterial({ color: kind === "plasma" ? v.core : 0xefe6d6, roughness: 0.8, emissive: kind === "plasma" ? v.rope : 0x000000 })));
    }
    if (tip) group.add(tip);

    // rantai: mata rantai (instanced) + titik energi di tiap sambungan
    let links = null, joints = null;
    if (kind === "chain") {
      links = new T.InstancedMesh(keep(new T.TorusGeometry(1, 0.3, 6, 14)), keep(new T.MeshMatcapMaterial({ matcap: matcap(), color: v.rope })), 160);
      joints = new T.InstancedMesh(keep(new T.SphereGeometry(1, 8, 6)), keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false })), 80);
      group.add(links, joints);
    }
    // robot: ruas kotak + engsel silinder
    if (kind === "robot") {
      links = new T.InstancedMesh(keep(new T.BoxGeometry(1, 1, 1)), keep(new T.MeshStandardMaterial({ color: v.rope, roughness: 0.32, metalness: 0.75 })), 40);
      joints = new T.InstancedMesh(keep(new T.CylinderGeometry(1, 1, 1, 16)), keep(new T.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.4, metalness: 0.6 })), 40);
      group.add(links, joints);
    }
    for (const o of group.children) o.frustumCulled = false;

    parts = { kind, tubes, halo, tassels, handle, knob, collar, tip, links, joints, dispose };
  }

  const up = new T.Vector3(0, 1, 0), xAxis = new T.Vector3(1, 0, 0), tmp = new T.Vector3();

  // taruh silinder dari a ke b (koordinat Three)
  function place(mesh, ax, ay, az, bx, by, bz, r) {
    tmp.set(bx - ax, by - ay, bz - az);
    const len = tmp.length() || 1e-3;
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.quaternion.setFromUnitVectors(up, tmp.multiplyScalar(1 / len));
    mesh.scale.set(r, len, r);
  }

  const line = { px: null, py: null, pz: null, M: 0 };
  const fr = { nx: null, ny: null, nz: null, bx: null, by: null, bz: null };

  // whip = Whip dari physics.js, base = pangkal gagang (posisi tangan)
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), Q2 = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3(), C3 = new T.Color();
  function render(whip, base, v, S, clock = 0, sinceCrack = 99) {
    if (!W || !H) return canvas;
    const key = [v.rope, v.grip, v.strands, v.flat, v.plug, v.glow, v.tassel, v.core, v.fire, v.holo, v.chrome, v.chain, v.arcs, v.void, v.fiber, v.robot].join("|");
    if (key !== sig) { sig = key; build(v); }

    const n = whip.n, M = (n - 1) * SUB + 1;
    smoothLine(whip, M);
    const { px, py, pz } = line;
    const P = parts, w0 = v.w0, w1 = v.w1;
    const ripple = v.chrome ? (f) => 1 + 0.22 * Math.sin(f * 18 - clock * 9) : () => 1;
    const radius = (f) => Math.max(0.55, (w0 + (w1 - w0) * Math.pow(f, 0.7)) * (v.flat ? 0.55 : 0.72) * ripple(f));

    if (v.strands) {
      // tiap lidi = garis tengah yang digeser ke samping (di bidang layar) + dikit ke depan/belakang
      frames(px, py, pz, M);
      const m = v.strands, spread = v.spread * S * v.len;
      P.tubes.forEach((tube, k) => {
        const side = (k - (m - 1) / 2) / ((m - 1) / 2), depth = ((k % 3) - 1) * 0.7;
        tube.ensure(M);
        const sx = tube.cx, sy = tube.cy, sz = tube.cz;
        for (let i = 0; i < M; i++) {
          const f = i / (M - 1), off = side * spread * f * f + side * 2, oz = depth * spread * f * f;
          sx[i] = px[i] + fr.nx[i] * off + fr.bx[i] * oz;
          sy[i] = py[i] + fr.ny[i] * off + fr.by[i] * oz;
          sz[i] = pz[i] + fr.nz[i] * off + fr.bz[i] * oz;
        }
        const rr = (k % 2 ? w1 + 0.4 : w0) * 0.55;
        tube.update(sx, sy, sz, M, () => rr);
      });
    } else if (P.tubes[0]) {
      P.tubes[0].update(px, py, pz, M, radius);
    }
    if (P.kind === "holo") P.tubes[0].mat.opacity = 0.42 + 0.22 * Math.sin(clock * 23) * Math.sin(clock * 7.3);

    if (P.kind === "chain") {
      // mata rantai ditaruh tiap `step` px sepanjang garis, gantian diputer 90° biar nyambung
      const r = w0 * 0.55, step = r * 2.1;
      let acc = 0, k = 0;
      for (let i = 1; i < M && k < 160; i++) {
        const dx = px[i] - px[i - 1], dy = py[i] - py[i - 1], dz = pz[i] - pz[i - 1], d = Math.hypot(dx, dy, dz) || 1e-3;
        acc += d;
        while (acc >= step && k < 160) {
          acc -= step;
          const f = 1 - acc / d;
          V.set(px[i - 1] + dx * f, py[i - 1] + dy * f, pz[i - 1] + dz * f);
          Q.setFromUnitVectors(xAxis, tmp.set(dx / d, dy / d, dz / d));
          Q2.setFromAxisAngle(tmp, k % 2 ? Math.PI / 2 : 0);
          Q.premultiply(Q2);
          SC.set(r * 1.25, r * 0.8, r * 0.8);
          P.links.setMatrixAt(k++, M4.compose(V, Q, SC));
        }
      }
      P.links.count = k; P.links.instanceMatrix.needsUpdate = true;
      const wave = sinceCrack * 2.6;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1), pulse = Math.exp(-((f - wave) ** 2) * 30);
        V.set(whip.x[i], -whip.y[i], whip.z[i]); Q.identity(); SC.setScalar(1.6 + pulse * 2.6);
        P.joints.setMatrixAt(i, M4.compose(V, Q, SC));
        P.joints.setColorAt(i, C3.set(v.chain).multiplyScalar(0.45 + pulse * 1.4));
      }
      P.joints.count = n; P.joints.instanceMatrix.needsUpdate = true;
      if (P.joints.instanceColor) P.joints.instanceColor.needsUpdate = true;
    }
    if (P.kind === "robot") {
      // ruas langsung dari titik fisika (nggak dihalusin, biar kaku kayak mesin)
      for (let i = 0; i < n - 1; i++) {
        const ax = whip.x[i], ay = -whip.y[i], az = whip.z[i], bx = whip.x[i + 1], by = -whip.y[i + 1], bz = whip.z[i + 1];
        const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz) || 1e-3, w = w0 + (w1 - w0) * (i / (n - 1));
        V.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
        Q.setFromUnitVectors(xAxis, tmp.set(dx / d, dy / d, dz / d));
        SC.set(d * 0.9, w, w * 0.8);
        P.links.setMatrixAt(i, M4.compose(V, Q, SC));
      }
      for (let i = 0; i < n; i++) {
        const w = w0 + (w1 - w0) * (i / (n - 1));
        V.set(whip.x[i], -whip.y[i], whip.z[i]);
        Q.setFromAxisAngle(xAxis, Math.PI / 2); // poros engsel ngadep kamera
        SC.set(w * 0.62, w * 1.1, w * 0.62);
        P.joints.setMatrixAt(i, M4.compose(V, Q, SC));
      }
      P.links.count = n - 1; P.joints.count = n;
      P.links.instanceMatrix.needsUpdate = true; P.joints.instanceMatrix.needsUpdate = true;
    }
    if (P.halo) P.halo.update(px, py, pz, M, (f) => radius(f) * 2.4 + 2);

    // gagang: kurva Bezier dari tangan ke titik 0 tali, titik kontrolnya dari physics.js
    const { x, y, z } = whip;
    const hr = v.plug ? Math.max(3, S * 0.006) : Math.max(5.5, S * 0.012);
    const ax = base.x, ay = -base.y, az = base.z || 0, hx = x[0], hy = -y[0], hz = z[0];
    const qx = whip.cx ?? (ax + hx) / 2, qy = whip.cy != null ? -whip.cy : (ay + hy) / 2, qz = whip.cz ?? (az + hz) / 2;
    const hb = P.handle.ensure(HANDLE_PTS);
    for (let j = 0; j < HANDLE_PTS; j++) {
      const f = j / (HANDLE_PTS - 1), g = 1 - f;
      hb.cx[j] = g * g * ax + 2 * g * f * qx + f * f * hx;
      hb.cy[j] = g * g * ay + 2 * g * f * qy + f * f * hy;
      hb.cz[j] = g * g * az + 2 * g * f * qz + f * f * hz;
    }
    hb.update(hb.cx, hb.cy, hb.cz, HANDLE_PTS, (f) => hr * (0.82 + 0.18 * f));
    P.knob.position.set(ax, ay, az); P.knob.scale.setScalar(hr * 1.25);
    // kerah ngikut arah ujung kurva gagang
    const ux = hx - qx, uy = hy - qy, uz = hz - qz, ul = Math.hypot(ux, uy, uz) || 1;
    place(P.collar, hx - (ux / ul) * 4, hy - (uy / ul) * 4, hz - (uz / ul) * 4, hx + (ux / ul) * 2, hy + (uy / ul) * 2, hz + (uz / ul) * 2, hr * 0.9);

    // rumbai: kibas dari pangkal gagang, ngarah ke belakang gagang + jatuh kena gravitasi
    P.tassels.forEach((tube, i) => {
      const a = Math.atan2(-(qy - ay), qx - ax) + Math.PI + (i - 1.5) * 0.35 + Math.sin(clock * 3.3 + i) * 0.1;
      const K = 6; tube.ensure(K);
      const sx = tube.cx, sy = tube.cy, sz = tube.cz;
      for (let j = 0; j < K; j++) {
        const t = j / (K - 1);
        sx[j] = ax + Math.cos(a) * 26 * t;
        sy[j] = ay - (Math.sin(a) * 26 * t + 22 * t * t);
        sz[j] = az + (i - 1.5) * 3 * t;
      }
      tube.update(sx, sy, sz, K, (f) => 1.6 - f * 0.6);
    });

    // ujung: cracker / colokan / gesper, ngikut arah segmen terakhir
    if (P.tip) {
      const t = n - 1, cx = x[t] - x[t - 1], cy = -(y[t] - y[t - 1]), cz = z[t] - z[t - 1], cl = Math.hypot(cx, cy, cz) || 1;
      if (P.kind === "void") {
        P.tip.position.set(x[t], -y[t], z[t]);
        P.tip.rotation.set(1.15, 0.2, clock * 2.5);
      } else if (v.plug || v.buckle || P.kind === "robot") {
        P.tip.position.set(x[t], -y[t], z[t]);
        P.tip.quaternion.setFromUnitVectors(xAxis, tmp.set(cx / cl, cy / cl, cz / cl));
      } else {
        place(P.tip, x[t], -y[t], z[t], x[t] + (cx / cl) * 14, -y[t] + (cy / cl) * 14, z[t] + (cz / cl) * 14, 1.6);
      }
    }

    // dua kali gambar: bayangan (geser ke kanan bawah, di belakang) terus pecutnya
    renderer.clear();
    if (P.kind !== "holo") { // hologram nggak punya bayangan
      if (P.halo) P.halo.mesh.visible = false;
      scene.overrideMaterial = shadowMat;
      group.position.set(S * 0.012, -S * 0.022, -S * 0.08);
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
      if (P.halo) P.halo.mesh.visible = true;
      renderer.clearDepth();
    }
    // hologram kadang nge-glitch geser dikit
    group.position.set(P.kind === "holo" && Math.random() < 0.05 ? (Math.random() - 0.5) * 10 : 0, 0, 0);
    renderer.render(scene, camera);
    return canvas;
  }

  // titik tali dihalusin pakai Catmull-Rom (y dibalik: layar ke bawah, Three ke atas)
  function smoothLine(whip, M) {
    if (line.M !== M) { line.M = M; line.px = new Float32Array(M); line.py = new Float32Array(M); line.pz = new Float32Array(M); }
    const { x, y, z, n } = whip, { px, py, pz } = line;
    for (let i = 0; i < n - 1; i++) {
      const i0 = Math.max(0, i - 1), i2 = i + 1, i3 = Math.min(n - 1, i + 2);
      for (let s = 0; s < SUB; s++) {
        const t = s / SUB, k = i * SUB + s;
        px[k] = cr(x[i0], x[i], x[i2], x[i3], t);
        py[k] = -cr(y[i0], y[i], y[i2], y[i3], t);
        pz[k] = cr(z[i0], z[i], z[i2], z[i3], t);
      }
    }
    px[M - 1] = x[n - 1]; py[M - 1] = -y[n - 1]; pz[M - 1] = z[n - 1];
    // tali tebel bikin patahan kecil dari fisika keliatan: haluskan dikit (cuma tampilan)
    for (let pass = 0; pass < 3; pass++) {
      for (const p of [px, py, pz]) {
        let prev = p[0];
        for (let i = 1; i < M - 1; i++) { const cur = p[i]; p[i] = 0.25 * prev + 0.5 * cur + 0.25 * p[i + 1]; prev = cur; }
      }
    }
  }

  function frames(px, py, pz, M) {
    if (!fr.nx || fr.nx.length !== M) for (const k of Object.keys(fr)) fr[k] = new Float32Array(M);
    transport(px, py, pz, M, (i, nx, ny, nz, bx, by, bz) => {
      fr.nx[i] = nx; fr.ny[i] = ny; fr.nz[i] = nz; fr.bx[i] = bx; fr.by[i] = by; fr.bz[i] = bz;
    });
  }

  return { canvas, resize, render, setTheme };
}

// Frame digeser paralel sepanjang garis biar tabungnya nggak melintir aneh.
// N awalnya di bidang layar, B kira-kira ngadep kamera.
function transport(px, py, pz, M, each) {
  let nx = 0, ny = 0, nz = 1;
  for (let i = 0; i < M; i++) {
    const a = Math.max(0, i - 1), b = Math.min(M - 1, i + 1);
    let tx = px[b] - px[a], ty = py[b] - py[a], tz = pz[b] - pz[a];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    if (i === 0) { nx = -ty; ny = tx; nz = 0; }
    const d = nx * tx + ny * ty + nz * tz;
    nx -= tx * d; ny -= ty * d; nz -= tz * d;
    let nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-4) { nx = -ty; ny = tx; nz = 0.3; nl = Math.hypot(nx, ny, nz); }
    nx /= nl; ny /= nl; nz /= nl;
    each(i, nx, ny, nz, ty * nz - tz * ny, tz * nx - tx * nz, tx * ny - ty * nx);
  }
}

// Tabung yang bentuknya diupdate tiap frame. flat < 1 = pipih (sabuk).
class Tube {
  constructor(group, mat, radial, flat, vScale) {
    this.group = group; this.mat = mat; this.radial = radial; this.flat = flat; this.vScale = vScale;
    this.M = 0; this.mesh = null; this.geo = null;
  }
  alloc(M) {
    const R = this.radial, count = M * (R + 1), idx = [], uv = new Float32Array(count * 2);
    for (let i = 0; i < M - 1; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    for (let i = 0; i < M; i++) for (let j = 0; j <= R; j++) { const o = (i * (R + 1) + j) * 2; uv[o] = j / R; uv[o + 1] = i * this.vScale; }
    const geo = new T.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute("position", new T.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("normal", new T.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
    if (this.mesh) { this.group.remove(this.mesh); this.geo.dispose(); }
    this.geo = geo; this.M = M;
    this.mesh = new T.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    // buffer garis tengah sendiri (dipakai sapu lidi & rumbai)
    this.cx = new Float32Array(M); this.cy = new Float32Array(M); this.cz = new Float32Array(M);
  }
  ensure(M) { if (this.M !== M) this.alloc(M); return this; }
  update(px, py, pz, M, radius) {
    this.ensure(M);
    const pos = this.geo.attributes.position.array, nor = this.geo.attributes.normal.array, R = this.radial, fl = this.flat;
    transport(px, py, pz, M, (i, nx, ny, nz, bx, by, bz) => {
      const r = radius(i / (M - 1));
      for (let j = 0; j <= R; j++) {
        const ang = (j / R) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const o = (i * (R + 1) + j) * 3;
        pos[o] = px[i] + (nx * c + bx * s * fl) * r;
        pos[o + 1] = py[i] + (ny * c + by * s * fl) * r;
        pos[o + 2] = pz[i] + (nz * c + bz * s * fl) * r;
        let qx = nx * c * fl + bx * s, qy = ny * c * fl + by * s, qz = nz * c * fl + bz * s;
        const ql = Math.hypot(qx, qy, qz) || 1;
        nor[o] = qx / ql; nor[o + 1] = qy / ql; nor[o + 2] = qz / ql;
      }
    });
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
  dispose() { if (this.mesh) { this.group.remove(this.mesh); this.geo.dispose(); } }
}

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function makeTexture(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  return { c, g: c.getContext("2d"), tex, dispose: () => tex.dispose() };
}

// matcap krom: pantulan langit terang di atas, horizon gelap, lantai terang lagi
function paintMatcap(t) {
  const { c, g } = t, w = c.width, h = c.height;
  const lin = g.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, "#ffffff"); lin.addColorStop(0.32, "#c9d1da"); lin.addColorStop(0.5, "#4b525b");
  lin.addColorStop(0.6, "#e9eef3"); lin.addColorStop(1, "#2b3036");
  g.fillStyle = lin; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
  const hi = g.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, w * 0.28);
  hi.addColorStop(0, "rgba(255,255,255,0.9)"); hi.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hi; g.fillRect(0, 0, w, h);
  t.tex.needsUpdate = true;
}

// pola kepang: tali kulit dianyam 4 helai, motif tulang ikan
function paintBraid(t, color) {
  const { c, g } = t, w = c.width, h = c.height, k = 4, cw = w / k;
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  for (let row = -1; row < 5; row++) {
    for (let i = 0; i < k; i++) {
      const x0 = i * cw, y0 = row * (h / 4) + (i % 2) * (h / 8);
      const grd = g.createLinearGradient(x0, y0, x0 + cw, y0 + h / 4);
      grd.addColorStop(0, "rgba(255,255,255,0.18)"); grd.addColorStop(0.5, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(0,0,0,0.35)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x0, y0); g.lineTo(x0 + cw / 2, y0 + h / 8); g.lineTo(x0 + cw, y0);
      g.lineTo(x0 + cw, y0 + h / 8); g.lineTo(x0 + cw / 2, y0 + h / 4); g.lineTo(x0, y0 + h / 8);
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = 1; g.stroke();
    }
  }
  t.tex.needsUpdate = true;
}

// kulit sabuk: polos + jahitan putus-putus di tengah depan & belakang
function paintLeather(t, color) {
  const { c, g } = t, w = c.width, h = c.height;
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = "rgba(236,232,225,0.55)";
  for (const u of [0.25, 0.75]) for (let y = 0; y < h; y += 16) g.fillRect(u * w - 1, y, 2, 9);
  t.tex.needsUpdate = true;
}

// gagang: dililit kulit miring
function paintGrip(t, color) {
  const { c, g } = t, w = c.width, h = c.height;
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  for (let i = -2; i < 10; i++) {
    const y = i * (h / 8);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + h / 8); g.lineTo(w, y + h / 8 + 3); g.lineTo(0, y + 3); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + h / 8); g.stroke();
  }
  t.tex.needsUpdate = true;
}

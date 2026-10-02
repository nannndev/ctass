// Gambar pecut versi 3D pakai Three.js. Cuma dimuat kalau tampilan 3D dinyalain.
// Fisikanya tetap dari physics.js (titik x, y, z), di sini cuma digambar jadi tali
// kepang beneran: tabung meruncing, ada cahaya + bayangan, gagang kulit, cracker di ujung.
// Hasil render dibalikin sebagai canvas, terus ditempel stage.js ke canvas 2D-nya
// (jadi efek ctarr, tulisan, guncangan tetap nyatu).
import * as T from "./vendor/three.min.js";

const RAD = 10; // sisi lingkaran tabung
const SUB = 3;  // titik halus per segmen tali

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
  scene.add(new T.HemisphereLight(0xfff1e0, 0x3a3028, 1.9));
  const keyLight = new T.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(-0.6, 1, 1.1);
  scene.add(keyLight);
  const rimLight = new T.DirectionalLight(0xffd6a0, 1.1);
  rimLight.position.set(0.9, -0.4, -0.5);
  scene.add(rimLight);

  const group = new T.Group();
  scene.add(group);

  // ---------- tali ----------
  const ropeTex = makeTexture(64, 64);
  const ropeMat = new T.MeshStandardMaterial({ map: ropeTex.tex, bumpMap: ropeTex.tex, bumpScale: 1.6, roughness: 0.48, metalness: 0.06, side: T.DoubleSide });
  let tube = null;

  function makeTube(M) {
    const geo = new T.BufferGeometry();
    const count = M * (RAD + 1);
    const idx = [];
    for (let i = 0; i < M - 1; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j, b = a + RAD + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < M; i++) {
      for (let j = 0; j <= RAD; j++) {
        uv[(i * (RAD + 1) + j) * 2] = j / RAD;
        uv[(i * (RAD + 1) + j) * 2 + 1] = i * 0.34;
      }
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new T.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("normal", new T.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
    if (tube) { group.remove(tube.mesh); tube.geo.dispose(); }
    const mesh = new T.Mesh(geo, ropeMat);
    mesh.frustumCulled = false;
    group.add(mesh);
    tube = { geo, mesh, M, px: new Float32Array(M), py: new Float32Array(M), pz: new Float32Array(M) };
  }

  // ---------- gagang ----------
  const gripTex = makeTexture(32, 64);
  const gripMat = new T.MeshStandardMaterial({ map: gripTex.tex, bumpMap: gripTex.tex, bumpScale: 2, roughness: 0.5, metalness: 0.05 });
  const handle = new T.Mesh(new T.CylinderGeometry(1, 0.82, 1, 18, 1), gripMat);
  const knob = new T.Mesh(new T.SphereGeometry(1, 18, 12), gripMat);
  const collar = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 18, 1), new T.MeshStandardMaterial({ color: 0xb8925c, roughness: 0.3, metalness: 0.7 }));
  const cracker = new T.Mesh(new T.ConeGeometry(1, 1, 8, 1), new T.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.8 }));
  for (const m of [handle, knob, collar, cracker]) { m.frustumCulled = false; group.add(m); }

  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  let W = 0, H = 0, colors = "";

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

  const up = new T.Vector3(0, 1, 0), tmp = new T.Vector3();

  // taruh silinder dari a ke b (koordinat Three)
  function place(mesh, ax, ay, az, bx, by, bz, r) {
    tmp.set(bx - ax, by - ay, bz - az);
    const len = tmp.length() || 1e-3;
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.quaternion.setFromUnitVectors(up, tmp.multiplyScalar(1 / len));
    mesh.scale.set(r, len, r);
  }

  // whip = Whip dari physics.js, base = pangkal gagang (posisi tangan)
  function render(whip, base, v, S) {
    if (!W || !H) return canvas;
    const key = v.rope + v.grip;
    if (key !== colors) {
      colors = key;
      paintBraid(ropeTex, v.rope);
      paintGrip(gripTex, v.grip);
    }
    const n = whip.n, M = (n - 1) * SUB + 1;
    if (!tube || tube.M !== M) makeTube(M);

    // titik tali dihalusin pakai Catmull-Rom (y dibalik: layar ke bawah, Three ke atas)
    const { x, y, z } = whip, { px, py, pz } = tube;
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

    // ring per titik, frame digeser paralel biar tabungnya nggak melintir aneh
    const pos = tube.geo.attributes.position.array, nor = tube.geo.attributes.normal.array;
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
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      const f = i / (M - 1);
      const r = Math.max(0.55, (v.w0 + (v.w1 - v.w0) * Math.pow(f, 0.7)) * 0.72);
      for (let j = 0; j <= RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const ox = nx * c + bx * s, oy = ny * c + by * s, oz = nz * c + bz * s;
        const o = (i * (RAD + 1) + j) * 3;
        pos[o] = px[i] + ox * r; pos[o + 1] = py[i] + oy * r; pos[o + 2] = pz[i] + oz * r;
        nor[o] = ox; nor[o + 1] = oy; nor[o + 2] = oz;
      }
    }
    tube.geo.attributes.position.needsUpdate = true;
    tube.geo.attributes.normal.needsUpdate = true;

    // gagang: dari tangan ke titik 0 tali
    const hr = Math.max(5.5, S * 0.012);
    const ax = base.x, ay = -base.y, az = base.z || 0, hx = x[0], hy = -y[0], hz = z[0];
    place(handle, ax, ay, az, hx, hy, hz, hr);
    knob.position.set(ax, ay, az); knob.scale.setScalar(hr * 1.25);
    // ring logam di sambungan gagang & tali
    const ux = hx - ax, uy = hy - ay, uz = hz - az, ul = Math.hypot(ux, uy, uz) || 1;
    place(collar, hx - (ux / ul) * 4, hy - (uy / ul) * 4, hz - (uz / ul) * 4, hx + (ux / ul) * 2, hy + (uy / ul) * 2, hz + (uz / ul) * 2, hr * 0.9);

    // cracker: rumbai kecil di ujung
    const t = n - 1, cx = x[t] - x[t - 1], cy = -(y[t] - y[t - 1]), cz = z[t] - z[t - 1], cl = Math.hypot(cx, cy, cz) || 1;
    place(cracker, x[t], -y[t], z[t], x[t] + (cx / cl) * 14, -y[t] + (cy / cl) * 14, z[t] + (cz / cl) * 14, 1.6);

    // dua kali gambar: bayangan (geser ke kanan bawah, di belakang) terus pecutnya
    renderer.clear();
    scene.overrideMaterial = shadowMat;
    group.position.set(S * 0.012, -S * 0.022, -S * 0.08);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    group.position.set(0, 0, 0);
    renderer.clearDepth();
    renderer.render(scene, camera);
    return canvas;
  }

  return { canvas, resize, render };
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
  return { c, g: c.getContext("2d"), tex };
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

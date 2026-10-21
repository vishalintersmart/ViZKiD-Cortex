/* VIZKID ORBITAL: real-time 3D hangar scene (three.js). Loaded lazily by the Space theme.
   Robot model: "RobotExpressive" by Tomás Laulhé (CC0), via three.js examples. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skClone } from "three/addons/utils/SkeletonUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const host = document.getElementById("stage");
const PI = Math.PI, TAU = PI * 2;
const SEGROW = 5.6, T_LAUNCH = 42;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hex = (r, g, b) => (r << 16) | (g << 8) | b;
function rnd(a, b) { return a + Math.random() * (b - a); }

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.domElement.className = "sx-cv";
renderer.domElement.setAttribute("aria-hidden", "true");
renderer.domElement.style.cssText = "position:absolute;left:0;top:0;display:block";
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.0036);
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 1200);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

let composer, bloomPass, W = 0, H = 0, DPR = 1, quality = 2;
let lastBottom = 205;

/* ---------- canvas texture helpers ---------- */
function cnv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function tex(c, rep, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
function plateTexture(base, line, n, speck) {
  const c = cnv(512, 512), x = c.getContext("2d");
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  const s = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
    x.fillStyle = "rgba(255,255,255," + (0.025 * Math.abs(v)) + ")"; x.fillRect(i * s, j * s, s, s);
  }
  x.strokeStyle = line; x.lineWidth = 2;
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 512); x.moveTo(0, i * s); x.lineTo(512, i * s); x.stroke(); }
  x.fillStyle = "rgba(255,255,255,.16)";
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { for (const [a, b] of [[6, 6], [s - 7, 6], [6, s - 7], [s - 7, s - 7]]) { x.fillRect(i * s + a, j * s + b, 2, 2); } }
  for (let i = 0; i < speck; i++) { x.fillStyle = "rgba(0,0,0," + Math.random() * 0.25 + ")"; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  return c;
}
function gratingTexture() {
  const c = cnv(128, 128), x = c.getContext("2d");
  x.fillStyle = "#14171f"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#3a4152";
  for (let i = 0; i < 16; i++) { x.fillRect(i * 8, 0, 3, 128); x.fillRect(0, i * 8, 128, 2); }
  return c;
}
function bodyTexture() {
  const c = cnv(512, 512), x = c.getContext("2d");
  x.fillStyle = "#eef1f6"; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = "rgba(60,70,90,.35)"; x.lineWidth = 2;
  for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke(); }
  for (let j = 0; j < 4; j++) { x.beginPath(); x.moveTo(0, j * 128 + 2); x.lineTo(512, j * 128 + 2); x.stroke(); }
  x.fillStyle = "rgba(60,70,90,.28)";
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 6; k++) x.fillRect(i * 64 + 6 + k * 9, j * 128 + 8, 2, 2);
  for (let i = 0; i < 700; i++) { x.fillStyle = "rgba(120,130,150," + Math.random() * 0.12 + ")"; x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 1); }
  return c;
}
function logoTexture() {
  const c = cnv(160, 1024), x = c.getContext("2d");
  x.clearRect(0, 0, 160, 1024);
  x.save(); x.translate(80, 560); x.rotate(PI / 2);
  x.fillStyle = "#1b2438"; x.font = "800 96px 'Segoe UI',Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  if (x.letterSpacing !== undefined) x.letterSpacing = "18px";
  x.fillText("VIZKID", 0, 0); x.restore();
  x.strokeStyle = "#1b2438"; x.lineWidth = 7; x.beginPath(); x.arc(80, 150, 34, 0, TAU); x.stroke();
  x.strokeStyle = "#ff8a2a"; x.lineWidth = 6; x.beginPath(); x.ellipse(80, 150, 56, 18, -0.42, 0, TAU); x.stroke();
  return c;
}
function glowTexture(rgb) {
  const c = cnv(128, 128), x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(" + rgb + ",1)"); g.addColorStop(0.35, "rgba(" + rgb + ",.45)"); g.addColorStop(1, "rgba(" + rgb + ",0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function smokeTexture() {
  const c = cnv(128, 128), x = c.getContext("2d");
  for (let i = 0; i < 14; i++) {
    const px = 64 + rnd(-24, 24), py = 64 + rnd(-24, 24), r = rnd(22, 42), g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,.38)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

/* ---------- noise (for planet / moon textures) ---------- */
function h3(x, y, z) { let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
function vn(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(ix, iy, iz), h3(ix + 1, iy, iz), u), L(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), u), v),
    L(L(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), u), L(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), u), v), w);
}
function fbm(x, y, z, o) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }
function earthTextures() {
  const w = 1024, h = 512, day = cnv(w, h), night = cnv(w, h), cl = cnv(w, h);
  const dx = day.getContext("2d"), nx = night.getContext("2d"), cx = cl.getContext("2d");
  const di = dx.createImageData(w, h), ni = nx.createImageData(w, h), ci = cx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - j / h) * PI, cl0 = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i / w) * TAU, X = cl0 * Math.cos(lon), Z = cl0 * Math.sin(lon), Y = sl, k = (j * w + i) * 4;
      const hgt = fbm(X * 2.3 + 5, Y * 2.3, Z * 2.3, 5), dry = fbm(X * 4 + 9, Y * 4 + 3, Z * 4, 3);
      let r, g, b, land = hgt > 0.54;
      if (land) {
        const e = (hgt - 0.54) * 5;
        if (Math.abs(lat) > 1.2 || (Math.abs(lat) > 1.0 && e > 0.3)) { r = 235; g = 240; b = 245; }
        else if (dry > 0.58 && Math.abs(lat) < 0.75) { r = 178 - e * 40; g = 150 - e * 40; b = 96 - e * 20; }
        else { r = 52 + e * 60; g = 110 + e * 20 - e * 40; b = 58 + e * 18; }
      } else {
        const d = clamp((0.54 - hgt) * 6, 0, 1);
        r = 30 - d * 22; g = 105 - d * 70; b = 175 - d * 78;
        if (Math.abs(lat) > 1.25) { r = 220; g = 230; b = 240; }
      }
      di.data[k] = r; di.data[k + 1] = g; di.data[k + 2] = b; di.data[k + 3] = 255;
      const lights = land && Math.abs(lat) < 1.1 && fbm(X * 9, Y * 9, Z * 9, 2) > 0.5 && h3(i, j, 7) > 0.8 ? 255 : 0;
      ni.data[k] = lights; ni.data[k + 1] = lights * 0.78; ni.data[k + 2] = lights * 0.4; ni.data[k + 3] = 255;
      const c1 = fbm(X * 3.2 + 20, Y * 3.2, Z * 3.2 + 7, 5), cv2 = clamp((c1 - 0.5) * 4.5, 0, 1) * 255;
      ci.data[k] = ci.data[k + 1] = ci.data[k + 2] = cv2; ci.data[k + 3] = 255;
    }
  }
  dx.putImageData(di, 0, 0); nx.putImageData(ni, 0, 0); cx.putImageData(ci, 0, 0);
  return { day: tex(day), night: tex(night), cloud: tex(cl) };
}
function moonTexture() {
  const c = cnv(512, 256), x = c.getContext("2d"), im = x.createImageData(512, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 512; i++) {
    const lat = (0.5 - j / 256) * PI, lon = (i / 512) * TAU, X = Math.cos(lat) * Math.cos(lon), Z = Math.cos(lat) * Math.sin(lon), Y = Math.sin(lat);
    const v = 150 + (fbm(X * 4, Y * 4, Z * 4, 5) - 0.5) * 170, k = (j * 512 + i) * 4;
    im.data[k] = v; im.data[k + 1] = v * 0.98; im.data[k + 2] = v * 0.94; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  for (let i = 0; i < 60; i++) {
    const px = Math.random() * 512, py = Math.random() * 256, r = rnd(3, 16), g = x.createRadialGradient(px, py, r * 0.2, px, py, r);
    g.addColorStop(0, "rgba(40,40,44,.35)"); g.addColorStop(0.85, "rgba(40,40,44,.2)"); g.addColorStop(1, "rgba(255,255,255,.2)");
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  return tex(c);
}

/* ---------- animated holo screens ---------- */
const screens = [];
function makeScreen(w, h, kind, accent) {
  const c = cnv(512, Math.round(512 * h / w)), x = c.getContext("2d");
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, opacity: 0.96 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  screens.push({ c, x, t, kind, accent, last: -9 });
  return mesh;
}
function paintScreen(s, time) {
  if (time - s.last < 0.12) return; s.last = time;
  const x = s.x, W2 = s.c.width, H2 = s.c.height;
  x.clearRect(0, 0, W2, H2);
  x.fillStyle = "rgba(6,18,34,.82)"; x.fillRect(0, 0, W2, H2);
  x.strokeStyle = s.accent; x.lineWidth = 4; x.strokeRect(4, 4, W2 - 8, H2 - 8);
  x.fillStyle = s.accent; x.font = "700 22px monospace"; x.fillText(s.kind === "tablet" ? "SCAN · SYSTEMS" : "TELEMETRY", 18, 36);
  x.strokeStyle = "rgba(120,200,255,.25)"; x.lineWidth = 1;
  for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(14, 50 + i * (H2 - 70) / 5); x.lineTo(W2 - 14, 50 + i * (H2 - 70) / 5); x.stroke(); }
  x.strokeStyle = s.accent; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i < 60; i++) { const px = 16 + i * (W2 - 32) / 59, py = H2 * 0.62 + Math.sin(i * 0.4 + time * 2.1) * H2 * 0.12 + Math.sin(i * 1.3 - time * 3.2) * H2 * 0.05; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
  x.stroke();
  for (let i = 0; i < 14; i++) { const bh = (0.25 + 0.65 * Math.abs(Math.sin(i * 0.9 + time * 1.4))) * H2 * 0.3; x.fillStyle = i % 3 === 0 ? "#ff9a40" : s.accent; x.fillRect(16 + i * (W2 - 32) / 14, H2 - 14 - bh, (W2 - 32) / 14 - 5, bh); }
  s.t.needsUpdate = true;
}

/* ---------- materials ---------- */
const M = {
  steel: new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.75, roughness: 0.42 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x1c2029, metalness: 0.8, roughness: 0.5 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff8a1f, metalness: 0.3, roughness: 0.45, emissive: 0x7a2c00, emissiveIntensity: 0.55 }),
  orangeHot: new THREE.MeshBasicMaterial({ color: 0xffa24a, toneMapped: false }),
  white: new THREE.MeshPhysicalMaterial({ map: tex(bodyTexture(), [1, 1]), color: 0xffffff, metalness: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.18 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc9d0dc, metalness: 1, roughness: 0.22 }),
  black: new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.6, roughness: 0.5 }),
  hazard: null,
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd6ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.32, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
  crate: new THREE.MeshStandardMaterial({ color: 0xb48a50, metalness: 0.1, roughness: 0.7 }),
  crateGrey: new THREE.MeshStandardMaterial({ color: 0x59627a, metalness: 0.5, roughness: 0.5 }),
  emis: (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
};
M.white.map.repeat.set(1, 1);
const gratingTex = tex(gratingTexture(), [4, 3]);
M.grating = new THREE.MeshStandardMaterial({ map: gratingTex, color: 0xffffff, metalness: 0.8, roughness: 0.5 });
(function () {
  const c = cnv(128, 128), x = c.getContext("2d");
  x.fillStyle = "#ffc01f"; x.fillRect(0, 0, 128, 128); x.fillStyle = "#14161c";
  for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 32, 128); x.lineTo(i * 32 + 16, 128); x.lineTo(i * 32 + 16 + 128, 0); x.lineTo(i * 32 + 128, 0); x.fill(); }
  M.hazard = new THREE.MeshStandardMaterial({ map: tex(c, [8, 1]), roughness: 0.6, metalness: 0.2 });
})();
function mesh(geo, mat, x, y, z, shadow) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
function box(w, h, d, mat, x, y, z, shadow) { const m = mesh(BOX, mat, x, y, z, shadow); m.scale.set(w, h, d); return m; }
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
function cylY(r, h, mat, x, y, z) { const m = mesh(CYL, mat, x, y, z); m.scale.set(r, h, r); return m; }

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0x8ea4ff, 0x2b1b10, 0.4); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffdcb0, 2.1);
key.position.set(-22, 40, 36); key.target.position.set(0, 8, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -30, right: 30, top: 34, bottom: -8, near: 5, far: 140 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0x6fa8ff, 0.7); fill.position.set(34, 16, 22); scene.add(fill);
const lamps = [];
function addLamp(x, y, z, color, intensity) {
  const l = new THREE.PointLight(color, intensity, 70, 2); l.position.set(x, y, z); scene.add(l); lamps.push(l);
  const bulb = mesh(new THREE.SphereGeometry(0.35, 12, 8), M.emis(color), x, y, z, false); scene.add(bulb);
  const shade = mesh(new THREE.ConeGeometry(0.9, 0.6, 16, 1, true), M.steelDark, x, y + 0.35, z, false); shade.material = M.steelDark.clone(); shade.material.side = THREE.DoubleSide; scene.add(shade);
  const sh = mesh(new THREE.ConeGeometry(4.6, 15, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.028, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), x, y - 7.6, z, false);
  sh.userData.shaft = true; scene.add(sh);
}
addLamp(-14, 27, -6, 0xffb870, 320); addLamp(14, 27, -6, 0xffb870, 320); addLamp(0, 29, -16, 0xffd8a0, 320);
addLamp(-26, 22, -14, 0xff8a3a, 220); addLamp(26, 22, -14, 0xff8a3a, 220);
const engineLight = new THREE.PointLight(0xffa050, 0, 90, 1.6); engineLight.position.set(0, 1, 2); scene.add(engineLight);
const weldLight = new THREE.PointLight(0x9fd4ff, 0, 14, 2); scene.add(weldLight);

/* ---------- hangar shell ---------- */
const floorTex = tex(plateTexture("#1d212c", "rgba(0,0,0,.6)", 4, 400), [14, 12]);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, metalness: 0.75, roughness: 0.34, envMapIntensity: 1.3 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 150), floorMat);
floor.rotation.x = -PI / 2; floor.position.set(0, 0, 10); floor.receiveShadow = true; scene.add(floor);
// glowing guide lines on the floor
function floorStrip(x, z, w, d, color, mat) { const m = mesh(new THREE.PlaneGeometry(w, d), mat || M.emis(color), x, 0.02, z, false); m.rotation.x = -PI / 2; scene.add(m); return m; }
floorStrip(0, 14, 80, 0.2, 0xff8a2a); floorStrip(-24, 4, 0.2, 40, 0x35bfff); floorStrip(24, 4, 0.2, 40, 0x35bfff);
[-1, 1].forEach((s) => { const h = floorStrip(s * 16, -12, 22, 1.4, 0, M.hazard); });
// pad
const pad = cylY(7.4, 0.5, M.steel, 0, 0.25, 0); pad.material = new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.85, roughness: 0.35 }); scene.add(pad);
const padRing = mesh(new THREE.TorusGeometry(7.4, 0.12, 8, 64), M.emis(0xff8a2a), 0, 0.52, 0, false); padRing.rotation.x = PI / 2; scene.add(padRing);
const padRing2 = mesh(new THREE.TorusGeometry(5.6, 0.07, 8, 64), M.emis(0x35bfff), 0, 0.53, 0, false); padRing2.rotation.x = PI / 2; scene.add(padRing2);
// trench with hold-down clamps
scene.add(box(5.2, 0.12, 5.2, M.black, 0, 0.55, 0, false));
for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; scene.add(box(0.7, 0.7, 0.7, M.steelDark, Math.cos(a) * 3.1, 0.85, Math.sin(a) * 3.1)); }

// back wall with two big windows
const wallTex = tex(plateTexture("#1a1f2b", "rgba(0,0,0,.55)", 4, 600), [1 / 9, 1 / 9]);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, metalness: 0.7, roughness: 0.5 });
const WIN = [[-27, -11, 7.5, 19.5], [11, 27, 7.5, 19.5]];
(function () {
  const sh = new THREE.Shape(); sh.moveTo(-70, 0); sh.lineTo(70, 0); sh.lineTo(70, 56); sh.lineTo(-70, 56); sh.closePath();
  WIN.forEach((w) => { const p = new THREE.Path(); p.moveTo(w[0], w[2]); p.lineTo(w[0], w[3]); p.lineTo(w[1], w[3]); p.lineTo(w[1], w[2]); p.closePath(); sh.holes.push(p); });
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false });
  const w = new THREE.Mesh(g, wallMat); w.position.z = -24; w.receiveShadow = true; w.castShadow = true; scene.add(w);
  WIN.forEach((o) => {
    const cx = (o[0] + o[1]) / 2, cy = (o[2] + o[3]) / 2, ww = o[1] - o[0], hh = o[3] - o[2];
    [[cx, o[3], ww + 0.8, 0.5], [cx, o[2], ww + 0.8, 0.5]].forEach((b) => scene.add(box(b[2], b[3], 2.2, M.orange, b[0], b[1], -23.2, false)));
    [[o[0], cy], [o[1], cy]].forEach((b) => scene.add(box(0.5, hh + 0.5, 2.2, M.orange, b[0], b[1], -23.2, false)));
    scene.add(box(0.3, hh, 1.2, M.steelDark, cx, cy, -23.2, false));
    scene.add(box(ww, 0.3, 1.2, M.steelDark, cx, cy, -23.2, false));
  });
})();
// big structural ribs + pipes along the back wall
[-48, -34, -3, 3, 34, 48].forEach((x) => { scene.add(box(2, 52, 2.4, M.steel, x, 26, -22.5)); scene.add(box(0.4, 52, 0.4, M.orange, x + 1.05, 26, -21.2, false)); });
[[20.5, 0.9], [23.5, 0.6], [4, 0.7]].forEach((p) => { const c = cylY(p[1], 120, M.steel, 0, p[0], -21.6); c.rotation.z = PI / 2; scene.add(c); for (let x = -50; x <= 50; x += 12) { const f = cylY(p[1] * 1.25, 0.7, M.steelDark, x, p[0], -21.6); f.rotation.z = PI / 2; scene.add(f); } });
// side walls
[-1, 1].forEach((s) => {
  const w = box(1.6, 56, 150, wallMat, s * 66, 28, 10); w.material = wallMat; scene.add(w);
  for (let z = -16; z <= 60; z += 14) { scene.add(box(2.4, 56, 2, M.steel, s * 64.8, 28, z)); }
});
// BAY sign + holo screens
(function () {
  const c = cnv(512, 160), x = c.getContext("2d");
  x.fillStyle = "rgba(20,14,6,.85)"; x.fillRect(0, 0, 512, 160); x.strokeStyle = "#ffb24a"; x.lineWidth = 8; x.strokeRect(6, 6, 500, 148);
  x.fillStyle = "#ffb24a"; x.font = "900 110px 'Segoe UI',Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("BAY 01", 256, 86);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.06), new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false })); s.position.set(31, 3.6, -22.2); scene.add(s);
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.06), new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false })); s2.position.set(-31, 3.6, -22.2); scene.add(s2);
})();
const scr1 = makeScreen(9, 5.6, "telemetry", "#35e0ff"); scr1.position.set(-2.8, 24, -21.7); scene.add(scr1);
const scr2 = makeScreen(9, 5.6, "telemetry", "#ffb24a"); scr2.position.set(2.8, 24, -21.7); scene.add(scr2);
// crate stacks, barrels, cabinets
function crateStack(x, z, n, mat) {
  for (let i = 0; i < n; i++) {
    const s = rnd(1.4, 2.2), m = box(s, s * 0.9, s, mat || (Math.random() > 0.5 ? M.crate : M.crateGrey), x + rnd(-0.4, 0.4), s * 0.45 + (i % 2) * 2, z + (i >> 1) * 2.2);
    m.rotation.y = rnd(-0.3, 0.3); scene.add(m);
    const bd = box(s * 1.02, 0.12, s * 1.02, M.orange, m.position.x, m.position.y + 0.05, m.position.z, false); bd.rotation.y = m.rotation.y; scene.add(bd);
  }
}
crateStack(-34, -8, 4); crateStack(36, -6, 4); crateStack(-40, 8, 2, M.crateGrey); crateStack(42, 6, 3);
for (let i = 0; i < 8; i++) { const b = cylY(0.7, 1.7, i % 2 ? M.orange : M.crateGrey, -22 + i * 1.6, 0.85, -17 + (i % 2) * 1.6); scene.add(b); }
// gantry crane (bridge) and cable
const craneY = 33;
scene.add(box(140, 1.4, 2, M.steel, 0, craneY, 0)); scene.add(box(140, 0.4, 2.2, M.orange, 0, craneY - 0.9, 0, false));
const trolley = box(3.4, 1.2, 2.4, M.steelDark, 0, craneY - 1.2, 0); scene.add(trolley);
const craneCable = box(0.14, 1, 0.14, M.black, 0, craneY - 8, 0, false); scene.add(craneCable);
const hook = box(1.0, 0.8, 1.0, M.orange, 0, 12, 0); scene.add(hook);

/* ---------- scaffold towers ---------- */
const truss = [];
function member(a, b, t) { truss.push([a, b, t]); }
const DECKS = [];
function buildTower(side) {
  const x0 = side * 6.6, x1 = side * 8.8, z0 = -1.5, z1 = 1.5, top = 30;
  const P4 = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  P4.forEach((p) => member(V3(p[0], 0, p[1]), V3(p[0], top, p[1]), 0.26));
  for (let y = 0; y <= top; y += 3) {
    for (let i = 0; i < 4; i++) { const a = P4[i], b = P4[(i + 1) % 4]; member(V3(a[0], y, a[1]), V3(b[0], y, b[1]), 0.14); }
    if (y < top) for (let i = 0; i < 4; i++) { const a = P4[i], b = P4[(i + 1) % 4], up = (y / 3 + i) % 2 === 0; member(V3(a[0], up ? y : y + 3, a[1]), V3(b[0], up ? y + 3 : y, b[1]), 0.1); }
  }
  // tower cap light
  scene.add(mesh(new THREE.SphereGeometry(0.4, 10, 8), M.emis(0xff5030), (x0 + x1) / 2, top + 0.7, 0, false));
}
function buildDeck(side, y) {
  const g = new THREE.Group(); g.position.y = y; g.userData.side = side; scene.add(g);
  const inner = side * 3.2, outer = side * 8.8, cx = (inner + outer) / 2, w = Math.abs(outer - inner);
  const plate = box(w, 0.22, 3.4, M.grating, cx, 0, 0); plate.material = M.grating; g.add(plate);
  g.add(box(w, 0.3, 0.3, M.orange, cx, -0.15, 1.7, false), box(w, 0.3, 0.3, M.orange, cx, -0.15, -1.7, false));
  // front + inner rails
  const rail = (x, z, lx, lz) => { g.add(box(lx, 0.12, lz, M.orange, x, 1.1, z, false), box(lx, 0.1, lz, M.orange, x, 0.55, z, false)); };
  rail(cx, 1.7, w, 0.12); rail(cx, -1.7, w, 0.12); rail(inner, 0, 0.12, 3.4);
  for (let i = 0; i <= 5; i++) { g.add(box(0.1, 1.1, 0.1, M.orange, inner + (outer - inner) * i / 5, 0.55, 1.7, false)); g.add(box(0.1, 1.1, 0.1, M.orange, inner + (outer - inner) * i / 5, 0.55, -1.7, false)); }
  const lt = mesh(new THREE.BoxGeometry(0.3, 0.1, 1), M.emis(0xffe0a0), cx, -0.28, 0, false); lt.scale.set(w * 0.6, 1, 0.3); g.add(lt);
  DECKS.push(g); return g;
}
buildTower(-1); buildTower(1);
const deckL = [3.0, 6.9, 10.8, 14.7, 18.6].map((y) => buildDeck(-1, y));
const deckR = [3.0, 6.9, 10.8, 14.7, 18.6].map((y) => buildDeck(1, y));
(function () {
  const g = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(g, M.steel, truss.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = V3(0, 1, 0);
  truss.forEach((t, i) => {
    const d = t[1].clone().sub(t[0]), len = d.length(); q.setFromUnitVectors(up, d.normalize()); s.set(t[2], len, t[2]);
    m.compose(t[0].clone().add(t[1]).multiplyScalar(0.5), q, s); im.setMatrixAt(i, m);
  });
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
})();
// props on spare decks
deckL[1].add(box(1.4, 1.1, 1.2, M.crate, -5.2, 0.7, -0.6), box(1.1, 0.7, 1.1, M.crateGrey, -6.6, 0.5, 0.6));
deckR[0].add(box(1.6, 1.0, 1.3, M.crateGrey, 6.0, 0.6, -0.5), cylY(0.5, 1.2, M.orange, 7.4, 0.7, 0.5));
deckR[3].add(box(1.3, 1.0, 1.2, M.crate, 5.8, 0.6, 0.4));
deckL[3].add(cylY(0.45, 1.3, M.crateGrey, -5.4, 0.7, 0.3), box(1.4, 0.9, 1.1, M.crate, -7, 0.5, -0.4));
const deckScr = makeScreen(2.6, 1.6, "telemetry", "#35e0ff"); deckScr.position.set(-4.0, 2.0, -1.2); deckL[1].add(deckScr);

/* ---------- the rocket ---------- */
const rocket = new THREE.Group(); scene.add(rocket);
const stages = [];
const Rc = 1.4;
function lathe(pts, mat, seg) { return mesh(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 32), mat); }
function stageGroup(top) { const g = new THREE.Group(); g.userData.top = top; rocket.add(g); stages.push(g); return g; }
const bellMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.95, roughness: 0.32, side: THREE.DoubleSide, emissive: 0x330800, emissiveIntensity: 0 });
const bellGlow = [];
(function () {
  const s0 = stageGroup(1.9);
  [[0.62, 0.62], [-0.62, 0.62], [0.62, -0.62], [-0.62, -0.62]].forEach((p) => {
    const b = lathe([[0.22, 1.4], [0.27, 1.1], [0.38, 0.7], [0.52, 0.28], [0.58, 0.02], [0.56, 0.0], [0.5, 0.26], [0.34, 0.66], [0.23, 1.06], [0.17, 1.4]], bellMat, 24);
    b.position.set(p[0], 0.0, p[1]); s0.add(b);
    const g = mesh(new THREE.CircleGeometry(0.42, 16), M.emis(0xff6a1a), p[0], 0.9, p[1], false); g.rotation.x = PI / 2; g.visible = false; s0.add(g); bellGlow.push(g);
  });
  s0.add(cylY(1.5, 0.5, M.steelDark, 0, 1.55, 0));
  s0.add(cylY(1.46, 0.12, M.orange, 0, 1.86, 0));
  // stage 1 body + boosters
  const s1 = stageGroup(8.4);
  const body1 = mesh(new THREE.CylinderGeometry(Rc, Rc, 6.3, 48, 1), M.white); body1.position.y = 5.0; s1.add(body1);
  M.white.map.repeat.set(2, 3);
  for (let y = 2.8; y < 8; y += 1.55) { const r = mesh(new THREE.TorusGeometry(Rc + 0.005, 0.02, 6, 48), M.black, 0, y, 0, false); r.rotation.x = PI / 2; s1.add(r); }
  const lg = logoTexture(), logo = new THREE.Mesh(new THREE.CylinderGeometry(Rc + 0.012, Rc + 0.012, 5.2, 24, 1, true, -0.34, 0.68), new THREE.MeshBasicMaterial({ map: tex(lg), transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  logo.position.y = 5.1; logo.material.map.wrapS = logo.material.map.wrapT = THREE.ClampToEdgeWrapping; s1.add(logo);
  s1.add(cylY(Rc + 0.03, 0.55, M.orange, 0, 8.25, 0));
  [-1, 1].forEach((s) => {
    const bx = s * 2.08;
    const bb = mesh(new THREE.CylinderGeometry(0.62, 0.62, 7.0, 32), M.white); bb.position.set(bx, 4.9, 0); s1.add(bb);
    const nose = lathe([[0, 2.0], [0.16, 1.88], [0.36, 1.5], [0.52, 0.9], [0.62, 0]], M.white, 32); nose.position.set(bx, 8.4, 0); s1.add(nose);
    const base = lathe([[0.62, 0], [0.5, -0.35], [0.28, -0.6], [0.0, -0.6]], M.steelDark, 20); base.position.set(bx, 1.4, 0); s1.add(base);
    const band = cylY(0.64, 0.4, M.orange, bx, 6.2, 0); s1.add(band);
    const bell = lathe([[0.15, 0.5], [0.22, 0.2], [0.34, -0.2], [0.3, -0.22], [0.2, 0.18], [0.12, 0.5]], bellMat, 16); bell.position.set(bx, 0.95, 0); s1.add(bell);
    [3.2, 7.0].forEach((y) => { const st = box(0.9, 0.22, 0.22, M.steelDark, s * 1.42, y, 0); s1.add(st); });
  });
  // interstage + stage 2
  const s2 = stageGroup(13.6);
  const body2 = mesh(new THREE.CylinderGeometry(Rc, Rc, 4.7, 48, 1), M.white); body2.position.y = 10.85; s2.add(body2);
  s2.add(cylY(Rc + 0.025, 0.3, M.black, 0, 13.35, 0)); s2.add(cylY(Rc + 0.02, 0.2, M.orange, 0, 9.1, 0));
  for (let a = 0; a < 4; a++) { const th = a * PI / 2 + PI / 4, n = mesh(new THREE.ConeGeometry(0.1, 0.3, 8), M.chrome, Math.cos(th) * (Rc + 0.05), 12.4, Math.sin(th) * (Rc + 0.05)); n.rotation.z = Math.cos(th) * 1.5; n.rotation.x = -Math.sin(th) * 1.5; s2.add(n); }
  // fairing
  const s3 = stageGroup(17.4);
  const fair = lathe([[Rc, 13.5], [Rc, 14.2], [1.34, 15.0], [1.1, 15.9], [0.72, 16.7], [0.34, 17.3], [0.18, 17.55]], M.white, 48); s3.add(fair);
  const port = mesh(new THREE.CircleGeometry(0.34, 20), M.emis(0x5ad4ff), 0, 14.7, Rc + 0.02, false); s3.add(port);
  s3.add(mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 24), M.chrome, 0, 14.7, Rc + 0.02, false));
  // nose
  const s4 = stageGroup(19.6);
  s4.add(lathe([[0.2, 17.5], [0.14, 18.0], [0.06, 18.6]], M.orange, 16));
  s4.add(cylY(0.03, 1.4, M.chrome, 0, 18.3, 0)); s4.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), M.emis(0xff3030), 0, 19.05, 0, false));
})();
// flames
const flames = [];
function flameCone(r, len, color, op) {
  const g = new THREE.ConeGeometry(r, len, 20, 1, true); g.rotateX(PI); g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  m.frustumCulled = false; return m;
}
[[0.62, 0.62, 1], [-0.62, 0.62, 1], [0.62, -0.62, 1], [-0.62, -0.62, 1], [2.08, 0, 0.55], [-2.08, 0, 0.55]].forEach((p) => {
  const g = new THREE.Group(), o = flameCone(0.55 * p[2], 7, 0xff7a1c, 0.55), i = flameCone(0.3 * p[2], 5, 0xcfe8ff, 0.9);
  g.add(o, i); g.position.set(p[0], p[2] < 1 ? 0.75 : 0.1, p[1]); g.visible = false; g.userData = { o, i, k: p[2] }; rocket.add(g); flames.push(g);
});
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,150,60"), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
glowSprite.scale.set(10, 10, 1); glowSprite.visible = false; rocket.add(glowSprite);

/* ---------- particles: smoke/steam sprites + sparks ---------- */
const smokeTex = smokeTexture(), smokes = [];
for (let i = 0; i < 90; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff, fog: true }));
  sp.visible = false; sp.userData = { age: 9, life: 1, v: V3(0, 0, 0), s0: 1, s1: 3, o: 0.5, warm: 0 }; scene.add(sp); smokes.push(sp);
}
let smokeI = 0;
function emitSmoke(x, y, z, vx, vy, vz, s0, s1, life, o, warm) {
  const sp = smokes[smokeI++ % smokes.length], u = sp.userData;
  sp.position.set(x, y, z); u.v.set(vx, vy, vz); u.age = 0; u.life = life; u.s0 = s0; u.s1 = s1; u.o = o; u.warm = warm || 0; sp.visible = true;
}
function updateSmoke(dt) {
  smokes.forEach((sp) => {
    const u = sp.userData; if (!sp.visible) return;
    u.age += dt; const k = u.age / u.life;
    if (k >= 1) { sp.visible = false; return; }
    sp.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 0.35);
    const s = u.s0 + (u.s1 - u.s0) * Math.sqrt(k); sp.scale.set(s, s, 1);
    sp.material.opacity = u.o * (1 - k) * Math.min(1, k * 8);
    sp.material.color.setRGB(1 - 0.28 * k - u.warm * 0.15 * k, 1 - 0.35 * k - u.warm * 0.45 * (1 - k), 1 - 0.38 * k - u.warm * 0.8 * (1 - k));
  });
}
const NSP = 260, sparkPos = new Float32Array(NSP * 3), sparkCol = new Float32Array(NSP * 3), sparkVel = [], sparkAge = new Float32Array(NSP);
for (let i = 0; i < NSP; i++) { sparkPos[i * 3 + 1] = -999; sparkVel.push(V3(0, 0, 0)); sparkAge[i] = 9; }
const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true }));
sparkPts.frustumCulled = false; scene.add(sparkPts);
let sparkI = 0;
function emitSpark(p, dir, speed, spread) {
  const i = sparkI++ % NSP; sparkAge[i] = 0;
  sparkPos[i * 3] = p.x; sparkPos[i * 3 + 1] = p.y; sparkPos[i * 3 + 2] = p.z;
  sparkVel[i].set(dir.x * speed + rnd(-spread, spread), dir.y * speed + rnd(0, spread), dir.z * speed + rnd(-spread, spread));
}
function updateSparks(dt) {
  for (let i = 0; i < NSP; i++) {
    if (sparkAge[i] > 1.1) { sparkPos[i * 3 + 1] = -999; continue; }
    sparkAge[i] += dt; const v = sparkVel[i]; v.y -= 14 * dt;
    sparkPos[i * 3] += v.x * dt; sparkPos[i * 3 + 1] += v.y * dt; sparkPos[i * 3 + 2] += v.z * dt;
    if (sparkPos[i * 3 + 1] < 0.1) { sparkPos[i * 3 + 1] = 0.1; v.y *= -0.35; v.x *= 0.6; v.z *= 0.6; }
    const f = Math.max(0, 1 - sparkAge[i] / 1.1);
    sparkCol[i * 3] = 1.6 * f + 0.2; sparkCol[i * 3 + 1] = 0.9 * f * f + 0.05; sparkCol[i * 3 + 2] = 0.3 * f * f * f;
  }
  sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
}

/* ---------- space outside: stars, Earth, Moon, station ---------- */
(function () {
  const N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * TAU, ph = Math.acos(rnd(-0.2, 1)), r = 700;
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph) * 0.9 - 40; pos[i * 3 + 2] = -r * Math.abs(Math.sin(ph) * Math.sin(th)) - 60;
    const c = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.75]][i % 3], b = rnd(0.35, 1);
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const st = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, toneMapped: false, depthWrite: false })); st.frustumCulled = false; scene.add(st);
})();
const earthTex = earthTextures();
const SUN = V3(-0.5, 0.35, 0.8).normalize();
const earthMat = new THREE.ShaderMaterial({
  uniforms: { dayMap: { value: earthTex.day }, nightMap: { value: earthTex.night }, cloudMap: { value: earthTex.cloud }, sun: { value: SUN }, cloudShift: { value: 0 } },
  vertexShader: "varying vec3 vN; varying vec2 vUv; varying vec3 vV; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }",
  fragmentShader: "uniform sampler2D dayMap,nightMap,cloudMap; uniform vec3 sun; uniform float cloudShift; varying vec3 vN; varying vec2 vUv; varying vec3 vV;" +
    "void main(){ vec3 N=normalize(vN); float d=dot(N,sun); float lit=smoothstep(-0.14,0.35,d); vec3 day=texture2D(dayMap,vUv).rgb; float cl=texture2D(cloudMap,vec2(vUv.x+cloudShift,vUv.y)).r;" +
    "vec3 col=day*(0.05+1.25*lit); col=mix(col,vec3(1.,1.,1.)*(0.08+1.1*lit),cl*0.8); vec3 city=texture2D(nightMap,vUv).rgb*(1.-smoothstep(-0.2,0.15,d))*(1.-cl*0.8)*2.6; col+=city;" +
    "float f=pow(1.-max(dot(N,normalize(vV)),0.),3.); col+=vec3(0.25,0.55,1.)*f*(0.25+1.0*lit); gl_FragColor=vec4(col,1.); }"
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(100, 96, 64), earthMat); earth.position.set(10, -58, -200); earth.rotation.z = 0.35; scene.add(earth);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(104, 64, 48), new THREE.ShaderMaterial({
  transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  uniforms: { sun: { value: SUN } },
  vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }",
  fragmentShader: "uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float k=clamp(-dot(normalize(vN),normalize(vV))/0.29,0.,1.); float i=pow(k,1.6); float s=0.35+0.65*smoothstep(-0.3,0.4,dot(normalize(-vN),sun)); gl_FragColor=vec4(vec3(0.3,0.62,1.)*i*s*2.2,i); }"
}));
atmo.position.copy(earth.position); scene.add(atmo);
const moon = new THREE.Mesh(new THREE.SphereGeometry(13, 48, 32), new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 1, metalness: 0, fog: false }));
moon.position.set(-70, 42, -300); scene.add(moon);
// orbital station seen through the right window
const station = new THREE.Group(); station.position.set(45, 26, -120); station.scale.setScalar(0.8); scene.add(station);
(function () {
  const ring = mesh(new THREE.TorusGeometry(9, 0.9, 10, 40), M.white, 0, 0, 0, false); station.add(ring);
  station.add(mesh(new THREE.CylinderGeometry(1.6, 1.6, 14, 14), M.chrome, 0, 0, 0, false));
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8, sp = box(0.3, 9, 0.3, M.steelDark, Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0, false); sp.rotation.z = a + PI / 2; station.add(sp); }
  [-1, 1].forEach((s) => { const p = box(9, 0.15, 3, new THREE.MeshStandardMaterial({ color: 0x1b3a7a, metalness: 0.9, roughness: 0.25, emissive: 0x0a1a44 }), s * 9, 0, 6, false); station.add(p); });
  station.add(mesh(new THREE.SphereGeometry(0.7, 8, 6), M.emis(0xff5030), 0, 7.4, 0, false));
  station.rotation.set(0.5, 0.2, 0.3);
})();
const sat = new THREE.Group(); sat.position.set(-28, 15, -56); scene.add(sat);
sat.add(box(1.6, 1.6, 2.2, M.chrome, 0, 0, 0, false), box(6, 0.1, 1.8, new THREE.MeshStandardMaterial({ color: 0x1b3a7a, metalness: 0.9, roughness: 0.3 }), 0, 0, 0, false));

/* ---------- robots ---------- */
let robotGltf = null, robotScale = 1, robotH0 = 1;
const robots = [];
function boneOf(skel, n1, n2) { return skel.getBoneByName(n1) || skel.getBoneByName(n2); }
function makeRobot(color, height, opts) {
  opts = opts || {};
  const root = new THREE.Group(), m = skClone(robotGltf.scene), k = (height / robotH0);
  m.scale.multiplyScalar(k); root.add(m);
  const mats = [];
  let skel = null;
  m.traverse((o) => {
    if (o.isSkinnedMesh) { skel = o.skeleton; o.frustumCulled = false; }
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.material = o.material.clone(); mats.push(o.material);
      if (o.morphTargetDictionary) root.userData.face = o;
    }
  });
  const r = { root: root, m: m, k: k, h: height, mats: mats, mixer: new THREE.AnimationMixer(m), act: {}, cur: null, tint: "", skel: skel, tools: {}, extra: opts };
  robotGltf.animations.forEach((a) => { r.act[a.name] = r.mixer.clipAction(a); });
  r.b = {
    uaR: boneOf(skel, "UpperArmR", "UpperArm.R"), laR: boneOf(skel, "LowerArmR", "LowerArm.R"), uaL: boneOf(skel, "UpperArmL", "UpperArm.L"), laL: boneOf(skel, "LowerArmL", "LowerArm.L"),
    head: boneOf(skel, "Head", "Head"), neck: boneOf(skel, "Neck", "Neck"), palmR: boneOf(skel, "Palm2R", "Palm2.R"), palmL: boneOf(skel, "Palm2L", "Palm2.L"), abd: boneOf(skel, "Abdomen", "Abdomen")
  };
  r.setColor = (rgb) => {
    const key = rgb.join(","); if (key === r.tint) return; r.tint = key;
    const c = new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    mats.forEach((mt) => { if (mt.name === "Main") { mt.color.setRGB(0.74, 0.77, 0.82).lerp(c, 0.28); mt.emissive.copy(c).multiplyScalar(0.03); mt.roughness = 0.45; mt.metalness = 0.2; } });
  };
  r.play = (name, fade, speed) => {
    const a = r.act[name]; if (!a || r.cur === a) { if (a && speed) a.timeScale = speed; return; }
    a.reset().fadeIn(fade === undefined ? 0.35 : fade).play(); if (speed) a.timeScale = speed;
    if (r.cur) r.cur.fadeOut(fade === undefined ? 0.35 : fade); r.cur = a;
  };
  r.setColor(color);
  r.play(opts.anim || "Idle", 0);
  r.mixer.setTime(Math.random() * 3);
  robots.push(r);
  return r;
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _ax = new THREE.Vector3();
function rotBone(r, bone, ax, ay, az, ang) {
  if (!bone) return;
  r.root.getWorldQuaternion(_qa);
  _ax.set(ax, ay, az).normalize();
  _qb.setFromAxisAngle(_ax, ang).premultiply(_qa).multiply(_qc.copy(_qa).invert());   // world-space delta
  bone.parent.getWorldQuaternion(_qc);
  const pinv = _qa.copy(_qc).invert();
  bone.quaternion.premultiply(_qc).premultiply(_qb).premultiply(pinv);   // parent^-1 * delta * parent * local
  bone.updateMatrixWorld(true);
}
function bonePos(r, bone, out) { return bone ? bone.getWorldPosition(out) : out.set(0, 0, 0); }

/* ---------- props: tools, tablet, forklift, pod, drones ---------- */
function torchTool() {
  const g = new THREE.Group();
  const bar = cylY(0.07, 0.8, M.steelDark, 0, 0, 0.0); bar.rotation.x = PI / 2; g.add(bar);
  const tip = mesh(new THREE.SphereGeometry(0.11, 10, 8), M.emis(0xc8ecff), 0, 0, 0.45, false); g.add(tip); g.userData.tip = tip;
  return g;
}
function wrenchTool() {
  const g = new THREE.Group();
  g.add(box(0.1, 0.1, 0.85, M.chrome, 0, 0, 0.2));
  const h = mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 14, TAU * 0.78), M.chrome, 0, 0, 0.68); g.add(h);
  return g;
}
function tabletTool() {
  const g = new THREE.Group();
  g.add(box(0.72, 0.5, 0.05, M.black, 0, 0, 0));
  const sc = makeScreen(0.66, 0.44, "tablet", "#6ff0ff"); sc.position.z = 0.03; g.add(sc);
  return g;
}

/* forklift */
const fork = new THREE.Group(); scene.add(fork);
(function () {
  const body = box(3.4, 1.0, 2.0, M.orange, 0, 1.0, 0); fork.add(body);
  fork.add(box(1.6, 0.9, 1.9, M.orange, -0.9, 1.9, 0));
  const counter = box(1.0, 1.4, 2.0, M.steelDark, -1.9, 1.5, 0); fork.add(counter);
  [[1.1, 0.8], [1.1, -0.8], [-1.1, 0.8], [-1.1, -0.8]].forEach((w) => { const t = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 20), M.black); t.rotation.x = PI / 2; t.position.set(w[0], 0.62, w[1] * 1.15); fork.add(t); const hub = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 14), M.chrome, w[0], 0.62, w[1] * 1.15); hub.rotation.x = PI / 2; fork.add(hub); });
  [[-1.7, 1], [-1.7, -1], [0.1, 1], [0.1, -1]].forEach((p) => fork.add(box(0.1, 1.7, 0.1, M.orange, p[0], 2.8, p[1] * 0.9, false)));
  fork.add(box(2.1, 0.1, 2.0, M.orange, -0.8, 3.65, 0));
  fork.add(box(0.22, 4.2, 1.8, M.steelDark, 1.9, 2.5, 0));
  fork.userData.carriage = new THREE.Group(); fork.userData.carriage.position.set(2.05, 1.0, 0); fork.add(fork.userData.carriage);
  [-0.6, 0.6].forEach((z) => fork.userData.carriage.add(box(1.8, 0.12, 0.28, M.chrome, 0.8, 0, z)));
  fork.userData.carriage.add(box(0.12, 1.3, 1.8, M.steelDark, 0, 0.6, 0));
  fork.userData.crate = box(1.3, 1.1, 1.3, M.crate, 1.0, 0.7, 0); fork.userData.carriage.add(fork.userData.crate);
  const beacon = mesh(new THREE.SphereGeometry(0.16, 10, 8), M.emis(0xffb020), -0.9, 3.8, 0, false); fork.add(beacon); fork.userData.beacon = beacon;
  fork.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), M.emis(0xfff0c0), 1.7, 1.2, 0.7, false), mesh(new THREE.SphereGeometry(0.2, 10, 8), M.emis(0xfff0c0), 1.7, 1.2, -0.7, false));
})();
/* hover pod */
const pod = new THREE.Group(); scene.add(pod);
(function () {
  const hull = mesh(new THREE.CapsuleGeometry(1.05, 2.6, 10, 24), M.white); hull.rotation.z = PI / 2; pod.add(hull);
  const nose = mesh(new THREE.SphereGeometry(0.9, 24, 16), M.chrome, 1.9, -0.05, 0); nose.scale.set(0.8, 0.75, 0.8); pod.add(nose);
  const stripe = mesh(new THREE.TorusGeometry(1.06, 0.07, 8, 32), M.orange, -0.4, 0, 0); stripe.rotation.y = PI / 2; pod.add(stripe);
  const can = mesh(new THREE.SphereGeometry(1.0, 24, 16), M.glass, 0.5, 0.55, 0, false); can.scale.set(1.1, 0.85, 0.9); pod.add(can);
  [0.7, -0.7].forEach((z) => { const t = mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.9, 16), M.steelDark, -1.9, 0, z); t.rotation.z = PI / 2; pod.add(t); const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("90,200,255"), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })); glow.scale.set(1.8, 1.8, 1); glow.position.set(-2.5, 0, z); pod.add(glow); pod.userData["g" + (z > 0 ? 0 : 1)] = glow; });
  pod.add(box(0.9, 0.12, 2.6, M.steelDark, -0.2, -1.05, 0));
  pod.add(mesh(new THREE.SphereGeometry(0.13, 8, 6), M.emis(0xff4040), 0.4, 1.4, 0, false));
})();
/* drones */
const drones = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group(), core = mesh(new THREE.SphereGeometry(0.42, 16, 12), M.white); g.add(core);
  const ring = mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 28), M.chrome, 0, 0, 0, false); ring.rotation.x = PI / 2; g.add(ring);
  const eye = mesh(new THREE.SphereGeometry(0.15, 10, 8), M.emis([0x66e0ff, 0xffb040, 0x7dff9a][i]), 0, 0, 0.36, false); g.add(eye);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("120,210,255"), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })); gl.scale.set(1.2, 1.2, 1); gl.position.y = -0.3; g.add(gl);
  g.userData = { ring, ph: i * 2.1 }; scene.add(g); drones.push(g);
}
/* dust motes */
const dust = (function () {
  const N = 260, p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { p[i * 3] = rnd(-40, 40); p[i * 3 + 1] = rnd(1, 30); p[i * 3 + 2] = rnd(-18, 14); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, color: 0xffd9a0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.frustumCulled = false; scene.add(pts); return { pts, p, N };
})();

/* ---------- actors ---------- */
const A = { agents: [], ambient: [], eva: [], deckExtra: [], hoses: [] };
let ready = false, lastOff = 99;
const DECK_SPOT = [
  { deck: () => deckL[2], x: -4.5, side: -1, kind: "weld" },
  { deck: () => deckL[0], x: -4.5, side: -1, kind: "wrench" },
  { deck: () => deckR[1], x: 4.5, side: 1, kind: "cable" },
  { deck: () => deckR[2], x: 4.5, side: 1, kind: "scan" }
];
const DEFAULT_COL = [[255, 138, 42], [90, 200, 255], [255, 200, 70], [160, 130, 255], [90, 255, 150], [255, 90, 140]];
function faceCamYaw(side) { return side < 0 ? PI / 2 - 0.62 : -PI / 2 + 0.62; }

const cableMat = new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: 0.4, roughness: 0.4, emissive: 0x00314a, emissiveIntensity: 0.4 });
let cableMesh = null;
const glowCable = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("120,220,255"), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
glowCable.scale.set(1.4, 1.4, 1); scene.add(glowCable);

function buildActors(gltf) {
  robotGltf = gltf;
  const box3 = new THREE.Box3().setFromObject(gltf.scene), sz = box3.getSize(V3(0, 0, 0)); robotH0 = sz.y || 1;
  // deck-working agents 01-04
  DECK_SPOT.forEach((sp, i) => {
    const r = makeRobot(DEFAULT_COL[i], 3.4, { anim: "Idle" }), d = sp.deck();
    r.root.position.set(sp.x, 0.11, 0.35); r.root.rotation.y = faceCamYaw(sp.side); d.add(r.root);
    r.spot = sp; r.index = i; A.agents[i] = r;
    if (sp.kind === "weld") { r.tool = torchTool(); } if (sp.kind === "wrench") { r.tool = wrenchTool(); } if (sp.kind === "scan") { r.tool = tabletTool(); }
    if (r.tool) scene.add(r.tool);
  });
  // forklift driver
  { const r = makeRobot(DEFAULT_COL[4], 2.1, { anim: "Sitting" }); r.root.position.set(-0.9, 1.65, 0); r.root.rotation.y = PI / 2; fork.add(r.root); r.index = 4; A.agents[4] = r; r.sit = true; }
  // pod pilot
  { const r = makeRobot(DEFAULT_COL[5], 1.7, { anim: "Sitting" }); r.root.position.set(0.5, -0.2, 0); r.root.rotation.y = PI / 2; pod.add(r.root); r.index = 5; A.agents[5] = r; r.sit = true; }
  // ambient floor walkers (dummy robots working around the hangar)
  const walkers = [
    { z: -8, cx: -2, amp: 17, sp: 0.07, ph: 0.4, col: [150, 200, 255], crate: true, h: 2.6 }, { z: -11.5, cx: 4, amp: 18, sp: 0.06, ph: 2.2, col: [255, 190, 110], crate: true, h: 2.6 },
    { z: -15, cx: 0, amp: 24, sp: 0.05, ph: 4.0, col: [150, 255, 190], crate: false, h: 2.8 }, { z: -5.8, cx: -14, amp: 8, sp: 0.09, ph: 5.0, col: [255, 230, 150], crate: true, h: 2.4 },
    { z: 6, cx: 18, amp: 7, sp: 0.08, ph: 0.9, col: [150, 230, 255], crate: false, h: 2.4 }, { z: 9, cx: -20, amp: 6, sp: 0.075, ph: 2.9, col: [255, 160, 160], crate: true, h: 2.4 }
  ];
  walkers.forEach((w) => {
    const r = makeRobot(w.col, w.h, { anim: "Walking" }); r.w = w; r.root.position.set(w.cx, 0, w.z); scene.add(r.root);
    r.play("Walking", 0, 1.05);
    if (w.crate) { const c = box(1.2, 1.0, 1.2, Math.random() > 0.5 ? M.crate : M.crateGrey, 0, w.h * 0.55, w.h * 0.45); c.add(box(1.04, 0.1, 1.04, M.orange, 0, 0.4, 0, false)); r.root.add(c); r.root.userData.crate = c; }
    A.ambient.push(r);
  });
  // extra deck crew (idle waves / thumbs up)
  [[deckL[3], -5.2, -1, "Wave", [255, 150, 200]], [deckR[3], 4.6, 1, "ThumbsUp", [190, 160, 255]], [deckR[0], 4.2, 1, "Yes", [150, 255, 220]]].forEach((e) => {
    const r = makeRobot(e[4], 3.0, { anim: e[3] }); r.root.position.set(e[1], 0.11, -0.2); r.root.rotation.y = faceCamYaw(e[2]); e[0].add(r.root); r.deckExtra = true; A.deckExtra.push(r);
  });
  // EVA robots outside the right window, working on a satellite
  [[-24, 12, -52, 0.4], [-33, 10.5, -52, -0.5]].forEach((e, i) => {
    const r = makeRobot(i ? [255, 220, 120] : [160, 220, 255], 3.0, { anim: "Idle" }); r.root.position.set(e[0], e[1], e[2]); r.root.rotation.y = e[3] + PI; scene.add(r.root); r.eva = i; A.eva.push(r);
    const jet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("120,200,255"), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })); jet.scale.set(1.6, 1.6, 1); jet.position.set(0, 1.2, -0.9); r.root.add(jet);
    r.root.traverse((o) => { o.castShadow = false; });
  });
  ready = true;
}

/* ---------- per-frame updates ---------- */
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _w2 = new THREE.Vector3(), _d = new THREE.Vector3();
function updateRobotsBase(dt) { robots.forEach((r) => r.mixer.update(dt)); }
function headScreen(r, extraY) {
  _v.copy(r.root.getWorldPosition(_w)); _v.y += r.h * 1.12 + (extraY || 0);
  _v.project(camera); return [(_v.x * 0.5 + 0.5) * W, (-_v.y * 0.5 + 0.5) * H, _v.z < 1];
}
function setCableCurve(a, b, sag, time) {
  const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= sag; mid.z += 0.4;
  const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5), mid, mid.clone().lerp(b, 0.5), b]);
  const geo = new THREE.TubeGeometry(curve, 20, 0.07, 6, false);
  if (!cableMesh) { cableMesh = new THREE.Mesh(geo, cableMat); cableMesh.castShadow = true; scene.add(cableMesh); } else { cableMesh.geometry.dispose(); cableMesh.geometry = geo; }
  const u = (time * 0.6) % 1; glowCable.position.copy(curve.getPoint(u));
}

function posAgents(o) {
  const t = o.t, dt = o.dt, off = o.off, ag = o.agents, scr = [];
  // retract decks away from the rocket during launch
  [deckL, deckR].forEach((arr, si) => { const s = si ? 1 : -1; arr.forEach((d) => { d.position.x = s * off * 1.0; }); });
  const fx = new THREE.Vector3();
  for (let i = 0; i < 6; i++) {
    const r = A.agents[i], a = ag[i] || { status: "idle", work: 0.4, rgb: DEFAULT_COL[i] };
    if (!r) { scr.push(null); continue; }
    r.setColor(a.rgb && a.rgb.length === 3 ? a.rgb : DEFAULT_COL[i]);
    const w = a.work === undefined ? 0.5 : a.work, err = a.status === "error", off0 = a.status === "off";
    const face = r.root.userData.face, ph = i * 1.9;
    if (face && face.morphTargetInfluences) { const d = face.morphTargetDictionary; face.morphTargetInfluences.fill(0); if (err && d.Angry !== undefined) face.morphTargetInfluences[d.Angry] = 0.9; else if (w > 0.8 && d.Surprised !== undefined) face.morphTargetInfluences[d.Surprised] = 0.25; }
    if (off0) r.play("Sitting"); else if (err) r.play("No", 0.3, 1.0); else if (i < 4) r.play("Idle"); else r.play("Sitting");
    r.pendingPose = { i: i, w: w, off: off0 || err, t: t, ph: ph };
    scr.push(null);
  }
  return scr;
}
const _t1 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _rt = new THREE.Vector3();
function aim(r, bone, child, x, y, z) {
  if (!bone || !child) return;
  r.root.getWorldQuaternion(_qa);
  _t1.set(x, y, z).normalize().applyQuaternion(_qa);
  bone.getWorldPosition(_p1); child.getWorldPosition(_p2); _p2.sub(_p1).normalize();
  _qb.setFromUnitVectors(_p2, _t1);
  bone.parent.getWorldQuaternion(_qc);
  _qa.copy(_qc).invert();
  bone.quaternion.premultiply(_qc).premultiply(_qb).premultiply(_qa);
  bone.updateMatrixWorld(true);
}
function sideOf(r, bone) {
  if (r.sideR !== undefined) return r.sideR;
  r.root.updateMatrixWorld(true);
  r.root.getWorldQuaternion(_qa); _rt.set(1, 0, 0).applyQuaternion(_qa);
  bone.getWorldPosition(_p1); r.root.getWorldPosition(_p2); _p1.sub(_p2);
  return (r.sideR = _p1.dot(_rt) >= 0 ? 1 : -1);
}
function applyPoses(o) {
  if (window.__nopose) return;
  const t = o.t;
  A.agents.forEach((r) => {
    if (!r || !r.pendingPose) return;
    const p = r.pendingPose, w = p.w, kind = r.spot ? r.spot.kind : "", b = r.b;
    if (p.off || !b.uaR || !b.uaL) return;
    const sR = sideOf(r, b.uaR), sL = -sR;   // lateral sign (local +x) of each arm
    if (kind === "weld") {
      const j = Math.sin(t * (3 + 5 * w) + p.ph) * 0.05 * w;
      aim(r, b.uaR, b.laR, 0.1 * sR, -0.15 + j, 1); aim(r, b.laR, b.palmR, 0.05 * sR, 0.1 + j, 1);
      aim(r, b.uaL, b.laL, 0.35 * sL, -0.7, 0.7); aim(r, b.laL, b.palmL, 0.1 * sL, 0.5, 0.9);
      rotBone(r, b.head, 1, 0, 0, 0.12);
    } else if (kind === "wrench") {
      const k = 0.5 + 0.5 * Math.sin(t * (1.6 + 2 * w) + p.ph);
      aim(r, b.uaR, b.laR, 0.2 * sR, 0.2 + 0.7 * k, 0.9); aim(r, b.laR, b.palmR, 0.1 * sR, 0.3 + 0.6 * k, 1);
      aim(r, b.uaL, b.laL, 0.35 * sL, -0.7, 0.7); aim(r, b.laL, b.palmL, 0.1 * sL, 0.5, 0.9);
      rotBone(r, b.abd, 1, 0, 0, 0.12);
    } else if (kind === "cable") {
      const a1 = Math.sin(t * 2.2 + p.ph) * 0.15 * (0.4 + w), a2 = Math.cos(t * 2.2 + p.ph) * 0.15 * (0.4 + w);
      aim(r, b.uaR, b.laR, 0.25 * sR, 0.1 + a1, 1); aim(r, b.laR, b.palmR, 0.15 * sR, 0.2 + a1, 1);
      aim(r, b.uaL, b.laL, 0.25 * sL, 0.1 + a2, 1); aim(r, b.laL, b.palmL, 0.15 * sL, 0.2 + a2, 1);
    } else if (kind === "scan") {
      aim(r, b.uaL, b.laL, 0.3 * sL, -0.45, 0.85); aim(r, b.laL, b.palmL, 0.25 * sL, 0.55, 0.85);
      const tap = Math.sin(t * 6) * 0.06 * (0.3 + w);
      aim(r, b.uaR, b.laR, 0.2 * sR, -0.35, 0.9); aim(r, b.laR, b.palmR, -0.1 * sR, 0.4 + tap, 1);
      rotBone(r, b.head, 1, 0, 0, 0.3 + Math.sin(t * 0.7 + p.ph) * 0.05);
    } else if (r.sit) {
      aim(r, b.uaR, b.laR, 0.2 * sR, -0.5, 1); aim(r, b.laR, b.palmR, 0.05 * sR, 0.05, 1);
      aim(r, b.uaL, b.laL, 0.2 * sL, -0.5, 1); aim(r, b.laL, b.palmL, 0.05 * sL, 0.05, 1);
      rotBone(r, b.head, 0, 1, 0, Math.sin(t * 0.8 + p.ph) * 0.35);
    }
  });
}
function placeTools(o) {
  const t = o.t, out = { weld: null, wrench: null };
  A.agents.forEach((r) => {
    if (!r || !r.tool || !r.spot) return;
    const kind = r.spot.kind, p = r.pendingPose;
    r.tool.visible = !!p && !p.off;
    if (!r.tool.visible) return;
    if (kind === "scan") { bonePos(r, r.b.palmL, _w); r.tool.position.copy(_w); r.tool.position.y += 0.05; r.root.getWorldQuaternion(r.tool.quaternion); r.tool.rotateX(-0.5); r.tool.rotateY(r.spot.side < 0 ? 0.35 : -0.35); r.tool.translateZ(0.2); return; }
    bonePos(r, r.b.palmR, _w); r.tool.position.copy(_w);
    // tool points forward (toward rocket)
    const dir = _d.set(r.spot.side * 1, 0.1, 0.1).normalize();
    r.tool.quaternion.setFromUnitVectors(V3(0, 0, 1), dir);
    if (kind === "weld") out.weld = r; if (kind === "wrench") out.wrench = r;
  });
  return out;
}

function frame(o) {
  if (!ready) return null;
  const { tc, dt, t, rise, off } = o, ag = o.agents || [];
  // resize
  const wNew = o.W, hNew = o.H;
  if (wNew !== W || hNew !== H || o.DPR !== DPR) resize(wNew, hNew, o.DPR, o.bottom);
  // build stages
  const buildT = tc < 28 ? tc : 99, fr = [];
  for (let i = 0; i < 5; i++) fr.push(ease((buildT - i * SEGROW) / 4.2));
  // shake + rocket
  let sx = 0, sz = 0;
  if (tc > 39 && tc < 47) { const kk = clamp((tc - 39) / 3, 0, 1) * (tc > T_LAUNCH ? 1.2 : 1); sx = (Math.random() - 0.5) * 0.1 * kk; sz = (Math.random() - 0.5) * 0.1 * kk; }
  rocket.position.set(sx, rise, sz);
  const burn = tc >= 39 && tc < 52 ? clamp((tc - 39) / 3, 0, 1) : 0;
  stages.forEach((g, i) => { g.visible = fr[i] > 0.01; g.position.y = (1 - fr[i]) * 22; });
  // crane hook lowering stages during build
  let hookY = 30, hookOn = false;
  for (let i = 4; i >= 0; i--) { if (fr[i] > 0.01 && fr[i] < 0.995) { hookY = stages[i].userData.top + (1 - fr[i]) * 22 + 1.6; hookOn = true; break; } }
  hook.visible = hookOn; craneCable.visible = hookOn;
  if (hookOn) { hook.position.set(sx, hookY, 0); const len = craneY - 1.6 - hookY; craneCable.scale.set(0.14, Math.max(0.1, len), 0.14); craneCable.position.set(sx, hookY + len / 2, 0); }
  trolley.position.x = sx;
  // flames
  const lift = clamp(rise / 6, 0, 1);
  flames.forEach((g, i) => {
    const flick = 0.85 + Math.random() * 0.3, len = burn * (g.userData.k < 1 ? 0.8 : 0.9) * (1 + lift * 1.8) * flick;
    g.visible = burn > 0.02; g.scale.set(1 + burn * 0.15, Math.max(0.01, len), 1 + burn * 0.15);
  });
  bellGlow.forEach((g) => { g.visible = burn > 0.01; });
  bellMat.emissiveIntensity = burn * 2.5;
  glowSprite.visible = burn > 0.02; glowSprite.position.set(0, 0.2, 0.8); glowSprite.scale.setScalar(6 + burn * 5 * (1 + Math.random() * 0.1)); glowSprite.material.opacity = burn * 0.55;
  engineLight.position.set(sx, rise + 1.2, 3); engineLight.intensity = burn * 650 * (0.9 + Math.random() * 0.2);
  // smoke + steam
  if (burn > 0.05) {
    for (let k = 0; k < 2; k++) {
      const gy = Math.max(0.5, rise * 0.9 + 0.6);
      if (rise < 18) { const a = Math.random() * TAU, sp = rnd(4, 9); emitSmoke(Math.cos(a) * 1.5, 0.6, Math.sin(a) * 1.5, Math.cos(a) * sp, rnd(0.4, 3), Math.sin(a) * sp, 1.8, 7.5, 3.2, 0.55, 0.8); }
      else emitSmoke(sx + rnd(-1, 1), gy, sz + rnd(-1, 1), rnd(-1, 1), -2, rnd(-1, 1), 1.6, 5, 2.4, 0.35, 0.5);
    }
  }
  if (tc > 32 && tc < 42 && fr[3] > 0.9 && Math.random() < dt * 22) emitSmoke((Math.random() > 0.5 ? 1 : -1) * 1.6, 6 + Math.random() * 6, rnd(-0.6, 0.6), (Math.random() > 0.5 ? 1 : -1) * 0.5, -0.8, 0.5, 0.5, 1.8, 1.6, 0.5, 0);
  updateSmoke(dt);
  // lamp shafts flicker, dust drift
  lamps.forEach((l, i) => { l.intensity = (i < 3 ? 320 : 220) * (0.96 + 0.04 * Math.sin(t * 1.3 + i)); });
  const pp = dust.p; for (let i = 0; i < dust.N; i++) { pp[i * 3 + 1] += dt * 0.25; pp[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.1; if (pp[i * 3 + 1] > 32) pp[i * 3 + 1] = 1; } dust.pts.geometry.attributes.position.needsUpdate = true;
  // space bodies
  earth.rotation.y = t * 0.012; earthMat.uniforms.cloudShift.value = t * 0.0012;
  moon.rotation.y = t * 0.01; station.rotation.z = 0.3 + t * 0.06; station.position.x = 45 + Math.sin(t * 0.04) * 3;
  sat.rotation.y = t * 0.3;
  A.eva.forEach((r, i) => { r.root.position.y = 12 - i * 1.6 + Math.sin(t * 0.7 + i * 2) * 0.35; r.root.position.x = -24 - i * 9 + Math.sin(t * 0.3 + i) * 0.5; });
  // screens
  screens.forEach((s) => paintScreen(s, t));
  // animated actors
  posAgents(o);
  updateRobotsBase(dt);
  applyPoses(o);
  const tools = placeTools(o);
  // sparks + weld light
  if (tools.weld && A.agents[0].pendingPose && !A.agents[0].pendingPose.off) {
    const tp = tools.weld.tool.userData.tip ? tools.weld.tool.userData.tip.getWorldPosition(_w2) : _w2.copy(tools.weld.tool.position);
    weldLight.position.copy(tp); weldLight.intensity = (3 + Math.random() * 10) * A.agents[0].pendingPose.w;
    if (Math.random() < A.agents[0].pendingPose.w * 0.8) emitSpark(tp, V3(A.agents[0].spot.side, 0.2, 0.2), rnd(2, 6), 3);
    tools.weld.tool.userData.tip.scale.setScalar(0.8 + Math.random() * 0.8);
  } else weldLight.intensity = 0;
  if (tools.wrench && Math.random() < 0.06 * tools.wrench.pendingPose.w) emitSpark(tools.wrench.tool.position, V3(tools.wrench.spot.side, 0.3, 0.2), 3, 2);
  updateSparks(dt);
  // cable robot (agent 03)
  { const r = A.agents[2]; if (r && r.pendingPose && !r.pendingPose.off) { const a = bonePos(r, r.b.palmR, V3(0, 0, 0)), b2 = bonePos(r, r.b.palmL, V3(0, 0, 0)), hand = a.add(b2).multiplyScalar(0.5); const port = V3(Rc * 0.9 + sx, 7.4 + rise, 0.3); setCableCurve(hand, port, 1.2, t); cableMesh.visible = true; glowCable.visible = true; } else if (cableMesh) { cableMesh.visible = false; glowCable.visible = false; } }
  // forklift
  { const fxp = 14 * Math.sin(t * 0.07 + 1.0), vx = Math.cos(t * 0.07 + 1.0), yaw = vx >= 0 ? 0 : PI; fork.position.set(fxp, 0, -5.2); fork.rotation.y = yaw + (A.agents[4] && A.agents[4].pendingPose ? 0 : 0);
    const k = 0.5 + 0.5 * Math.sin(t * 0.7); fork.userData.carriage.position.y = 0.9 + 1.7 * k;
    fork.userData.beacon.visible = Math.sin(t * 8) > 0; fork.userData.beacon.material.color.setHex(a_status(ag, 4) === "error" ? 0xff3030 : 0xffb020);
  }
  // pod
  { const px = -14 + 4 * Math.sin(t * 0.09), py = 14 + 1.2 * Math.sin(t * 0.5), pz = 4 + 2 * Math.cos(t * 0.09), vx = Math.cos(t * 0.09);
    pod.position.set(px, py, pz); pod.rotation.set(0, vx >= 0 ? 0 : PI, 0.05 * Math.sin(t * 0.9)); pod.rotation.z += Math.sin(t * 0.9) * 0.04;
    const fl = 1.0 + Math.sin(t * 40) * 0.15; pod.userData.g0.scale.set(fl * 1.5, fl * 1.5, 1); pod.userData.g1.scale.set(fl * 1.5, fl * 1.5, 1);
  }
  // walkers
  A.ambient.forEach((r, i) => {
    const w = r.w, a = t * w.sp * 2.0 + w.ph, x = w.cx + w.amp * Math.sin(a), vx = Math.cos(a);
    r.root.position.set(x, 0, w.z); r.root.rotation.y = vx >= 0 ? PI / 2 : -PI / 2;
  });
  // drones
  drones.forEach((g, i) => { const a = t * 0.35 + g.userData.ph; g.position.set(Math.sin(a) * (15 + i * 5), 17 + i * 2.5 + Math.sin(a * 2.3) * 1.2, 7 - i * 5 + Math.cos(a) * 3); g.rotation.y = a * 2; g.userData.ring.rotation.z = t * 3 + i; });
  // camera
  const followY = clamp(rise * 0.28, 0, 15), shakeC = tc > 39 && tc < 50 ? (Math.random() - 0.5) * 0.12 * burn : 0;
  const dist = frame.dist;
  camera.position.set(Math.sin(t * 0.13) * 2.6 + shakeC, 9.0 + clamp(rise * 0.12, 0, 7) + Math.sin(t * 0.17) * 0.35 + shakeC, dist - clamp(rise * 0.06, 0, 5));
  camera.lookAt(0, 9.6 + followY, 0);
  if (window.__cam) { const c = window.__cam; camera.position.set(c.p[0], c.p[1], c.p[2]); camera.lookAt(c.t[0], c.t[1], c.t[2]); if (c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); } if (c.noOffset) camera.clearViewOffset(); }
  key.target.position.set(0, 8 + followY, 0); key.position.set(-22, 40 + followY, 36);
  camera.updateMatrixWorld(true);
  // project agent labels
  const sc = [];
  for (let i = 0; i < 6; i++) { const r = A.agents[i]; sc.push(r ? headScreen(r, i === 5 ? 0.2 : 0) : null); }
  composer.render(dt);
  return { fr: fr, burn: burn, scr: sc };
}
function a_status(ag, i) { return ag[i] ? ag[i].status : "idle"; }

/* ---------- sizing ---------- */
function resize(w, h, dpr, bottom) {
  W = w; H = h; DPR = dpr;
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  renderer.domElement.style.width = W + "px"; renderer.domElement.style.height = H + "px";
  composer.setPixelRatio(DPR); composer.setSize(W, H);
  camera.aspect = W / H;
  lastBottom = bottom;
  const top = 52, hv = Math.max(120, H - top - bottom), fov = camera.fov * PI / 180;
  const worldH = 22, d = (worldH * H) / (hv * 2 * Math.tan(fov / 2));
  frame.dist = d;
  camera.near = 1; camera.far = 1400;
  // shift the scene into the area not covered by HUD panels
  const xoff = (W > 980 ? W * 0.08 : 0), yoff = (bottom - top) / 2;
  camera.setViewOffset(W, H, xoff, yoff, W, H);
  camera.updateProjectionMatrix();
}

/* ---------- init ---------- */
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.28, 0.45, 1.05);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const API = {
  ready: false, canvas: renderer.domElement,
  render(o) {
    return frame(o);
  },
  setQuality(q) {
    quality = q;
    bloomPass.enabled = q >= 2;
    renderer.shadowMap.enabled = q >= 1; key.castShadow = q >= 1;
  }
};
window.Space3D = API;
new GLTFLoader().load(new URL("./vendor/RobotExpressive.glb", import.meta.url).href, (gltf) => {
  try { buildActors(gltf); API.ready = true; if (window.SpaceStage && window.SpaceStage.ready3d) window.SpaceStage.ready3d(); } catch (e) { console.error("Space3D init failed", e); API.failed = true; }
}, undefined, (e) => { console.error("Space3D model load failed", e); API.failed = true; });

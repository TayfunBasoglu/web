// The Sosis Game
// Sosis çubuklarla getirilir; ilk dokunuş onu bırakır, sonraki dokunuşlar tavayı kaldırıp sosisi fırlatır.
// Amaç, sosisi her bölümdeki nesnenin üstüne (ya da içine) kondurmaktır.
// Fizik 2B düzlemde çalışır; sahne Three.js ile çizilir.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { LEVEL_DATA, BG_GRAD } from './sosis-levels.js';

/* ====================================================================== */
/*  Fizik                                                                 */
/* ====================================================================== */

export const H = 1 / 240;            // sabit fizik adımı (sn)
const GRAV = 20;
const ITER = 8;                      // kısıt çözücü yineleme sayısı

// Sosis: N noktalı yumuşak bir zincir.
const N = 7, RAD = 0.27, SEG = 0.34;
const REST = 0.22;                   // çarpışmada sekme katsayısı
const K_BEND = 0.1, K_BEND2 = 0.05;
const BEND2 = 2 * SEG * 0.99813, BEND3 = 3 * SEG * 0.99503;   // durgun hâlde hafif kavis
const WIN_HOLD = 1.0;                // sosis nesnenin üstünde bu kadar süre durursa bölüm biter
const STILL_COM = 0.3, STILL_PT = 1.2;   // "durmuş" sayılmak için ağırlık merkezi ve en hızlı nokta hız sınırı
const MAX_DEPEN = 15, DEPEN_STEP = MAX_DEPEN * H;

// Tava. Ölçüler dönme noktasına (sapın tavaya birleştiği yer) göredir.
const PIVOT_X = -7.47, PIVOT_Y = -2.02;
const PAN_CX = 1.5, PAN_CY = -0.2;   // taban ortası
const PAN_HALF = 1.55, PAN_RIM = 1.83, PAN_WALL = 0.2;
const PAN_MU = 0.04;
const REST_TILT = -0.216;            // dururken uç aşağıda
const SWING_MAX = 0.4, SWING_UP = 0.07, SWING_DOWN = 0.2, SWING_STAY = 0.01;
const PAN_PUSH = 0.8;                // tavanın gövdesinden sosise geçen en yüksek açısal hız
// Vuruş: dikeyden KICK_DIR kadar ileri bir itiş; hız noktanın dönme noktasına uzaklığıyla artar
// (uçta en güçlü). Sosisin tava boyunca kayma hızı korunur, böylece hızlı kayarken vurulan sosis
// daha yatık ve uzağa gider.
const KICK = 19, KICK_DIR = 0.32;

// Çubuklar: sosisi üst ucundan tutup soldan içeri getirir.
const GRIP_X = -7.06, GRIP_Y = 3.86;
const GRIP_IN_FROM = 3.6, GRIP_IN = 0.8;
const HOLD_A0 = -1.35, HOLD_A1 = -0.56;
const GRIP_MIN = 0.35;               // bu süreden önce bırakılamaz
const DROP_SPIN = -1.3;

const smooth = (s) => s * s * (3 - 2 * s), dsmooth = (s) => 6 * s * (1 - s);

function boxShape(p) {
  const ang = (p.a || 0) * Math.PI / 180;
  return {
    sh: 'box', role: p.role, part: p, cx: p.x, cy: p.y, hw: p.w / 2, hh: p.h / 2,
    ang, cos: Math.cos(ang), sin: Math.sin(ang), vx: 0, vy: 0, w: 0, mu: p.mu ?? 0.9, rest: p.rest ?? REST
  };
}

// Tavanın çarpışma parçaları (tavanın kendi çerçevesinde). Gövdeler görünenden kalındır ki tava
// hızla kalkarken sosis tabanın öbür yanına geçemesin. Sap tarafındaki kenar alçaktır: tava basılı
// tutulunca sosis geriye kayıp sapın üstünden düşebilir.
function panParts() {
  return [
    { ox: PAN_CX, oy: PAN_CY - 1.0, w: 2 * PAN_HALF + 0.2, h: 2.0, a: 0 },
    { ox: PAN_CX - PAN_HALF - 0.05, oy: PAN_CY - 0.1, w: 0.3, h: 0.16, a: 25 },
    { ox: PAN_CX + 1.62, oy: PAN_CY - 0.03, w: 0.6, h: 0.2, a: 18 }
  ].map((p) => boxShape({ ...p, role: 'pan', mu: PAN_MU, x: PIVOT_X + p.ox, y: PIVOT_Y + p.oy, a0: p.a * Math.PI / 180 }));
}

// Nesnenin çarpışma şekli: ekranın tamamını kaplayan ızgarada işaretli uzaklık alanı
// (dışarıda artı, içeride eksi). Ekran kenarına değen nesneler o yönde sürüyormuş gibi davranır.
function fieldD(f, X, Y) {
  let u = (X - f.x0) / f.cs - 0.5, v = (f.y0 - Y) / f.cs - 0.5, ex = 0, ey = 0;
  const W = f.w, Hh = f.h, D = f.d;
  if (u < 0) { ex = -u; u = 0; } else if (u > W - 1) { ex = u - (W - 1); u = W - 1; }
  if (v < 0) { ey = -v; v = 0; } else if (v > Hh - 1) { ey = v - (Hh - 1); v = Hh - 1; }
  const i0 = u | 0, j0 = v | 0, i1 = i0 + 1 < W ? i0 + 1 : i0, j1 = j0 + 1 < Hh ? j0 + 1 : j0;
  const fu = u - i0, fv = v - j0;
  const a = D[j0 * W + i0] + (D[j0 * W + i1] - D[j0 * W + i0]) * fu;
  const b = D[j1 * W + i0] + (D[j1 * W + i1] - D[j1 * W + i0]) * fu;
  let d = a + (b - a) * fv;
  if (d > 0 && (ex || ey)) d += Math.hypot(ex, ey);
  return d * f.cs;
}

// Felzenszwalb kare uzaklık dönüşümü (tek boyut).
function edt1(f, n, out, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    do { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k]) k--; else break; } while (k >= 0);
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; out[q] = (q - p) * (q - p) + f[p]; }
}
function edt2(mask, W, Hh, target) {
  const g = new Float64Array(W * Hh), n = Math.max(W, Hh);
  const f = new Float64Array(n), o = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < W * Hh; i++) g[i] = mask[i] === target ? 0 : 1e12;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < Hh; y++) f[y] = g[y * W + x];
    edt1(f, Hh, o, v, z);
    for (let y = 0; y < Hh; y++) g[y * W + x] = o[y];
  }
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    edt1(f, W, o, v, z);
    for (let x = 0; x < W; x++) g[y * W + x] = o[x];
  }
  return g;
}
function makeField(mask, W, Hh, cam, mu) {
  const toIn = edt2(mask, W, Hh, 1), toOut = edt2(mask, W, Hh, 0), d = new Float32Array(W * Hh);
  let x0 = W, x1 = -1, y0 = Hh, y1 = -1;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (mask[k]) {
      d[k] = -(Math.sqrt(toOut[k]) - 0.5);
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
    } else d[k] = Math.sqrt(toIn[k]) - 0.5;
  }
  const cs = 20 / cam.z / W, fx0 = cam.cx - 10 / cam.z, fy0 = cam.cy + 5.625 / cam.z;
  return {
    d, w: W, h: Hh, cs, x0: fx0, y0: fy0, mu,
    // Çarpışma testini hızlandıran sınırlar; ekran kenarına değen yönde sınırsız.
    bx0: x0 <= 0 ? -Infinity : fx0 + x0 * cs, bx1: x1 >= W - 1 ? Infinity : fx0 + (x1 + 1) * cs,
    by1: y0 <= 0 ? Infinity : fy0 - y0 * cs, by0: y1 >= Hh - 1 ? -Infinity : fy0 - (y1 + 1) * cs,
    box: [fx0 + Math.max(0, x0) * cs, fy0 - (Math.min(Hh - 1, y1) + 1) * cs, fx0 + (Math.min(W - 1, x1) + 1) * cs, fy0 - Math.max(0, y0) * cs]
  };
}

export class World {
  constructor(def) {
    this.pvx = PIVOT_X; this.pvy = PIVOT_Y;
    this.shapes = [...panParts(), ...def.parts.map(boxShape)];
    if (def.field) {
      this.shapes.push({ sh: 'field', role: 't', f: def.field, part: null, cx: 0, cy: 0, vx: 0, vy: 0, w: 0, mu: def.field.mu, rest: REST });
    }
    this.view = def.view;
    this.killY = def.view.cy - def.view.hh - 1.9;
    this.radial = def.radial || null;   // çekim merkezi (Ay bölümü)
    this.glue = def.glue || null;       // yapışkan bölge [x0, y0, x1, y1]
    this.x = new Float64Array(N); this.y = new Float64Array(N);
    this.px = new Float64Array(N); this.py = new Float64Array(N);
    this.cs = new Int16Array(N);
    this.cnx = new Float64Array(N); this.cny = new Float64Array(N);
    this.cvn = new Float64Array(N);
    this.bud = new Float64Array(N);
    this.kv = new Float64Array(N);
    this.kickT = 0;
    this.panHeld = false;
    this.swing = -1;                    // tavanın savrulmasından beri geçen süre; -1 = duruyor
    this.panTh = REST_TILT;
    this.events = [];
    this.spawn();
  }

  spawn() {
    this.gx = GRIP_X - GRIP_IN_FROM; this.gy = GRIP_Y;
    for (let i = 0; i < N; i++) {
      const d = (N - 1 - i) * SEG;      // son nokta çubukların tuttuğu uç
      this.x[i] = this.px[i] = this.gx + Math.cos(HOLD_A0) * d;
      this.y[i] = this.py[i] = this.gy + Math.sin(HOLD_A0) * d;
    }
    this.state = 'hold';                // hold | play | win | lost
    this.glued = null;
    this.holdT = 0;
    this.panT = 0; this.lockT = 0; this.airT = 0;
    this.winT = 0; this.idleT = 0; this.outT = 0; this.lostT = 0;
  }

  com() {
    let x = 0, y = 0;
    for (let i = 0; i < N; i++) { x += this.x[i]; y += this.y[i]; }
    return { x: x / N, y: y / N };
  }

  maxSpeed() {
    let m = 0;
    for (let i = 0; i < N; i++) m = Math.max(m, Math.hypot(this.x[i] - this.px[i], this.y[i] - this.py[i]) / H);
    return m;
  }

  comSpeed() {
    let vx = 0, vy = 0;
    for (let i = 0; i < N; i++) { vx += this.x[i] - this.px[i]; vy += this.y[i] - this.py[i]; }
    return Math.hypot(vx, vy) / (N * H);
  }

  // Dokunuş: sosis tutuluyorsa bırakılır; tava kalkar ve basılı tutuldukça yukarıda bekler.
  hit(hold = false) {
    if (this.state !== 'play' && this.state !== 'hold') return false;
    let did = false;
    if (this.state === 'hold') {
      if (this.holdT < GRIP_MIN) return false;
      const c = this.com();
      for (let i = 0; i < N; i++) {
        const rx = this.x[i] - c.x, ry = this.y[i] - c.y;
        this.px[i] = this.x[i] + DROP_SPIN * ry * H;
        this.py[i] = this.y[i] - DROP_SPIN * rx * H;
      }
      this.state = 'play'; did = true;
    }
    if (this.swing < 0) {
      this.swing = 0; this.panHeld = hold; did = true;
      this.events.push({ type: 'swing' });
      this._kick();
    }
    return did;
  }

  release() { this.panHeld = false; }

  // Tavanın kalkarken süpürdüğü kama biçimli bölgedeki noktalara vurur. Sosisin yalnızca bir kısmı
  // bölgedeyse yalnızca o kısım vurulur; sosis döner ve daha zayıf gider.
  _kick() {
    const ct = Math.cos(REST_TILT), st = Math.sin(REST_TILT), tipU = PAN_CX + PAN_RIM;
    const ks = Math.sin(KICK_DIR), kc = Math.cos(KICK_DIR);
    for (let i = 0; i < N; i++) {
      this.kv[i] = 0;
      const dx = this.x[i] - this.pvx, dy = this.y[i] - this.pvy;
      const u = dx * ct + dy * st, v = -dx * st + dy * ct - PAN_CY;
      if (u < -0.4 || u > tipU + 0.3) continue;
      if (v < -0.2 || v > Math.max(0.3, u * SWING_MAX) + RAD + 0.25) continue;
      const k = KICK * Math.max(u, 0.2) / tipU;
      const vt = ((this.x[i] - this.px[i]) * ct + (this.y[i] - this.py[i]) * st) / H;
      this.px[i] = this.x[i] - (vt * ct + k * ks) * H;
      this.py[i] = this.y[i] - (vt * st + k * kc) * H;
      this.kv[i] = k;
      this.kickT = 0.08; this.lockT = 0.1; this.panT = 0;
    }
  }

  // Tava hızla kalkar, en az SWING_STAY (basılıysa bırakılana kadar) yukarıda bekler, sonra iner.
  _updatePan() {
    let th = REST_TILT, om = 0;
    if (this.swing >= 0) {
      const top = SWING_UP + SWING_STAY;
      if (!(this.panHeld && this.swing >= top)) this.swing += H;
      if (this.swing < SWING_UP) {
        const s = this.swing / SWING_UP; th += SWING_MAX * smooth(s); om = SWING_MAX * dsmooth(s) / SWING_UP;
      } else if (this.swing < top || this.panHeld) th += SWING_MAX;
      else if (this.swing < top + SWING_DOWN) {
        const s = (this.swing - top) / SWING_DOWN; th += SWING_MAX * (1 - smooth(s)); om = -SWING_MAX * dsmooth(s) / SWING_DOWN;
      } else this.swing = -1;
    }
    this.panTh = th;
    const push = Math.max(-PAN_PUSH, Math.min(PAN_PUSH, om));
    const c = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) {
      const s = this.shapes[k], p = s.part;
      const rx = p.ox * c - p.oy * sn, ry = p.ox * sn + p.oy * c;
      s.cx = this.pvx + rx; s.cy = this.pvy + ry;
      s.ang = p.a0 + th; s.cos = Math.cos(s.ang); s.sin = Math.sin(s.ang);
      s.vx = -push * ry; s.vy = push * rx; s.w = push;
    }
  }

  _lose(why) {
    const c = this.com();
    this.state = 'lost'; this.lostT = 0.45;
    this.events.push({ type: 'lost', why, x: c.x, y: c.y });
  }

  _dist(i, j, rest, k) {
    const dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i];
    const d = Math.hypot(dx, dy) || 1e-9;
    const f = (d - rest) / d * 0.5 * k;
    this.x[i] += dx * f; this.y[i] += dy * f;
    this.x[j] -= dx * f; this.y[j] -= dy * f;
  }

  step() {
    const S = this.shapes, x = this.x, y = this.y, px = this.px, py = this.py;
    const cs = this.cs, cnx = this.cnx, cny = this.cny, cvn = this.cvn, bud = this.bud;
    this._updatePan();

    if (this.state === 'lost') {
      this.lostT -= H;
      if (this.lostT <= 0) this.spawn();
      return;
    }
    if (this.state === 'win') return;   // kazanınca sosis olduğu yerde kalır

    // Tutulurken uçtaki iki nokta çubuklara bağlıdır, gerisi kendi ağırlığıyla sarkar.
    const holding = this.state === 'hold';
    const gpx = this.gx;
    let hdx = 0, hdy = 0;
    if (holding) {
      this.holdT += H;
      this.gx = GRIP_X - GRIP_IN_FROM * (1 - smooth(Math.min(1, this.holdT / GRIP_IN)));
      const a = HOLD_A0 + (HOLD_A1 - HOLD_A0) * smooth(Math.min(1, this.holdT / (GRIP_IN + 0.15)));
      hdx = Math.cos(a) * SEG; hdy = Math.sin(a) * SEG;
    }

    const drag = holding ? 0.985 : 1;
    const rad = this.radial, gl = this.glued;
    for (let i = 0; i < N; i++) {
      let gx = 0, gy = -GRAV;
      if (rad) { const dx = rad[0] - x[i], dy = rad[1] - y[i], l = Math.hypot(dx, dy) || 1; gx = GRAV * dx / l; gy = GRAV * dy / l; }
      const vx = (x[i] - px[i]) * drag + gx * H * H, vy = (y[i] - py[i]) * drag + gy * H * H;
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx; y[i] += vy;
      cs[i] = -1; bud[i] = DEPEN_STEP;
    }

    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < N - 1; i++) this._dist(i, i + 1, SEG, 1);
      for (let i = 0; i < N - 2; i++) this._dist(i, i + 2, BEND2, K_BEND);
      for (let i = 0; i < N - 3; i++) this._dist(i, i + 3, BEND3, K_BEND2);
      if (holding) { x[N - 1] = this.gx; y[N - 1] = this.gy; x[N - 2] = this.gx + hdx; y[N - 2] = this.gy + hdy; }
      if (gl) { x[gl.i] = gl.x; y[gl.i] = gl.y; }

      for (let i = 0; i < N; i++) {
        for (let k = 0; k < S.length; k++) {
          const s = S[k];
          let wx, wy, pen;
          if (s.sh === 'field') {
            const f = s.f, X = x[i], Y = y[i];
            if (X < f.bx0 - RAD || X > f.bx1 + RAD || Y < f.by0 - RAD || Y > f.by1 + RAD) continue;
            const d = fieldD(f, X, Y);
            if (d >= RAD) continue;
            const h = f.cs;
            const nx = fieldD(f, X + h, Y) - fieldD(f, X - h, Y), ny = fieldD(f, X, Y + h) - fieldD(f, X, Y - h);
            const l = Math.hypot(nx, ny);
            if (l < 1e-9) { wx = 0; wy = 1; } else { wx = nx / l; wy = ny / l; }
            pen = RAD - d;
          } else {
            const dx = x[i] - s.cx, dy = y[i] - s.cy;
            const lx = dx * s.cos + dy * s.sin, ly = -dx * s.sin + dy * s.cos;
            const ex = s.hw, ey = s.hh;
            if (lx > ex + RAD || lx < -ex - RAD || ly > ey + RAD || ly < -ey - RAD) continue;
            const qx = lx < -ex ? -ex : lx > ex ? ex : lx;
            const qy = ly < -ey ? -ey : ly > ey ? ey : ly;
            let nx, ny;
            if (qx === lx && qy === ly) {
              const rx = ex - Math.abs(lx), ry = ey - Math.abs(ly);
              if (rx < ry) { nx = lx < 0 ? -1 : 1; ny = 0; pen = rx + RAD; }
              else { nx = 0; ny = ly < 0 ? -1 : 1; pen = ry + RAD; }
            } else {
              const ddx = lx - qx, ddy = ly - qy, d = Math.hypot(ddx, ddy);
              if (d >= RAD) continue;
              nx = ddx / d; ny = ddy / d; pen = RAD - d;
            }
            wx = nx * s.cos - ny * s.sin; wy = nx * s.sin + ny * s.cos;
          }
          if (cs[i] < 0 || wy > cny[i]) {
            const cxp = x[i] - wx * RAD, cyp = y[i] - wy * RAD;
            const svx = s.vx - s.w * (cyp - s.cy), svy = s.vy + s.w * (cxp - s.cx);
            const pre = ((x[i] - px[i]) / H - svx) * wx + ((y[i] - py[i]) / H - svy) * wy;
            cvn[i] = cs[i] < 0 ? pre : Math.min(cvn[i], pre);
            cs[i] = k; cnx[i] = wx; cny[i] = wy;
          }
          if (pen > bud[i]) pen = bud[i];
          bud[i] -= pen;
          x[i] += wx * pen; y[i] += wy * pen;
        }
      }
    }
    if (holding) {
      x[N - 1] = this.gx; y[N - 1] = this.gy; px[N - 1] = gpx; py[N - 1] = this.gy; cs[N - 1] = -1;
      x[N - 2] = this.gx + hdx; y[N - 2] = this.gy + hdy; px[N - 2] = gpx + hdx; py[N - 2] = this.gy + hdy; cs[N - 2] = -1;
    }
    if (gl) { x[gl.i] = px[gl.i] = gl.x; y[gl.i] = py[gl.i] = gl.y; cs[gl.i] = -1; }

    // Temas hızları: yüzeyle birlikte hareket, sınırlı sekme ve sürtünme.
    let panTouch = false, tPts = 0, pPts = 0, hardest = 0, any = false;
    for (let i = 0; i < N; i++) {
      if (cs[i] < 0) continue;
      any = true;
      const s = S[cs[i]], nx = cnx[i], ny = cny[i];
      const cxp = x[i] - nx * RAD, cyp = y[i] - ny * RAD;
      const svx = s.vx - s.w * (cyp - s.cy), svy = s.vy + s.w * (cxp - s.cx);
      const rx = (x[i] - px[i]) / H - svx, ry = (y[i] - py[i]) / H - svy;
      const vn = rx * nx + ry * ny;
      let tx = rx - vn * nx, ty = ry - vn * ny;
      const pre = cvn[i];
      let newVn = Math.min(Math.max(vn, 0), this.kickT > 0 ? Math.max(2, this.kv[i]) : 2);
      if (pre < -4) newVn = Math.max(newVn, -pre * s.rest);
      const fmax = s.mu * (Math.max(0, -pre) + GRAV * H * 0.5);
      const tl = Math.hypot(tx, ty);
      if (tl <= fmax) { tx = 0; ty = 0; } else { const f = (tl - fmax) / tl; tx *= f; ty *= f; }
      px[i] = x[i] - (svx + newVn * nx + tx) * H;
      py[i] = y[i] - (svy + newVn * ny + ty) * H;
      if (-pre > hardest) hardest = -pre;
      if (s.role === 'pan') { pPts++; if (ny > 0.3) panTouch = true; } else tPts++;
    }

    if (any) {
      if (this.airT > 0.2 && hardest > 3) { const c = this.com(); this.events.push({ type: 'land', x: c.x, y: c.y - RAD, v: hardest }); }
      this.airT = 0;
    } else this.airT += H;

    if (this.kickT > 0) this.kickT -= H;
    if (this.lockT > 0) this.lockT -= H;
    else if (panTouch) this.panT = 0.12;
    if (!panTouch) this.panT -= H;

    if (this.state !== 'play') return;

    if (this.glue && !this.glued) {
      const [gx0, gy0, gx1, gy1] = this.glue;
      for (let i = 0; i < N; i++) {
        if (cs[i] < 0 || S[cs[i]].sh !== 'field') continue;
        const qx = x[i] - cnx[i] * RAD, qy = y[i] - cny[i] * RAD;
        if (qx >= gx0 && qx <= gx1 && qy >= gy0 && qy <= gy1) {
          this.glued = { i, x: x[i], y: y[i] };
          this.events.push({ type: 'land', x: qx, y: qy, v: 6 });
          break;
        }
      }
    }

    const c = this.com(), V = this.view;
    if (c.y < this.killY || Math.abs(c.x - V.cx) > V.hw + 3 || (this.radial && c.y > V.cy + V.hh + 2)) { this._lose('fall'); return; }
    // Kazanmak için sosis nesneye değmeli (tavaya değmeden) ve durmuş olmalı; üstünden kayıp
    // düşen sosis sayılmaz. Yapışmış sosis sallansa da sayılır.
    const inView = Math.abs(c.x - V.cx) < V.hw && c.y > V.cy - V.hh;
    const touching = pPts === 0 && inView && (this.glued || tPts > 0);
    const speed = this.maxSpeed();
    const still = this.glued || (speed < STILL_PT && this.comSpeed() < STILL_COM);
    if (touching && still) this.winT += H;
    else if (!touching) this.winT = Math.max(0, this.winT - 3 * H);
    if (this.winT >= WIN_HOLD) {
      this.state = 'win';
      this.events.push({ type: 'win' });
      return;
    }
    if (this.panT > 0) { this.outT = 0; this.idleT = 0; return; }
    this.outT += H;
    if (!touching && speed < 0.35) this.idleT += H; else this.idleT = 0;
    if (this.idleT > 1.0 || (this.outT > 9 && !touching)) this._lose('miss');
  }
}

/* ====================================================================== */
/*  Bölümler                                                              */
/* ====================================================================== */

// Bölüm verisi (sosis-levels.js) 1280x720'lik ekran pikselleriyle yazılır:
//   px / col : nesne görüntüsü ve silüet dosyası (sosis.pak içinde)
//   cam      : [yakınlık, ekran ortasının dünya x, y]
//   card     : not kâğıdı (metin ve yeri)
//   glue     : yapışkan bölge, radial: çekim merkezi, front: görüntü sosisin önünde
const VIEW_W = 20, VIEW_H = 11.25;
const toWorld = (cam, px, py) => [cam.cx + (px - 640) / (64 * cam.z), cam.cy - (py - 360) / (64 * cam.z)];
function rectToWorld(cam, r) {
  const [a, b] = toWorld(cam, r[0], r[1]), [c, d] = toWorld(cam, r[0] + r[2], r[1] + r[3]);
  return { x: (a + c) / 2, y: (b + d) / 2, w: c - a, h: b - d };
}

export const LEVELS = LEVEL_DATA.map((d) => {
  const [z, cx, cy] = d.cam || [1, 0, 0];
  const cam = { z, cx, cy };
  const def = {
    key: d.key, name: d.title, data: d, cam, parts: [],
    view: { cx, cy, hw: VIEW_W / 2 / z, hh: VIEW_H / 2 / z },
    image: null, field: null, loading: null
  };
  if (d.card) {
    const r = rectToWorld(cam, d.card.px);
    def.parts.push({ ...r, role: 't', mu: d.mu ?? 0.9, rest: 0.1 });
    def.card = { ...r, text: d.card.text };
  }
  if (d.px) def.sprite = rectToWorld(cam, d.px);
  if (d.glue) {
    const [a, b] = toWorld(cam, d.glue[0], d.glue[3]), [c, e] = toWorld(cam, d.glue[2], d.glue[1]);
    def.glue = [a, b, c, e];
  }
  if (d.radial) def.radial = toWorld(cam, d.radial[0], d.radial[1]);
  return def;
});
LEVELS[0].hint = 'Dokun: çubuklar sosisi bırakır. Sosis tavaya gelince tekrar dokun: tava onu fırlatır';

// Görüntü ve silüet dosyaları tek bir paket dosyasındadır. Paket xorshift32 anahtar akışıyla
// karıştırılmıştır; çözülünce: "SPK1" + uint32 dizin uzunluğu + dizin (JSON: [ad, başlangıç, uzunluk])
// + dosyaların ham baytları.
const PACK_URL = new URL('./sosis.pak', import.meta.url);
let packPromise = null;
function loadPack() {
  packPromise ??= fetch(PACK_URL).then((r) => {
    if (!r.ok) throw new Error('Paket yüklenemedi: ' + r.status);
    return r.arrayBuffer();
  }).then((buf) => {
    const b = new Uint8Array(buf);
    let s = 0x5A17C0DE;
    for (let i = 0; i < b.length; i += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      b[i] ^= s & 255; b[i + 1] ^= (s >>> 8) & 255; b[i + 2] ^= (s >>> 16) & 255; b[i + 3] ^= s >>> 24;
    }
    if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'SPK1') throw new Error('Paket bozuk');
    const n = b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24);
    const index = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + n)));
    const files = new Map();
    for (const [name, o, l] of index) files.set(name, b.subarray(8 + n + o, 8 + n + o + l));
    return files;
  }).catch((e) => { packPromise = null; throw e; });
  return packPromise;
}

async function decodeImage(file) {
  const bytes = (await loadPack()).get(file);
  if (!bytes) throw new Error('Pakette yok: ' + file);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.endsWith('.png') ? 'image/png' : 'image/webp' }));
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    return im;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildField(im, def) {
  const W = 320, Hh = 180, c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, W, Hh);
  const px = g.getImageData(0, 0, W, Hh).data, mask = new Uint8Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;
  return makeField(mask, W, Hh, def.cam, def.data.mu ?? 0.9);
}

// Bölümün görüntüsünü ve çarpışma alanını hazırlar (aynı anda gelen çağrılar tek işte birleşir).
export function prepareLevel(def) {
  if (def.loading) return def.loading;
  const d = def.data;
  def.loading = Promise.all([
    d.img ? decodeImage(d.img) : null,
    d.col ? decodeImage(d.col).then((im) => buildField(im, def)) : null
  ]).then(([image, field]) => {
    def.image = image; def.field = field;
    return def;
  }).catch((e) => { def.loading = null; throw e; });
  return def.loading;
}

// Uzun oyunlarda bellek büyümesin diye yalnızca yakındaki bölümlerin verisi tutulur.
function releaseLevels(keep) {
  for (const def of LEVELS) {
    if (keep.has(def) || !def.loading) continue;
    def.loading = null; def.image = null; def.field = null;
  }
}

/* ====================================================================== */
/*  Görüntü                                                               */
/* ====================================================================== */

const FOV = 32;
const SPRITE_Z = 0.35;              // nesne görüntüsü sosisin arkasında (kaplarda önünde)
const rgb = (c) => 'rgb(' + c.join(',') + ')';
const BG_CSS = 'linear-gradient(' + BG_GRAD.map((c, i) => rgb(c) + ' ' + Math.round(i / (BG_GRAD.length - 1) * 100) + '%').join(',') + ')';

const CSS = `
.sg-root{position:absolute;inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#3b2a20}
.sg-root *{box-sizing:border-box}
.sg-canvas{position:absolute;left:0;top:0;display:block;outline:none;cursor:pointer}
.sg-top{position:absolute;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));display:flex;align-items:center;gap:6px}
.sg-count{min-width:64px;text-align:center;padding:9px 12px;border-radius:999px;background:rgba(255,255,255,.7);font-weight:700;font-size:14px}
.sg-nav,.sg-gear{width:42px;height:42px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.75);color:#3b2a20;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1;font-family:inherit}
.sg-nav:disabled{opacity:.3;cursor:default}
.sg-gear{position:absolute;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));width:46px;height:46px}
.sg-gear svg{width:24px;height:24px}
.sg-title{position:absolute;left:50%;top:max(16px,env(safe-area-inset-top));transform:translateX(-50%);font-size:clamp(18px,3.4vw,34px);font-weight:700;letter-spacing:.06em;color:rgba(150,98,58,.9);white-space:nowrap;pointer-events:none;transition:opacity .9s}
.sg-title.off{opacity:0}
.sg-hint{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);padding:9px 17px;border-radius:999px;background:rgba(59,42,32,.78);color:#fff;font-size:14px;max-width:92%;text-align:center;pointer-events:none;transition:opacity .4s;opacity:0;z-index:2}
.sg-spot{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .7s;background:radial-gradient(ellipse 44% 60% at 50% 46%,rgba(255,236,200,.08) 0,rgba(70,45,25,.3) 48%,rgba(38,22,10,.88) 100%)}
.sg-spot.on{opacity:1}
.sg-winbar{position:absolute;left:0;right:0;bottom:max(22px,env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:center;gap:14px;pointer-events:none;opacity:0;transition:opacity .5s .5s}
.sg-winbar.on{opacity:1;pointer-events:auto}
.sg-winbar button{border:0;color:#fff;cursor:pointer;font-family:inherit;line-height:1}
.sg-winbar .sg-retry{width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.2);font-size:30px}
.sg-winbar .sg-retry:hover{background:rgba(255,255,255,.32)}
.sg-winbar .sg-next{height:64px;padding:0 34px;border-radius:999px;background:#e4572e;font-size:clamp(18px,2.6vw,24px);font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.sg-winbar .sg-next:hover{background:#f0653b}
.sg-fade{position:absolute;inset:0;background:#fff8ec;opacity:0;pointer-events:none;transition:opacity .22s}
.sg-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(59,42,32,.46);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:10px;z-index:3}
.sg-modal[hidden]{display:none}
.sg-panel{width:min(380px,100%);max-height:100%;overflow:auto;background:#fff8ec;border-radius:20px;padding:18px;box-shadow:0 12px 40px rgba(40,20,5,.35);text-align:center}
.sg-panel h2{margin:0 0 4px;font-size:20px}
.sg-panel p{margin:0 0 8px;font-size:14px;color:#7a6455}
.sg-btn{display:block;width:100%;margin-top:8px;padding:11px;border:0;border-radius:12px;background:#ffe6c7;color:#3b2a20;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.sg-btn.pri{background:#e4572e;color:#fff}
.sg-confirm{margin-top:8px;padding:10px;border-radius:12px;background:#ffe6c7;font-size:14px}
.sg-confirm[hidden]{display:none}
.sg-confirm div{display:flex;gap:8px;margin-top:8px}
.sg-confirm .sg-btn{margin-top:0;background:#fff8ec}
.sg-confirm .sg-btn.pri{background:#e4572e}
.sg-sub{margin-top:12px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#a08a78}
.sg-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:8px}
.sg-grid button{aspect-ratio:1;border:0;border-radius:7px;background:#2f7f84;color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;padding:0}
.sg-grid button:disabled{background:#e3d8c6;color:#b3a692;cursor:default}
.sg-grid button.cur{box-shadow:0 0 0 3px #e4572e}
.sg-rotate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#2f7f84;color:#fff;font-size:18px;font-weight:600;text-align:center;padding:20px;z-index:4}
.sg-rotate[hidden]{display:none}
.sg-phone{width:44px;height:78px;border:4px solid #fff;border-radius:10px;animation:sg-rot 1.9s ease-in-out infinite}
@keyframes sg-rot{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
@media (max-height:500px){.sg-hint{bottom:auto;top:max(62px,env(safe-area-inset-top));font-size:13px;padding:7px 14px}}
@media (max-height:420px){.sg-panel{width:min(520px,100%);padding:10px 16px}.sg-btn{padding:7px;margin-top:5px}.sg-grid{grid-template-columns:repeat(17,1fr);gap:3px}.sg-grid button{border-radius:6px}.sg-panel h2{font-size:17px}.sg-sub{margin-top:6px}}
`;

const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function rbox(w, h, d, r) {
  const b = Math.max(0.005, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const sw = w - 2 * b, sh = h - 2 * b, cr = Math.min(0.12, sw / 2, sh / 2);
  const x = -sw / 2, y = -sh / 2, s = new THREE.Shape();
  s.moveTo(x + cr, y);
  s.lineTo(x + sw - cr, y); s.quadraticCurveTo(x + sw, y, x + sw, y + cr);
  s.lineTo(x + sw, y + sh - cr); s.quadraticCurveTo(x + sw, y + sh, x + sw - cr, y + sh);
  s.lineTo(x + cr, y + sh); s.quadraticCurveTo(x, y + sh, x, y + sh - cr);
  s.lineTo(x, y + cr); s.quadraticCurveTo(x, y, x + cr, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const sausageTexture = () => canvasTexture(1024, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  [[0, '#6e2412'], [0.05, '#a5401c'], [0.2, '#c9581f'], [0.5, '#d66a26'], [0.8, '#c9581f'], [0.95, '#a5401c'], [1, '#6e2412']]
    .forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = seeded(11);
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = r() * h, rx = 30 + r() * 90, ry = 8 + r() * 22;
    const sp = g.createRadialGradient(x, y, 0, x, y, rx);
    sp.addColorStop(0, `rgba(96,34,10,${0.16 + r() * 0.2})`); sp.addColorStop(1, 'rgba(96,34,10,0)');
    g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = sp; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,190,120,${0.05 + r() * 0.1})` : `rgba(70,22,6,${0.05 + r() * 0.12})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
  }
});

const backdropTexture = () => canvasTexture(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  BG_GRAD.forEach((c, i) => gr.addColorStop(i / (BG_GRAD.length - 1), rgb(c)));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

function woodTexture() {
  const t = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    const r = seeded(7);
    for (let i = 0; i < 80; i++) {
      const y = r() * h;
      g.strokeStyle = `rgba(80,45,15,${0.05 + r() * 0.13})`; g.lineWidth = 0.6 + r() * 2.4;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.0245 + i) * 2.5);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.3, 1.1);
  return t;
}

// Not kâğıdı: kenarları koyulaşan eski kâğıt üstünde, sığacak boyutta satırlara bölünmüş yazı.
function cardTexture(text, wu, hu) {
  const W = 512, Hc = Math.max(64, Math.round(W * hu / wu));
  return canvasTexture(W, Hc, (g, w, h) => {
    g.fillStyle = '#f6dc9c'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w * 0.45, h * 0.4, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.62);
    gr.addColorStop(0, 'rgba(255,248,214,.85)'); gr.addColorStop(0.65, 'rgba(240,206,140,0)'); gr.addColorStop(1, 'rgba(176,118,52,.55)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = seeded(5);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(150,100,40,${r() * 0.07})`; g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 3); }
    g.strokeStyle = 'rgba(150,100,45,.35)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = '#3a2c20'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = text.split(' ');
    let size = Math.round(Math.min(h * 0.17, w * 0.085)), lines = [text];
    for (; size > 10; size -= 2) {
      g.font = `500 ${size}px system-ui,-apple-system,"Segoe UI",sans-serif`;
      lines = []; let cur = '';
      for (const wd of words) {
        const t = cur ? cur + ' ' + wd : wd;
        if (g.measureText(t).width > w * 0.84 && cur) { lines.push(cur); cur = wd; } else cur = t;
      }
      lines.push(cur);
      if (lines.length * size * 1.25 <= h * 0.8 && lines.every((l) => g.measureText(l).width <= w * 0.86)) break;
    }
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.25));
  });
}

/* ====================================================================== */
/*  Oyun                                                                  */
/* ====================================================================== */

// opts: { mount, unlocked, level, onProgress(level, reset), onExit() }
export function startSosis(opts) {
  const mount = opts.mount;
  let unlocked = Math.max(1, Math.min(LEVELS.length, opts.unlocked || 1));
  let levelIdx = Math.max(0, Math.min(unlocked - 1, opts.level ?? unlocked - 1));
  let destroyed = false;
  const cleanups = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };

  /* ---------- DOM ---------- */
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'sg-root';
  root.style.background = BG_CSS;
  root.innerHTML = `
    <canvas class="sg-canvas"></canvas>
    <div class="sg-spot"></div>
    <div class="sg-winbar"><button type="button" class="sg-retry" data-win="retry" aria-label="Tekrar">&#8635;</button><button type="button" class="sg-next" data-win="next">Sonraki bölüm &#8594;</button></div>
    <div class="sg-title"></div>
    <div class="sg-top">
      <button class="sg-nav" data-nav="-1" type="button" aria-label="Önceki bölüm">&#8249;</button>
      <div class="sg-count"></div>
      <button class="sg-nav" data-nav="1" type="button" aria-label="Sonraki bölüm">&#8250;</button>
    </div>
    <button class="sg-gear" type="button" aria-label="Ayarlar">${GEAR_SVG}</button>
    <div class="sg-fade"></div>
    <div class="sg-hint"></div>
    <div class="sg-modal sg-settings" hidden><div class="sg-panel">
      <h2>Ayarlar</h2>
      <button class="sg-btn pri" data-act="resume" type="button">Devam et</button>
      <button class="sg-btn" data-act="sound" type="button"></button>
      <button class="sg-btn" data-act="reset" type="button">İlerlemeyi sıfırla</button>
      <div class="sg-confirm" hidden>Tüm ilerlemen silinecek ve 1. bölümden başlayacaksın. Emin misin?
        <div><button class="sg-btn pri" data-act="reset-yes" type="button">Evet</button><button class="sg-btn" data-act="reset-no" type="button">Hayır</button></div>
      </div>
      <button class="sg-btn" data-act="exit" type="button">Ana menüye dön</button>
      <div class="sg-sub">Bölümler</div>
      <div class="sg-grid"></div>
    </div></div>
    <div class="sg-modal sg-win" hidden><div class="sg-panel">
      <h2>Tebrikler!</h2>
      <p>Tüm bölümleri bitirdin.</p>
      <button class="sg-btn pri" data-act="first" type="button">Baştan oyna</button>
      <button class="sg-btn" data-act="exit" type="button">Ana menüye dön</button>
    </div></div>
    <div class="sg-rotate" hidden><div class="sg-phone"></div><div>Oynamak için telefonu yan çevir</div></div>`;
  mount.appendChild(root);
  const $ = (q) => root.querySelector(q);
  const canvas = $('.sg-canvas'), elCount = $('.sg-count'), elTitle = $('.sg-title'), elHint = $('.sg-hint'), elFade = $('.sg-fade');
  const elSpot = $('.sg-spot'), elWinBar = $('.sg-winbar'), elConfirm = $('.sg-confirm');
  const elSettings = $('.sg-settings'), elWin = $('.sg-win'), elRotate = $('.sg-rotate'), elGrid = $('.sg-grid');
  const navPrev = $('[data-nav="-1"]'), navNext = $('[data-nav="1"]');
  const showHint = (text) => { elHint.textContent = text || ''; elHint.style.opacity = text ? '1' : '0'; };

  /* ---------- Ses ---------- */
  let soundOn = localStorage.getItem('sosis-ses') !== '0';
  let actx = null;
  // Mobil tarayıcılar (özellikle iOS) sesi yalnızca bir dokunuşun içinde başlatmaya izin verir.
  function unlockAudio() {
    if (!soundOn) return;
    try {
      actx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch {
      soundOn = false;
    }
  }
  function tone(f1, f2, dur, type = 'sine', vol = 0.14, delay = 0) {
    if (!soundOn || !actx) return;
    try {
      const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.03);
    } catch {
      soundOn = false;              // ses desteklenmiyor
    }
  }
  const sfx = {
    toss: () => tone(320, 690, 0.17, 'triangle'),
    land: (v) => tone(140, 70, 0.1, 'sine', Math.min(0.2, 0.04 + v * 0.012)),
    lost: () => tone(380, 110, 0.3, 'sine', 0.1),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.13, i * 0.1))
  };

  /* ---------- Sahne ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    showHint('Bu cihazda 3B grafik açılamadı.');
    return { destroy() { root.remove(); style.remove(); } };
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const bgTex = backdropTexture();
  scene.background = bgTex;
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 300);
  {
    // Yansımalar için küçük bir stüdyo ortamı.
    const pmrem = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(), made = [];
    const panel = (w, h, d, x, y, z, r, g, b, back) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: back ? THREE.BackSide : THREE.FrontSide, toneMapped: false });
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); env.add(mesh); made.push(geo, m);
    };
    panel(40, 24, 40, 0, 0, 0, 0.42, 0.4, 0.38, true);
    panel(18, 0.5, 18, 0, 11, 0, 8, 8, 8);
    panel(0.5, 10, 14, -19, 3, 0, 6.5, 5.8, 5);
    panel(0.5, 8, 10, 19, 2, 0, 1.6, 1.8, 2.2);
    panel(16, 8, 0.5, 0, 3, 19, 2.2, 2.2, 2.2);
    scene.environment = pmrem.fromScene(env, 0.03).texture;
    made.forEach((o) => o.dispose()); pmrem.dispose();
  }
  scene.add(new THREE.HemisphereLight('#ffffff', '#cdbfb2', 0.45));
  const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
  sun.position.set(-7, 15, 15);
  const rimLight = new THREE.DirectionalLight('#cfe1ff', 1.5);
  rimLight.position.set(12, 9, -7);
  scene.add(sun, rimLight);

  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
  const woodTex = woodTexture(), sausTex = sausageTexture();
  const mats = {
    pan: std('#0e0f11', { roughness: 0.4, metalness: 0.3, envMapIntensity: 0.3, side: THREE.DoubleSide }),
    panIn: std('#0b0b0d', { roughness: 0.45, metalness: 0.1, envMapIntensity: 0.25 }),
    stick: std('#8a4b2c', { roughness: 0.5, map: woodTex }),
    knot: std('#5a1d0e', { roughness: 0.45 }),
    sausage: new THREE.MeshPhysicalMaterial({ map: sausTex, color: '#ffa27a', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.3 })
  };
  const geos = [];
  const keep = (g) => { geos.push(g); return g; };

  // Sosis: fizik noktalarından geçen eğri boyunca her karede yeniden kurulan tüp.
  const S_SEG = 36, S_RAD = 18, S_VERTS = (S_SEG + 1) * (S_RAD + 1);
  const sausGeo = keep(new THREE.BufferGeometry());
  const sPos = new Float32Array(S_VERTS * 3), sNrm = new Float32Array(S_VERTS * 3), sUv = new Float32Array(S_VERTS * 2);
  {
    const idx = [];
    for (let j = 0; j < S_SEG; j++) for (let k = 0; k < S_RAD; k++) {
      const a = j * (S_RAD + 1) + k, b = a + S_RAD + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    for (let j = 0; j <= S_SEG; j++) for (let k = 0; k <= S_RAD; k++) { const v = j * (S_RAD + 1) + k; sUv[v * 2] = j / S_SEG; sUv[v * 2 + 1] = k / S_RAD; }
    sausGeo.setIndex(idx);
    sausGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
    sausGeo.setAttribute('normal', new THREE.BufferAttribute(sNrm, 3).setUsage(THREE.DynamicDrawUsage));
    sausGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2));
  }
  const sausMesh = new THREE.Mesh(sausGeo, mats.sausage);
  sausMesh.frustumCulled = false;
  const knotGeo = keep(new THREE.SphereGeometry(0.06, 10, 8));
  const knotA = new THREE.Mesh(knotGeo, mats.knot), knotB = new THREE.Mesh(knotGeo, mats.knot);
  const sausage = new THREE.Group();
  sausage.add(sausMesh, knotA, knotB);
  scene.add(sausage);

  // Tava, dönme noktası etrafında döner.
  const panPivot = new THREE.Group(), panGroup = new THREE.Group();
  const panMesh = (geo, mat, x, y) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set(x, y, 0); panGroup.add(m); return m; };
  panMesh(new THREE.CylinderGeometry(PAN_RIM, PAN_HALF, PAN_WALL, 64, 1, true), mats.pan, 0, PAN_WALL / 2);
  panMesh(new THREE.CylinderGeometry(PAN_HALF, PAN_HALF * 0.97, 0.1, 64), mats.panIn, 0, -0.05);
  panMesh(new THREE.TorusGeometry(PAN_RIM, 0.045, 8, 64), mats.pan, 0, PAN_WALL).rotation.x = Math.PI / 2;
  panMesh(rbox(4.2, 0.16, 0.26, 0.07), mats.pan, -PAN_RIM - 1.95, PAN_WALL + 0.62).rotation.z = -0.33;
  panGroup.position.set(PAN_CX, PAN_CY, 0);
  panPivot.position.set(PIVOT_X, PIVOT_Y, 0);
  panPivot.add(panGroup);
  scene.add(panPivot);

  // Çubuklar: arka uçlarından döner; tutarken kapalı, bırakınca açılır. Grup tutma noktasını izler.
  const STICK_LEN = 7, STICK_DIR = 2.2;
  const sticks = [], stickGroup = new THREE.Group();
  {
    const geo = keep(new THREE.CylinderGeometry(0.085, 0.035, STICK_LEN, 14));
    geo.translate(0, -STICK_LEN / 2, 0);
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      const back = [Math.cos(STICK_DIR) * STICK_LEN + side * 0.25, Math.sin(STICK_DIR) * STICK_LEN + side * 0.12];
      const tip = [side * 0.33, -0.12 - side * 0.1];
      pivot.position.set(back[0], back[1], side * 0.05);
      pivot.add(new THREE.Mesh(geo, mats.stick));
      stickGroup.add(pivot);
      sticks.push({ pivot, side, base: Math.atan2(tip[0] - back[0], -(tip[1] - back[1])) });
    }
  }
  scene.add(stickGroup);
  let stickOpen = 0;

  // Parçacıklar (sabit havuz).
  const fxGeo = keep(new THREE.SphereGeometry(1, 8, 6));
  const fx = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(fxGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, roughness: 0.9 }));
    m.visible = false; scene.add(m);
    fx.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0.1, s1: 0.1 });
  }
  function spawnFx(x, y, z, o) {
    const p = fx.find((f) => f.life <= 0);
    if (!p) return;
    Object.assign(p, { life: o.life, max: o.life, vx: o.vx, vy: o.vy, vz: o.vz || 0, s0: o.s0, s1: o.s1 });
    p.m.position.set(x, y, z); p.m.visible = true;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- Bölüm kurulumu ---------- */
  let world = null, levelDef = null;
  let levelGroup = null, levelDispose = [], spriteMeshes = [];
  let levelToken = 0, switching = false, failedIdx = -1, hintTaps = 0, titleTimer = 0;

  // Nesne görüntüsü ışıklandırılmadan, olduğu gibi çizilen düz bir levhadır.
  function addPlane(map, r, front, transparent) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mtl = new THREE.MeshBasicMaterial({ map, transparent, toneMapped: false, depthWrite: !transparent });
    const m = new THREE.Mesh(geo, mtl);
    m.renderOrder = front ? 5 : -5;
    levelGroup.add(m); levelDispose.push(geo, mtl, map);
    spriteMeshes.push({ m, x: r.x, y: r.y, w: r.w, h: r.h, z: front ? SPRITE_Z : -SPRITE_Z });
  }
  // Levhalar sosisin önünde ya da arkasında durduğu için perspektif kaymasını düzelt.
  function fitSprites() {
    if (!levelDef) return;
    const d = baseDist / levelDef.cam.z, cy = levelDef.cam.cy, cx = levelDef.cam.cx - shiftX;
    for (const s of spriteMeshes) {
      const k = (d - s.z) / d;
      s.m.position.set(cx + (s.x - cx) * k, cy + (s.y - cy) * k, s.z);
      s.m.scale.set(s.w * k, s.h * k, 1);
    }
  }

  function unloadLevel() {
    if (!levelGroup) return;
    scene.remove(levelGroup);
    for (const o of levelDispose) o.dispose();
    levelDispose = []; spriteMeshes = []; levelGroup = null;
  }

  async function loadLevel(i) {
    const tok = ++levelToken, def = LEVELS[i];
    switching = true;
    try {
      await prepareLevel(def);
    } catch (e) {
      if (destroyed || tok !== levelToken) return false;
      console.error(e);
      failedIdx = i; switching = false;
      showHint('Bölüm yüklenemedi. Tekrar denemek için dokun.');
      return false;
    }
    if (destroyed || tok !== levelToken) return false;
    failedIdx = -1;
    unloadLevel();
    levelIdx = i; levelDef = def;
    world = new World(def);
    levelGroup = new THREE.Group(); scene.add(levelGroup);
    if (def.image) {
      const tex = new THREE.Texture(def.image);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
      addPlane(tex, def.sprite, !!def.data.front, true);
    }
    if (def.card) addPlane(cardTexture(def.card.text, def.card.w, def.card.h), def.card, false, false);
    cam.x = def.cam.cx; cam.y = def.cam.cy; cam.k = 1;
    resize();                         // bölüme göre (sol kenar, yakınlık) yerleşim değişebilir
    elCount.textContent = `${i + 1} / ${LEVELS.length}`;
    elTitle.textContent = def.name; elTitle.classList.remove('off');
    clearTimeout(titleTimer); titleTimer = setTimeout(() => elTitle.classList.add('off'), 2200);
    showHint(def.hint); hintTaps = 0;
    navPrev.disabled = i === 0;
    navNext.disabled = i + 1 >= unlocked;
    leaveWin();
    elWin.hidden = true;
    switching = false;
    const near = new Set([LEVELS[i - 1], def, LEVELS[i + 1]].filter(Boolean));
    releaseLevels(near);
    if (LEVELS[i + 1]) prepareLevel(LEVELS[i + 1]).catch(() => {});
    return true;
  }

  function goTo(i) {
    if (i < 0 || i >= LEVELS.length || i + 1 > unlocked || switching) return;
    switching = true;
    elFade.style.opacity = '1';
    setTimeout(async () => {
      if (destroyed) return;
      await loadLevel(i);
      if (!destroyed) elFade.style.opacity = '0';
    }, 230);
  }

  /* ---------- Boyut ve kamera ---------- */
  let paused = false, rotateBlock = false, winMode = false;
  const baseDist = VIEW_H / 2 / Math.tan(FOV * Math.PI / 360);
  const cam = { x: 0, y: 0, k: 1 }, focus = { x: 0, y: 0, k: 1 };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let shiftX = 0;                     // geniş ekranda kameranın sola kayması (dünya birimi)
  function placeCamera() {
    const x = cam.x - shiftX * cam.k;
    camera.position.set(x, cam.y, baseDist / (levelDef ? levelDef.cam.z : 1) * cam.k);
    camera.lookAt(x, cam.y, 0);
  }
  // Oyun alanı 16:9'dur (bölüm görüntüleri bu alana göre). Ekran daha genişse (çoğu telefon) sahne
  // sola doğru uzar ki tava ve çubuklar kesilmesin; sol kenara değen bir görüntü varsa ya da ekran
  // daha uzunsa kalan yer fon rengiyle dolar.
  function resize() {
    const W = Math.max(1, mount.clientWidth), Hh = Math.max(1, mount.clientHeight);
    const touchesLeft = levelDef?.data.px && levelDef.data.px[0] <= 2;
    const extend = W / Hh > 16 / 9 && !touchesLeft;
    let w = W, h = Hh;
    if (!extend) {
      h = Math.round(W * 9 / 16);
      if (h > Hh) { h = Hh; w = Math.round(Hh * 16 / 9); }
    }
    Object.assign(canvas.style, { width: w + 'px', height: h + 'px', left: Math.round((W - w) / 2) + 'px', top: Math.round((Hh - h) / 2) + 'px' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    shiftX = extend ? (VIEW_H / 2 * camera.aspect - VIEW_W / 2) / (levelDef ? levelDef.cam.z : 1) : 0;
    rotateBlock = coarse && Hh > W;
    elRotate.hidden = !rotateBlock;
    fitSprites();
    placeCamera();
    renderer.render(scene, camera);   // boyut değişince tuval silinir; duraklatılmışken de görüntü kalsın
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  /* ---------- Girdi ---------- */
  function press() {
    if (failedIdx >= 0 && !switching) { showHint(''); loadLevel(failedIdx); return; }
    if (!world || paused || rotateBlock || switching || winMode || !elWin.hidden) return;
    if (world.hit(true) && ++hintTaps >= 5) showHint('');
  }
  const release = () => world?.release();
  on(root, 'pointerdown', (e) => {
    if (e.target !== canvas && e.target !== root) return;
    e.preventDefault();
    root.setPointerCapture?.(e.pointerId);
    unlockAudio();
    press();
  });
  on(root, 'pointerup', release);
  on(root, 'pointercancel', release);
  // Basılıyken pencere değişirse bırakma olayı gelmez; tava yukarıda takılı kalmasın.
  on(window, 'blur', release);
  on(document, 'visibilitychange', release);
  on(root, 'contextmenu', (e) => e.preventDefault());
  on(window, 'keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { unlockAudio(); press(); } }
    else if (e.code === 'Escape') { if (elSettings.hidden) openSettings(); else closeSettings(); }
  });
  on(window, 'keyup', (e) => { if (e.code === 'Space') { e.preventDefault(); release(); } });

  /* ---------- Menüler ---------- */
  function renderSettings() {
    $('[data-act="sound"]').textContent = 'Ses: ' + (soundOn ? 'Açık' : 'Kapalı');
    elConfirm.hidden = true;
    elGrid.replaceChildren(...LEVELS.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = String(i + 1); b.dataset.level = String(i);
      b.disabled = i + 1 > unlocked;
      if (i === levelIdx) b.className = 'cur';
      return b;
    }));
  }
  function openSettings() {
    if (!elWin.hidden) return;
    paused = true; release(); renderSettings(); elSettings.hidden = false;
  }
  function closeSettings() { elSettings.hidden = true; paused = false; }
  const exit = () => opts.onExit?.();

  on($('.sg-gear'), 'click', openSettings);
  on(navPrev, 'click', () => goTo(levelIdx - 1));
  on(navNext, 'click', () => goTo(levelIdx + 1));
  on(elSettings, 'click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.level) { closeSettings(); if (+t.dataset.level !== levelIdx) goTo(+t.dataset.level); return; }
    switch (t.dataset.act) {
      case 'resume': closeSettings(); break;
      case 'sound':
        soundOn = !soundOn;
        localStorage.setItem('sosis-ses', soundOn ? '1' : '0');
        renderSettings();
        unlockAudio();
        tone(660, 880, 0.1, 'triangle');
        break;
      case 'reset': elConfirm.hidden = false; break;
      case 'reset-no': elConfirm.hidden = true; break;
      case 'reset-yes':
        unlocked = 1;
        opts.onProgress?.(1, true);
        closeSettings();
        switching = false;
        goTo(0);
        break;
      case 'exit': exit(); break;
    }
  });
  on(elWin, 'click', (e) => {
    const a = e.target.closest('button')?.dataset.act;
    if (a === 'first') { elWin.hidden = true; goTo(0); } else if (a === 'exit') exit();
  });
  function leaveWin() {
    winMode = false;
    elSpot.classList.remove('on'); elWinBar.classList.remove('on');
  }
  on(elWinBar, 'click', (e) => {
    const a = e.target.closest('button')?.dataset.win;
    if (!a || !winMode) return;
    if (a === 'retry') { leaveWin(); world.spawn(); }
    else if (levelIdx === LEVELS.length - 1) { leaveWin(); elWin.hidden = false; }
    else goTo(levelIdx + 1);
  });

  /* ---------- Olaylar ---------- */
  function onWin() {
    sfx.win();
    // Kamera nesneyle sosisi birlikte gösterecek kadar yaklaşır.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of world.shapes) {
      if (s.role !== 't') continue;
      const [a, b, c, d] = s.sh === 'field' ? s.f.box : [s.cx - s.hw, s.cy - s.hh, s.cx + s.hw, s.cy + s.hh];
      x0 = Math.min(x0, a); x1 = Math.max(x1, c); y0 = Math.min(y0, b); y1 = Math.max(y1, d);
    }
    const sc = world.com(), V = world.view;
    x0 = Math.max(V.cx - V.hw, Math.min(x0, sc.x - 1)); x1 = Math.min(V.cx + V.hw, Math.max(x1, sc.x + 1));
    y0 = Math.max(V.cy - V.hh, Math.min(y0, sc.y - 1)); y1 = Math.min(V.cy + V.hh, Math.max(y1, sc.y + 1));
    focus.x = (x0 + x1) / 2; focus.y = (y0 + y1) / 2 + 0.3 / levelDef.cam.z;
    focus.k = Math.max(0.42, Math.min(0.85, Math.max((x1 - x0) / (2 * V.hw), (y1 - y0) / (2 * V.hh)) * 1.7));
    winMode = true;
    elSpot.classList.add('on'); elWinBar.classList.add('on');
    showHint('');
    if (levelIdx + 2 > unlocked && levelIdx + 1 < LEVELS.length) {
      unlocked = levelIdx + 2;
      opts.onProgress?.(unlocked, false);
    }
    navNext.disabled = levelIdx + 1 >= unlocked;
  }

  function handleEvents() {
    for (const e of world.events) {
      if (e.type === 'swing') sfx.toss();
      else if (e.type === 'land') {
        sfx.land(e.v);
        for (let i = 0; i < 5; i++) spawnFx(e.x + rnd(-0.9, 0.9), e.y + 0.05, rnd(-0.4, 0.6), { life: 0.4, vx: rnd(-1.4, 1.4), vy: rnd(0.4, 1.3), s0: 0.09, s1: 0.24 });
      } else if (e.type === 'lost') {
        sfx.lost();
        if (e.why === 'miss') {
          for (let i = 0; i < 12; i++) {
            const a = rnd(0, 6.28);
            spawnFx(e.x + rnd(-0.8, 0.8), e.y, 0.3, { life: 0.4, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, s0: 0.16, s1: 0.03 });
          }
        }
      } else if (e.type === 'win') onWin();
    }
    world.events.length = 0;
  }

  /* ---------- Çizim ---------- */
  const pts = Array.from({ length: N + 2 }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const cP = new THREE.Vector3(), cT = new THREE.Vector3();
  const CAP = RAD * 1.5, S_LEN = (N - 1) * SEG + 2 * RAD;
  // Uçlarda yuvarlak kapanan, ortası hafif şişkin kesit.
  const sausRadius = (u) => {
    const e = Math.min(u, 1 - u) * S_LEN, belly = 1 + 0.05 * Math.sin(Math.PI * u);
    if (e >= CAP) return RAD * belly;
    const k = 1 - e / CAP;
    return Math.max(0.012, RAD * belly * Math.sqrt(1 - k * k));
  };

  function drawSausage() {
    sausage.visible = world.state !== 'lost';
    if (!sausage.visible) return;
    const X = world.x, Y = world.y;
    let ex = X[0] - X[1], ey = Y[0] - Y[1], el = Math.hypot(ex, ey) || 1;
    pts[0].set(X[0] + ex / el * RAD, Y[0] + ey / el * RAD, 0);
    for (let i = 0; i < N; i++) pts[i + 1].set(X[i], Y[i], 0);
    ex = X[N - 1] - X[N - 2]; ey = Y[N - 1] - Y[N - 2]; el = Math.hypot(ex, ey) || 1;
    pts[N + 1].set(X[N - 1] + ex / el * RAD, Y[N - 1] + ey / el * RAD, 0);
    curve.updateArcLengths();
    for (let j = 0; j <= S_SEG; j++) {
      const u = j / S_SEG;
      curve.getPointAt(u, cP); curve.getTangentAt(u, cT);
      const r = sausRadius(u), dr = (sausRadius(Math.min(1, u + 0.01)) - sausRadius(Math.max(0, u - 0.01))) / (0.02 * S_LEN);
      const nx = -cT.y, ny = cT.x;
      for (let k = 0; k <= S_RAD; k++) {
        const a = k / S_RAD * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), v = (j * (S_RAD + 1) + k) * 3;
        sPos[v] = cP.x + nx * c * r; sPos[v + 1] = cP.y + ny * c * r; sPos[v + 2] = s * r;
        const qx = nx * c - cT.x * dr, qy = ny * c - cT.y * dr, ql = Math.hypot(qx, qy, s) || 1;
        sNrm[v] = qx / ql; sNrm[v + 1] = qy / ql; sNrm[v + 2] = s / ql;
      }
    }
    sausGeo.attributes.position.needsUpdate = true; sausGeo.attributes.normal.needsUpdate = true;
    knotA.position.copy(pts[0]); knotB.position.copy(pts[N + 1]);
  }

  let last = performance.now(), acc = 0, raf = 0;
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    // Bölüm yüklenirken ya da oyun dururken sahne değişmez; çizmeye gerek yok.
    if (!world || paused || rotateBlock) return;

    acc += dt;
    while (acc >= H) { world.step(); acc -= H; }
    handleEvents();
    for (const p of fx) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = 1 - p.life / p.max;
      p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      p.m.material.opacity = Math.min(1, (1 - k) * 1.6);
    }

    panPivot.rotation.z = world.panTh;
    const ck = 1 - Math.exp(-dt * 2.6);
    cam.x += ((winMode ? focus.x : levelDef.cam.cx) - cam.x) * ck;
    cam.y += ((winMode ? focus.y : levelDef.cam.cy) - cam.y) * ck;
    cam.k += ((winMode ? focus.k : 1) - cam.k) * ck;
    placeCamera();
    stickGroup.position.set(world.gx, world.gy, 0);
    const wantOpen = world.state === 'hold' ? 0 : 1;
    stickOpen += (wantOpen - stickOpen) * Math.min(1, dt * (wantOpen ? 14 : 7));
    for (const st of sticks) st.pivot.rotation.z = st.base - st.side * stickOpen * 0.085;
    drawSausage();
    renderer.render(scene, camera);
  }

  elFade.style.opacity = '1';
  resize();
  loadLevel(levelIdx).then(() => { if (!destroyed) elFade.style.opacity = '0'; });
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(titleTimer);
      ro.disconnect();
      for (const c of cleanups) c();
      unloadLevel();
      for (const m of Object.values(mats)) m.dispose();
      for (const g of geos) g.dispose();
      for (const p of fx) p.m.material.dispose();
      woodTex.dispose(); sausTex.dispose(); bgTex.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      actx?.close().catch(() => {});
      root.remove(); style.remove();
    }
  };
}

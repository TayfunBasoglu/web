// ORTA DÜNYA teması (ZORLU) — Yüzüklerin Efendisi evreninden esinlenen yarış pisti. Bütün modeller bu dosyada
// basit şekillerden çizilir (dışarıdan görsel, model ya da müzik kullanılmaz).
// Tur: Shire (hobbit şenliği) → Fangorn Ormanı (Ent köşedeki şeride adım atar) → Rivendell (elf ordusu hazırlanır,
// atlı komutan konuşma yapar) → Anduin Köprüsü (altından geçilir; üstündeki ejder ateş püskürür) → Helm Geçidi
// (sırttaki ork okçuları ok yağdırır, kale) → Shire. Uzakta Mordor: kara kulenin tepesinde göz yanar ve sana bakar;
// kartallar tepeden geçer. Zorluk: dar virajlar (virajdan önce fren gerekir).
export function tema(A) {
  const { THREE, mk, mat, box, cyl, sph, canvasTex, frameAt, F1, F2, ribbon, pedKur, PED_YERI,
    inRange, sd, clamp, lerp, sstep, rand, srand, sr, wrapA, yakinSerit, HW, emit, knock, hitRacers, addFx, FXG, FXM, dummy } = A;

  /* ---------- pist (ham harita birimi × SC = dünya birimi; x doğu, z güney) ---------- */
  const SC = 1.42;
  const YOL = [
    [-380, 306], [-300, 312], [-170, 302], [-40, 306], [90, 300], [200, 294],              // Shire düzlüğü (doğuya)
    [262, 291], [282, 281], [290, 262], [292, 222],                                         // dar sol viraj (fren)
    [286, 140], [266, 75], [296, 28], [334, -22], [330, -95], [312, -160],                  // Fangorn: S virajları
    [316, -228], [308, -258], [290, -270], [250, -275],                                     // Ent köşesi (dar, fren)
    [170, -268], [80, -280], [-10, -298], [-100, -294], [-200, -270],                       // Rivendell ve köprü (batıya)
    [-258, -266], [-284, -257], [-297, -238], [-302, -190],                                 // dar sol viraj (fren)
    [-300, -72], [-326, -2], [-378, 58], [-420, 120], [-450, 188], [-462, 250],             // Helm Geçidi (güneye)
    [-460, 280], [-448, 297], [-425, 304],                                                  // Shire'a dönüş (dar)
  ];
  const CTRL = YOL.map(([x, z]) => [x * SC, 0, z * SC]);
  const START = [-300 * SC, 312 * SC];
  const sp = (x, z) => A.sAt(x * SC, z * SC);

  /* ---------- dokular ---------- */
  const gurultu = (g, w, h, n, renk, a0, a1, sw = 2, sh = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${renk},${a0 + srand() * (a1 - a0)})`; g.fillRect(srand() * w, srand() * h, sw, sh); } };
  const yuvarla = A.rrect;   // yuvarlak köşeli dikdörtgen yolu (tuval)
  /* --- gerçekçi dokular: değer gürültüsü (fbm) ile piksel piksel üretilir; taşlarda kabartma (normal) haritası --- */
  // kendi sabit tohumuyla (dokuların görünüşü hangi haritanın önce yüklendiğine bağlı olmasın)
  let gtTohum = 3019; const gtRand = () => (gtTohum = (gtTohum * 16807) % 2147483647) / 2147483647;
  const GT = new Float32Array(256 * 256).map(() => gtRand());
  function vgur(x, y, per) {   // per: tekrar boyu (doku kenarları birleşsin)
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, m = v => ((v % per) + per) % per & 255;
    const h = (a, b) => GT[m(a) * 256 + m(b)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, per, okt = 4) { let a = .5, s = 0, t = 0; for (let i = 0; i < okt; i++) { s += a * vgur(x, y, per); t += a; x *= 2; y *= 2; per *= 2; a *= .5; } return s / t; }
  function pikselTuval(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = fn(x, y), i = (y * w + x) * 4; im.data[i] = p[0]; im.data[i + 1] = p[1]; im.data[i + 2] = p[2]; im.data[i + 3] = p[3] ?? 255; }
    g.putImageData(im, 0, 0); return c;
  }
  function dokuYap(c, renk = true) { const t = new THREE.CanvasTexture(c); if (renk) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  // yükseklikten kabartma haritası (OpenGL yönü: yeşil yukarı)
  function normalDoku(w, h, H, guc) {
    return dokuYap(pikselTuval(w, h, (x, y) => {
      const l = H[y * w + (x - 1 + w) % w], r = H[y * w + (x + 1) % w], u = H[((y - 1 + h) % h) * w + x], d = H[((y + 1) % h) * w + x];
      const nx = (l - r) * guc, ny = (d - u) * guc, k = 1 / Math.hypot(nx, ny, 1);
      return [(nx * k * .5 + .5) * 255, (ny * k * .5 + .5) * 255, (k * .5 + .5) * 255];
    }), false);
  }
  // taş döşeme: sıra sıra (yarım kaydırmalı), her taş farklı boy ve renkte, araları çamurlu; yükseklik de döner
  function tasDoseme(w, h, tw, th, renk, aralik, ekle, cesit = 1) {
    const H = new Float32Array(w * h), cols = Math.round(w / tw), rows = Math.round(h / th);
    const tasRenk = new Float32Array(cols * rows * 4).map(() => srand()), sira = new Float32Array(rows).map(() => srand());
    const c = pikselTuval(w, h, (x, y) => {
      const r = Math.floor(y / th), ox = Math.floor(sira[r % rows] * tw), cx = Math.floor(((x + ox) % w) / tw) % cols, i = (r % rows) * cols + cx;   // her sıra rastgele kaymış (ızgara gibi durmasın)
      const lx = (((x + ox) % w) - cx * tw) / tw - .5, ly = (y - r * th) / th - .5;   // taşın içinde -0,5…0,5
      const kenar = Math.max(Math.abs(lx) * (1 + tasRenk[i * 4 + 2] * .2), Math.abs(ly) * (1 + tasRenk[i * 4 + 3] * .3)) * 2;
      const n = fbm(x / 16, y / 16, w / 16, 4), d = fbm(x / 4, y / 4, w / 4, 2);
      const tas = sstep(.98, .78 - n * .18, kenar);                          // 1: taşın üstü, 0: aradaki derz
      H[y * w + x] = tas * (.75 + .25 * n) + d * .08;
      const k = 1 - .16 * cesit + tasRenk[i * 4] * .32 * cesit + (n - .5) * .35 + (d - .5) * .12, ton = tasRenk[i * 4 + 1] * .12 * cesit;
      let p = [renk[0] * k * (1 + ton), renk[1] * k, renk[2] * k * (1 - ton * .5)];
      p = p.map((v, j) => lerp(aralik[j] * (.8 + d * .4), v, tas));
      return ekle ? ekle(p, x, y, tas, n) : p;
    });
    return { c, H };
  }
  // yol: koyu, yıpranmış arnavut kaldırımı; şerit sınırları yalnızca soluk, aşınmış açık taşlarla belli
  // doku yolun 16 birim genişliğini ve 32 birim boyunu kaplar: 8 piksellik taş ≈ yarım metrelik arnavut taşı
  const yolT = tasDoseme(256, 512, 8, 8, [100, 94, 84], [64, 58, 50], (p, x, y, tas, n) => {
    const u = x / 256, iz = [.13, .37, .63, .87].reduce((a, c) => a + Math.exp(-(((u - c) / .05) ** 2)), 0);   // tekerlek izleri: koyu
    const kir = fbm(x / 32, y / 32, 8, 3);                                       // geniş çamur/aşınma lekeleri
    p = p.map((v, j) => v * (1 - iz * .2) * (.82 + kir * .36) - (j === 2 ? 4 : 0));
    const serit = Math.abs(u - .5) < .012 && (y % 256) < 104 || (Math.abs(u - .25) < .01 || Math.abs(u - .75) < .01) && (y % 256) > 128 && (y % 256) < 192;
    const kenar = (u > .03 && u < .05) || (u > .95 && u < .97);
    if ((serit || kenar) && tas > .3) p = p.map(v => lerp(v, 170 + n * 30, (kenar ? .5 : .42) * (.7 + kir * .5)));   // aşınmış açık renk taşlar
    return p;
  }, .45);
  const yolTex = dokuYap(yolT.c), yolN = normalDoku(256, 512, yolT.H, 1.5);
  const kerbT = tasDoseme(64, 128, 64, 32, [150, 144, 132], [50, 44, 36]);   // kerb: iri bordür taşları
  const kerbTex = dokuYap(kerbT.c), kerbN = normalDoku(64, 128, kerbT.H, 2.5);
  const toprakTex = dokuYap(pikselTuval(128, 128, (x, y) => { const n = fbm(x / 8, y / 8, 16, 4), d = vgur(x / 2, y / 2, 64); const k = .55 + n * .7 + (d - .5) * .15; return [86 * k, 72 * k, 56 * k]; }));
  const tasT = tasDoseme(128, 128, 26, 16, [118, 112, 100], [34, 30, 26]);   // kuru taş duvar (kare: gürültü kenarları birleşir, dikiş izi olmaz)
  const tasTex = dokuYap(tasT.c), tasN = normalDoku(128, 128, tasT.H, 3);
  // arazi ayrıntısı: çimen, toprak lekeleri (renk köşe renklerinden gelir, bu yalnızca açık/koyu desen)
  const otH = new Float32Array(256 * 256);
  const otTex = dokuYap(pikselTuval(256, 256, (x, y) => { const n = fbm(x / 32, y / 32, 8, 4), d = vgur(x / 2, y / 2, 128), s = vgur(x / 4, y / 4, 64); otH[y * 256 + x] = n * .6 + d * .25 + s * .15; const k = 150 + (n - .5) * 120 + (d - .5) * 50 + (s - .5) * 30; return [k, k, k * .95]; }));
  const otN = normalDoku(256, 256, otH, 2);
  const tahtaTex = canvasTex(128, 128, (g, w, h) => {   // tahta sandık
    g.fillStyle = '#9a6b3c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = `rgba(60,35,15,${.25 + srand() * .2})`; g.fillRect(0, y, w, 3); }
    gurultu(g, w, h, 600, '70,40,15', .05, .2, 6, 1);
    g.strokeStyle = 'rgba(55,30,10,.75)'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.stroke();
  });
  const rampaTex = canvasTex(128, 128, (g, w, h) => {   // tahta rampa (yeşil şeritli)
    g.fillStyle = '#a47a48'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 21) { g.fillStyle = 'rgba(60,35,15,.5)'; g.fillRect(x, 0, 2, h); }
    g.fillStyle = '#3fae5a'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
  });
  // kapalı, kasvetli gök: katman katman bulut (fbm); batıda bulutların arasından alçak güneş sızar,
  // kuzeydoğuda (Mordor, u ≈ 0,625) ufuk kızıl yanar, üstünde kül rengi bulutlar
  const gokTex = dokuYap(pikselTuval(512, 256, (x, y) => {
    const u = x / 512, v = y / 256, yuk = .5 - v;                     // yuk > 0: ufkun üstü
    const fark = (a, b) => { let d = Math.abs(a - b); return Math.min(d, 1 - d); };
    const mord = Math.exp(-((fark(u, .625) / .07) ** 2)), gun = Math.exp(-((fark(u, .137) / .06) ** 2));
    let r = lerp(118, 46, sstep(0, .42, yuk)), g = lerp(119, 54, sstep(0, .42, yuk)), b = lerp(122, 66, sstep(0, .42, yuk));   // ufuk sis rengine yakın
    if (yuk < 0) { r = 72; g = 66; b = 58; }
    const bulut = fbm(x / 51.2, y / 22, 10, 5), yogun = sstep(.38, .7, bulut) * sstep(-.02, .08, yuk);
    const alt = sstep(.55, .35, bulut);                                 // bulutların alt kenarı biraz aydınlık
    let br = 70 + alt * 30, bg = 72 + alt * 28, bb = 78 + alt * 24;
    // güneşin sızdığı yer: ufka yakın sıcak ışık, bulut kenarları parlar
    const gIs = gun * Math.exp(-(((yuk - .06) / .09) ** 2));
    r += gIs * 120; g += gIs * 80; b += gIs * 30; br += gIs * 110 * alt; bg += gIs * 70 * alt; bb += gIs * 25 * alt;
    // Mordor: ufukta kızıl, bulutlar kül/kahverengi ve koyu
    const mIs = mord * Math.exp(-(((yuk - .02) / .12) ** 2));
    r = lerp(r, 170, mIs * .9); g = lerp(g, 52, mIs * .9); b = lerp(b, 26, mIs * .9);
    br = lerp(br, 40, mord * .8); bg = lerp(bg, 30, mord * .8); bb = lerp(bb, 30, mord * .8);
    br += mIs * 70 * alt; bg += mIs * 18 * alt;
    return [lerp(r, br, yogun * .92), lerp(g, bg, yogun * .92), lerp(b, bb, yogun * .92)];
  }));
  gokTex.wrapT = THREE.ClampToEdgeWrapping;
  const suTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#bfe4f2'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${.3 + srand() * .6})`; g.fillRect(srand() * w, srand() * h, 1 + srand() * 2, 8 + srand() * 30); } }, true);
  const gozTex = canvasTex(256, 256, (g, w, h) => {   // alevden göz: ortada dikey kara yarık
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, '#fff6c0'); rg.addColorStop(.25, '#ffc040'); rg.addColorStop(.55, '#ff5a10'); rg.addColorStop(.85, 'rgba(160,20,0,.7)'); rg.addColorStop(1, 'rgba(80,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h * .32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#120202'; g.beginPath(); g.ellipse(w / 2, h / 2, w * .045, h * .27, 0, 0, Math.PI * 2); g.fill();
  });
  const parlakTex = canvasTex(128, 128, (g, w, h) => { const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); rg.addColorStop(0, 'rgba(255,170,60,1)'); rg.addColorStop(.4, 'rgba(255,80,20,.45)'); rg.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); });
  const tabelaTex = (yazi, alt = '') => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#6b4526'; yuvarla(g, 0, 0, w, h, 20); g.fill();
    for (let y = 8; y < h; y += 26) { g.fillStyle = 'rgba(40,22,8,.35)'; g.fillRect(0, y, w, 3); }
    g.strokeStyle = '#3a2410'; g.lineWidth = 10; yuvarla(g, 5, 5, w - 10, h - 10, 16); g.stroke();
    g.fillStyle = '#f4e3b8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${alt ? 64 : 76}px Georgia, "Times New Roman", serif`; g.fillText(yazi, w / 2, alt ? h * .42 : h / 2 + 4);
    if (alt) { g.font = 'italic 30px Georgia, serif'; g.fillStyle = '#e2c98f'; g.fillText(alt, w / 2, h * .78); }
  });
  const okTex = canvasTex(256, 128, (g, w, h) => {   // yıpranmış tahta viraj levhası (soluk boyalı oklar)
    g.fillStyle = '#2e2218'; yuvarla(g, 0, 0, w, h, 6); g.fill(); g.fillStyle = '#4a3a2a'; yuvarla(g, 8, 8, w - 16, h - 16, 4); g.fill();
    gurultu(g, w, h, 900, '20,14,8', .1, .35, 8, 1); g.fillStyle = '#d8cdb4';
    for (let i = 0; i < 2; i++) { const x = 70 + i * 80; g.beginPath(); g.moveTo(x - 24, 22); g.lineTo(x + 8, 22); g.lineTo(x + 44, 64); g.lineTo(x + 8, 106); g.lineTo(x - 24, 106); g.lineTo(x + 12, 64); g.closePath(); g.fill(); }
  });
  const sancakTex = (zemin, desen) => canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = zemin; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h * .86); g.lineTo(w / 2, h); g.lineTo(0, h * .86); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,240,200,.8)'; g.lineWidth = 6; g.stroke();
    g.fillStyle = desen; g.save(); g.translate(w / 2, h * .42);
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, -36); g.lineTo(7, 0); g.lineTo(-7, 0); g.closePath(); g.fill(); }   // yıldız
    g.restore();
  });
  // aynı renkli sancaklar tek doku ve malzemeyi paylaşır (eskiden her sancak kendi dokusunu çiziyordu)
  const sancakMalz = new Map();
  const sancakM = (zemin, desen, roughness = 1) => {
    const k = zemin + desen + roughness;
    if (!sancakMalz.has(k)) sancakMalz.set(k, new THREE.MeshStandardMaterial({ map: sancakTex(zemin, desen), side: THREE.DoubleSide, roughness }));
    return sancakMalz.get(k);
  };
  const pencereTex = canvasTex(128, 128, (g, w, h) => {   // elf yapısı: kemerli pencereler
    g.fillStyle = '#efe8da'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 400, '150,140,120', .04, .12);
    for (const x of [16, 72]) { g.fillStyle = '#3d5466'; g.beginPath(); g.moveTo(x, 110); g.lineTo(x, 50); g.quadraticCurveTo(x + 20, 14, x + 40, 50); g.lineTo(x + 40, 110); g.closePath(); g.fill(); g.strokeStyle = '#b89a5a'; g.lineWidth = 3; g.stroke(); }
  }, true);
  // kesme taş (köprü, kale): iri bloklar, kabartmalı; yıllanmış, yer yer yosunlu
  const surT = tasDoseme(128, 128, 32, 16, [112, 108, 98], [44, 40, 34], (p, x, y, tas, n) => { const y2 = fbm(x / 16, y / 16, 8, 3); return p.map((v, j) => v * (1 - sstep(.55, .75, y2) * .35) + (j === 1 ? sstep(.6, .8, y2) * 10 : 0)); });
  const surTex = dokuYap(surT.c), surN = normalDoku(128, 128, surT.H, 3);
  const beyazT = tasDoseme(128, 128, 32, 16, [196, 192, 182], [120, 114, 104]);
  const beyazSurTex = dokuYap(beyazT.c), beyazN = normalDoku(128, 128, beyazT.H, 2);
  // kabuk: dikey lifler ve yarıklar (Ent, yaşlı ağaçlar)
  const kabukH = new Float32Array(64 * 128);
  const kabukTex = dokuYap(pikselTuval(64, 128, (x, y) => { const n = fbm(x / 4, y / 32, 16, 4), l = vgur(x / 2, y / 16, 32); kabukH[y * 64 + x] = n * .7 + l * .3; const k = .45 + n * .75; return [78 * k, 62 * k, 48 * k]; }));
  const kabukN = normalDoku(64, 128, kabukH, 4);

  /* ---------- malzemeler ---------- */
  const M = {};
  let ENV = null;
  const ofset = (o, k) => Object.assign(o, { polygonOffset: true, polygonOffsetFactor: k, polygonOffsetUnits: k });
  function malzemeler() {
    const S_ = o => new THREE.MeshStandardMaterial(o);
    // taş, toprak: kabartmalı (normal haritası) — ışık yandan vurunca taşlar gerçek gibi görünür
    M.yol = S_(ofset({ map: yolTex, normalMap: yolN, normalScale: new THREE.Vector2(1.1, 1.1), roughness: .88 }, -2));
    M.kerb = S_(ofset({ map: kerbTex, normalMap: kerbN, roughness: .9 }, -3));
    M.toprak = S_(ofset({ map: toprakTex, normalMap: otN, roughness: 1 }, -1));
    M.duvar = S_({ map: tasTex, normalMap: tasN, normalScale: new THREE.Vector2(1.4, 1.4), roughness: .95, side: THREE.DoubleSide });   // iki yandaki duvar da görünsün
    M.duvarUst = S_({ map: tasTex, normalMap: tasN, roughness: 1 });
    // arazinin sık tekrarı yalnız arazide (toprak kenar ve tepeler aynı dokuyu kendi ölçeğinde kullanır)
    const zT = otTex.clone(), zN = otN.clone(); zT.needsUpdate = zN.needsUpdate = true; zT.repeat.set(300, 300); zN.repeat.set(300, 300);
    M.zemin = S_({ map: zT, normalMap: zN, normalScale: new THREE.Vector2(.8, .8), vertexColors: true, roughness: 1 });
    M.renkli = S_({ vertexColors: true, roughness: .9 });
    M.zirh = S_({ vertexColors: true, roughness: .55, metalness: .45, envMap: ENV, envMapIntensity: .5 });
    M.tahta = mat('#4e3a28', { roughness: .95 }); M.koyuTahta = mat('#2e2219', { roughness: 1 });
    M.sandik = S_({ map: tahtaTex, color: 0x8a7a6a, roughness: .9 });
    M.rampa = S_({ map: rampaTex, color: 0x9a8a78, roughness: .85 });
    M.batak = new THREE.MeshPhysicalMaterial({ color: 0x241c12, roughness: .18, clearcoat: .6, envMap: ENV, transparent: true, opacity: .95 });
    M.tas = S_({ map: surTex, normalMap: surN, color: 0xb0aca4, roughness: .95 }); M.koyuTas = S_({ map: surTex, normalMap: surN, color: 0x6a665e, roughness: 1, flatShading: true });
    M.sur = S_({ map: surTex, normalMap: surN, normalScale: new THREE.Vector2(1.3, 1.3), roughness: .95 });
    M.beyaz = S_({ map: beyazSurTex, normalMap: beyazN, color: 0xe0dcd2, roughness: .8 }); M.elfDuvar = S_({ map: pencereTex, color: 0xd8d2c4, roughness: .8 });
    M.elfCati = mat('#3a4a52', { roughness: .6, metalness: .25 }); M.altin = mat('#8f7444', { roughness: .45, metalness: .75 });
    M.tepe = S_({ map: otTex, normalMap: otN, color: 0x56683a, roughness: 1 });
    M.kapi = ['#2c3e26', '#5e5026', '#4e2620', '#26364a'].map(c => mat(c, { roughness: .7 }));   // eski boyalı ahşap kapılar
    M.kapiCerceve = mat('#3e2e20', { roughness: 1 }); M.pirinc = mat('#9a8048', { roughness: .4, metalness: .8 });
    M.cam = mat('#ffd890', { emissive: 0xffa040, emissiveIntensity: .9, roughness: .4 });          // içeride yanan ocak ışığı
    M.cadir = mat('#bdb4a2', { roughness: .95, side: THREE.DoubleSide }); M.cadirKirmizi = mat('#6a4a3a', { roughness: .95, side: THREE.DoubleSide });   // eski keten çadır
    M.fener = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a30, emissiveIntensity: 2.2 });
    M.kabuk = S_({ map: kabukTex, normalMap: kabukN, roughness: 1 }); M.yosun = mat('#2e3a20', { roughness: 1, flatShading: true });
    M.entYaprak = mat('#2c3f22', { roughness: 1, flatShading: true });
    M.ejder = mat('#3a1610', { roughness: .45, metalness: .2, flatShading: true }); M.ejderKarin = mat('#6a4a2a', { roughness: .6, flatShading: true });
    M.kanat = new THREE.MeshStandardMaterial({ color: 0x2a120e, roughness: .75, side: THREE.DoubleSide, flatShading: true });
    M.boynuz = mat('#9a8e78', { roughness: .6 }); M.ejderGoz = new THREE.MeshBasicMaterial({ color: 0xffb020 });
    M.alev = new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    M.alevZemin = new THREE.MeshBasicMaterial({ map: parlakTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    M.kartal = mat('#4a3320', { roughness: .9, flatShading: true }); M.kartalBas = mat('#8a7658', { roughness: .9, flatShading: true }); M.gaga = mat('#8a6a30', { roughness: .5 });
    M.kartalKanat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: .9, side: THREE.DoubleSide, flatShading: true });
    M.at = mat('#cfc8ba', { roughness: .7 }); M.yele = mat('#9a9284', { roughness: .9 }); M.gumus = mat('#9aa2aa', { roughness: .35, metalness: .85 });
    M.pelerin = new THREE.MeshStandardMaterial({ color: 0x24302a, roughness: .9, side: THREE.DoubleSide });
    M.ok = new THREE.MeshStandardMaterial({ map: okTex, roughness: .95, side: THREE.DoubleSide });
    M.su = new THREE.MeshStandardMaterial({ map: suTex, color: 0x9aa8ae, transparent: true, opacity: .8, roughness: .15, emissive: 0x3a4a52, emissiveIntensity: .3, side: THREE.DoubleSide, depthWrite: false });
    M.gol = new THREE.MeshStandardMaterial({ color: 0x2a3a42, roughness: .05, metalness: .4, envMap: ENV, transparent: true, opacity: .92 });
    // uzaktaki dağlar, kuleler: sis içinde kaybolmasınlar (siluet olarak görünsünler)
    const uzak = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, fog: false, flatShading: true, ...o });
    M.kule = uzak(0x121012, { metalness: .4, roughness: .55 });
    M.lav = new THREE.MeshBasicMaterial({ color: 0xff5010, fog: false, toneMapped: false });
    M.goz = new THREE.MeshBasicMaterial({ map: gozTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
    M.gozIsik = new THREE.MeshBasicMaterial({ map: parlakTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
    M.uzakBeyaz = uzak(0xa8a69e, { flatShading: false });
    M.dag = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });           // yakın dağlar (sisli)
    M.uzakDagR = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog: false });   // ufuk dağları
    M.kivilcim = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }
  function ortamKur() {   // sahne saklanır: WebGL bağlamı kaybolup gelirse yansıma yeniden çizilir (A.ortamHaritasi)
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ map: gokTex, side: THREE.BackSide })));
    const yer = new THREE.Mesh(new THREE.CircleGeometry(99, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2e3024 })); yer.position.y = -4; es.add(yer);
    return A.ortamHaritasi(es, .03, 1, 300);
  }

  /* ---------- yardımcılar ---------- */
  // birçok parçayı tek, köşe renkli geometride birleştirir: kalabalıklar (elf, hobbit, ork, ağaç) tek çizimde çizilir
  // sapma > 0: köşeler konuma bağlı gürültüyle itilir (yapraklar, kayalar düzgün top/koni gibi durmasın; aynı
  // noktadaki köşeler aynı itilir, yüzeyde yarık açılmaz)
  function renkli(parcalar, sapma = 0) {
    const geos = parcalar.map(([g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]]) => {
      const q = g.index ? g.toNonIndexed() : g.clone();
      for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
      dummy.position.set(...p); dummy.rotation.set(...r); dummy.scale.set(...s); dummy.updateMatrix(); q.applyMatrix4(dummy.matrix);
      const col = new THREE.Color(c), n = q.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const v = 1 + (vgur(q.attributes.position.getX(i) * 3.1 + 7, q.attributes.position.getY(i) * 2.3 + q.attributes.position.getZ(i) * 1.7, 256) - .5) * .35; arr[i * 3] = col.r * v; arr[i * 3 + 1] = col.g * v; arr[i * 3 + 2] = col.b * v; }
      q.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return q;
    });
    const out = A.mergeGeometries(geos, false); geos.forEach(g => g.dispose());
    if (sapma) {
      const p = out.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + (vgur(x * .9 + 3, y * .9, 256) - .5) * sapma, y + (vgur(y * .9 + 11, z * .9, 256) - .5) * sapma, z + (vgur(z * .9 + 19, x * .9, 256) - .5) * sapma); }
      out.computeVertexNormals();
    }
    return out;
  }
  // örnekli (instanced) çizim: liste [{x,y,z,ry,s}]; renk > 0 ise her örnek biraz farklı tonda (ağaçlar tek tip durmasın)
  function topluCiz(D, geo, malz, liste, golge = true, renk = 0) {
    const im = new THREE.InstancedMesh(geo, malz, Math.max(1, liste.length));
    liste.forEach((o, i) => { dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); dummy.scale.setScalar(o.s || 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    if (renk) { const c = new THREE.Color(); liste.forEach((o, i) => { const k = 1 - renk + srand() * renk * 1.4; c.setRGB(k * (.95 + srand() * .1), k, k * (.92 + srand() * .1)); im.setColorAt(i, c); }); }
    im.count = liste.length; im.castShadow = golge; im.receiveShadow = false; D.add(im); return im;
  }
  // köşe renkli parçaları tek çizimde birleştirir (oyunun ortak birleştiricisi köşe renklerini sildiği için ondan muaf)
  function tekParca(D, geos, malz) { const m = new THREE.Mesh(A.mergeGeometries(geos, false), malz); m.userData.noMerge = true; D.add(m); geos.forEach(g => g.dispose()); return m; }
  // pürüzlü dağ: kesik koni köşeleri gürültüyle itilir (sırtlar, yarıklar); renk yükseğe göre kaya → kar
  function dagGeo(r, h, { ust = 0, kar = 0, kaya = [74, 70, 64], seg = 22, kat = 9, tohum = 0, puruz = 1 } = {}) {
    const g = new THREE.CylinderGeometry(ust, r, h, seg, kat, true).toNonIndexed(), p = g.attributes.position;
    const renk = new Float32Array(p.count * 3), c = new THREE.Color(), t0 = tohum * 37.3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), yk = (y + h / 2) / h, a = Math.atan2(z, x);
      const n1 = vgur(a * 2.2 + t0, yk * 3, 256), n2 = vgur(a * 7 + t0, yk * 8 + 5, 256), n3 = vgur(a * 19 + t0, yk * 17, 256);
      const itme = 1 + ((n1 - .5) * .8 + (n2 - .5) * .35 + (n3 - .5) * .12) * puruz;
      p.setXYZ(i, x * itme, y + ((n2 - .5) * .14 + (n3 - .5) * .05) * h * (1 - yk) * puruz, z * itme);
      const k = .55 + n2 * .5 + n3 * .2 - (1 - yk) * .15;
      let rr = kaya[0] * k, gg = kaya[1] * k, bb = kaya[2] * k;
      if (kar && yk > kar - n1 * .18 + (n3 - .5) * .08) { rr = 196 + n3 * 30; gg = 200 + n3 * 30; bb = 206 + n3 * 30; }
      c.setRGB(rr / 255, gg / 255, bb / 255, THREE.SRGBColorSpace); renk[i * 3] = c.r; renk[i * 3 + 1] = c.g; renk[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(renk, 3)); g.computeVertexNormals();
    return g;
  }
  const yonu = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);   // (x,z)'den (tx,tz)'ye bakan dönüş
  const pistNoktasi = (s, yan) => { frameAt(s, F1); return [F1.p.x + F1.r.x * yan, F1.p.z + F1.r.z * yan]; };
  const ANIM = [];   // her karede çalışan dekor animasyonları (t: yarış saati, dt)
  const ALANLAR = [];   // ağaç dikilmeyecek yerler [x, z, yarıçap]

  /* =========================================================
     ARAZİ
     ========================================================= */
  let KOPRU = null, SIRT = [], SENLIK = null, ORDU = null, RIV = null, HELM = null;
  let disari = 1;   // pistin sağ vektörü (R) halkanın dışını mı (1) içini mi (-1) gösteriyor
  function kopruTepe(x, z) {
    if (!KOPRU) return -99;
    const dx = x - KOPRU.p.x, dz = z - KOPRU.p.z, boy = Math.abs(dx * KOPRU.t.x + dz * KOPRU.t.z), yan = Math.abs(dx * KOPRU.r.x + dz * KOPRU.r.z);
    const h = 22 * sstep(28, 42, yan) * (1 - sstep(110, 190, yan)) * sstep(46, 18, boy);
    return h > .01 ? h : -99;   // köprü başlarının dışında tepe yok (arazi yerinde kalır)
  }
  function sirtH(x, z) {   // ork okçularının durduğu kayalık sırt
    let b = 1e9; for (const [a, c] of SIRT) b = Math.min(b, Math.hypot(x - a, z - c));
    return 9 * sstep(18, 4, b);
  }
  function zeminH(x, z) {
    const rx = x / SC, rz = z / SC, rn = A.roadNear(x, z);
    const n = Math.sin(x * .009 + 1.3) * Math.cos(z * .011 - .7) * .6 + Math.sin(x * .023 + z * .017) * .3 + Math.sin(z * .047 - x * .037) * .1;
    let amp = 12 + 16 * sstep(330, 430, rz) - 7 * sstep(230, 330, rx) + 26 * sstep(-330, -470, rz) + 14 * sstep(-330, -430, rx);
    let h = (n * .5 + .55) * amp;
    h += Math.max(0, Math.hypot(x, z) - 1300) * .35;   // haritanın kenarı yükselir (ufuk dağları)
    if (SENLIK) h = lerp(h, .2, sstep(150, 80, Math.hypot(x - SENLIK.x, z - SENLIK.z)));   // şenlik çayırı düz
    if (ORDU) h = lerp(h, .2, sstep(160, 100, Math.hypot(x - ORDU.x, z - ORDU.z)));       // ordunun dizildiği düzlük
    if (RIV) h = lerp(h, 2, sstep(120, 80, Math.hypot(x - RIV.x, z - RIV.z)));            // Rivendell'in vadi tabanı
    if (HELM) h = lerp(h, 3, sstep(270, 160, Math.hypot(x - HELM.x, z - HELM.z)));        // kalenin önündeki düzlük (yoldan görünsün)
    h = lerp(-.4, h, sstep(22, 60, rn.d));   // pistin yanı düz (yolun kenarına tepe binmesin)
    h = Math.max(h, sirtH(x, z) - .4);   // sırt yoksa yol kenarı yine yolun altında (-0,4) kalır
    return Math.max(h, kopruTepe(x, z));
  }
  function renkAt(x, z, h) {
    const rx = x / SC, rz = z / SC, c = new THREE.Color(0x46532e);
    c.lerp(new THREE.Color(0x5a7a3a), sstep(200, 320, rz));                 // Shire: yeşil çayır (haritanın en canlı yeri)
    c.lerp(new THREE.Color(0x27321d), sstep(220, 320, rx) * (1 - sstep(240, 340, rz)));   // Fangorn: koyu orman tabanı
    c.lerp(new THREE.Color(0x5c5840), sstep(-260, -360, rx));               // Helm yönü: kuru, sararmış ot
    c.lerp(new THREE.Color(0x58534a), sstep(4, 14, h) * .65);               // yükseklerde kaya
    c.lerp(new THREE.Color(0x3e3a2c), sstep(.5, .72, vgur(x * .02, z * .02, 256)) * .5);   // yer yer çamurlu, çiğnenmiş toprak
    const md = Math.hypot(x - MORDOR.x, z - MORDOR.z);
    c.lerp(new THREE.Color(0x3a302a), sstep(1700, 1000, md));                // Mordor'a doğru kül rengi
    return c;
  }
  function araziKur(D) {
    const BOY = 3400, SEG = A.isTouch ? 200 : 240, g = new THREE.PlaneGeometry(BOY, BOY, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = g.attributes.position, renk = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = zeminH(x, z); pos.setY(i, h);
      const c = renkAt(x, z, h), v = .9 + srand() * .2; renk[i * 3] = c.r * v; renk[i * 3 + 1] = c.g * v; renk[i * 3 + 2] = c.b * v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(renk, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.zemin); m.receiveShadow = true; m.userData.noMerge = true; D.add(m);
  }

  /* =========================================================
     DÜNYA
     ========================================================= */
  const MORDOR = { x: 1500, z: -1550 };
  const RG = { isiklar: [], gok: null, goz: null, gozIsik: null, ent: null, ejder: null, kartallar: [], hobbitler: [], elfler: null, orklar: null, atli: null, sancaklar: [], fisek: null, lav: [] };
  const Z = { koseler: [], entS: 0, entYan: 1, kopruS: 0, orkA: 0, orkB: 0, orkCek: 0, ejderAtes: 0, entOlay: null };
  function kur(D) {
    ENV = ortamKur(); malzemeler();
    const L = A.L, START_S = A.START_S;
    { let cx = 0, cz = 0; for (const p of A.P) { cx += p.x; cz += p.z; } cx /= A.P.length; cz /= A.P.length; let t = 0; for (let i = 0; i < A.P.length; i += 20) t += (A.P[i].x - cx) * A.R[i].x + (A.P[i].z - cz) * A.R[i].z; disari = Math.sign(t) || 1; }
    Z.koseler = koseBul();
    // önemli yerler (pist üzerindeki konumları)
    Z.kopruS = sp(-148, -284); frameAt(Z.kopruS, F1);
    KOPRU = { p: F1.p.clone(), t: F1.t.clone(), r: F1.r.clone() };
    Z.orkA = sp(-302, -60); Z.orkB = sp(-420, 120);
    for (let s = Z.orkA; inRange(s, Z.orkA, Z.orkB); s += 10) SIRT.push(pistNoktasi(s, disari * 34));   // yoldan görünen alçak sırt
    { const s = sp(-440, 170); const [x, z] = pistNoktasi(s, disari * 235); HELM = { x, z, s }; }
    { const s = sp(-160, 302); const [x, z] = pistNoktasi(s, -disari * 72); SENLIK = { x, z, s }; }   // şenlik yoldan görünür (iç tarafta)
    { const s = sp(100, -282); const [x, z] = pistNoktasi(s, disari * 70); ORDU = { x, z, s }; }
    { const [x, z] = pistNoktasi(ORDU.s - 40, disari * 175); RIV = { x, z }; }   // ordunun arkasındaki vadi
    ALANLAR.push([SENLIK.x, SENLIK.z, 90], [ORDU.x, ORDU.z, 75], [RIV.x, RIV.z, 90]);

    araziKur(D);
    // gökyüzü kubbesi kameraya eşlik eder
    RG.gok = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.MeshBasicMaterial({ map: gokTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    RG.gok.renderOrder = 2; RG.gok.frustumCulled = false;   // saydam olmayanlardan sonra: arkada kalan gök pikselleri boyanmaz
    RG.gok.userData.noMerge = true; D.add(RG.gok);

    /* pist: taş yol, kerb, toprak kenar, kuru taş duvar */
    ribbon(-HW, HW, .05, .05, 32, M.yol, true);   // doku 16×32 birim: taşlar kare kalsın
    ribbon(HW, HW + 1.3, .11, .11, 3, M.kerb, true); ribbon(-HW - 1.3, -HW, .11, .11, 3, M.kerb, true);
    ribbon(HW + 1.3, HW + 4.4, .04, .04, 12, M.toprak, true); ribbon(-HW - 4.4, -HW - 1.3, .04, .04, 12, M.toprak, true);
    const DH = 1.5;
    for (const sg of [-1, 1]) {
      const a = sg * (HW + 3.4), b = sg * (HW + 4.2);
      ribbon(a, a, -.3, DH, 6, M.duvar, true).castShadow = true;
      ribbon(b, b, -.3, DH, 6, M.duvar, false);
      ribbon(Math.min(a, b), Math.max(a, b), DH, DH, 30, M.duvarUst, false);
    }
    // bitiş çizgisi
    {
      frameAt(START_S, F1);
      const g = new THREE.Group(); g.position.copy(F1.p); g.position.y += .07; g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
      const t = A.TEX.finish.clone(); t.needsUpdate = true; t.repeat.set(8, 1);
      mk(g, new THREE.PlaneGeometry(2 * HW, 2), new THREE.MeshStandardMaterial({ map: t, roughness: .6, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), 0, 0, 0, { r: [-Math.PI / 2, 0, 0], cast: false, recv: true });
    }
    baslangicKapisi(D, START_S);
    virajLevhalari(D);

    shireKur(D);
    fangornKur(D);
    rivendellKur(D);
    kopruKur(D);
    helmKur(D);
    uzakKur(D);
    agaclar(D);
    kartallarKur(D);
    bolgeTabelalari(D);

    const pads = pedKur(PED_YERI, yasakAraliklar());
    return { pads, env: ENV };
  }
  const yasakAraliklar = () => [...Z.koseler, [Z.kopruS - 24, Z.kopruS + 24], [Z.entS - 40, Z.entS + 40]];

  // virajlar: iki yanındaki yön farkı büyük olan aralıklar (hız pedleri ve yol engelleri buraya konmaz)
  function koseBul() {
    const L = A.L, out = []; let ac = null, tepe = 0;
    for (let s = 0; s < L; s += 3) {
      frameAt(s - 22, F1); frameAt(s + 22, F2);
      const ang = Math.acos(clamp(F1.t.dot(F2.t), -1, 1));
      if (ang > .5) { if (!ac) { ac = [s, s]; tepe = 0; } ac[1] = s; tepe = Math.max(tepe, ang); }
      else if (ac) { out.push([...ac, tepe]); ac = null; }
    }
    if (ac) { if (out.length && out[0][0] === 0) { out[0][0] = ac[0]; out[0][2] = Math.max(out[0][2], tepe); } else out.push([...ac, tepe]); }
    return out.map(([a, b, t]) => { const r = [((a - 20) % L + L) % L, ((b + 20) % L + L) % L]; r.tepe = t; return r; });
  }
  // başlangıç kapısı: iki ahşap direk, "SHIRE" tabelası, geri sayımda yanan 5 fener
  function baslangicKapisi(D, s) {
    frameAt(s, F1);
    const g = new THREE.Group(); g.position.copy(F1.p); g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
    const x0 = HW + 5.6, h = 10;
    for (const sx of [-1, 1]) { mk(g, cyl(.9, 1.1, h + 2, 10), M.koyuTahta, sx * x0, (h + 2) / 2, 0); mk(g, box(2.6, 1, 2.6), M.tas, sx * x0, .5, 0); }
    mk(g, box(x0 * 2 + 2.4, 1.4, 1.4), M.koyuTahta, 0, h + .6, 0);
    const lev = mk(g, new THREE.PlaneGeometry(14, 4.4), new THREE.MeshStandardMaterial({ map: tabelaTex('SHIRE', 'Hobbitlerin diyarı'), roughness: .8, side: THREE.DoubleSide }), 0, h + 3.6, -.2, { cast: false });
    lev.rotation.y = Math.PI;
    for (const sx of [-6, 6]) mk(g, cyl(.12, .12, 2.4, 6), M.koyuTahta, sx, h + 2, 0, { cast: false });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xff3a1a, emissiveIntensity: 0, roughness: .4 });
      mk(g, cyl(.08, .08, 1.2, 6), M.koyuTahta, (i - 2) * 2.4, h - .5, -.2, { cast: false });
      const l = mk(g, sph(.55, 12, 10), m, (i - 2) * 2.4, h - 1.4, -.2, { cast: false }); l.userData.noMerge = true;
      RG.isiklar.push(m);
    }
  }
  // virajların dış yanında tahta ok levhaları; sert virajlardan önce fren direkleri
  function virajLevhalari(D) {
    // ters yöndeki levha aynalanmış dokuyla çizilir (ölçeği -1 yapmak birleştirmede yüzünü karartıyordu)
    const kart = new THREE.PlaneGeometry(4.2, 2.1), kartTers = kart.clone();
    { const uv = kartTers.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    for (const k of Z.koseler) {
      const [a, b] = k;
      frameAt(a, F1); frameAt(b, F2);
      const sag = F1.t.x * F2.t.z - F1.t.z * F2.t.x < 0, side = sag ? 1 : -1;
      for (let s = a + 6; inRange(s, a, b); s += 12) {
        frameAt(s, F1);
        const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, side * (HW + 5.4)); g.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI; D.add(g);
        mk(g, sag ? kartTers : kart, M.ok, 0, 2.9, 0, { cast: false });
        for (const sx of [-1.4, 1.4]) mk(g, box(.26, 2.2, .26), M.koyuTahta, sx, 1.1, -.12);
      }
    }
  }
  // bölgelerin girişinde yol kenarında tahta tabelalar
  function bolgeTabelalari(D) {
    const liste = [[sp(250, 282) - 60, 'FANGORN', 'Ormanı'], [sp(246, -272) + 30, 'RIVENDELL', 'Elflerin vadisi'], [Z.kopruS - 130, 'ANDUIN', 'Köprüsü'],
      [sp(-304, -150) + 20, 'HELM GEÇİDİ', 'Rohan'], [sp(-450, 286) + 10, 'SHIRE', 'Hobbiton'], [sp(60, 300), 'MORDOR', '← uzakta, dikkat']];
    for (const [s, ad, alt] of liste) {
      frameAt(s, F1);
      const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, disari * (HW + 6.6)); g.position.y = zeminH(g.position.x, g.position.z) - .2;
      g.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI - disari * .4; D.add(g);
      mk(g, cyl(.22, .26, 4.4, 8), M.koyuTahta, 0, 2.2, 0);
      mk(g, new THREE.PlaneGeometry(5.6, 1.75), new THREE.MeshStandardMaterial({ map: tabelaTex(ad, alt), roughness: .8, side: THREE.DoubleSide }), 0, 4, .3, { cast: false });
      ALANLAR.push([g.position.x, g.position.z, 4]);
    }
  }

  /* ---------- SHIRE: hobbit evleri ve şenlik ---------- */
  function hobbitGeo(yelek, tur) {
    const ten = '#c9a084', p = [
      [box(.5, .24, .82), '#5e4230', [-.27, .12, .14]], [box(.5, .24, .82), '#5e4230', [.27, .12, .14]],   // tüylü büyük ayaklar
      [cyl(.19, .21, .62, 8), '#3a2e22', [-.21, .52, 0]], [cyl(.19, .21, .62, 8), '#3a2e22', [.21, .52, 0]],
      [cyl(.4, .46, .85, 7), '#b8ae98', [0, 1.18, 0]], [cyl(.43, .48, .5, 7), yelek, [0, 1.07, .02]],
      [sph(.4, 8, 6), ten, [0, 1.86, 0]], [sph(.44, 7, 5), '#6a4322', [0, 1.98, -.07], [0, 0, 0], [1, .74, 1]],
      [sph(.09, 4, 3), ten, [-.4, 1.85, 0]], [sph(.09, 4, 3), ten, [.4, 1.85, 0]],
    ];
    if (tur === 'kadeh') p.push([cyl(.1, .1, .8, 6), ten, [.52, 1.95, 0], [0, 0, -.35]], [cyl(.17, .15, .34, 8), '#8a5a2a', [.66, 2.42, 0]], [cyl(.17, .17, .07, 8), '#fffbe8', [.66, 2.62, 0]], [cyl(.1, .1, .8, 6), ten, [-.52, 1.2, 0], [0, 0, .28]]);
    else if (tur === 'dans') p.push([cyl(.1, .1, .8, 6), ten, [-.55, 1.95, 0], [0, 0, .55]], [cyl(.1, .1, .8, 6), ten, [.55, 1.95, 0], [0, 0, -.55]]);
    else p.push([cyl(.1, .1, .75, 6), ten, [-.42, 1.4, .3], [1.1, 0, 0]], [cyl(.1, .1, .75, 6), ten, [.42, 1.4, .3], [1.1, 0, 0]], [sph(.22, 8, 6), '#c8902a', [0, 1.45, .7]]);   // yemek yiyor
    return renkli(p);
  }
  function shireKur(D) {
    const S = SENLIK;
    // hobbit evleri: pistin dışındaki tepelerde yuvarlak kapılar (yola bakar)
    let i = 0;
    for (let s = sp(-430, 300) + 40; inRange(s, sp(-430, 300), sp(170, 292)); s += 62) {
      const yan = disari * (40 + srand() * 26), [x, z] = pistNoktasi(s, yan), [tx, tz] = pistNoktasi(s, 0);
      hobbitEvi(D, x, z, yonu(x, z, tx, tz), i++);
      ALANLAR.push([x, z, 16]);
    }
    // şenlik çayırı: büyük ağaç, çadır, uzun masalar, fener dizileri
    const g = new THREE.Group(); g.position.set(S.x, .2, S.z); frameAt(S.s, F1); g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
    // şenlik ağacı
    mk(g, cyl(1.6, 2.4, 14, 10), M.kabuk, 0, 7, 0);
    for (const [x, y, z, r] of [[0, 18, 0, 9], [-6, 15, 3, 6], [6, 15, -2, 6.5], [2, 21, -3, 5.5], [-3, 20, -5, 5]]) mk(g, new THREE.IcosahedronGeometry(r, 1), M.tepe, x, y, z, { s: [1, .8, 1] });
    // beyaz çadır (kırmızı çizgili çatı)
    for (const [x, z, r] of [[-26, -10, 9], [24, 14, 7]]) {
      mk(g, new THREE.CylinderGeometry(r, r, 4.5, 16, 1, true), M.cadir, x, 2.25, z);
      mk(g, new THREE.ConeGeometry(r * 1.15, 5.5, 16), M.cadirKirmizi, x, 7.2, z);
      mk(g, cyl(.15, .15, 3, 6), M.koyuTahta, x, 11.2, z);
    }
    // uzun masalar ve üstündekiler
    const masalar = [[-8, 14, 0], [10, -12, .3], [-14, -22, -.2]];
    for (const [x, z, r] of masalar) {
      const m = new THREE.Group(); m.position.set(x, 0, z); m.rotation.y = r; g.add(m);
      mk(m, box(12, .3, 2.2), M.tahta, 0, 1.15, 0); for (const sx of [-5.4, 5.4]) for (const sz of [-.8, .8]) mk(m, box(.25, 1.1, .25), M.koyuTahta, sx, .55, sz);
      for (const sz of [-1.7, 1.7]) mk(m, box(12, .2, .6), M.tahta, 0, .65, sz);   // banklar
      for (let k = 0; k < 9; k++) { const c = ['#8a6428', '#7a3424', '#a89058', '#5a3c22', '#b0a488'][k % 5]; mk(m, sph(.35, 8, 6), mat(c, { roughness: .7 }), -5 + k * 1.25, 1.45, sr(-.4, .4), { cast: false }); }
      mk(m, cyl(.6, .6, 1.2, 10), M.koyuTahta, 6.4, .6, 1.6);   // fıçı
    }
    // fener dizileri: direkler arasında sarkan ışıklar
    const direk = [[-30, 6], [-12, 26], [12, 22], [30, -2], [16, -26], [-14, -30]];
    for (const [x, z] of direk) mk(g, cyl(.18, .22, 7, 6), M.koyuTahta, x, 3.5, z);
    for (let k = 0; k < direk.length; k++) {
      const [x1, z1] = direk[k], [x2, z2] = direk[(k + 1) % direk.length];
      for (let j = 1; j < 8; j++) { const u = j / 8; mk(g, sph(.28, 8, 6), M.fener, lerp(x1, x2, u), 6.8 - Math.sin(u * Math.PI) * 1.6, lerp(z1, z2, u), { cast: false }); }
    }
    // hobbitler: masalarda yiyip içenler, ortada dans edenler (her tür tek çizimde)
    const turler = [['kadeh', '#3e4a2c'], ['dans', '#6a5a34'], ['yemek', '#5a3226']];   // toprak tonlu yelekler
    const yerler = { kadeh: [], dans: [], yemek: [] };
    for (const [x, z, r] of masalar) for (let k = 0; k < 6; k++) {
      const yan = k % 2 ? 1 : -1, lx = -4.5 + Math.floor(k / 2) * 4.2, lz = yan * 2.1, c = Math.cos(r), s_ = Math.sin(r);
      yerler[k % 3 === 0 ? 'kadeh' : 'yemek'].push({ x: x + lx * c + lz * s_, z: z - lx * s_ + lz * c, ry: r + (yan > 0 ? Math.PI : 0), faz: srand() * 6 });
    }
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; yerler.dans.push({ x: Math.cos(a) * 7 + 2, z: Math.sin(a) * 7 + 2, ry: -a, faz: k * .6 }); }
    for (const [tur, renk] of turler) {
      const liste = yerler[tur], im = topluCiz(g, hobbitGeo(renk, tur), M.renkli, liste.map(o => ({ ...o, y: 0, s: 1.35 })));
      RG.hobbitler.push({ im, liste, tur });
    }
    // havai fişek: şenliğin üstünde renkli patlamalar
    const n = 120, fis = new THREE.InstancedMesh(new THREE.SphereGeometry(.7, 6, 4), M.kivilcim, n);
    fis.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    dummy.scale.setScalar(0); dummy.updateMatrix(); for (let k = 0; k < n; k++) fis.setMatrixAt(k, dummy.matrix);
    fis.frustumCulled = false; fis.userData.noMerge = true; fis.castShadow = false; D.add(fis);
    RG.fisek = { im: fis, n, patlamalar: [], sonraki: 2 };
  }
  function hobbitEvi(D, x, z, ry, i) {
    const y = zeminH(x, z), g = new THREE.Group(); g.position.set(x, y - .3, z); g.rotation.y = ry; D.add(g);
    mk(g, sph(11, 18, 10), M.tepe, 0, -2.5, -6, { s: [1, .62, 1], cast: false, recv: true });     // evin üstündeki tepe (kapı yamaçta)
    mk(g, new THREE.CircleGeometry(1.7, 24), M.kapi[i % 4], 0, 2.1, 3.62, { cast: false });        // yuvarlak kapı
    mk(g, new THREE.TorusGeometry(1.85, .28, 8, 24), M.kapiCerceve, 0, 2.1, 3.55, { cast: false });
    mk(g, sph(.2, 8, 6), M.pirinc, 0, 2.1, 3.72, { cast: false });                                  // kapının ortasındaki tokmak
    for (const sx of [-3.6, 3.6]) { mk(g, new THREE.CircleGeometry(.85, 18), M.cam, sx, 2.6, 2.9, { cast: false, r: [0, sx > 0 ? -.35 : .35, 0] }); mk(g, new THREE.TorusGeometry(.95, .16, 6, 18), M.kapiCerceve, sx, 2.6, 2.86, { cast: false, r: [0, sx > 0 ? -.35 : .35, 0] }); }
    mk(g, box(5.4, .3, 2.6), M.tas, 0, .15, 4.8, { cast: false });                                   // kapı önü taşlığı
    mk(g, cyl(.45, .55, 3, 8), M.tas, 3.5, 5.5, -5);                                                // baca
    for (let k = -3; k <= 3; k++) if (k) mk(g, box(.18, 1, .18), M.tahta, k * 1.3, .5, 7.6, { cast: false });   // bahçe çiti
    mk(g, box(7.8, .14, .1), M.tahta, 0, .85, 7.6, { cast: false });
    for (let k = 0; k < 6; k++) mk(g, sph(.32, 6, 5), mat(['#8a4a52', '#a08a40', '#a8a8a0', '#6a4a6a'][k % 4]), sr(-3.5, 3.5), .35, sr(5.5, 7.2), { cast: false });   // çiçekler
    const baca = new THREE.Vector3(3.5, 7.2, -5).applyAxisAngle(A.UP, ry).add(g.position);
    ANIM.push((t, dt) => { if (Math.random() < dt * 1.2) emit(baca.x, baca.y, baca.z, rand(-.3, .3), rand(1.2, 2), rand(-.3, .3), rand(1.4, 2.2), rand(2, 3)); });   // yarışta dünya tohumu (srand) kullanılmaz
  }

  /* ---------- FANGORN: yaşlı orman ve Ent ---------- */
  function fangornKur(D) {
    // Ent'in durduğu köşe (dar viraj): virajın dış yanında, duvarın arkasında
    const k = Z.koseler.find(c => inRange(sp(308, -258), c[0], c[1])) || [sp(308, -258) - 30, sp(308, -258) + 30];
    const ort = k[0] + (((k[1] - k[0]) % A.L + A.L) % A.L) * .5;
    frameAt(k[0], F1); frameAt(k[1], F2);
    const dis = (F1.t.x * F2.t.z - F1.t.z * F2.t.x < 0) ? 1 : -1;
    Z.entS = ort + 14; Z.entYan = dis;
    const [x, z] = pistNoktasi(Z.entS, dis * 21), [tx, tz] = pistNoktasi(Z.entS, 0);
    ALANLAR.push([x, z, 14]);
    RG.ent = entKur(D, x, zeminH(x, z), z, yonu(x, z, tx, tz));
  }
  // Hareketli parçalar "dyn" grup: her grup kendi içinde malzemeye göre birleşir ama hareket etmeye devam eder
  // (Ent ~40 çizimden ~12'ye). Ayağa göre uzayıp dönen bacaklar ayrı kalır.
  function entKur(D, x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, y - .3, z); g.rotation.y = ry; g.userData.dyn = true; D.add(g);
    const govde = new THREE.Group(); govde.position.y = 10; govde.userData.dyn = true; g.add(govde);
    mk(govde, new THREE.CylinderGeometry(2.2, 3, 12, 9, 3), M.kabuk, 0, 6, 0);                            // gövde (kabuk)
    for (const [a, r] of [[0, .4], [2.1, -.3], [4.2, .2]]) mk(govde, new THREE.CylinderGeometry(.25, .7, 5, 6), M.kabuk, Math.cos(a) * 1.5, 14, Math.sin(a) * 1.5, { r: [r, 0, a * .3 - .3] });   // dallar
    for (const [x0, y0, z0, r] of [[0, 17, 0, 4.2], [-2.6, 15.5, 1, 2.8], [2.8, 15.8, -.6, 3], [.5, 19.5, -1, 2.6]]) mk(govde, new THREE.IcosahedronGeometry(r, 1), M.entYaprak, x0, y0, z0);
    mk(govde, box(2.2, 2.4, .8), M.yosun, 0, 10.5, 2.4);                                                    // yüz: yosunlu sakal ve kaşlar
    for (const sx of [-.65, .65]) mk(govde, sph(.3, 8, 6), M.cam, sx, 11.4, 2.72, { cast: false });         // kehribar gözler
    mk(govde, box(2.4, .4, .5), M.kabuk, 0, 11.95, 2.6);
    for (let j = 0; j < 5; j++) mk(govde, new THREE.CylinderGeometry(.08, .2, 2.2, 5), M.yosun, -.8 + j * .4, 8.7, 2.5, { r: [.15, 0, 0], cast: false });   // sakal
    const kollar = [];
    for (const sx of [-1, 1]) {
      const kol = new THREE.Group(); kol.position.set(sx * 2.6, 10, 0); kol.userData.dyn = true; govde.add(kol);
      mk(kol, new THREE.CylinderGeometry(.5, .8, 8, 7), M.kabuk, 0, -4, 0);
      for (let j = 0; j < 4; j++) mk(kol, new THREE.CylinderGeometry(.08, .22, 2.2, 5), M.kabuk, -.4 + j * .27, -8.6, .2, { r: [.2, 0, (j - 1.5) * .3] });
      kol.rotation.z = sx * .25; kollar.push(kol);
    }
    // bacaklar: kalçadan ayağa uzanan kalın kökler (ayağın yeri serbestçe verilir)
    const bacak = () => { const m = mk(g, new THREE.CylinderGeometry(1.1, 1.5, 1, 8).translate(0, .5, 0), M.kabuk); m.userData.noMerge = true; return m; };
    const ayak = () => { const a = new THREE.Group(); a.userData.dyn = true; g.add(a); mk(a, new THREE.CylinderGeometry(1.4, 2.3, 1.2, 8), M.kabuk, 0, .6, 0); for (let j = 0; j < 5; j++) mk(a, new THREE.CylinderGeometry(.15, .4, 2.6, 5), M.kabuk, Math.cos(j * 1.25) * 1.6, .3, Math.sin(j * 1.25) * 1.6, { r: [Math.sin(j * 1.25) * 1.2, 0, -Math.cos(j * 1.25) * 1.2], cast: false }); return a; };
    const ent = { g, govde, kollar, bacaklar: [bacak(), bacak()], ayaklar: [ayak(), ayak()], kalcalar: [new THREE.Vector3(-1.6, 10.3, 0), new THREE.Vector3(1.6, 10.3, 0)],
      ayakYer: [new THREE.Vector3(-2.2, 0, -.5), new THREE.Vector3(2.2, 0, .5)] };
    entBacak(ent);
    return ent;
  }
  // bacak: kalçadan ayağa uzanan silindir (ayak nerede olursa olsun bağlı kalır)
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _kalca = new THREE.Vector3();
  function entBacak(ent) {
    for (let i = 0; i < 2; i++) {
      const k = _kalca.copy(ent.kalcalar[i]); k.x += ent.govde.position.x; k.z += ent.govde.position.z; k.y += ent.govde.position.y - 10;
      const a = ent.ayakYer[i], b = ent.bacaklar[i];
      _v.copy(k).sub(a); const boy = _v.length(); _q.setFromUnitVectors(A.UP, _v.normalize());
      b.position.copy(a); b.position.y += 1; b.quaternion.copy(_q); b.scale.set(1, Math.max(1, boy - 1), 1);
      ent.ayaklar[i].position.copy(a);
    }
  }

  /* ---------- RIVENDELL: elf yapıları, şelaleler, elf ordusu ve atlı komutan ---------- */
  function elfGeo() {
    return renkli([
      [cyl(.17, .2, 1.4, 6), '#2a2a2e', [-.2, .7, 0]], [cyl(.17, .2, 1.4, 6), '#2a2a2e', [.2, .7, 0]],
      [cyl(.42, .62, 1.6, 7), '#2a3430', [0, 1.65, 0]],                      // koyu yeşil-gri pelerin
      [cyl(.46, .4, .85, 7), '#8a7a52', [0, 2.05, .02]],                     // eskimiş pirinç zırh
      [sph(.29, 7, 5), '#c8b49c', [0, 2.72, 0]],
      [new THREE.ConeGeometry(.35, 1, 7), '#9a8a5e', [0, 3.15, -.02]],       // uzun miğfer
      [cyl(.045, .045, 4.4, 4), '#4a3e2e', [.56, 2.3, .12]], [new THREE.ConeGeometry(.12, .55, 4), '#b8bcc0', [.56, 4.75, .12]],   // mızrak
      [cyl(.58, .58, .12, 9), '#6e6446', [-.52, 1.85, .25], [Math.PI / 2, 0, 0]], [cyl(.2, .2, .14, 6), '#8a8a86', [-.52, 1.85, .32], [Math.PI / 2, 0, 0]],   // kalkan
    ]);
  }
  function rivendellKur(D) {
    const O = ORDU;
    frameAt(O.s, F1);
    const ry = Math.atan2(F1.t.x, F1.t.z);
    // elf ordusu: pistin kenarında saf saf dizilmiş; yüzleri pist tarafındaki komutana dönük
    const liste = [], cx = F1.r.x * disari, cz = F1.r.z * disari;   // dışarı yönü
    for (let sira = 0; sira < 7; sira++) for (let k = -9; k <= 9; k++) {
      const yan = 26 + sira * 3.4, boy = k * 3 + (sira % 2) * 1.5;   // ön saf duvardan 14 birim içeride: arada komutan gezer
      const x = O.x + F1.t.x * boy + cx * (yan - 70) , z = O.z + F1.t.z * boy + cz * (yan - 70);
      liste.push({ x, y: zeminH(x, z), z, ry: Math.atan2(-cx, -cz), faz: sira * .5 + k * .05 });
    }
    RG.elfler = { im: topluCiz(D, elfGeo(), M.zirh, liste), liste };
    // ordunun sancakları
    for (const k of [-10, 0, 10]) {
      const x = O.x + F1.t.x * k * 3 + cx * (26 - 70 - 3), z = O.z + F1.t.z * k * 3 + cz * (26 - 70 - 3), y = zeminH(x, z);
      mk(D, cyl(.12, .12, 9, 6), M.altin, x, y + 4.5, z);
      const s = mk(D, new THREE.PlaneGeometry(2.2, 4.4), sancakM('#22426e', '#e8e2c8', .8), x, y + 6.6, z, { cast: false });
      s.rotation.y = ry; s.geometry.translate(1.1, 0, 0); s.userData.noMerge = true; RG.sancaklar.push(s);
    }
    // atlı komutan: ordunun önünde (pist ile ordu arasında) bir aşağı bir yukarı gider, kılıcını kaldırıp konuşur
    RG.atli = atliKur(D, O, F1.t.clone(), new THREE.Vector3(cx, 0, cz));
    // Rivendell: ordunun arkasındaki vadide zarif yapılar ve şelaleler
    const vx = RIV.x, vz = RIV.z;
    const v = new THREE.Group(); v.position.set(vx, 2, vz); v.rotation.y = Math.atan2(-cx, -cz); D.add(v);
    mk(v, box(120, 14, 60), M.tas, 0, -6, 0, { cast: false });   // teras
    const ev = (x, z, w, h, d, cati = M.elfCati) => { mk(v, box(w, h, d), M.elfDuvar, x, 1 + h / 2, z); const c = mk(v, new THREE.ConeGeometry(Math.max(w, d) * .75, h * .55, 4), cati, x, 1 + h + h * .27, z, { r: [0, Math.PI / 4, 0] }); c.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); };
    ev(-30, 4, 16, 9, 10); ev(-8, -8, 20, 12, 12, M.altin); ev(18, 6, 14, 8, 9); ev(36, -10, 12, 10, 10); ev(0, 16, 10, 7, 8);
    for (const [x, z, h] of [[-44, -6, 26], [8, -18, 34], [46, 8, 22]]) { mk(v, cyl(2.2, 2.6, h, 12), M.beyaz, x, 1 + h / 2, z); mk(v, new THREE.ConeGeometry(3.2, 7, 12), M.elfCati, x, 1 + h + 3.5, z); }
    mk(v, new THREE.TorusGeometry(10, .8, 6, 16, Math.PI), M.beyaz, -18, 1, 22, { r: [0, 0, 0] });   // kemerli köprü
    // arkadaki yamaçtan dökülen şelaleler ve göl
    for (const [x, h, w] of [[-36, 60, 8], [6, 74, 11], [40, 52, 7]]) {
      const s = mk(v, new THREE.PlaneGeometry(w, h), M.su, x, 1 + h / 2, -34, { cast: false }); s.userData.noMerge = true;
      mk(v, box(w + 14, h + 20, 14), M.koyuTas, x, (h + 20) / 2 - 8, -42);
    }
    mk(v, new THREE.CircleGeometry(30, 24), M.gol, 0, 1.2, -18, { r: [-Math.PI / 2, 0, 0], cast: false });
    mk(v, box(160, 90, 30), M.koyuTas, 0, 30, -62, { cast: false });
    ALANLAR.push([vx, vz, 110]);
    ANIM.push(t => { suTex.offset.y = t * .9; });
  }
  function atliKur(D, O, ileri, disariV) {   // hareketli parçalar "dyn": kendi içlerinde birleşir, oynamaya devam eder
    const g = new THREE.Group(); g.userData.dyn = true; D.add(g);
    const at = new THREE.Group(); at.userData.dyn = true; g.add(at);
    mk(at, sph(1, 14, 10), M.at, 0, 2.6, 0, { s: [1.05, 1, 2.1] });                       // gövde
    const boyun = new THREE.Group(); boyun.position.set(0, 3.1, 1.6); boyun.userData.dyn = true; at.add(boyun);
    mk(boyun, new THREE.CylinderGeometry(.45, .7, 2.2, 8), M.at, 0, .9, .4, { r: [.6, 0, 0] });
    mk(boyun, box(.7, .75, 1.6), M.at, 0, 1.9, 1.3, { r: [.35, 0, 0] });                  // baş
    mk(boyun, box(.2, 1.4, 1.6), M.yele, 0, 1.4, .1, { r: [.6, 0, 0] });                  // yele
    const bacaklar = [];
    for (const [x, z] of [[-.55, 1.4], [.55, 1.4], [-.55, -1.5], [.55, -1.5]]) { const b = new THREE.Group(); b.position.set(x, 2.2, z); b.userData.dyn = true; at.add(b); mk(b, new THREE.CylinderGeometry(.2, .16, 2.2, 6), M.at, 0, -1.1, 0); mk(b, box(.34, .3, .4), M.koyuTas, 0, -2.15, .05); bacaklar.push(b); }
    mk(at, new THREE.CylinderGeometry(.12, .35, 2.2, 6), M.yele, 0, 2.6, -2.4, { r: [-.6, 0, 0] });   // kuyruk
    // binici: gümüş zırh, mavi pelerin, miğfer; sağ kolu kılıçla birlikte kalkar
    const b = new THREE.Group(); b.position.y = 3.4; at.add(b);
    mk(b, new THREE.CylinderGeometry(.45, .5, 1.5, 10), M.gumus, 0, .9, 0);
    mk(b, sph(.32, 10, 8), mat('#f0dcc4'), 0, 1.95, 0); mk(b, new THREE.ConeGeometry(.38, .8, 10), M.gumus, 0, 2.35, 0);
    const pel = mk(b, new THREE.PlaneGeometry(1.4, 2), M.pelerin, 0, .9, -.5, { cast: false }); pel.rotation.x = .25;
    const kol = new THREE.Group(); kol.position.set(.5, 1.5, 0); kol.userData.dyn = true; b.add(kol);
    mk(kol, new THREE.CylinderGeometry(.13, .13, .9, 6), M.gumus, 0, .45, 0);
    mk(kol, box(.12, 2.4, .05), M.gumus, 0, 2, 0); mk(kol, box(.5, .12, .12), M.altin, 0, .9, 0);   // kılıç
    for (const sx of [-.5, .5]) mk(b, new THREE.CylinderGeometry(.14, .14, 1.2, 6), M.gumus, sx, .1, .3, { r: [1.2, 0, 0] });   // bacaklar (eyerde)
    return { g, at, boyun, bacaklar, kol, O, ileri, disariV, u: 0, yon: 1 };
  }

  /* ---------- ANDUIN KÖPRÜSÜ ve ejder ---------- */
  function kopruKur(D) {
    const K = KOPRU, g = new THREE.Group(); g.position.copy(K.p); g.rotation.y = Math.atan2(K.t.x, K.t.z); D.add(g);
    // kemerli taş köprü: yol kemerin altından geçer (yerel x: yan, y: yukarı, z: yol yönü)
    // kemerin tepesi 16 birim: yol kenarında (8) 13,5, duvarda 9 birim yükseklik kalır
    // tek dış hat, kemer içe doğru kesik (delik olarak çizilince kemer açıklığında hatalı üçgen kalabiliyordu)
    const sekil = new THREE.Shape(); sekil.moveTo(-46, -2); sekil.lineTo(-14, -2); sekil.lineTo(-14, 2);
    sekil.absarc(0, 2, 14, Math.PI, 0, true); sekil.lineTo(14, -2); sekil.lineTo(46, -2); sekil.lineTo(46, 22); sekil.lineTo(-46, 22); sekil.closePath();
    const geo = new THREE.ExtrudeGeometry(sekil, { depth: 12, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -6);
    { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8); }
    mk(g, geo, M.sur, 0, 0, 0, { recv: true });
    for (const sx of [-1, 1]) for (let k = 0; k < 12; k++) mk(g, box(2.2, 1.6, 1.2), M.sur, -44 + k * 8, 22.8, sx * 5.4);   // korkuluk dişleri
    for (const sx of [-1, 1]) { mk(g, box(7, 10, 13), M.sur, sx * 40, 27, 0); mk(g, new THREE.ConeGeometry(6, 8, 4), M.elfCati, sx * 40, 36, 0, { r: [0, Math.PI / 4, 0] }); }   // köprü başlarındaki kuleler
    ALANLAR.push([K.p.x, K.p.z, 60]);
    RG.ejder = ejderKur(g);
  }
  function ejderKur(kok) {
    // köprünün tepesinde oturan ejder: gelen arabalara bakar (yolun geliş yönüne)
    // dyn: gövde parçaları malzemeye göre birleşir; sallanan kuyruk boğumları, boyun, baş ve kanatlar ayrı oynar
    const g = new THREE.Group(); g.position.set(0, 23.4, 0); g.rotation.y = Math.PI; g.scale.setScalar(1.55); g.userData.dyn = true; kok.add(g);
    mk(g, sph(3, 14, 10), M.ejder, 0, 3, -1, { s: [1, .9, 1.9] });                      // gövde
    mk(g, sph(2.4, 12, 8), M.ejderKarin, 0, 2.3, -.2, { s: [.9, .8, 1.7] });
    for (const [x, z] of [[-2.2, 2.4], [2.2, 2.4], [-2.2, -4], [2.2, -4]]) mk(g, new THREE.CylinderGeometry(.7, .5, 3.2, 7), M.ejder, x, 1.4, z, { r: [z > 0 ? -.3 : .3, 0, 0] });   // bacaklar (köprünün kenarını tutar)
    const kuyruk = []; let kp = new THREE.Vector3(0, 3, -6);
    for (let k = 0; k < 8; k++) { const r = 1.6 - k * .17; const m = mk(g, sph(r, 10, 8), M.ejder, kp.x, kp.y, kp.z); m.userData.noMerge = true; kuyruk.push(m); kp = kp.clone().add(new THREE.Vector3(Math.sin(k * .7) * 1.2, -.55, -2)); }
    mk(g, new THREE.ConeGeometry(.9, 2.2, 4), M.boynuz, kp.x, kp.y, kp.z, { r: [-Math.PI / 2, 0, 0] });
    // boyun ve baş (eğilip ateş püskürür)
    const boyun = new THREE.Group(); boyun.position.set(0, 4.6, 3.6); boyun.userData.dyn = true; g.add(boyun);
    for (let k = 0; k < 5; k++) mk(boyun, sph(1.25 - k * .1, 10, 8), M.ejder, 0, k * .72 + Math.sin(k * .6) * .3, k * 1);   // öne kıvrık boyun
    const bas = new THREE.Group(); bas.position.set(0, 3.7, 5); bas.userData.dyn = true; boyun.add(bas);
    mk(bas, box(2.2, 1.6, 3.2), M.ejder, 0, 0, .8); mk(bas, box(1.8, .6, 2.6), M.ejderKarin, 0, -.8, 1.3);
    for (const sx of [-.75, .75]) { mk(bas, new THREE.ConeGeometry(.35, 2.4, 6), M.boynuz, sx, 1.1, -.7, { r: [-1.1, 0, sx * .3] }); mk(bas, sph(.25, 8, 6), M.ejderGoz, sx, .4, 1.9, { cast: false }); }
    // kanatlar: zar (üçgen yelpaze), kemik kenar
    const kanatlar = [];
    for (const sx of [-1, 1]) {
      const k = new THREE.Group(); k.position.set(sx * 1.6, 4.6, 0); k.userData.dyn = true; g.add(k);
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(sx * 13, 6); sh.lineTo(sx * 12, 1); sh.lineTo(sx * 9, -1.5); sh.lineTo(sx * 6, -1); sh.lineTo(sx * 3, -2.5); sh.closePath();
      // kanatlar yukarı ve yana açık (yoldan bakınca zar görünsün), üst kenarında kemik
      mk(k, new THREE.ShapeGeometry(sh), M.kanat, 0, 0, 0, { r: [-.3, 0, 0] });
      mk(k, new THREE.CylinderGeometry(.2, .32, 14.4, 5), M.ejder, sx * 6.5, 2.9, -.9, { r: [-.3, 0, -Math.atan2(sx * 13, 6)] });
      kanatlar.push({ k, sx });
    }
    return { g, boyun, bas, kanatlar, kuyruk };
  }

  /* ---------- HELM GEÇİDİ: kale ve ork okçuları ---------- */
  function orkGeo() {
    const ten = '#55623f';
    return renkli([
      [cyl(.2, .24, 1.1, 6), '#2e2a26', [-.25, .55, 0]], [cyl(.2, .24, 1.1, 6), '#2e2a26', [.25, .55, 0]],
      [sph(.62, 10, 8), '#3a332e', [0, 1.55, .1], [.35, 0, 0], [1, 1.1, .9]],              // kambur gövde, kaba zırh
      [box(1.1, .25, .8), '#5a4a3a', [0, 1.95, .05]],                                       // omuzluk
      [sph(.36, 10, 8), ten, [0, 2.25, .45]], [box(.42, .16, .3), ten, [0, 2.05, .62]],        // baş ve çene
      [sph(.07, 5, 4), '#ffcf40', [-.13, 2.32, .76]], [sph(.07, 5, 4), '#ffcf40', [.13, 2.32, .76]],
      [new THREE.TorusGeometry(1, .06, 4, 14, Math.PI * .9), '#5a3a1e', [.1, 1.9, .9], [0, Math.PI / 2, 1.4]],   // yay
      [cyl(.1, .1, 1, 6), ten, [.4, 1.85, .45], [1.3, 0, -.2]], [cyl(.1, .1, 1, 6), ten, [-.35, 1.85, .35], [1.4, 0, .3]],
    ]);
  }
  function helmKur(D) {
    // sırttaki ork okçuları (yola bakar)
    const liste = [];
    for (let s = Z.orkA + 20; inRange(s, Z.orkA, Z.orkB); s += 15) {
      for (const ek of [-1.5, 1.5]) {
        const [x, z] = pistNoktasi(s + ek * 2, disari * (33 + ek)), [tx, tz] = pistNoktasi(s, 0);
        liste.push({ x, y: zeminH(x, z), z, ry: yonu(x, z, tx, tz), s: 1.4, ps: s });   // ps: pistteki yeri (ok atanlar hedefe yakın olanlar)
      }
    }
    RG.orklar = { im: topluCiz(D, orkGeo(), M.renkli, liste), liste, son: 0 };
    // kara sancaklar sırtta
    for (let k = 0; k < liste.length; k += 6) { const o = liste[k]; mk(D, cyl(.1, .1, 6, 5), M.koyuTahta, o.x + 1.5, o.y + 3, o.z); const s = mk(D, new THREE.PlaneGeometry(1.6, 3), sancakM('#1e1a18', '#d8d2c6'), o.x + 1.5, o.y + 4.8, o.z, { cast: false }); s.geometry.translate(.8, 0, 0); s.userData.noMerge = true; RG.sancaklar.push(s); }
    // Helm Geçidi kalesi: yol güneye inerken sağ önde görünür; iki yamaç arasında uzun sur ve kule
    const x = HELM.x, z = HELM.z, y = 3;
    const [tx, tz] = pistNoktasi(HELM.s - 120, 0);
    const g = new THREE.Group(); g.position.set(x, y - 2, z); g.rotation.y = yonu(x, z, tx, tz); g.scale.setScalar(1.5); D.add(g);   // sur yola bakar, kayalar arkada
    for (let k = -6; k <= 6; k++) {   // kavisli sur
      const a = k * .09, r = 120, px = Math.sin(a) * r, pz = Math.cos(a) * r - r;
      mk(g, box(11.5, 18, 6), M.sur, px, 9, pz, { r: [0, -a, 0] });
      for (const dx of [-3.5, 0, 3.5]) mk(g, box(1.8, 2, 6.4), M.sur, px + dx * Math.cos(a), 19, pz - dx * Math.sin(a), { r: [0, -a, 0] });
    }
    mk(g, cyl(13, 15, 40, 18), M.sur, 82, 20, -10); mk(g, cyl(14, 14, 3, 18), M.sur, 82, 41.5, -10);   // ana kule (yüksek kayanın üstünde)
    mk(g, cyl(5, 6, 22, 12), M.sur, 82, 53, -10); mk(g, new THREE.ConeGeometry(7, 12, 12), M.elfCati, 82, 70, -10);
    mk(g, new THREE.DodecahedronGeometry(22, 1), M.koyuTas, 86, 0, -16, { s: [1, .75, 1.1] });   // kulenin oturduğu kaya
    // geçidi çevreleyen dağlar: surun iki ucunun arkasından yükselir
    tekParca(g, [[-130, -175, 120, 95], [0, -215, 140, 125], [130, -175, 120, 100], [-215, -110, 90, 65], [220, -110, 90, 65]].map(([x, z, r, h], i) =>
      dagGeo(r, h, { kaya: [92, 88, 80], tohum: i + 3, ust: r * .06 }).translate(x, h / 2 - 6, z)), M.dag);
    mk(g, box(30, 4, 60), M.tas, -10, 2, 30);   // sura çıkan yol
    ALANLAR.push([x, z, 260]);
  }

  /* ---------- uzaktakiler: Mordor (kara kule, göz, yanardağ), beyaz şehir, sıradağlar ---------- */
  // Uzaktaki dağlar ve kuleler genel birleştirmeye girer (birleştirme köşe renklerini de korur): eskiden ~110 ayrı
  // çizimdi, malzeme başına bire iner. Kameraya dönen göz ve yanardağ parıltısı ayrı kalır.
  function uzakKur(D) {
    const g = new THREE.Group(); g.position.set(MORDOR.x, 0, MORDOR.z); D.add(g);
    // kara kule: kat kat daralan, dikenli
    const kat = [[60, 48, 90], [40, 30, 140], [26, 18, 120], [16, 10, 80]]; let y = 0;
    for (const [a, b, h] of kat) { mk(g, new THREE.CylinderGeometry(b, a, h, 8), M.kule, 0, y + h / 2, 0, { cast: false }); for (let k = 0; k < 8; k++) { const an = k / 8 * Math.PI * 2; mk(g, new THREE.ConeGeometry(4, 26, 4), M.kule, Math.cos(an) * b, y + h + 8, Math.sin(an) * b, { cast: false, r: [Math.sin(an) * .35, 0, -Math.cos(an) * .35] }); } y += h; }
    for (const sx of [-1, 1]) mk(g, new THREE.ConeGeometry(5, 70, 6), M.kule, sx * 12, y + 30, 0, { cast: false, r: [0, 0, -sx * .22] });   // tepedeki iki boynuz
    // göz: alevden göz, her karede sana döner
    const goz = new THREE.Group(); goz.position.set(0, y + 46, 0); goz.userData.noMerge = true; g.add(goz);
    mk(goz, new THREE.PlaneGeometry(44, 30), M.goz, 0, 0, 0, { cast: false });
    const isik = mk(goz, new THREE.PlaneGeometry(130, 110), M.gozIsik, 0, 0, -1, { cast: false });
    RG.goz = goz; RG.gozIsik = isik;
    // yanardağ ve lav
    const yd = new THREE.Group(); yd.position.set(-380, 0, 160); g.add(yd);
    mk(yd, dagGeo(260, 330, { ust: 40, kaya: [46, 36, 32], seg: 26, kat: 10, tohum: 9, puruz: .7 }), M.uzakDagR, 0, 165, 0, { cast: false });
    const lav = mk(yd, new THREE.CylinderGeometry(36, 44, 6, 14), M.lav, 0, 318, 0, { cast: false }); RG.lav.push(lav);
    const tepeIsik = mk(yd, new THREE.PlaneGeometry(260, 200), M.gozIsik, 0, 330, 0, { cast: false }); tepeIsik.userData.noMerge = true; RG.lavIsik = tepeIsik;   // kameraya döner
    // Mordor'u çevreleyen kara sıradağlar
    // iç içe geçmiş, sivri ve alçak tepeler: tek tek piramit değil, uzun bir sıradağ gibi görünsün
    for (let k = 0; k < 70; k++) {
      const a = -2.6 + k * .068 + (srand() - .5) * .05, r = 560 + srand() * 160, h = 70 + srand() * 150;
      const m = mk(g, dagGeo(60 + srand() * 50, h, { kaya: [40, 34, 32], seg: 9, kat: 4, tohum: k, puruz: 1.3 }), M.uzakDagR, Math.cos(a) * r - 100, h / 2 - 15, Math.sin(a) * r + 200, { cast: false, r: [0, srand() * 3, 0] });
      m.scale.x = 1 + srand();
    }
    // beyaz şehir: yedi katlı, kat kat surlar ve en tepede ince beyaz kule; arkasında karlı dağ
    const b = new THREE.Group(); b.position.set(-1650, 0, -1250); D.add(b);
    mk(b, dagGeo(420, 620, { kar: .62, kaya: [96, 100, 104], seg: 24, kat: 10, tohum: 21 }), M.uzakDagR, -40, 300, -260, { cast: false });
    for (let k = 0; k < 7; k++) mk(b, new THREE.CylinderGeometry(150 - k * 18, 158 - k * 18, 26, 24), M.uzakBeyaz, 0, 13 + k * 26, 0, { cast: false });
    mk(b, new THREE.CylinderGeometry(6, 8, 90, 10), M.uzakBeyaz, 0, 182 + 45, 0, { cast: false }); mk(b, new THREE.ConeGeometry(9, 22, 10), M.uzakBeyaz, 0, 182 + 101, 0, { cast: false });
    mk(b, box(30, 170, 260), M.uzakBeyaz, 70, 85, 40, { cast: false, r: [0, .5, 0] });   // şehri ikiye bölen kaya burnu
    // ufukta diğer dağlar (kuzey ve batı)
    // ufuk dağları: uzaklık sisiyle mavimsi gri, zirveleri karlı
    const ufuk = [];
    for (let k = 0; k < 18; k++) { const a = Math.PI * .65 + k * .17, r = 2100 + srand() * 300, h = 220 + srand() * 280; ufuk.push(dagGeo(170 + srand() * 130, h, { kar: .66, kaya: [104, 110, 120], seg: 16, kat: 7, tohum: 40 + k }).translate(Math.cos(a) * r, h / 2 - 20, -Math.abs(Math.sin(a)) * r * .9)); }
    tekParca(D, ufuk, M.uzakDagR);
  }

  /* ---------- ağaçlar (örnekli çizim) ---------- */
  function agaclar(D) {
    // köşeli (low-poly) tepeler: yüzlerce ağaç telefonu yormasın
    const ik = r => new THREE.IcosahedronGeometry(r, 0);
    // koyu, düzensiz (köşeleri itilmiş) tepeler; gövde ince ve dallı
    const yaprakli = renkli([[cyl(.45, .75, 7, 6), '#3a2e24', [0, 3.5, 0]], [cyl(.18, .3, 3.6, 4), '#3a2e24', [.9, 6.6, .2], [0, 0, -.7]], [ik(3.4), '#2f4226', [0, 8, 0], [0, 0, 0], [1.1, .75, 1]], [ik(2.6), '#364a2a', [1.9, 8.8, .9]], [ik(2.3), '#2a3c22', [-1.6, 9.6, -.8]], [ik(1.9), '#33462a', [.2, 10.6, -.2]]], .9);
    const cam = renkli([[cyl(.3, .45, 5, 5), '#2e241c', [0, 2.5, 0]], [new THREE.ConeGeometry(2.9, 5.5, 7), '#1c2a1e', [0, 5.6, 0]], [new THREE.ConeGeometry(2.3, 4.6, 7), '#203024', [0, 8.2, 0]], [new THREE.ConeGeometry(1.6, 3.8, 7), '#24362a', [0, 10.6, 0]]], .5);
    const yasli = renkli([[cyl(1.1, 2.4, 11, 7), '#2e261e', [0, 5.5, 0]], [cyl(.45, .9, 7, 5), '#2a2a1e', [1.8, 10, 0], [0, 0, -.8]], [cyl(.4, .8, 6, 5), '#2a2a1e', [-1.6, 10, .4], [.2, 0, .9]], [ik(5), '#1f2e1a', [0, 14, 0], [0, 0, 0], [1.3, .7, 1.2]], [ik(3.8), '#26381e', [4, 12, 1.6]], [ik(3.6), '#1c2a17', [-3.6, 12.6, -1.4]], [ik(2.8), '#22331b', [.6, 16.4, 1.4]]], 1.2);
    const altin = renkli([[cyl(.35, .55, 8, 5), '#8a8478', [0, 4, 0]], [ik(3), '#6e5428', [0, 8.8, 0], [0, 0, 0], [1, 1.2, 1]], [ik(2.2), '#7a5e2e', [1.1, 10.6, .6]], [ik(1.8), '#5e4a24', [-1, 10, -.5]]], .7);
    const L = { yaprakli: [], cam: [], yasli: [], altin: [] };
    const bos = (x, z, pay) => A.roadNear(x, z).d > pay && ALANLAR.every(([a, b, r]) => Math.hypot(x - a, z - b) > r);
    const ekle = (tur, x, z, s) => { L[tur].push({ x, y: zeminH(x, z) - .3, z, ry: srand() * 6, s }); };
    // Fangorn: pistin her iki yanında sık yaşlı orman
    const fA = sp(282, 252), fB = sp(246, -272);
    for (let s = fA; inRange(s, fA, fB); s += 8) for (const yan of [-1, 1]) for (let k = 0; k < 3; k++) {
      const d = 24 + k * 16 + srand() * 12, [x, z] = pistNoktasi(s + srand() * 6, yan * d);
      if (bos(x, z, 22)) ekle(k === 0 && srand() < .5 ? 'yaprakli' : 'yasli', x, z, sr(.9, 1.4));
    }
    // geri kalan her yer: dağınık ağaçlar (Rivendell'de altın yapraklı, Helm'de çam)
    for (let i = 0; i < 2600 && L.yaprakli.length + L.cam.length + L.altin.length < (A.isTouch ? 520 : 760); i++) {
      const x = sr(-1100, 1000), z = sr(-900, 900); if (!bos(x, z, 26)) continue;
      if (Math.hypot(x - MORDOR.x, z - MORDOR.z) < 1100) continue;
      const rx = x / SC, rz = z / SC;
      const tur = rz < -330 && rx > -260 ? 'altin' : rx < -300 ? 'cam' : 'yaprakli';
      if (tur === 'yaprakli' && rz > 200 && srand() < .5) continue;   // Shire: açık çayırlar
      ekle(tur, x, z, sr(.8, 1.3));
    }
    // gölgeyi yalnızca yola yakın Fangorn ağaçları düşürür (dağınık ağaçlar gölge geçişinde boşuna çizilmesin)
    topluCiz(D, yaprakli, M.renkli, L.yaprakli, false, .35); topluCiz(D, cam, M.renkli, L.cam, false, .3); topluCiz(D, yasli, M.renkli, L.yasli, true, .3); topluCiz(D, altin, M.renkli, L.altin, false, .3);
  }

  /* ---------- kartallar: arada bir tepeden süzülerek geçerler ---------- */
  function kartallarKur(D) {
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group(); g.userData.noMerge = true; g.visible = false; D.add(g);
      mk(g, sph(1.6, 10, 8), M.kartal, 0, 0, 0, { s: [1, .9, 2.6], cast: false });
      mk(g, sph(1, 10, 8), M.kartalBas, 0, .6, 3.6, { cast: false }); mk(g, new THREE.ConeGeometry(.4, 1.2, 6), M.gaga, 0, .4, 4.8, { r: [Math.PI / 2 + .3, 0, 0], cast: false });
      mk(g, new THREE.ConeGeometry(1.4, 3.6, 6), M.kartal, 0, 0, -4.6, { r: [-Math.PI / 2, 0, 0], s: [1.6, 1, .4], cast: false });   // kuyruk
      const kanatlar = [];
      for (const sx of [-1, 1]) {
        const kn = new THREE.Group(); kn.position.set(sx * 1.2, .3, .4); g.add(kn);
        const sh = new THREE.Shape(); sh.moveTo(0, 1.6); sh.lineTo(sx * 6, 2.2); sh.lineTo(sx * 13, .6); sh.lineTo(sx * 14.5, -1.4); sh.lineTo(sx * 10, -2.2); sh.lineTo(sx * 5, -2.6); sh.lineTo(0, -1.6); sh.closePath();
        mk(kn, new THREE.ShapeGeometry(sh), M.kartalKanat, 0, 0, 0, { r: [-Math.PI / 2, 0, 0], cast: false });
        kanatlar.push({ kn, sx });
      }
      RG.kartallar.push({ g, kanatlar, t: -1, sure: 9, a: new THREE.Vector3(), b: new THREE.Vector3(), faz: k * 1.3 });
    }
  }

  /* =========================================================
     BÖLGELER ve OLAYLAR
     ========================================================= */
  const bolgeler = [
    { name: 'SHIRE', test: p => p.z / SC > 225 },
    { name: 'FANGORN ORMANI', test: p => p.x / SC > 225 },
    { name: 'ANDUIN KÖPRÜSÜ', test: p => p.z / SC < -200 && p.x / SC < -40 && p.x / SC > -270 },
    { name: 'RIVENDELL', test: p => p.z / SC < -200 && p.x / SC >= -40 },
    { name: 'HELM GEÇİDİ', test: () => true },
  ];
  const bolgeAdi = p => bolgeler.find(b => b.test(p)).name;
  function olay(dt, raceT) {
    const me = A.me, p = me.car.root.position, aktif = A.olayAcik(raceT), reg = bolgeAdi(p);
    if (aktif && A.bolgeSirasi()) {
      const secenek = [];
      const dsEnt = sd(Z.entS, me.s);
      if (!Z.entOlay && dsEnt > 170 && dsEnt < 430) secenek.push(entAdimAt);
      const dsKopru = sd(Z.kopruS, me.s);
      if (dsKopru > 150 && dsKopru < 420 && !Z.ejderAktif) secenek.push(ejderAtesi);   // önceki ateş sönmeden yenisi başlamaz
      if (reg === 'HELM GEÇİDİ') { const s = me.s + rand(95, 125); if (inRange(s, Z.orkA, Z.orkB)) secenek.push(() => orkOklari(s)); }
      if (secenek.length) { secenek[Math.floor(Math.random() * secenek.length)](); A.olayBasladi(); } else A.bolgeOlayiYok();
    }
  }
  function olaySifirla() {
    Z.entOlay = null; Z.ejderAtes = 0; Z.ejderAktif = false; Z.orkCek = 0;
    kartalZaman = 6; for (const k of RG.kartallar) { k.t = -1; k.g.visible = false; }   // yeni yarışta kartallar yine ~6. sn'de gelir
    if (RG.fisek) { RG.fisek.patlamalar = []; RG.fisek.sonraki = 2; }
    if (RG.ent) { RG.ent.govde.position.set(0, 10, 0); RG.ent.govde.rotation.set(0, 0, 0); RG.ent.ayakYer[0].set(-2.2, 0, -.5); RG.ent.ayakYer[1].set(2.2, 0, .5); entBacak(RG.ent); } }

  // --- Fangorn: Ent yolun kenarından bir adım atıp ayağını virajın dış şeridine basar; bir süre orada kalır ---
  function entAdimAt() {
    // yarışçıların konumu turlar boyunca artar (2. turda L + …): Ent'in yeri bu turdaki konuma çevrilir,
    // yoksa 2. ve 3. turda ayak yolda durur ama hiçbir şeye çarpmazdı
    const E = RG.ent, x = Z.entYan * A.ILK_SERIT, s = A.me.s + sd(Z.entS, A.me.s), hit = new Set(), eng = A.olayEngel(s, x, 0);
    // ayağın pistteki yeri (Ent'in kendi koordinatında)
    const hedefDunya = A.roadPt(s, x); hedefDunya.y += .05;
    const yerel = E.g.worldToLocal(hedefDunya.clone());
    const bas = E.ayakYer[1].clone();
    let t = 0, basti = false;
    const ses = A.SES.gumburtu('kaya');
    Z.entOlay = addFx({
      update(dt) {
        t += dt;
        const kalk = sstep(0, 1.3, t) * (1 - sstep(8.4, 9.6, t));    // 0: yerinde … 1: yolda
        const yuk = Math.sin(Math.min(1, t / 1.3) * Math.PI) * (t < 1.3 ? 6 : 0) + Math.sin(clamp((t - 8.4) / 1.2, 0, 1) * Math.PI) * 6;
        ses.guncelle(hedefDunya, kalk > .02 && kalk < .98 ? 9 : 0);   // ayak kalkıp inerken gümbürdeme (yaklaştıkça duyulur)
        E.ayakYer[1].lerpVectors(bas, yerel, kalk); E.ayakYer[1].y = lerp(bas.y, yerel.y, kalk) + yuk;   // ayak asfaltın üstüne basar
        E.govde.position.set(lerp(0, yerel.x * .3, kalk), 10 - kalk * .8, lerp(0, yerel.z * .3, kalk));
        E.govde.rotation.x = kalk * .12;
        entBacak(E);
        if (!basti && t >= 1.3) {   // ayak yere basar: yer sarsılır, toz kalkar
          basti = true; eng.w = 2.2;
          A.SES.tok(hedefDunya, { f0: 70, f1: 30, sure: .5, guc: 1, parlak: 500, gurultuG: .4, menzil: 80 });
          if (A.me.car.root.position.distanceTo(hedefDunya) < 90) A.sarsinti(.5);
          for (let i = 0; i < 16; i++) emit(hedefDunya.x + rand(-2.5, 2.5), hedefDunya.y + .3, hedefDunya.z + rand(-2.5, 2.5), rand(-4, 4), rand(1, 3), rand(-4, 4), rand(1.4, 2.4), rand(.7, 1.1));
        }
        // ayak yoldayken (yere basılıyken) vurur: alan kökleriyle birlikte ayak kadar
        if (t >= 1.3 && t < 8.4) hitRacers(s, x, 2.2, 2, r => knock(r, { slow: .62, jump: 2.2, kick: -Z.entYan * .3, shake: .5, msg: 'ENT!' }), hit);
        if (t > 8.4) eng.w = 0;
        if (t > 9.6) { this.dispose(); return false; }
        return true;
      },
      dispose() { ses?.bitir(); A.OLAY_ENGEL.delete(eng); E.ayakYer[1].copy(bas); E.govde.position.set(0, 10, 0); E.govde.rotation.set(0, 0, 0); entBacak(E); Z.entOlay = null; },
    });
  }

  // --- Anduin Köprüsü: ejder başını eğip köprünün önündeki bir şeride ateş püskürür; ateş birkaç saniye yanar ---
  // ateşin parçaları bir kez kurulur (her ateşte yeni geometri yaratılıp bellekte birikmesin)
  const ATES_BOY = 9, ATES_G = { zemin: new THREE.PlaneGeometry(4.4, ATES_BOY * 2 + 2), dil: new THREE.ConeGeometry(.9, 3.2, 6), isin: new THREE.CylinderGeometry(.6, 2.2, 1, 8, 1, true).translate(0, .5, 0) };
  const _agiz = new THREE.Vector3();
  function ejderAtesi() {
    const me = A.me, E = RG.ejder, x = Math.random() < .55 ? yakinSerit(me.x) : A.LANES[Math.floor(Math.random() * 4)];
    // köprünün önü, bu turdaki konuma çevrilmiş (2. turdan sonra da ateş köprünün önüne düşsün), en az 95 birim ileride
    const s = me.s + Math.max(95, sd(Z.kopruS - rand(26, 44), me.s)), hit = new Set(), eng = A.olayEngel(s, x, 0), BOY = ATES_BOY;
    const hedef = A.roadPt(s, x);
    const mark = new THREE.Mesh(FXG.ring, FXM.marker.clone()); mark.position.copy(hedef); mark.position.y += .15; mark.scale.set(.62, 1, 2.4); frameAt(s, F1); mark.rotation.y = Math.atan2(F1.t.x, F1.t.z); A.scene.add(mark);
    // yanan şerit: yerde kızıl parıltı + alev dilleri
    const ates = new THREE.Group(); ates.position.copy(hedef); ates.rotation.y = mark.rotation.y; ates.visible = false; A.scene.add(ates);
    mk(ates, ATES_G.zemin, M.alevZemin, 0, .12, 0, { r: [-Math.PI / 2, 0, 0], cast: false });
    const diller = [];
    for (let k = 0; k < 9; k++) { const m = mk(ates, ATES_G.dil, M.alev, rand(-1.2, 1.2), 1.6, -BOY + k * BOY * 2 / 8, { cast: false }); diller.push({ m, faz: rand(0, 6) }); }
    const isin = mk(A.scene, ATES_G.isin, M.alev, 0, 0, 0, { cast: false }); isin.visible = false;
    let t = 0, ses = false;
    Z.ejderAtes = 1; Z.ejderAktif = true;
    A.SES.kukreme(E.bas.getWorldPosition(new THREE.Vector3())); A.toast('EJDER UYANDI!');
    addFx({
      update(dt) {
        t += dt;
        Z.ejderAtes = t < 1 ? t : t < 2.2 ? 1 : Math.max(0, 1 - (t - 2.2) * 1.5);
        if (t < 1.2) mark.material.opacity = .35 + .45 * Math.abs(Math.sin(t * 12));
        else if (mark.parent) { A.scene.remove(mark); }
        // 1,0–2,0 sn: ağızdan şeride ateş seli
        const agiz = E.bas.localToWorld(_agiz.set(0, -.3, 2.6));
        if (t > 1 && t < 2.1) {
          isin.visible = true; _v.copy(hedef).sub(agiz); const boy = _v.length(); isin.position.copy(agiz); isin.quaternion.setFromUnitVectors(A.UP, _v.normalize()); isin.scale.set(1, boy * Math.min(1, (t - 1) / .25), 1);
          for (let i = 0; i < 3; i++) { const u = Math.random(); emit(lerp(agiz.x, hedef.x, u) + rand(-1, 1), lerp(agiz.y, hedef.y, u), lerp(agiz.z, hedef.z, u) + rand(-1, 1), rand(-2, 2), rand(1, 3), rand(-2, 2), rand(1.4, 2.4), rand(.4, .7)); }
          if (!ses) { ses = true; A.SES.patlama(hedef, .8, 90); }
        } else isin.visible = false;
        // 1,5–5,5 sn: şerit yanar (etkili); sonra söner
        const yan = sstep(1.4, 1.8, t) * (1 - sstep(5.2, 5.8, t));
        ates.visible = yan > .01; ates.scale.setScalar(Math.max(.01, yan));
        for (const d of diller) { d.m.scale.set(1, .6 + .5 * Math.abs(Math.sin(t * 9 + d.faz)), 1); }
        if (yan > .01 && Math.random() < .5) emit(hedef.x + rand(-1.5, 1.5), hedef.y + 1, hedef.z + rand(-3, 3), rand(-1, 1), rand(2, 4), rand(-1, 1), rand(1.6, 2.6), rand(.8, 1.2));
        if (t > 1.5 && t < 5.5) { eng.w = 1.9; hitRacers(s, x, BOY, 1.9, r => knock(r, { slow: .64, jump: 1.4, kick: rand(-.25, .25), shake: .5, msg: 'EJDER ATEŞİ!' }), hit); } else eng.w = 0;
        if (t > 5.9) { this.dispose(); return false; }
        return true;
      },
      dispose() { A.scene.remove(mark); mark.material.dispose(); A.scene.remove(ates); A.scene.remove(isin); A.OLAY_ENGEL.delete(eng); Z.ejderAtes = 0; Z.ejderAktif = false; },
    });
  }

  // --- Helm Geçidi: sırttaki orklar yaylarını gerip bir şeride ok yağdırır; oklar saplandığı yerde kısa süre kalır ---
  FXG.okGeo ??= renkli([[cyl(.05, .05, 2.4, 4), '#6a4a2a', [0, 0, 0]], [new THREE.ConeGeometry(.12, .35, 4), '#2a2a2e', [0, 1.35, 0]], [box(.32, .45, .02), '#e8e0d0', [0, -1.05, 0]]]);
  const _np = new THREE.Vector3();
  function orkOklari(s) {
    const me = A.me, x = Math.random() < .55 ? yakinSerit(me.x) : A.LANES[Math.floor(Math.random() * 4)];
    const hedef = A.roadPt(s, x), hit = new Set(), eng = A.olayEngel(s, x, 0);
    frameAt(s, F1); const yaw = Math.atan2(F1.t.x, F1.t.z), T = 1.7;
    const mark = new THREE.Mesh(FXG.ring, FXM.marker.clone()); mark.position.copy(hedef); mark.position.y += .15; mark.scale.set(.6, 1, 1.5); mark.rotation.y = yaw; A.scene.add(mark);
    const n = 16, im = new THREE.InstancedMesh(FXG.okGeo, M.renkli, n); im.frustumCulled = false; A.scene.add(im);
    const oklar = [], yakin = RG.orklar.liste.filter(o => Math.abs(sd(o.ps, s)) < 70), atan = yakin.length ? yakin : RG.orklar.liste;   // oklar hedefin yanındaki orklardan
    for (let i = 0; i < n; i++) {
      const o = atan[Math.floor(Math.random() * atan.length)];
      const a = new THREE.Vector3(o.x, o.y + 2.2, o.z), b = hedef.clone().addScaledVector(F1.r, rand(-1.5, 1.5)).addScaledVector(F1.t, rand(-3.6, 3.6));
      oklar.push({ a, b, gec: rand(0, .25), p: a.clone(), q: new THREE.Quaternion(), yuk: rand(16, 24) });
    }
    Z.orkCek = 1; A.SES.islik(T, () => hedef);
    let t = 0, indi = false;
    addFx({
      update(dt) {
        t += dt;
        Z.orkCek = t < .35 ? 1 : 0;   // yaylar gerili
        mark.material.opacity = t < T + .25 ? .35 + .45 * Math.abs(Math.sin(t * 12)) : 0;
        const bat = t > T + .3 + 2.4 ? (t - T - 2.7) * 2.2 : 0;   // sonunda yere gömülüp kaybolur
        oklar.forEach((o, i) => {
          const k = clamp((t - o.gec) / (T - o.gec), 0, 1), k2 = clamp((t + .02 - o.gec) / (T - o.gec), 0, 1);
          const np = _np.lerpVectors(o.a, o.b, k2); np.y += Math.sin(Math.PI * k2) * o.yuk;
          o.p.lerpVectors(o.a, o.b, k); o.p.y += Math.sin(Math.PI * k) * o.yuk;
          if (k < 1) { _v.copy(np).sub(o.p); if (_v.lengthSq() > 1e-6) o.q.setFromUnitVectors(A.UP, _v.normalize()); }
          dummy.position.copy(o.p); dummy.position.y += k >= 1 ? .6 - bat : 0; dummy.quaternion.copy(o.q); dummy.scale.setScalar(k >= 1 && bat > 1 ? 0 : 1.4); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true;
        if (!indi && t >= T) {
          indi = true; eng.w = 1.8;
          A.SES.tok(hedef, { f0: 260, f1: 120, sure: .15, guc: .5, parlak: 4000, gurultuG: .7, menzil: 60 });
          for (let i = 0; i < 10; i++) emit(hedef.x + rand(-2, 2), hedef.y + .2, hedef.z + rand(-3, 3), rand(-2, 2), rand(1, 2.5), rand(-2, 2), rand(1, 1.6), rand(.4, .7));
        }
        // oklar düştüğü an ve saplı durdukları 2,4 sn boyunca: ok tarlasına giren yavaşlar
        if (t >= T && t < T + 2.7) hitRacers(s, x, 3.8, 1.7, r => knock(r, { slow: .7, jump: 0, kick: rand(-.2, .2), shake: .4, msg: 'ORK OKLARI!' }), hit);
        if (t >= T + 2.7) eng.w = 0;
        if (t > T + 3.3) { this.dispose(); return false; }
        return true;
      },
      dispose() { A.scene.remove(mark); mark.material.dispose(); A.scene.remove(im); im.dispose(); A.OLAY_ENGEL.delete(eng); Z.orkCek = 0; },
    });
  }

  /* =========================================================
     HER KARE: göz sana bakar, ejder nefes alır, Ent sallanır, elfler, atlı komutan, hobbitler, kartallar, fişekler
     ========================================================= */
  let onceki = 0;
  const _w = new THREE.Vector3();
  function kare(time) {
    const dt = clamp(time - onceki, 0, .1); onceki = time;
    if (RG.gok) RG.gok.position.copy(A.camera.position);
    // start fenerleri geri sayımda yanar
    const T_GO = 2.2, n = time < T_GO ? Math.min(5, Math.floor(time / (T_GO / 5.5))) : 0, yesil = time >= T_GO && time < T_GO + 2.5;
    RG.isiklar.forEach((m, i) => { const yan = yesil || i < n; m.emissiveIntensity = yan ? 3 : 0; m.emissive.setHex(yesil ? 0x40ff70 : 0xff3a1a); });
    const me = A.me, cp = A.camera.position; if (!me) return;
    // göz: kameraya döner, alev gibi titrer
    if (RG.goz) { RG.goz.lookAt(cp); const f = 1 + Math.sin(time * 7) * .04 + Math.sin(time * 13.1) * .03; RG.goz.scale.set(f, f * (1 + Math.sin(time * .7) * .05), 1); RG.gozIsik.material.opacity = .75 + Math.sin(time * 3.3) * .15; }
    for (const l of RG.lav) l.material.color.setHSL(.04, 1, .5 + Math.sin(time * 1.7) * .06);
    if (RG.lavIsik) RG.lavIsik.lookAt(cp);   // yanardağın ağzındaki kızıl parıltı
    // ejder: nefes alır, kanatlarını hafifçe oynatır; ateşte başını eğer
    if (RG.ejder) {
      const E = RG.ejder, a = Z.ejderAtes;
      E.g.position.y = 23.4 + Math.sin(time * 1.2) * .15;
      E.boyun.rotation.x = lerp(-.05 + Math.sin(time * .6) * .08, .55, a);
      E.bas.rotation.x = lerp(.15 + Math.sin(time * .9) * .1, .45, a);
      E.boyun.rotation.y = Math.sin(time * .35) * .25 * (1 - a);
      for (const k of E.kanatlar) k.k.rotation.z = k.sx * (Math.sin(time * (a > .1 ? 6 : 1.1)) * (a > .1 ? .3 : .07) - .1);
      E.kuyruk.forEach((m, i) => { m.position.x = (m.userData.x0 ??= m.position.x) + Math.sin(time * 1.4 - i * .5) * .12 * i; });   // sabit duruşun çevresinde sallanır (kayıp gitmez)
    }
    // Ent: hafifçe sallanır, kollarını oynatır
    if (RG.ent && !Z.entOlay) { RG.ent.govde.rotation.z = Math.sin(time * .5) * .025; }
    if (RG.ent) RG.ent.kollar.forEach((k, i) => { k.rotation.x = Math.sin(time * .8 + i * 2) * .12; });
    // elf ordusu: arada bir mızraklarını kaldırıp tezahürat eder (dalga gibi)
    // (dalga yokken matrisler bir kez yerine konur, sonra her karede yeniden yazılmaz)
    const dalga = (time % 7) / 7;
    if (RG.elfler && (dalga < .4 || !RG.elfler.durgun) && me.car.root.position.distanceTo(_w.set(ORDU.x, 0, ORDU.z)) < 700) {
      const im = RG.elfler.im;
      RG.elfler.liste.forEach((o, i) => { const k = Math.max(0, Math.sin((dalga * 3 - o.faz * .15) * Math.PI)) * (dalga < .33 ? 1 : 0); dummy.position.set(o.x, o.y + k * .5, o.z); dummy.rotation.set(-k * .12, o.ry, 0, 'YXZ'); dummy.scale.setScalar(1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      dummy.rotation.order = 'XYZ';
      im.instanceMatrix.needsUpdate = true; RG.elfler.durgun = dalga >= .4;
    }
    // atlı komutan: ordunun önünde gidip gelir, durunca kılıcını kaldırıp konuşur
    if (RG.atli) {
      const B = RG.atli, dongu = time % 16, yuru = dongu < 5 || (dongu > 8 && dongu < 13);
      if (yuru) B.u = clamp(B.u + dt * 3.2 * B.yon, -26, 26); if (B.u >= 26) B.yon = -1; if (B.u <= -26) B.yon = 1;
      const x = ORDU.x + B.ileri.x * B.u - B.disariV.x * 52, z = ORDU.z + B.ileri.z * B.u - B.disariV.z * 52;   // yoldan 18 birim içeride
      B.g.position.set(x, zeminH(x, z), z);
      const bak = yuru ? Math.atan2(B.ileri.x * B.yon, B.ileri.z * B.yon) : Math.atan2(B.disariV.x, B.disariV.z);
      B.g.rotation.y += wrapA(bak - B.g.rotation.y) * Math.min(1, dt * 3);
      B.bacaklar.forEach((b, i) => { b.rotation.x = yuru ? Math.sin(time * 9 + (i % 2) * Math.PI + (i > 1 ? 1.2 : 0)) * .5 : 0; });
      B.kol.rotation.z = yuru ? -.2 : -.2 - Math.max(0, Math.sin(time * 2.2)) * 2.2;   // konuşurken kılıcını kaldırır
      B.boyun.rotation.x = yuru ? Math.sin(time * 9) * .08 : Math.sin(time * 1.3) * .1;
      B.at.position.y = yuru ? Math.abs(Math.sin(time * 9)) * .2 : 0;
    }
    // hobbitler: yiyip içer, kadeh kaldırır, dans eder
    if (SENLIK && cp.distanceTo(_w.set(SENLIK.x, 0, SENLIK.z)) < 650) {
      for (const H of RG.hobbitler) {
        H.liste.forEach((o, i) => {
          let y = 0, ry = o.ry, rz = 0;
          if (H.tur === 'dans') { y = Math.abs(Math.sin(time * 5 + o.faz)) * .6; ry = o.ry + time * .8; rz = Math.sin(time * 5 + o.faz) * .15; }
          else if (H.tur === 'kadeh') { y = Math.max(0, Math.sin(time * 2 + o.faz)) * .25; rz = Math.sin(time * 1.5 + o.faz) * .08; }
          else { y = Math.abs(Math.sin(time * 3 + o.faz)) * .08; }
          dummy.position.set(o.x, y, o.z); dummy.rotation.set(0, ry, rz); dummy.scale.setScalar(1.35); dummy.updateMatrix(); H.im.setMatrixAt(i, dummy.matrix);
        });
        H.im.instanceMatrix.needsUpdate = true;
      }
      fisekGuncelle(time, dt);
    } else if (RG.fisek && RG.fisek.patlamalar.length) {   // uzaklaşınca havada donmuş kıvılcım kalmasın
      RG.fisek.patlamalar = []; RG.fisek.temiz = true; dummy.scale.setScalar(0); dummy.updateMatrix();
      for (let i = 0; i < RG.fisek.n; i++) RG.fisek.im.setMatrixAt(i, dummy.matrix);
      RG.fisek.im.instanceMatrix.needsUpdate = true;
    }
    // orklar: ok atarken yaylarını gerip geriye yaslanır
    if (RG.orklar && RG.orklar.son !== Z.orkCek) {
      const O = RG.orklar; O.son = Z.orkCek;
      O.liste.forEach((o, i) => { dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(-O.son * .35, o.ry, 0, 'YXZ'); dummy.scale.setScalar(o.s); dummy.updateMatrix(); O.im.setMatrixAt(i, dummy.matrix); });   // önce dön, sonra geriye yaslan
      dummy.rotation.order = 'XYZ';
      O.im.instanceMatrix.needsUpdate = true;
    }
    // sancaklar dalgalanır
    RG.sancaklar.forEach((s, i) => { s.rotation.y = (s.userData.ry0 ??= s.rotation.y) + Math.sin(time * 2.2 + i) * .16; });
    kartalGuncelle(time, dt);
    for (const f of ANIM) f(time, dt);
  }
  // havai fişekler: şenliğin üstünde renkli bir küre gibi açılır, aşağı süzülürken söner
  function fisekGuncelle(time, dt) {
    const F = RG.fisek; if (!F) return;
    F.sonraki -= dt;
    if (F.sonraki <= 0 && F.patlamalar.length < 3) {
      F.sonraki = rand(1.6, 3.4);
      const renk = new THREE.Color().setHSL(Math.random(), 1, .6), o = new THREE.Vector3(SENLIK.x + rand(-30, 30), rand(55, 80), SENLIK.z + rand(-30, 30));
      const yonler = []; for (let k = 0; k < 40; k++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); yonler.push(new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a)).multiplyScalar(rand(14, 20))); }
      F.patlamalar.push({ o, renk, yonler, t: 0 });
      A.SES.tok(o, { f0: 220, f1: 80, sure: .25, guc: .35, parlak: 2500, gurultuG: .6, menzil: 400 });
    }
    // patlama yoksa ve kıvılcımlar zaten gizliyse her karede 120 örneği yeniden yazıp yüklemeye gerek yok
    if (!F.patlamalar.length && F.temiz) return;
    let i = 0;
    F.patlamalar = F.patlamalar.filter(p => (p.t += dt) < 1.8);
    F.temiz = !F.patlamalar.length;
    for (const p of F.patlamalar) for (const v of p.yonler) {
      const k = 1 - Math.exp(-p.t * 2.2);
      dummy.position.set(p.o.x + v.x * k * .5, p.o.y + v.y * k * .5 - p.t * p.t * 3, p.o.z + v.z * k * .5);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(Math.max(.001, 1 - p.t / 1.8)); dummy.updateMatrix();
      F.im.setMatrixAt(i, dummy.matrix); F.im.setColorAt(i, p.renk); i++;
    }
    dummy.scale.setScalar(0); dummy.updateMatrix();
    for (; i < F.n; i++) F.im.setMatrixAt(i, dummy.matrix);
    F.im.instanceMatrix.needsUpdate = true; if (F.im.instanceColor) F.im.instanceColor.needsUpdate = true;
  }
  // kartallar: 14–26 sn'de bir, arabanın üstünden süzülerek geçer
  let kartalZaman = 6;
  function kartalGuncelle(time, dt) {
    const me = A.me; if (!me) return;
    if (dt > 0 && time > kartalZaman && RG.kartallar.every(k => k.t < 0)) {   // lobide (zaman durgun) kartal başlatılmaz
      kartalZaman = time + rand(14, 26);
      const a = Math.random() * Math.PI * 2, p = me.car.root.position;
      RG.kartallar.forEach((k, i) => {
        const yan = new THREE.Vector3(Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2)).multiplyScalar((i - .5) * 26);
        const ileri = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        k.a.copy(p).addScaledVector(ileri, -260).add(yan); k.a.y = 52 + i * 6;
        k.b.copy(p).addScaledVector(ileri, 260).add(yan); k.b.y = 44 + i * 6;
        k.t = -i * .5; k.sure = 10; k.g.visible = true; k.g.position.copy(k.a);
      });
    }
    for (const k of RG.kartallar) {
      if (k.t < 0 && !k.g.visible) continue;
      k.t += dt; if (k.t < 0) continue;
      const u = k.t / k.sure;
      if (u > 1) { k.t = -1; k.g.visible = false; continue; }
      k.g.position.lerpVectors(k.a, k.b, u); k.g.position.y += Math.sin(u * Math.PI) * 6;
      k.g.lookAt(k.b.x, k.g.position.y, k.b.z); k.g.rotation.z = Math.sin(time * .7 + k.faz) * .12;
      const kanat = Math.sin(time * 2.2 + k.faz) * (u < .2 || u > .8 ? .45 : .12);
      for (const w of k.kanatlar) w.kn.rotation.z = w.sx * kanat;
    }
  }

  if (A.DBG.has('debug')) window.__ortadunya = { ent: entAdimAt, ejder: ejderAtesi, ork: () => orkOklari(A.me.s + 110), kartal: () => { kartalZaman = 0; }, Z, RG, A, M };

  return {
    id: 'ortadunya', ad: 'ORTA DÜNYA', baslik: 'Orta Dünya', ctrl: CTRL, start: START, seed: 3019,
    kur, bolgeler, olay, olaySifirla, kare, virajFren: true,
    get yasak() { return yasakAraliklar(); },
    // kasvetli, bulutlu alacakaranlık: soğuk gök ışığı, alçaktan vuran sıcak güneş (uzun gölgeler), yoğun pus,
    // soluk renkler (doyma), güçlü kenar karartması; feneler, göz, lav ve ateş karanlıkta parlar
    isik: { gok: 0xa4adbc, yer: 0x4a4234, gokG: 1.1, gunes: 0xffc690, gunesG: 2.5, gunesYon: [-.6, .26, .7], isikYon: [-.6, .5, .62],
      sis: 0x7c7f86, sisYakin: 150, sisUzak: 1500, pozlama: 1.08, arka: null, ton: [.6, .62, .68], golge: [.014, .016, .024],
      doyma: .78, vinyet: .42, parlama: .45, gunesParlama: false, golgeKutu: 90, golgeUzak: 320 },
    get engel() { return { boxes: M.sandik, oil: M.batak, ramp: M.rampa, kenar: mat('#4a3a2a'), adKutu: 'SANDIKLAR!', adYag: 'BATAKLIK! kayıyorsun', adRampa: 'TAHTA RAMPA! +HIZ', renkYag: '#3a2e1e' }; },
  };
}

// LEVENT PLAZALAR teması (ZORLU) — gerçek sokaklar; Google Haritalar'dan bina bina, sokak sokak çıkarıldı:
// Büyükdere Cd. yan yolu → Prof. Ahmet Kemal Aru Sk. → Çamlık Cd. → Hacı Adil Cd. → Çayırçimen Sk. → Talatpaşa Cd.
// Yapı Kredi Plaza blokları (A, B, C kuleleri ve D bloğu) çemberin içinde kalır. Sokaklar yarış için kapatılmış:
// beton bariyerli bir şehir pisti. Ölçek: 1 m = 4,75 birim (3 tur ≈ 3,5 dk sürsün diye); binalar da aynı ölçekte.
// Zorluk: dar şehir virajları (virajdan önce fren gerekir), plazalar arası rüzgâr ve sokağa özgü olaylar.
// Bu dosya oyunun ortak araçlarını index.html'deki API nesnesinden alır. Binalarda logo/marka yoktur.
export function tema(A) {
  const { THREE, mk, mat, box, cyl, sph, canvasTex, frameAt, F1, F2, ribbon, pedKur, PED_YERI,
    inRange, sd, clamp, lerp, sstep, rand, srand, HW, emit, knock, hitRacers, addFx, FXG, FXM, dummy } = A;

  /* ---------- ölçek ve harita ----------
     Noktalar Google Haritalar uydu/harita görünümünden (yakınlık 18, merkez 41.0808 K, 29.0122 D) piksel olarak
     alındı: 1 piksel = 0,4506 m. Dünya: x doğu, z güney. */
  const S = 4.75, PX = .4506, F = PX * S;
  const pm = (px, py) => [(px - 632) * F, (py - 417) * F];
  const met = v => v * S;
  const pxOf = p => [p.x / F + 632, p.z / F + 417];
  const KAT = met(3.8), BAY = met(3.6);                  // kat yüksekliği, pencere aralığı
  const SOKAK_KENAR = HW + 9.4;                          // yarış sokağının asfalt kenarı (bordür)
  const YOL_Y = .2;                                      // asfaltın orta çizgiden yüksekliği (yan sokakların üstünde)

  // Saat yönünde (haritada): Talatpaşa'dan batıya → Büyükdere yan yolundan kuzeye → Ahmet Kemal Aru'dan doğuya →
  // Çamlık / Hacı Adil'den güneye → Çayırçimen'den batıya → Talatpaşa'dan kuzeybatıya
  const YOL = [
    [740, 560], [680, 555], [628, 553], [601, 545], [586, 524], [560, 465], [530, 395], [508, 340], [496, 310],
    [489, 290], [489, 277], [495, 268], [507, 261], [530, 252], [562, 243], [600, 236], [670, 242], [730, 266], [790, 306], [840, 345],
    [880, 371], [918, 381], [944, 390], [960, 410], [974, 448], [995, 520], [1015, 580], [1034, 628], [1047, 659],
    [1050, 682], [1034, 697], [1000, 713], [962, 728], [937, 736], [916, 729], [902, 713], [886, 688], [861, 645],
    [836, 608], [810, 580], [776, 565]];
  const CTRL = YOL.map(([x, y]) => { const [a, b] = pm(x, y); return [a, 0, b]; });
  const START = pm(552, 446);

  /* ---------- dokular ---------- */
  const gurultu = (g, w, h, n, renk, a0, a1, sw = 2, sh = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${renk},${a0 + srand() * (a1 - a0)})`; g.fillRect(srand() * w, srand() * h, sw, sh); } };
  // yarış asfaltı: u pistin enine (-HW..HW), v boyuna. Kenar çizgileri düz, şerit çizgileri kesikli
  const asfaltTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#56585d'; g.fillRect(0, 0, w, h);
    gurultu(g, w, h, 5000, '20,20,24', .05, .22); gurultu(g, w, h, 2500, '210,210,215', .03, .12);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(30,30,34,${.05 + srand() * .06})`; g.fillRect(srand() * w, srand() * h, 4 + srand() * 30, 2 + srand() * 60); }   // yamalar
    const u = x => (x + HW) / (2 * HW) * w;
    g.fillStyle = 'rgba(245,245,240,.92)';
    for (const x of [-HW + .45, HW - .45]) g.fillRect(u(x) - 2.5, 0, 5, h);
    for (const x of [-3.9, 0, 3.9]) g.fillRect(u(x) - 2, 0, 4, h * .45);
    g.fillStyle = 'rgba(30,30,30,.25)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  }, true);
  const sokakTex = canvasTex(128, 256, (g, w, h) => {   // yan sokaklar: ortada kesikli çizgi
    g.fillStyle = '#5a5c61'; g.fillRect(0, 0, w, h);
    gurultu(g, w, h, 2500, '20,20,24', .05, .2); gurultu(g, w, h, 1200, '210,210,215', .03, .1);
    g.fillStyle = 'rgba(240,240,236,.85)'; g.fillRect(w / 2 - 1.5, 0, 3, h * .5);
    g.fillRect(3, 0, 2, h); g.fillRect(w - 5, 0, 2, h);
  }, true);
  const anaYolTex = canvasTex(512, 256, (g, w, h) => {   // Büyükdere Cd.: iki yönde üçer şerit, ortada refüj
    g.fillStyle = '#57595e'; g.fillRect(0, 0, w, h);
    gurultu(g, w, h, 6000, '20,20,24', .05, .2); gurultu(g, w, h, 3000, '210,210,215', .03, .1);
    const k = w / 27;   // 27 m
    g.fillStyle = '#a9a59b'; g.fillRect(12 * k, 0, 3 * k, h);
    g.fillStyle = '#5f7f45'; g.fillRect(12.4 * k, 0, 2.2 * k, h);
    g.fillStyle = 'rgba(240,240,236,.85)';
    for (const x of [4, 8, 19, 23]) g.fillRect(x * k - 1.5, 0, 3, h * .45);
    for (const x of [.4, 11.6, 15.4, 26.6]) g.fillRect(x * k - 1.5, 0, 3, h);
  }, true);
  const kerbTex = canvasTex(32, 128, (g, w, h) => {
    for (let i = 0; i < 2; i++) { g.fillStyle = i ? '#f2efe8' : '#d3302b'; g.fillRect(0, i * h / 2, w, h / 2); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 3, h);
  }, true);
  const bariyerTex = canvasTex(64, 256, (g, w, h) => {   // u: yükseklik, v: boyuna (kırmızı-beyaz boyalı beton)
    for (let i = 0; i < 2; i++) { g.fillStyle = i ? '#f1eee6' : '#cf2f2a'; g.fillRect(0, i * h / 2, w, h / 2); }
    gurultu(g, w, h, 900, '60,50,45', .04, .14);
    g.fillStyle = '#8d8a84'; g.fillRect(0, 0, w * .12, h);            // dipte kirli beton
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h / 2, w, 1);   // blok derzleri
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(w - 4, 0, 4, h);
  }, true);
  const kaldirimTex = canvasTex(512, 512, (g, w, h) => {   // kilit taşı kaldırım (4 m'lik desen)
    g.fillStyle = '#b9b4aa'; g.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let y = 0; y < n * 2; y++) for (let x = 0; x < n; x++) {
      const t = 165 + Math.floor(srand() * 30), o = y % 2 ? s / 2 : 0;
      g.fillStyle = `rgb(${t + 8},${t + 3},${t - 6})`; g.fillRect(x * s + o + 2, y * s / 2 + 2, s - 4, s / 2 - 4);
      if (o) g.fillRect(-s / 2 + 2, y * s / 2 + 2, s - 4, s / 2 - 4);
    }
    gurultu(g, w, h, 4000, '70,65,60', .04, .14);
  }, true);
  const cimenTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f9a4a'; g.fillRect(0, 0, w, h);
    gurultu(g, w, h, 6000, '40,70,25', .1, .35, 1, 3); gurultu(g, w, h, 3000, '170,200,110', .08, .25, 1, 3);
  }, true);
  const citTex = canvasTex(128, 128, (g, w, h) => {   // budanmış şimşir çit
    g.fillStyle = '#3f6a2f'; g.fillRect(0, 0, w, h);
    gurultu(g, w, h, 2500, '25,50,18', .2, .5, 3, 3); gurultu(g, w, h, 1500, '120,170,80', .15, .35, 2, 2);
  }, true);
  // cepheler: her doku 4 pencere aralığı × 4 kat
  const cephe = (ciz, ww = 512, hh = 512) => canvasTex(ww, hh, ciz, true);
  const plazaCamTex = cephe((g, w, h) => {   // mavi aynalı cam (Yapı Kredi kuleleri)
    const c = w / 4, r = h / 4;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) {
      const gr = g.createLinearGradient(0, k * r, 0, k * r + r); const t = srand() * .12;
      gr.addColorStop(0, `rgb(${70 + t * 200},${118 + t * 200},${170 + t * 150})`); gr.addColorStop(1, `rgb(${40 + t * 100},${80 + t * 120},${128 + t * 100})`);
      g.fillStyle = gr; g.fillRect(i * c, k * r, c, r);
      g.fillStyle = '#1d3150'; g.fillRect(i * c, k * r + r - 26, c, 26);   // kat arası koyu bant
    }
    g.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 6; i++) { const x = srand() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 80, 0); g.lineTo(x - 40, h); g.lineTo(x - 120, h); g.fill(); }
    g.fillStyle = '#a8b6c4'; for (let x = 0; x <= w; x += c / 2) g.fillRect(x - 1.5, 0, 3, h);
    for (let y = 0; y <= h; y += r) g.fillRect(0, y - 2, w, 4);
  });
  const tasTex = cephe((g, w, h) => {   // açık bej doğal taş kaplama
    g.fillStyle = '#e7dfd2'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 5000, '120,100,80', .03, .1);
    g.fillStyle = 'rgba(120,105,85,.35)'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 * 64; x < w; x += 128) g.fillRect(x, y, 2, 64);
  });
  const lobiTex = cephe((g, w, h) => {   // giriş katı: büyük camlar, içeride sıcak ışık
    g.fillStyle = '#26303a'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, h, 0, h * .4); gr.addColorStop(0, 'rgba(255,214,150,.5)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c7cbcf'; for (let x = 0; x <= w; x += 128) g.fillRect(x - 4, 0, 8, h); g.fillRect(0, 0, w, 10); g.fillRect(0, h * .55, w, 5);
  }, 512, 128);
  const ofisTex = cephe((g, w, h) => {   // taş cephe, kat boyu şerit pencere
    g.fillStyle = '#ddd3c1'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 3000, '110,95,75', .03, .1);
    const r = h / 4;
    for (let k = 0; k < 4; k++) {
      const gr = g.createLinearGradient(0, k * r + 32, 0, k * r + 96); gr.addColorStop(0, '#5d7f8e'); gr.addColorStop(1, '#2e4954');
      g.fillStyle = gr; g.fillRect(0, k * r + 32, w, 64);
      g.fillStyle = '#9aa7ad'; for (let x = 0; x < w; x += 32) g.fillRect(x, k * r + 32, 2, 64);
    }
  });
  const apartTex = cephe((g, w, h) => {   // sıva + pencere + balkon (renk malzemeden gelir)
    g.fillStyle = '#f6f3ee'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 3000, '120,110,100', .03, .1);
    const c = w / 4, r = h / 4;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) {
      const x = i * c + 30, y = k * r + 26, ww = 68, wh = 70;
      g.fillStyle = '#fbfaf7'; g.fillRect(x - 5, y - 5, ww + 10, wh + 10);
      g.fillStyle = srand() < .25 ? '#55606a' : '#36414c'; g.fillRect(x, y, ww, wh);
      if (srand() < .45) { g.fillStyle = ['#efe6d4', '#e9eef2', '#e7d8c8'][Math.floor(srand() * 3)]; g.fillRect(x + 2, y + 2, ww - 4, wh * (.3 + srand() * .5)); }   // perde / stor
      g.fillStyle = '#fbfaf7'; g.fillRect(x + ww / 2 - 2, y, 4, wh);
      if ((k + i) % 3 === 0) { g.fillStyle = 'rgba(90,96,104,.9)'; g.fillRect(i * c + 6, y + wh - 10, c - 12, 5); for (let b = i * c + 8; b < i * c + c - 8; b += 9) g.fillRect(b, y + wh - 8, 2, 20); g.fillRect(i * c + 6, y + wh + 10, c - 12, 4); }
    }
  });
  const dukkanTex = cephe((g, w, h) => {   // zemin kat dükkânları (yazısız tabelalar)
    g.fillStyle = '#3b3f44'; g.fillRect(0, 0, w, h);
    const c = w / 4;
    for (let i = 0; i < 4; i++) {
      const gr = g.createLinearGradient(0, h, 0, 30); gr.addColorStop(0, '#f0d3a2'); gr.addColorStop(1, '#8c7a62');
      g.fillStyle = gr; g.fillRect(i * c + 8, 34, c - 16, h - 40);
      g.fillStyle = ['#b8322c', '#2f6f9a', '#3f7d45', '#c9a23a', '#6c4a8a'][Math.floor(srand() * 5)]; g.fillRect(i * c + 4, 6, c - 8, 22);
      g.fillStyle = '#ffffff'; g.font = '800 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';   // genel dükkân adları
      g.fillText(['ECZANE', 'MARKET', 'KAFE', 'FIRIN', 'KUAFÖR', 'BÜFE', 'KIRTASİYE', 'LOKANTA', 'EMLAK', 'TERZİ', 'OPTİK', 'ÇİÇEKÇİ'][Math.floor(srand() * 12)], i * c + c / 2, 18);
      g.fillStyle = '#2a2d31'; g.fillRect(i * c + c / 2 - 2, 34, 4, h - 40);
    }
  }, 512, 128);
  const betonTex = cephe((g, w, h) => {   // prekast beton ızgara
    g.fillStyle = '#bdb9b2'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 3000, '80,80,80', .03, .12);
    const c = w / 4, r = h / 4;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) { g.fillStyle = '#3a434b'; g.fillRect(i * c + 20, k * r + 22, c - 40, r - 46); g.fillStyle = 'rgba(160,190,210,.25)'; g.fillRect(i * c + 20, k * r + 22, (c - 40) / 2, r - 46); }
  });
  const kahveTex = cephe((g, w, h) => {   // bronz metal panel (plaza alt blokları)
    g.fillStyle = '#6e4b34'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = `rgba(${srand() < .5 ? '0,0,0' : '255,220,180'},${.04 + srand() * .07})`; g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 2, h); }
    for (let y = 0; y < h; y += 128) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y, w, 3); }
    g.fillStyle = '#2b3138'; for (let i = 0; i < 4; i++) g.fillRect(i * 128 + 52, 40, 24, 50);
  });
  const camTex = cephe((g, w, h) => {   // mavi-yeşil giydirme cephe (Levent kuleleri)
    const c = w / 8, r = h / 4;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 8; i++) { const t = srand() * .14; g.fillStyle = `rgb(${50 + t * 150},${95 + t * 160},${118 + t * 150})`; g.fillRect(i * c, k * r, c, r); }
    g.fillStyle = 'rgba(20,40,55,.8)'; for (let k = 0; k < 4; k++) g.fillRect(0, k * r + r - 14, w, 14);
    g.fillStyle = '#b3c3cf'; for (let x = 0; x <= w; x += c) g.fillRect(x - 1, 0, 2, h);
  });
  const sigortaTex = cephe((g, w, h) => {   // renkli baskılı cam cephe (Türkiye Sigorta binası)
    g.fillStyle = '#9fbfd2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = srand() * w, y = srand() * h, r = 60 + srand() * 140, col = ['242,140,40', '210,60,122', '43,123,214', '245,200,60'][i % 4];
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},.75)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    g.fillStyle = 'rgba(240,245,250,.8)'; for (let x = 0; x <= w; x += 64) g.fillRect(x - 1.5, 0, 3, h); for (let y = 0; y <= h; y += 128) g.fillRect(0, y - 2, w, 4);
  });
  const beyazTex = cephe((g, w, h) => {   // beyaz yatay bantlar, koyu şerit pencereler (Genel Müdürlük)
    g.fillStyle = '#efede7'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 2000, '120,120,120', .02, .08);
    const r = h / 4;
    for (let k = 0; k < 4; k++) { g.fillStyle = '#2c3b46'; g.fillRect(0, k * r + 40, w, 58); g.fillStyle = 'rgba(160,190,210,.3)'; g.fillRect(0, k * r + 40, w, 14); g.fillStyle = '#d9d7d0'; for (let x = 0; x < w; x += 64) g.fillRect(x, k * r + 40, 3, 58); }
  });
  const gokTex = canvasTex(8, 512, (g, w, h) => {   // gökyüzü: tepede mavi, ufukta puslu açık mavi
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5d8fd8'); gr.addColorStop(.38, '#8db5e6'); gr.addColorStop(.5, '#d3e2ef'); gr.addColorStop(.53, '#dfe5e8'); gr.addColorStop(1, '#c9cdd0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const pankartTex = canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = '#16233a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#16233a'; g.fillRect(i * 64, 0, 64, 18); g.fillStyle = i % 2 ? '#16233a' : '#f4f1ea'; g.fillRect(i * 64, h - 18, 64, 18); }
    g.fillStyle = '#ffffff'; g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LEVENT', w / 2, h / 2 - 8);
    g.fillStyle = '#e8b93a'; g.font = '700 26px system-ui, sans-serif'; g.fillText('İSTANBUL ŞEHİR YARIŞI', w / 2, h - 40);
  });
  const okTex = canvasTex(128, 96, (g, w, h) => {   // viraj levhası (kırmızı zemin, beyaz oklar)
    g.fillStyle = '#d3302b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff';
    for (const x of [18, 58]) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 34, h / 2); g.lineTo(x, h - 16); g.lineTo(x + 14, h - 16); g.lineTo(x + 48, h / 2); g.lineTo(x + 14, 16); g.fill(); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
  });
  const mesafeTex = n => canvasTex(128, 128, (g, w, h) => {   // fren levhası
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b1b1b'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#1b1b1b'; g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 3);
  });
  const koliTex = canvasTex(128, 128, (g, w, h) => {   // karton koli (yol engeli)
    g.fillStyle = '#c49561'; g.fillRect(0, 0, w, h); gurultu(g, w, h, 600, '90,60,30', .05, .15);
    g.fillStyle = '#d8c9a8'; g.fillRect(w / 2 - 12, 0, 24, h);
    g.strokeStyle = 'rgba(70,45,20,.6)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
  });
  const rampaTex = canvasTex(128, 128, (g, w, h) => {   // sarı-siyah inşaat rampası
    g.fillStyle = '#f0c419'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1c1c';
    for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 48, h); g.lineTo(i * 32 + 32, h); g.fill(); }
  });
  const simitTex = canvasTex(128, 64, (g, w, h) => {   // susamlı simit kabuğu
    g.fillStyle = '#b86a2a'; g.fillRect(0, 0, w, h);
    gurultu(g, w, h, 500, '120,60,20', .1, .3, 2, 2);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(245,225,170,${.6 + srand() * .4})`; g.save(); g.translate(srand() * w, srand() * h); g.rotate(srand() * 3); g.fillRect(-1.5, -.8, 3, 1.6); g.restore(); }
  }, true);

  /* ---------- malzemeler ---------- */
  let ENV = null;
  const M = {};
  const ofset = (o, k = -1) => Object.assign(o, { polygonOffset: true, polygonOffsetFactor: k, polygonOffsetUnits: k });
  function malzemeler() {
    const S_ = o => new THREE.MeshStandardMaterial(o);
    M.yol = S_(ofset({ map: asfaltTex, roughness: .8 }, -3));
    M.sokak = S_(ofset({ map: sokakTex, roughness: .85 }, -1));
    M.anaYol = S_(ofset({ map: anaYolTex, roughness: .85 }, -1));
    M.kacis = S_(ofset({ color: 0x4c4e53, roughness: .9 }, -2));
    M.kerb = S_(ofset({ map: kerbTex, roughness: .6 }, -4));
    M.bariyer = S_({ map: bariyerTex, roughness: .75, side: THREE.DoubleSide });
    M.bariyerUst = mat('#c9c5bc', { roughness: .85 });
    M.bordur = mat('#c4bfb5', { roughness: .85 });
    M.zemin = S_({ map: kaldirimTex, roughness: .92 });
    M.cimen = S_(ofset({ map: cimenTex, roughness: 1 }, -1));
    M.cit = S_({ map: citTex, roughness: 1 });
    M.plazaCam = S_({ map: plazaCamTex, roughness: .12, metalness: .55, envMap: ENV, envMapIntensity: 1.1 });
    M.tas = S_({ map: tasTex, roughness: .7, envMap: ENV, envMapIntensity: .3 });
    M.lobi = S_({ map: lobiTex, roughness: .12, metalness: .4, envMap: ENV, envMapIntensity: .8 });
    M.ofis = S_({ map: ofisTex, roughness: .55, envMap: ENV, envMapIntensity: .4 });
    M.apart = ['#f4e8d2', '#ead9c6', '#dfe4e6', '#f2ddc5', '#e7e1d3', '#f0d7cc'].map(c => S_({ map: apartTex, color: c, roughness: .88 }));
    M.dukkan = S_({ map: dukkanTex, roughness: .45, envMap: ENV, envMapIntensity: .5 });
    M.beton = S_({ map: betonTex, roughness: .8 });
    M.kahve = S_({ map: kahveTex, roughness: .45, metalness: .45, envMap: ENV, envMapIntensity: .7 });
    M.cam = S_({ map: camTex, roughness: .08, metalness: .6, envMap: ENV, envMapIntensity: 1.2 });
    M.sigorta = S_({ map: sigortaTex, roughness: .1, metalness: .35, envMap: ENV, envMapIntensity: .9 });
    M.beyaz = S_({ map: beyazTex, roughness: .5, envMap: ENV, envMapIntensity: .4 });
    M.cati = mat('#8f8c86', { roughness: .9 });
    M.direk = new THREE.MeshStandardMaterial({ color: 0x5c6168, roughness: .45, metalness: .6, envMap: ENV });
    M.lamba = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, emissive: 0xfff1d0, emissiveIntensity: .3 });
    M.govde = mat('#5b4535', { roughness: 1 });
    M.yaprak = S_({ color: 0xffffff, roughness: .95 });
    M.lastik = mat('#1d1d20', { roughness: .95 });
    M.levha = S_({ map: okTex, roughness: .7, side: THREE.DoubleSide });
    M.pankart = S_({ map: pankartTex, roughness: .7, side: THREE.DoubleSide });
    M.koli = S_({ map: koliTex, roughness: .9 });
    M.mazot = new THREE.MeshPhysicalMaterial({ color: 0x15161a, roughness: .05, clearcoat: 1, envMap: ENV, transparent: true, opacity: .92 });
    M.rampa = S_({ map: rampaTex, roughness: .6 });
    M.kova = new THREE.MeshStandardMaterial({ color: 0xf2c12e, roughness: .4 });
    M.simit = S_({ map: simitTex, roughness: .7 });
    M.su = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0x9fc4dc, emissiveIntensity: .35, roughness: .05, transparent: true, opacity: .8, envMap: ENV, depthWrite: false, side: THREE.DoubleSide });
    M.birikinti = new THREE.MeshPhysicalMaterial({ color: 0x6f8796, roughness: .02, clearcoat: 1, envMap: ENV, envMapIntensity: 1.4, transparent: true, opacity: .8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    M.rogar = mat('#2f2f33', { roughness: .5, metalness: .6 });
    M.iskele = mat('#d9d6cf', { roughness: .5, metalness: .4 });
  }
  // gökyüzü yansıması (cam kuleler ve araç boyaları gökyüzünü yansıtır)
  function ortamKur() {
    const pm2 = new THREE.PMREMGenerator(A.renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ map: gokTex, side: THREE.BackSide })));
    const yer = new THREE.Mesh(new THREE.CircleGeometry(99, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8e8a84 })); yer.position.y = -6; es.add(yer);
    for (let i = 0; i < 14; i++) {   // ufuktaki binalar
      const a = i / 14 * Math.PI * 2, h = 8 + srand() * 24;
      const b = new THREE.Mesh(new THREE.BoxGeometry(14, h, 14), new THREE.MeshBasicMaterial({ color: srand() < .5 ? 0x7f95a8 : 0xb8b2a6 }));
      b.position.set(Math.cos(a) * 80, h / 2 - 6, Math.sin(a) * 80); es.add(b);
    }
    const tex = pm2.fromScene(es, .03, 1, 300).texture; pm2.dispose();
    return tex;
  }

  /* ---------- yardımcılar ---------- */
  // cephe dokusu bina boyutuna göre döşenir (doku: 4 aralık × 4 kat): bütün binalar aynı malzemeyi paylaşır
  function kutuGeo(w, h, d, bay = BAY * 4, kat = KAT * 4) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const yuz = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x, -x, +y, -y, +z, -z
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * yuz[f][0] / bay, uv.getY(i) * yuz[f][1] / kat); }
    return g;
  }
  function silindirGeo(r, h, bolum, bay = BAY * 4, kat = KAT * 4, aci = Math.PI * 2) {
    const g = new THREE.CylinderGeometry(r, r, h, bolum, 1, false, 0, aci), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * aci / bay, uv.getY(i) * h / kat);
    return g;
  }
  const parca = (g, geo, m, x, y, z, o = {}) => mk(g, geo, m, x, y, z, { recv: true, ...o });
  // ana yolu ve yan sokakları çizer: haritadaki çoklu çizgi (piksel) → yumuşak şerit
  const SOKAKLAR = [];
  function serit(pxNoktalar, genM, malz, y, vLen = 40) {
    const noktalar = pxNoktalar.map(([x, yy]) => { const [a, b] = pm(x, yy); return new THREE.Vector3(a, 0, b); });
    const egri = new THREE.CatmullRomCurve3(noktalar, false, 'centripetal');
    const n = Math.max(8, Math.round(egri.getLength() / 12)), pts = egri.getSpacedPoints(n);
    const yar = met(genM) / 2, pos = [], uv = [], idx = []; let v = 0;
    for (let i = 0; i <= n; i++) {
      const p = pts[i], q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)];
      const t = q.clone().sub(o).setY(0).normalize(), r = new THREE.Vector3(-t.z, 0, t.x);
      if (i) v += p.distanceTo(pts[i - 1]) / vLen;
      pos.push(p.x - r.x * yar, y, p.z - r.z * yar, p.x + r.x * yar, y, p.z + r.z * yar); uv.push(0, v, 1, v);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]; g.setIndex(idx); g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, malz); m.receiveShadow = true; D0.add(m);
    SOKAKLAR.push({ pts, yar });
    return pts;
  }
  let D0 = null;   // kurulan dünyanın kökü

  // bina yerleşimi: pistten, sokaklardan ve diğer binalardan uzak mı?
  const BINALAR = [], PARKLAR = [], DEKOR = [];   // DEKOR: [x, z, yarıçap] — totem ve tabelaların yerine ağaç dikilmez
  const kenarlar = (cx, cz, w, d, rot) => {
    const c = Math.cos(rot), s = Math.sin(rot), out = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0], [-.5, -1], [.5, -1], [-.5, 1], [.5, 1], [-1, -.5], [-1, .5], [1, -.5], [1, .5]]) {
      const lx = a * w / 2, lz = b * d / 2; out.push([cx + lx * c + lz * s, cz - lx * s + lz * c]);
    }
    return out;
  };
  const PAY = SOKAK_KENAR + met(3.2);   // yarış sokağının ortasından bina cephesine en az (bordür + kaldırım)
  function sokakUzak(x, z, pay) {
    for (const s of SOKAKLAR) for (const p of s.pts) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < (s.yar + pay) ** 2) return false; }
    return true;
  }
  function binaBos(cx, cz, w, d, rot) {
    for (const [x, z] of kenarlar(cx, cz, w, d, rot)) {
      if (A.roadNear(x, z).d < PAY) return false;
      if (!sokakUzak(x, z, met(2.5))) return false;
      for (const b of BINALAR) { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot), s = Math.sin(b.rot); const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < b.w / 2 + met(2) && Math.abs(lz) < b.d / 2 + met(2)) return false; }
      for (const p of PARKLAR) if (x > p[0] && x < p[2] && z > p[1] && z < p[3]) return false;
    }
    return true;
  }
  // gerçek konumdaki binayı pistten yeterince uzağa iter (harita pikselleri yaklaşık olduğu için)
  function pistten(cx, cz, w, d, rot) {
    for (let k = 0; k < 8; k++) {
      let en = Infinity, ex = 0, ez = 0;
      for (const [x, z] of kenarlar(cx, cz, w, d, rot)) { const dd = A.roadNear(x, z).d; if (dd < en) { en = dd; ex = x; ez = z; } }
      if (en >= PAY) break;
      frameAt(A.sAt(ex, ez), F1);
      const yon = Math.sign((cx - F1.p.x) * F1.r.x + (cz - F1.p.z) * F1.r.z) || 1;
      cx += F1.r.x * yon * (PAY - en + 2); cz += F1.r.z * yon * (PAY - en + 2);
    }
    return [cx, cz];
  }

  /* --- bina türleri (ölçüler birim; g grubunun yerel x/z'si) --- */
  function plazaKulesi(g, w, d, h) {   // Yapı Kredi kuleleri: mavi aynalı cam, köşelerde ve ortada bej taş
    const pod = KAT * 2.2, p = w * .17, q = d * .17;
    parca(g, kutuGeo(w * 1.12, pod, d * 1.12, BAY * 4, KAT * 2.2), M.lobi, 0, pod / 2, 0);
    parca(g, kutuGeo(w * 1.14, KAT * .35, d * 1.14), M.tas, 0, pod + KAT * .17, 0);
    parca(g, kutuGeo(w * .9, h - pod, d * .9), M.plazaCam, 0, pod + (h - pod) / 2, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parca(g, kutuGeo(p, h - pod, q), M.tas, sx * (w - p) / 2, pod + (h - pod) / 2, sz * (d - q) / 2);
    parca(g, kutuGeo(w * .09, h - pod, d * .94), M.tas, 0, pod + (h - pod) / 2, 0);
    parca(g, kutuGeo(w * .94, h - pod, d * .09), M.tas, 0, pod + (h - pod) / 2, 0);
    parca(g, kutuGeo(w, KAT * 1.6, d), M.tas, 0, h + KAT * .8, 0);                // taç
    parca(g, box(w * .5, KAT * 1.2, d * .45), M.cati, 0, h + KAT * 2.2, 0);       // makine dairesi
    return h + KAT * 2.8;
  }
  function ofisBlok(g, w, d, h, malz = M.ofis) {
    parca(g, kutuGeo(w, KAT * 1.4, d, BAY * 4, KAT * 1.4), M.lobi, 0, KAT * .7, 0);
    parca(g, kutuGeo(w, h - KAT * 1.4, d), malz, 0, KAT * 1.4 + (h - KAT * 1.4) / 2, 0);
    parca(g, box(w + 1, KAT * .4, d + 1), M.cati, 0, h + KAT * .2, 0);
    return h;
  }
  function apartman(g, w, d, h) {
    const m = M.apart[Math.floor(srand() * M.apart.length)];
    parca(g, kutuGeo(w, KAT * 1.2, d, BAY * 4, KAT * 1.2), M.dukkan, 0, KAT * .6, 0);
    parca(g, kutuGeo(w, h - KAT * 1.2, d), m, 0, KAT * 1.2 + (h - KAT * 1.2) / 2, 0);
    parca(g, box(w + 1.2, KAT * .3, d + 1.2), M.cati, 0, h + KAT * .15, 0);
    if (srand() < .6) parca(g, box(w * .3, KAT * .9, d * .3), m, w * .15, h + KAT * .45, 0);
    return h;
  }
  function camKule(g, w, d, h, tepe = 'duz') {
    parca(g, kutuGeo(w * 1.05, KAT * 2, d * 1.05, BAY * 4, KAT * 2), M.lobi, 0, KAT, 0);
    parca(g, kutuGeo(w, h - KAT * 2, d), M.cam, 0, KAT * 2 + (h - KAT * 2) / 2, 0);
    if (tepe === 'piramit') { const pg = new THREE.ConeGeometry(Math.hypot(w, d) / 2 * .95, h * .1, 4).rotateY(Math.PI / 4); pg.scale(w / Math.hypot(w, d) * 1.41, 1, d / Math.hypot(w, d) * 1.41); parca(g, pg, M.cam, 0, h + h * .05, 0); parca(g, cyl(1.2, 1.2, h * .12, 8), M.direk, 0, h + h * .1 + h * .06, 0); }
    else if (tepe === 'egik') { const e = new THREE.BoxGeometry(w, h * .12, d); const p = e.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getX(i) < 0) p.setY(i, -h * .06 + .5); e.computeVertexNormals(); parca(g, e, M.cam, 0, h + h * .06, 0); }
    else parca(g, box(w * .96, KAT, d * .96), M.cati, 0, h + KAT * .5, 0);
    return h;
  }

  /* ---------- tabelalar ----------
     Bina adları Google Haritalar'daki adlardır; düz yazı olarak (logo/amblem yok) cepheye ya da tepeye yazılır.
     Sokak tabelaları İstanbul'daki mavi tabelalar gibi: kavşaklarda direk üstünde. */
  const yaziMalz = new Map();
  function yaziMalzeme(metin, { renk = '#ffffff', arka = null, ust = null } = {}) {
    const anahtar = [metin, renk, arka, ust].join('|');
    if (yaziMalz.has(anahtar)) return yaziMalz.get(anahtar);
    const font = '800 92px system-ui, "Segoe UI", Arial, sans-serif', olc = document.createElement('canvas').getContext('2d'); olc.font = font;
    const H = arka ? 176 : 128, W = Math.ceil(olc.measureText(metin).width) + (arka ? 90 : 30);
    const tex = canvasTex(W, H, (g, w, h) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (arka) {   // mavi sokak tabelası: beyaz çerçeve, üstte ilçe adı
        g.fillStyle = arka; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
        if (ust) { g.fillStyle = '#ffffff'; g.font = '700 28px system-ui, Arial, sans-serif'; g.fillText(ust, w / 2, 40); }
        g.font = font; g.fillStyle = '#ffffff'; g.fillText(metin, w / 2, ust ? 112 : h / 2);
      } else {      // cepheye yazı: harfler, arkasında hafif gölge (her zeminde okunsun)
        g.font = font; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(metin, w / 2 + 4, h / 2 + 5);
        g.fillStyle = renk; g.fillText(metin, w / 2, h / 2);
      }
    });
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: arka ? .25 : .35, roughness: .5,
      alphaTest: arka ? 0 : .4, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });   // tek yüz: arkadan ayna gibi ters okunmasın
    const sonuc = { m, oran: W / H }; yaziMalz.set(anahtar, sonuc); return sonuc;
  }
  function yaziPlani(metin, yuk, enFazla, o) {
    const { m, oran } = yaziMalzeme(metin, o); let w = yuk * oran;
    if (enFazla && w > enFazla) { yuk *= enFazla / w; w = enFazla; }
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, yuk), m); p.castShadow = false; return p;
  }
  const kayit = g => BINALAR.find(o => o.g === g);
  // binanın pisti gören cephesine (iki: karşı cepheye de) yazı. y: yükseklik, pay: cephenin merkeze uzaklık çarpanı
  function binaTabela(g, metin, { y, yuk, pay = 1, iki = false, renk } = {}) {
    const b = kayit(g); if (!b) return;
    frameAt(A.sAt(b.x, b.z), F1);
    const dx = F1.p.x - b.x, dz = F1.p.z - b.z, c = Math.cos(b.rot), s = Math.sin(b.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const yuzler = Math.abs(lx) / b.w > Math.abs(lz) / b.d ? [[Math.sign(lx) || 1, 0]] : [[0, Math.sign(lz) || 1]];
    if (iki) yuzler.push([-yuzler[0][0], -yuzler[0][1]]);
    for (const [nx, nz] of yuzler) {
      const genis = nx ? b.d : b.w, yarim = (nx ? b.w : b.d) / 2 * pay + .4;
      const m = yaziPlani(metin, yuk, genis * .86, { renk });
      m.position.set(nx * yarim, y, nz * yarim); m.rotation.y = nx ? nx * Math.PI / 2 : (nz > 0 ? 0 : Math.PI);
      g.add(m);
    }
  }
  // mavi sokak tabelası: pistin s noktasında, yan (+1/-1) kaldırımda, gelen yarışçılara dönük
  function sokakTabelasi(D, s, yan, metin) {
    frameAt(s, F1);
    const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, yan * (SOKAK_KENAR + met(1.3))); g.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI - yan * .35; D.add(g);
    DEKOR.push([g.position.x, g.position.z, met(1)]);
    const h = met(3.2);
    parca(g, cyl(.22, .26, h, 8), M.direk, 0, h / 2, 0);
    const p = yaziPlani(metin, met(.42), met(2.2), { arka: '#1f4f9e', ust: 'BEŞİKTAŞ' }); p.position.set(0, h - met(.3), .3); g.add(p);
    parca(g, box(p.geometry.parameters.width + .3, p.geometry.parameters.height + .3, .2), M.direk, 0, h - met(.3), .12, { cast: false });
  }

  /* =========================================================
     DÜNYA
     ========================================================= */
  const RG = { iskele: null, isiklar: [], gok: null, arabaci: null };
  let disari = 1;   // pistin sağ vektörü (R) çemberin dışını mı (1) içini mi (-1) gösteriyor
  const Z = { kuzeyA: 0, kuzeyB: 0, simitA: 0, simitB: 0, suA: 0, suB: 0, koseler: [], ruzgar: null, ruzgarSes: 0 };
  function kur(D) {
    D0 = D; ENV = ortamKur(); malzemeler();
    const L = A.L, START_S = A.START_S;
    // çemberin dışı hangi yanda?
    { let cx = 0, cz = 0; for (const p of A.P) { cx += p.x; cz += p.z; } cx /= A.P.length; cz /= A.P.length; let t = 0; for (let i = 0; i < A.P.length; i += 20) t += (A.P[i].x - cx) * A.R[i].x + (A.P[i].z - cz) * A.R[i].z; disari = Math.sign(t) || 1; }
    Z.koseler = koseBul();
    const sp = (x, y) => { const [a, b] = pm(x, y); return A.sAt(a, b); };
    Z.kuzeyA = sp(545, 240); Z.kuzeyB = sp(845, 348);
    Z.simitA = sp(1040, 694); Z.simitB = sp(884, 684);
    Z.suA = sp(860, 643); Z.suB = sp(690, 556);

    /* zemin (kilit taşı kaldırım), parklar */
    { const g = new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14000 / met(4), uv.getY(i) * 14000 / met(4)); mk(D, g, M.zemin, 0, 0, 0, { cast: false, recv: true }); }
    const park = (x0, y0, x1, y1) => {
      const [a, b] = pm(x0, y0), [c, d] = pm(x1, y1); PARKLAR.push([a, b, c, d]);
      const g = new THREE.PlaneGeometry(c - a, d - b).rotateX(-Math.PI / 2), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (c - a) / met(8), uv.getY(i) * (d - b) / met(8));
      mk(D, g, M.cimen, (a + c) / 2, .05, (b + d) / 2, { cast: false, recv: true });
    };
    park(742, 628, 830, 718);   // Talatpaşa - Cömert Sk. arasındaki park
    park(905, 60, 1000, 140);   // Çamlık Cd. kuzeyindeki yeşil alan
    park(640, 470, 700, 520);   // plaza bahçesi

    /* yan sokaklar ve Büyükdere Caddesi */
    serit([[300, -500], [345, -200], [385, 40], [420, 200], [446, 300], [478, 390], [510, 470], [548, 560], [590, 680], [640, 820], [705, 990], [800, 1250]], 27, M.anaYol, .1, 60);
    const yan = [
      [[[598, 548], [520, 553], [420, 560], [300, 566], [150, 572], [-100, 580], [-400, 590]], 14, 'TALATPAŞA CD.'],
      [[[952, 382], [948, 300], [937, 180], [925, 60], [905, -220]], 12, 'ÇAMLIK CD.'],
      [[[1049, 680], [1075, 740], [1100, 800], [1130, 880], [1170, 1000], [1230, 1180]], 13, 'HACI ADİL CD.'],
      [[[1031, 610], [1040, 480], [1055, 330], [1072, 180], [1088, 0], [1100, -200]], 9, 'HACI ADİL CD.'],          // kuzey kolu
      [[[820, 860], [871, 826], [931, 791], [1000, 752], [1066, 716], [1120, 694], [1260, 650]], 10, 'ÇAYIRÇİMEN SK.'],   // alt kol
      [[[905, 728], [903, 780], [911, 830], [925, 910], [940, 1050]], 9, 'CÖMERT SK.'],
      [[[758, 300], [752, 200], [745, 60], [738, -150]], 8, 'MELTEM SK.'],
      [[[626, 238], [624, 150], [621, 75]], 8, 'KALE SERAMİK SK.'],   // Kule Çarşı'da biter
      [[[484, 268], [468, 200], [448, 120], [425, 0], [400, -150]], 9, 'CÖMERT SK.'],
      [[[1040, 160], [1200, 162], [1420, 165]], 8, 'ORTANCA SK.'],
      [[[1050, 282], [1200, 285], [1420, 288]], 8, 'FESLEĞEN SK.'],
      [[[1045, 392], [1200, 395], [1420, 398]], 8, 'PALMİYE SK.'],
      [[[1037, 520], [1200, 523], [1420, 526]], 8, 'ASMA SK.'],
      [[[1036, 638], [1200, 641], [1420, 644]], 8, 'HAYAT SK.'],
      [[[1085, 762], [1240, 765], [1420, 768]], 8, 'ALKARANFİL SK.'],
      [[[1168, -150], [1165, 160], [1160, 400], [1152, 700], [1142, 1000]], 8, 'KARANFİL SK.'],
    ];
    const kavsak = [];   // yan sokakların pistle birleştiği yerler: bordürde açıklık kalır, köşede sokak tabelası durur
    for (const [pts, w, ad] of yan) {
      serit(pts, w, M.sokak, .1);
      const [a, b] = pm(...pts[0]), [a2, b2] = pm(...pts[1]), s = A.sAt(a, b); frameAt(s, F1);
      // sokağın hangi yanda olduğu ikinci noktasına göre (ilk nokta pistin üstünde olabilir)
      if (Math.hypot(F1.p.x - a, F1.p.z - b) < SOKAK_KENAR + met(w)) kavsak.push({ s, yan: Math.sign((a2 - F1.p.x) * F1.r.x + (b2 - F1.p.z) * F1.r.z) || 1, yar: met(w) / 2 + 6, ad });
    }

    /* yarış sokağı: asfalt, kerb, kaçış payı, beton bariyer, sokak kenarı ve bordür */
    ribbon(-HW, HW, YOL_Y, YOL_Y, 12, M.yol, true);
    ribbon(HW, HW + 1.3, .21, .21, 3, M.kerb, true); ribbon(-HW - 1.3, -HW, .21, .21, 3, M.kerb, true);
    ribbon(HW + 1.3, SOKAK_KENAR, .19, .19, 20, M.kacis, true); ribbon(-SOKAK_KENAR, -HW - 1.3, .19, .19, 20, M.kacis, true);
    const BH = 2.3;
    for (const sg of [-1, 1]) {
      const a = sg * (HW + 3.4), b = sg * (HW + 4.25);
      ribbon(a, a, 0, BH, 8, M.bariyer, true).castShadow = true;
      ribbon(b, b, 0, BH, 8, M.bariyer, false);
      ribbon(Math.min(a, b), Math.max(a, b), BH, BH, 30, M.bariyerUst, false);
    }
    // bordür: kavşak ağızlarında açıklık
    for (const sg of [-1, 1]) {
      const kapali = s => kavsak.some(k => k.yan === sg && Math.abs(sd(s, k.s)) < k.yar);
      let bas = null;
      const bordur = (a, b) => {   // a..b aralığı (bütün tur ise b = null)
        const o = sg * SOKAK_KENAR, o2 = sg * (SOKAK_KENAR + .7);
        ribbon(o, o, 0, .65, 20, M.bordur, true, a, b); ribbon(Math.min(o, o2), Math.max(o, o2), .65, .65, 20, M.bordur, true, a, b);
      };
      // son açık parça da (son kavşaktan tur sonuna kadar) kurulsun: döngü tam L'de biter
      for (let s = 0; ; s = Math.min(s + 2, L)) {
        const son = s >= L, acik = !son && !kapali(s);
        if (acik && bas === null) bas = s;
        if ((!acik || son) && bas !== null) {
          if (bas === 0 && son) bordur(0, null);   // bu yanda hiç kavşak yok: bütün tur
          else if (s - bas > 4) bordur(bas, s);
          bas = null;
        }
        if (son) break;
      }
    }
    // bitiş çizgisi
    {
      frameAt(START_S, F1);
      const g = new THREE.Group(); g.position.copy(F1.p); g.position.y += .23; g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
      const t = A.TEX.finish.clone(); t.needsUpdate = true; t.repeat.set(8, 1);
      mk(g, new THREE.PlaneGeometry(2 * HW, 2), new THREE.MeshStandardMaterial({ map: t, roughness: .6, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), 0, 0, 0, { r: [-Math.PI / 2, 0, 0], cast: false, recv: true });
    }
    baslangicKapisi(D, START_S);
    virajLevhalari(D);

    /* --- BİNALAR (haritadaki yerlerinde) --- */
    const bina = (px, py, wpx, dpx, hM, tur, rot = 0, it = true) => {
      let [x, z] = pm(px, py); const w = wpx * F, d = dpx * F, h = met(hM);
      if (it) [x, z] = pistten(x, z, w, d, rot);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; D.add(g);
      const ust = tur(g, w, d, h);
      BINALAR.push({ x, z, w, d, rot, h: ust, g });
      return g;
    };
    // Yapı Kredi Plaza: A (helikopter pistli), B, C kuleleri (20'şer kat) ve D bloğu; aralarında bronz kaplı alçak bloklar
    const kuleA = bina(574, 382, 64, 64, 84, plazaKulesi, .12);
    const kuleB = bina(782, 394, 62, 62, 84, plazaKulesi, .12);
    const kuleC = bina(650, 462, 62, 64, 84, plazaKulesi, .12);
    const blokD = bina(574, 286, 98, 60, 32, (g, w, d, h) => ofisBlok(g, w, d, h), .1);      // D bloğu
    const bronz = bina(714, 470, 96, 50, 11, (g, w, d, h) => ofisBlok(g, w, d, h, M.kahve), .12);   // alçak bronz blok (giriş)
    bina(706, 410, 52, 46, 14, (g, w, d, h) => ofisBlok(g, w, d, h, M.kahve), .12);
    { const b = BINALAR.find(o => o.g === kuleA); mk(kuleA, new THREE.CylinderGeometry(b.w * .32, b.w * .32, .4, 32), M.cati, 0, b.h + .2, 0, { cast: false }); }   // A kulesinin helikopter pisti
    // çemberin içindeki diğer binalar
    bina(905, 465, 70, 118, 40, (g, w, d, h) => ofisBlok(g, w, d, h, M.beton), .2);
    const okul = bina(948, 590, 58, 46, 16, (g, w, d, h) => ofisBlok(g, w, d, h, M.apart[2]), .3);   // AB-I Hayat Okulu
    const sigorta = bina(968, 668, 92, 40, 26, (g, w, d, h) => ofisBlok(g, w, d, h, M.sigorta), .41);   // Türkiye Sigorta
    bina(852, 522, 54, 44, 19, apartman, .1);
    bina(800, 520, 34, 30, 12, apartman, .1);
    // çemberin dışı: Yapı Kredi Bankası Genel Müdürlük (köşeleri yuvarlak, beyaz bantlı)
    const ykgm = bina(878, 240, 110, 72, 40, (g, w, d, h) => {
      const r = d / 2;
      parca(g, kutuGeo(w - d, KAT * 1.4, d, BAY * 4, KAT * 1.4), M.lobi, 0, KAT * .7, 0);
      parca(g, kutuGeo(w - d, h - KAT * 1.4, d), M.beyaz, 0, KAT * 1.4 + (h - KAT * 1.4) / 2, 0);
      for (const sx of [-1, 1]) {
        const c = parca(g, silindirGeo(r, h, 28, BAY * 4, KAT * 4, Math.PI), M.beyaz, sx * (w - d) / 2, h / 2, 0); c.rotation.y = sx > 0 ? 0 : Math.PI;
      }
      parca(g, box(w - d, KAT * .4, d + 1), M.cati, 0, h + KAT * .2, 0);
      return h;
    }, .05);
    const kpmg = bina(722, 140, 70, 46, 24, (g, w, d, h) => ofisBlok(g, w, d, h), 0);       // KPMG Akademi binası
    bina(560, 150, 50, 50, 22, (g, w, d, h) => ofisBlok(g, w, d, h, M.beton), 0);
    bina(668, 160, 40, 46, 18, apartman, 0);
    bina(810, 170, 40, 40, 16, apartman, 0);
    const eurasia = bina(784, 760, 52, 40, 30, apartman, .35);                               // Eurasia
    const emlak = bina(744, 812, 60, 36, 36, apartman, .35); bina(808, 838, 60, 36, 36, apartman, .35);   // Emlak Kredi blokları
    bina(1000, 830, 150, 110, 12, (g, w, d, h) => ofisBlok(g, w, d, h, M.beton), .42);      // Çayırçimen güneyi
    // Büyükdere Cd.'nin batısı
    const deva = bina(250, 465, 90, 60, 36, (g, w, d, h) => ofisBlok(g, w, d, h), .3);      // Deva Holding
    const l199 = bina(235, 390, 70, 70, 135, (g, w, d, h) => camKule(g, w, d, h, 'egik'), .3);   // Levent 199
    bina(330, 560, 80, 50, 26, (g, w, d, h) => ofisBlok(g, w, d, h, M.beton), .3);
    bina(300, 650, 70, 50, 30, apartman, .3);
    bina(380, 300, 60, 60, 62, (g, w, d, h) => camKule(g, w, d, h), .3);
    bina(300, 180, 70, 55, 45, (g, w, d, h) => ofisBlok(g, w, d, h), .3);
    bina(420, 760, 80, 60, 48, (g, w, d, h) => ofisBlok(g, w, d, h, M.cam), .3);
    // uzaktaki Levent kuleleri (gerçek yerlerine göre)
    const tekfen = bina(98, 136, 60, 60, 115, (g, w, d, h) => camKule(g, w, d, h), .3, false);             // Tekfen Tower
    // İş Bankası Kuleleri: çemberin hemen kuzeyinde, Kule Çarşı'nın üstünde (41.0827 K, 29.0122 D); 181 m + iki 137 m
    const isK = bina(625, -55, 80, 80, 181, (g, w, d, h) => camKule(g, w, d, h, 'piramit'), .3, false);
    bina(702, -8, 60, 60, 137, (g, w, d, h) => camKule(g, w, d, h), .3, false);
    bina(585, 45, 56, 56, 137, (g, w, d, h) => camKule(g, w, d, h), .3, false);
    // QNB Genel Müdürlük: Kristal Kule, Büyükdere Cd. No:215 (41.0829 K, 29.0081 D), 147 m
    const qnb = bina(-131, -102, 62, 62, 147, (g, w, d, h) => camKule(g, w, d, h, 'egik'), .3, false);
    const sabanci = bina(300, -520, 70, 70, 158, (g, w, d, h) => camKule(g, w, d, h, 'piramit'), .1, false);   // Sabancı Center
    bina(370, -470, 60, 60, 128, (g, w, d, h) => camKule(g, w, d, h, 'piramit'), .1, false);
    const sapphire = bina(-202, -504, 90, 60, 261, (g, w, d, h) => camKule(g, w, d, h, 'egik'), .25, false);   // İstanbul Sapphire
    const kanyon = bina(398, 856, 70, 70, 120, (g, w, d, h) => {   // Kanyon ofis kulesi: kavisli cephe, kesik yüzleri kapalı
      const r = w * .6, aci = Math.PI * 1.2;
      parca(g, silindirGeo(r, h, 32, BAY * 4, KAT * 4, aci), M.cam, 0, h / 2, 0);
      for (const t of [0, aci]) parca(g, kutuGeo(r, h, 1.2), M.cam, Math.sin(t) * r / 2, h / 2, Math.cos(t) * r / 2, { r: [0, t - Math.PI / 2, 0] });
      return h;
    }, .6, false);
    const metro = bina(780, 1210, 70, 70, 135, (g, w, d, h) => camKule(g, w, d, h), .3, false);   // Metrocity
    bina(850, 1250, 60, 60, 120, (g, w, d, h) => camKule(g, w, d, h), .3, false);
    // dolgu: doğudaki apartman sokakları, kuzey ve güney mahalleleri, Büyükdere'nin batısı
    const dolgu = (x0, y0, x1, y1, n, hMin, hMax, tur = apartman) => {
      for (let i = 0, deneme = 0; i < n && deneme < n * 12; deneme++) {
        const px = x0 + srand() * (x1 - x0), py = y0 + srand() * (y1 - y0), w = 26 + srand() * 22, d = 24 + srand() * 18, rot = (srand() - .5) * .08;
        const [x, z] = pm(px, py);
        if (!binaBos(x, z, w * F, d * F, rot)) continue;
        bina(px, py, w, d, hMin + srand() * (hMax - hMin), tur, rot, false); i++;
      }
    };
    dolgu(1060, 60, 1400, 900, 46, 12, 24);
    dolgu(960, 880, 1300, 1150, 14, 12, 26);
    dolgu(600, 860, 960, 1150, 12, 14, 30);
    dolgu(500, -200, 1000, 120, 20, 14, 30);
    dolgu(-150, 220, 340, 1000, 22, 18, 45, (g, w, d, h) => ofisBlok(g, w, d, h, srand() < .5 ? M.ofis : M.beton));
    dolgu(1000, -200, 1400, 60, 10, 12, 22);

    /* bina tabelaları (Google Haritalar'daki adlar) */
    {
      const ust = g => kayit(g).h;
      // Yapı Kredi kuleleri: tepedeki taç bandında blok harfi (uzaktan görünür), giriş katında ad (yoldan görünür)
      for (const [g, harf, giris] of [[kuleA, 'A BLOK', 'YAPI KREDİ PLAZA'], [kuleB, 'B BLOK', 'SWISSOFFICES'], [kuleC, 'C BLOK', 'SYSTEMAIR TÜRKİYE']]) {
        binaTabela(g, harf, { y: ust(g) - KAT * 2, yuk: KAT * 1.05, iki: true });
        binaTabela(g, giris, { y: KAT * 1.75, yuk: KAT * .55, pay: 1.12 });
      }
      binaTabela(blokD, 'D BLOK', { y: ust(blokD) - KAT * .75, yuk: KAT * .9 });
      binaTabela(blokD, 'YAPI KREDİ YATIRIM', { y: KAT * 1.95, yuk: KAT * .5 });
      binaTabela(bronz, 'YAPI KREDİ', { y: ust(bronz) - KAT * .8, yuk: KAT * .75, iki: true });
      binaTabela(ykgm, 'YAPI KREDİ BANKASI GENEL MÜDÜRLÜK', { y: ust(ykgm) - KAT * .7, yuk: KAT * .7 });
      binaTabela(sigorta, 'TÜRKİYE SİGORTA', { y: ust(sigorta) - KAT * .8, yuk: KAT * .9, iki: true });
      binaTabela(sigorta, 'GENEL MÜDÜRLÜK', { y: KAT * 1.9, yuk: KAT * .45 });
      binaTabela(okul, 'AB-I HAYAT OKULU', { y: ust(okul) - KAT * .7, yuk: KAT * .65, renk: '#1d3d6b' });
      binaTabela(kpmg, 'KPMG AKADEMİ', { y: ust(kpmg) - KAT * .7, yuk: KAT * .8 });
      binaTabela(eurasia, 'EURASIA TERCÜME', { y: KAT * 1.55, yuk: KAT * .4 });
      binaTabela(emlak, 'EMLAK KREDİ BLOKLARI', { y: KAT * 1.55, yuk: KAT * .4 });
      binaTabela(deva, 'DEVA HOLDİNG', { y: ust(deva) - KAT * .8, yuk: KAT * .9 });
      binaTabela(l199, 'ODEABANK', { y: ust(l199) - KAT * 1.6, yuk: KAT * 1.8, iki: true });   // Odeabank Genel Müdürlük bu kulede
      binaTabela(l199, 'LEVENT 199', { y: KAT * 1.6, yuk: KAT * .55 });
      binaTabela(tekfen, 'TEKFEN TOWER', { y: ust(tekfen) - KAT * 1.5, yuk: KAT * 1.5 });
      binaTabela(isK, 'İŞ BANKASI', { y: ust(isK) - KAT * 2, yuk: KAT * 2, iki: true });
      binaTabela(isK, 'İŞ KULELERİ', { y: KAT * 1.6, yuk: KAT * .6 });
      binaTabela(qnb, 'QNB', { y: ust(qnb) - KAT * 2.2, yuk: KAT * 2.4, iki: true });
      binaTabela(qnb, 'KRİSTAL KULE', { y: KAT * 1.6, yuk: KAT * .55 });
      binaTabela(sabanci, 'SABANCI CENTER', { y: ust(sabanci) - KAT * 2, yuk: KAT * 1.8 });
      binaTabela(sapphire, 'İSTANBUL SAPPHIRE', { y: ust(sapphire) - KAT * 3, yuk: KAT * 2.4 });
      binaTabela(kanyon, 'KANYON', { y: ust(kanyon) - KAT * 1.8, yuk: KAT * 2, pay: 1.25 });
      binaTabela(metro, 'METROCITY', { y: ust(metro) - KAT * 1.8, yuk: KAT * 1.8 });
    }
    /* plaza totemleri: kulelerin önünde, yolun kenarında, gelen yarışçılara dönük taş tabela (cephedeki yazı yoldan yandan görünür) */
    for (const [g, ust, alt] of [[kuleA, 'YAPI KREDİ PLAZA', 'A BLOK'], [kuleB, 'YAPI KREDİ PLAZA', 'B BLOK'], [kuleC, 'YAPI KREDİ PLAZA', 'C BLOK'], [blokD, 'YAPI KREDİ YATIRIM', 'D BLOK']]) {
      const b = kayit(g), s = A.sAt(b.x, b.z); frameAt(s, F1);
      const yan = Math.sign((b.x - F1.p.x) * F1.r.x + (b.z - F1.p.z) * F1.r.z) || -disari;
      const t = new THREE.Group(); t.position.copy(F1.p).addScaledVector(F1.r, yan * (SOKAK_KENAR + met(2.8))); t.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI - yan * .3; D.add(t);
      DEKOR.push([t.position.x, t.position.z, met(3)]);
      parca(t, kutuGeo(9, 15, 1.6, 9, 15), M.tas, 0, 7.5, 0);
      parca(t, box(9.6, .6, 2.2), M.bariyerUst, 0, .3, 0);
      for (const yon of [1, -1]) {
        const u = yaziPlani(ust, 1.6, 8.4, { renk: '#1d3d6b' }); u.position.set(0, 13, yon * .85); u.rotation.y = yon > 0 ? 0 : Math.PI; t.add(u);
        const a = yaziPlani(alt, 3.4, 8, { renk: '#1d3d6b' }); a.position.set(0, 9.6, yon * .85); a.rotation.y = yon > 0 ? 0 : Math.PI; t.add(a);
      }
    }
    /* sokak tabelaları: yan sokak ağızlarında (gelen yarışçı görmeden önce) ve yarış sokaklarının başında */
    for (const k of kavsak) sokakTabelasi(D, k.s - k.yar - 10, k.yan, k.ad);
    for (const [px, py, ad] of [[575, 500, 'BÜYÜKDERE CD.'], [600, 236, 'PROF. AHMET KEMAL ARU SK.'], [968, 432, 'ÇAMLIK CD.'],
      [1010, 565, 'HACI ADİL CD.'], [985, 718, 'ÇAYIRÇİMEN SK.'], [861, 645, 'TALATPAŞA CD.']]) sokakTabelasi(D, sp(px, py), disari, ad);

    /* cam silme iskelesi: B kulesinin kuzey cephesinde asılı (kova buradan düşer) */
    {
      const b = BINALAR.find(o => o.g === kuleB), y = met(31);
      const g = new THREE.Group(); g.position.set(0, y, -b.d * .45 - met(1.2)); kuleB.add(g);
      parca(g, box(met(6), met(1.1), met(1)), M.iskele, 0, 0, 0);
      parca(g, box(met(6.2), met(.12), met(1.1)), M.cati, 0, met(.55), 0);
      for (const sx of [-1, 1]) parca(g, cyl(.15, .15, b.h - y, 4), M.direk, sx * met(2.8), (b.h - y) / 2, 0, { cast: false });
      kuleB.updateMatrixWorld(true); RG.iskele = g.getWorldPosition(new THREE.Vector3());
    }

    /* plaza çiti: çemberin içinde, yarış sokağı boyunca budanmış çit */
    {
      const ic = -disari, a = ic * (SOKAK_KENAR + met(4.2)), b = ic * (SOKAK_KENAR + met(5.4)), ch = met(1.1);
      const [s0, s1] = [sp(588, 532), sp(495, 305)], [s2, s3] = [sp(560, 246), sp(830, 340)];
      for (const [p, q] of [[s0, s1], [s2, s3]]) {
        ribbon(a, a, 0, ch, 20, M.cit, true, p, q); ribbon(b, b, 0, ch, 20, M.cit, false, p, q); ribbon(Math.min(a, b), Math.max(a, b), ch, ch, 20, M.cit, false, p, q);
      }
    }

    /* simitçi arabası: Çayırçimen - Talatpaşa kavşağında kaldırımda (simitler buradan yuvarlanır) */
    {
      const s = sp(944, 733); frameAt(s, F1);
      // İstanbul simitçi arabası: kırmızı dolap, kırmızı çerçeveli cam vitrin (içinde dizili simitler), tente,
      // "SİMİT" tabelası, bir uçta iki tekerlek, öbür uçta ayaklar ve itme kolları. Yerel z: kaldırım boyunca.
      const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, disari * (SOKAK_KENAR + met(2.4))); g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
      DEKOR.push([g.position.x, g.position.z, met(1.6)]);
      const kirmizi = mat('#c8302a', { roughness: .45 }), krem = mat('#f1ece2', { roughness: .6 });
      const cam = new THREE.MeshStandardMaterial({ color: 0xeef6fa, roughness: .05, transparent: true, opacity: .18, envMap: ENV, depthWrite: false });
      const en = met(.72), boy = met(1.25), dy = met(.34), dh = met(.46), vy = dy + dh + met(.05), vh = met(.6);
      parca(g, box(en, dh, boy), kirmizi, 0, dy + dh / 2, 0);                                  // alt dolap
      parca(g, box(en - .3, dh - .6, .08), krem, 0, dy + dh / 2, boy / 2 + .02, { cast: false });   // dolap kapağı
      parca(g, box(en + .3, met(.05), boy + .3), krem, 0, dy + dh + met(.025), 0);                // tezgâh tablası
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parca(g, box(.22, vh, .22), kirmizi, sx * (en / 2 - .11), vy + vh / 2, sz * (boy / 2 - .11));   // vitrin direkleri
      for (const sz of [-1, 1]) parca(g, box(en, .2, .22), kirmizi, 0, vy + vh - .1, sz * (boy / 2 - .11));
      for (const sx of [-1, 1]) parca(g, box(.22, .2, boy), kirmizi, sx * (en / 2 - .11), vy + vh - .1, 0);
      const vitrin = mk(g, box(en - .25, vh - .2, boy - .25), cam, 0, vy + vh / 2 - .1, 0, { cast: false }); vitrin.userData.noMerge = true; vitrin.renderOrder = 2;
      // vitrindeki simitler: iki rafta, üst üste dizili
      const sg = new THREE.TorusGeometry(.5, .19, 10, 20).rotateX(Math.PI / 2);
      parca(g, box(en - .4, .08, boy - .4), krem, 0, vy + vh * .48, 0, { cast: false });         // ara raf
      for (const [y0, kat] of [[vy + .25, 3], [vy + vh * .48 + .25, 2]]) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < kat; k++)
        parca(g, sg, M.simit, (j - .5) * en * .42 + (k % 2) * .08, y0 + k * .3, (i - 1.5) * boy * .21, { cast: false });
      // tente ve "SİMİT" tabelası
      const tente = mk(g, box(en + .9, .3, boy + .9), kirmizi, 0, vy + vh + .25, 0); tente.rotation.z = .06;
      for (const yon of [-1, 1]) { const t = yaziPlani('SİMİT', 1.1, boy * .8, { arka: '#c8302a' }); t.position.set(yon * (en / 2 + .5), vy + vh + 1.05, 0); t.rotation.y = yon * Math.PI / 2; g.add(t); }
      parca(g, box(.12, .95, boy * .82), kirmizi, 0, vy + vh + 1.05, 0);
      // tekerlekler (arka uçta), ayaklar ve itme kolları (ön uçta)
      const teker = new THREE.TorusGeometry(met(.24), .2, 8, 22).rotateY(Math.PI / 2), tz = -boy / 2 + met(.28);
      for (const sx of [-1, 1]) {
        parca(g, teker, M.lastik, sx * (en / 2 + .22), met(.24) + .2, tz);
        parca(g, cyl(.22, .22, .5, 10), M.direk, sx * (en / 2 + .22), met(.24) + .2, tz, { r: [0, 0, Math.PI / 2] });
        parca(g, box(.18, dy, .18), M.direk, sx * (en / 2 - .2), dy / 2, boy / 2 - .3);           // ayak
        parca(g, box(.14, .14, met(.45)), M.direk, sx * (en / 2 - .2), dy + dh - .2, boy / 2 + met(.22));   // itme kolu
      }
      parca(g, cyl(.08, .08, en * 1.1, 8), M.direk, 0, met(.24) + .2, tz, { r: [0, 0, Math.PI / 2], cast: false });   // dingil
      RG.arabaci = s;
    }

    /* ağaçlar: kaldırımlarda ve parklarda (fıstık çamı, çınar) */
    {
      const yerler = [];
      const agacBos = (x, z) => {
        if (A.roadNear(x, z).d < SOKAK_KENAR + met(1.6)) return false;
        if (!sokakUzak(x, z, met(1.2))) return false;
        for (const [dx, dz, r] of DEKOR) if (Math.hypot(x - dx, z - dz) < r + met(2.5)) return false;
        for (const b of BINALAR) { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot), s = Math.sin(b.rot); const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < b.w / 2 + met(3) && Math.abs(lz) < b.d / 2 + met(3)) return false; }
        return true;
      };
      for (const sg of [-1, 1]) for (let s = 0; s < L; s += met(9) + srand() * met(5)) {
        if (Math.abs(sd(s, START_S)) < 50 || kavsak.some(k => Math.abs(sd(s, k.s)) < k.yar + 10)) continue;
        frameAt(s, F1); const o = sg * (SOKAK_KENAR + met(2.4) + srand() * met(1));
        const x = F1.p.x + F1.r.x * o, z = F1.p.z + F1.r.z * o; if (agacBos(x, z)) yerler.push([x, z]);
      }
      for (const [x0, z0, x1, z1] of PARKLAR) for (let i = 0; i < (x1 - x0) * (z1 - z0) / 2600; i++) { const x = lerp(x0, x1, srand()), z = lerp(z0, z1, srand()); if (agacBos(x, z)) yerler.push([x, z]); }
      for (const s of SOKAKLAR) for (let i = 4; i < s.pts.length - 2; i += 4) for (const sg of [-1, 1]) {   // yan sokak kaldırımları
        const p = s.pts[i], q = s.pts[i + 1], t = q.clone().sub(p).normalize(), o = sg * (s.yar + met(2));
        const x = p.x - t.z * o, z = p.z + t.x * o; if (srand() < .55 && agacBos(x, z)) yerler.push([x, z]);
      }
      const n = yerler.length;
      const govde = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .32, 1, 7).translate(0, .5, 0), M.govde, n);
      const tac = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), M.yaprak, n);
      const renk = ['#4d7a3a', '#5a8a42', '#3f6b33', '#6b9147', '#4a7f45'].map(c => new THREE.Color(c));
      yerler.forEach(([x, z], i) => {
        const cam = srand() < .4, h = met(cam ? 9 + srand() * 4 : 6 + srand() * 4), r = met(cam ? 3.4 + srand() : 2.4 + srand() * 1.2);
        dummy.position.set(x, 0, z); dummy.rotation.set(0, srand() * 6, 0); dummy.scale.set(met(1.1), cam ? h * .82 : h * .55, met(1.1)); dummy.updateMatrix(); govde.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, cam ? h * .86 : h * .62, z); dummy.scale.set(r, cam ? r * .45 : r * .9, r * (cam ? 1 : .95)); dummy.updateMatrix(); tac.setMatrixAt(i, dummy.matrix);
        tac.setColorAt(i, renk[Math.floor(srand() * renk.length)]);
      });
      govde.castShadow = tac.castShadow = true; tac.receiveShadow = true; D.add(govde, tac);
    }

    /* sokak lambaları (bariyerin dışında, kaldırımda) */
    for (let s = 20, k = 0; s < L; s += met(32), k++) {
      if (Math.abs(sd(s, START_S)) < 40) continue;
      const sg = k % 2 ? 1 : -1; frameAt(s, F1);
      if (kavsak.some(q => q.yan === sg && Math.abs(sd(s, q.s)) < q.yar + 6)) continue;
      const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, sg * (SOKAK_KENAR + 2.2)); g.rotation.y = Math.atan2(F1.r.x, F1.r.z) + (sg > 0 ? Math.PI : 0); D.add(g);
      const h = met(9);
      parca(g, cyl(.5, .7, h, 10), M.direk, 0, h / 2, 0);
      parca(g, box(.45, .45, met(2.2)), M.direk, 0, h - .3, met(1.05));
      parca(g, box(1.6, .5, 3.2), M.direk, 0, h - .55, met(2.1));
      parca(g, box(1.3, .12, 2.8), M.lamba, 0, h - .85, met(2.1), { cast: false });
    }

    /* yeşil hız pedleri: virajların içine değil, çıkışına */
    const pads = pedKur(PED_YERI, Z.koseler, YOL_Y);   // asfaltın üstünde (eskiden altında kalıp görünmüyordu)
    // gökyüzü
    RG.gok = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.MeshBasicMaterial({ map: gokTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    RG.gok.renderOrder = -10; RG.gok.frustumCulled = false; RG.gok.userData.noMerge = true; D.add(RG.gok);
    return { pads, env: ENV, yolY: YOL_Y };   // ortak kod araçları ve yol engellerini bu yüksekliğe oturtur
  }

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
  function baslangicKapisi(D, s) {
    frameAt(s, F1);
    const g = new THREE.Group(); g.position.copy(F1.p); g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
    const x0 = HW + 5.2, h = 11;
    for (const sx of [-1, 1]) { parca(g, box(1.4, h + 3, 1.4), M.direk, sx * x0, (h + 3) / 2, 0); parca(g, box(2.6, .6, 2.6), M.bariyerUst, sx * x0, .3, 0); }
    parca(g, box(x0 * 2 + 1.4, 2.6, 1.2), M.direk, 0, h + 1.3, 0);
    const ban = mk(g, new THREE.PlaneGeometry(x0 * 2 - 1, 3.4), M.pankart, 0, h + 1.3, -.7, { cast: false }); ban.rotation.y = Math.PI;   // gelen arabalara dönük
    // start ışıkları: 5 lamba (geri sayımda kırmızı yanar, yeşille söner)
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: .4 });
      parca(g, box(1.3, 1.3, .5), M.lastik, (i - 2) * 1.9, h - 1.2, -.7);
      const l = mk(g, sph(.48, 14, 10), m, (i - 2) * 1.9, h - 1.2, -1, { cast: false }); l.userData.noMerge = true;
      RG.isiklar.push(m);
    }
  }
  // virajlarda bariyerin üstünde ok levhaları; sert virajlardan önce 150 / 100 / 50 fren levhaları; dış yanda lastik yığını
  function virajLevhalari(D) {
    const L = A.L, kart = new THREE.PlaneGeometry(4.2, 3.2), lev = new THREE.PlaneGeometry(2.6, 2.6);
    const mesafe = { 150: null, 100: null, 50: null };
    const lastik = [];
    for (const k of Z.koseler) {
      const [a, b] = k;
      frameAt(a, F1); frameAt(b, F2);
      const sag = F1.t.x * F2.t.z - F1.t.z * F2.t.x < 0, side = sag ? 1 : -1;   // side: virajın dış yanı
      // ok levhaları virajın dış yanında, bariyerin hemen arkasında iki ayak üstünde (havada durmaz)
      for (let s = a + 6; inRange(s, a, b); s += 12) {
        frameAt(s, F1);
        const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, side * (HW + 5)); g.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI; D.add(g);
        const m = mk(g, kart, M.levha, 0, 3.95, 0, { cast: false }); if (sag) m.scale.x = -1;
        mk(g, box(4.4, 3.4, .12), M.direk, 0, 3.95, -.1, { cast: false });                 // levhanın arka çerçevesi
        for (const sx of [-1, 1]) mk(g, box(.24, 2.4, .24), M.direk, sx * 1.5, 1.2, -.18);   // ayaklar
      }
      // lastik yığınları yalnızca virajın dış yanında, tek sıra (çok sayıda olunca telefonu yoruyordu)
      for (let s = a - 8; inRange(s, a - 8, b + 8); s += 2.3) { frameAt(s, F1); lastik.push([F1.p.x + F1.r.x * side * (HW + 6.8), F1.p.z + F1.r.z * side * (HW + 6.8), srand() * 6]); }   // levhaların arkasında
      if (k.tepe < .9) continue;   // fren levhaları yalnızca sert virajlarda
      for (const n of [150, 100, 50]) {
        mesafe[n] ??= new THREE.MeshStandardMaterial({ map: mesafeTex(n), roughness: .7, side: THREE.DoubleSide });
        frameAt(a - n + 20, F1);
        const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, side * (HW + 5)); g.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI; D.add(g);
        mk(g, lev, mesafe[n], 0, 3.8, 0, { cast: false });
        mk(g, box(2.8, 2.8, .12), M.direk, 0, 3.8, -.1, { cast: false });
        mk(g, box(.26, 2.5, .26), M.direk, 0, 1.25, -.2);                                    // direk yerden çıkar
      }
    }
    // üç lastikten oluşan yığın tek parça: her yığın tek örnek (~100 üçgen)
    const yigin = A.mergeGeometries([0, 1, 2].map(y => new THREE.CylinderGeometry(.86, .86, .58, 14, 1, false).translate(y % 2 ? .06 : -.04, .3 + y * .62, y === 1 ? .05 : 0)));   // üstü kapalı
    const im = new THREE.InstancedMesh(yigin, M.lastik, lastik.length);
    lastik.forEach(([x, z, r], i) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, r, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = true; D.add(im);
  }

  /* =========================================================
     BÖLGELER ve OLAYLAR
     ========================================================= */
  const bolgeler = [
    { name: 'ÇAYIRÇİMEN SOKAĞI', sub: 'Simitçinin tablası devrilebilir', test: p => { const [x, y] = pxOf(p); return y > 645 && x > 900; } },
    { name: 'ÇAMLIK CADDESİ', sub: 'Plazalar arası sert rüzgâr', test: p => pxOf(p)[0] > 900 },
    { name: 'TALATPAŞA CADDESİ', sub: 'Eski su borusu patlayabilir', test: p => { const [x, y] = pxOf(p); return y > 500 && x > 600; } },
    { name: 'AHMET KEMAL ARU SOKAĞI', sub: 'Cam silme iskelesinden kova düşebilir', test: p => { const [x, y] = pxOf(p); return y < 400 && x > 515; } },
    { name: 'BÜYÜKDERE YAN YOLU', sub: 'Yapı Kredi Plaza blokları', test: () => true },
  ];
  const bolgeAdi = p => bolgeler.find(b => b.test(p)).name;
  const SIMIT_R = 1.25, SIMIT_T = .5, KOVA_R = 1.15;   // hepsi tek şeride sığar
  const FG = {
    simit: new THREE.TorusGeometry(SIMIT_R, SIMIT_T, 12, 28), kirinti: new THREE.DodecahedronGeometry(.6, 0),
    kova: null, kapak: new THREE.CylinderGeometry(1.3, 1.3, .25, 20), su: new THREE.CylinderGeometry(1.5, 1.1, 1, 18, 1, true).translate(0, .5, 0),
    birikinti: new THREE.CircleGeometry(1.8, 28).rotateX(-Math.PI / 2),
  };
  function ileride(a, b, once) {
    const me = A.me, ilk = me.s + Math.max(once, sd(a, me.s)), son = me.s + sd(b, me.s);
    return son - ilk > 4 ? rand(ilk, son) : null;
  }
  const yakinSerit = x => A.LANES.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  function olay(dt, raceT) {
    const me = A.me, p = me.car.root.position, aktif = A.olayAcik(raceT), reg = bolgeAdi(p);
    if (aktif && A.bolgeSirasi()) {
      const secenek = [];
      if (reg === 'AHMET KEMAL ARU SOKAĞI' && RG.iskele) { const s = me.s + rand(90, 125); if (inRange(s, Z.kuzeyA, Z.kuzeyB)) secenek.push(() => kovaDusur(s)); }
      if (reg === 'ÇAMLIK CADDESİ' && !Z.ruzgar) secenek.push(ruzgarBaslat);
      const ss = ileride(Z.simitA, Z.simitB, 330); if (ss !== null) secenek.push(() => simitYuvarla(ss));
      const su = ileride(Z.suA, Z.suB, 330); if (su !== null) secenek.push(() => suPatlat(su));
      if (secenek.length) { secenek[Math.floor(Math.random() * secenek.length)](); A.olayBasladi(); } else A.bolgeOlayiYok();
    }
    // plazalar arası rüzgâr: sokağı yandan süpürür, arabaları iter
    let hedef = 0;
    if (Z.ruzgar) {
      const r = Z.ruzgar; r.t += dt;
      hedef = sstep(0, .7, r.t) * (1 - sstep(r.T - .9, r.T, r.t));
      if (r.t >= r.T || !aktif) Z.ruzgar = null;
      else {
        const gust = hedef * r.dir * (3.4 + 1.8 * Math.sin(A.time * 2.3) + 1 * Math.sin(A.time * 5.1));
        // yalnızca rüzgârın estiği yerdekiler itilir (oyuncunun çevresi; pistin öbür ucundaki botlar değil)
        for (const o of A.racers) { if (o.remote || Math.abs(o.s - me.s) > 160) continue; const lim = o.me && !A.AUTO_ALL ? A.wallLim(o) : HW - 1.3; o.x = clamp(o.x + gust * dt * (o.me ? 1 : .5), -lim, lim); }
        if ((r.tozT -= dt) <= 0) {   // savrulan toz ve kâğıtlar: rüzgârın yönünü gösterir
          r.tozT = .04; frameAt(me.s + rand(15, 70), F1);
          const o = -r.dir * rand(14, 26), x = F1.p.x + F1.r.x * o, z = F1.p.z + F1.r.z * o, v = rand(18, 30) * hedef;
          emit(x, rand(.5, 5), z, F1.r.x * r.dir * v, rand(-.5, 1.5), F1.r.z * r.dir * v, rand(.5, 1.1), rand(.8, 1.4));
        }
      }
    }
    Z.ruzgarSes = lerp(Z.ruzgarSes, hedef, 1 - Math.exp(-dt * 3)); A.RFX.wind = Z.ruzgarSes;
  }
  function olaySifirla() { Z.ruzgar = null; Z.ruzgarSes = 0; A.RFX.wind = 0; }
  // --- Çamlık Cd.: plazaların arasından gelen sert rüzgâr (3–4 sn) ---
  function ruzgarBaslat() { Z.ruzgar = { t: 0, T: rand(3.2, 4.2), dir: Math.random() < .5 ? -1 : 1, tozT: 0 }; A.toast('PLAZA RÜZGÂRI!'); }
  // --- Ahmet Kemal Aru Sk.: B kulesindeki cam silme iskelesinden kova düşer, tek şeride iner ve orada yatar ---
  function kovaDusur(s) {
    const me = A.me, x = Math.random() < .5 ? yakinSerit(me.x) : A.LANES[Math.floor(Math.random() * 4)];
    FG.kova ??= new THREE.CylinderGeometry(KOVA_R, KOVA_R * .78, 2.1, 20);
    // yan yatan kova asfaltın üstünde durur (geniş ağzı asfalta değer; eskiden 30 cm gömülüyordu)
    const zemin = A.roadPt(s, x).y + YOL_Y, hedef = A.roadPt(s, x); hedef.y = zemin + KOVA_R;
    const from = RG.iskele.clone();
    const g = new THREE.Group(); A.scene.add(g);
    FG.sap ??= new THREE.TorusGeometry(KOVA_R * .9, .08, 6, 20, Math.PI);
    mk(g, FG.kova, M.kova); mk(g, FG.sap, M.direk, 0, 1.05, 0);
    A.kenarlik(g, 'kirmizi', .2);
    const mark = new THREE.Mesh(FXG.ring, FXM.marker.clone()); mark.position.copy(hedef); mark.position.y = zemin + .05; mark.scale.setScalar(.55); A.scene.add(mark);
    frameAt(s, F1); const yaw = Math.atan2(F1.t.x, F1.t.z);
    const T = 2.1; let t = 0, yer = 0, ucan = null; const hit = new Set(), eng = A.olayEngel(s, x, 0);
    A.toast('KOVA DÜŞÜYOR!'); A.SES.islik(T, () => g.position);
    addFx({
      update(dt) {
        t += dt;
        if (t < T) {
          const k = t / T; g.position.lerpVectors(from, hedef, k * k * (3 - 2 * k) * .25 + k * .75); g.position.y = lerp(from.y, hedef.y, k * k) + Math.sin(Math.PI * k) * 12;
          g.rotation.set(t * 5, yaw + t * 2, t * 3);
          mark.material.opacity = .35 + .45 * Math.abs(Math.sin(t * 12)); return true;
        }
        if (!yer) {
          yer = 1; g.position.copy(hedef); g.rotation.set(0, yaw, Math.PI / 2); A.scene.remove(mark); mark.material.dispose(); eng.w = 1.3;
          A.SES.tok(hedef, { f0: 210, f1: 90, sure: .2, guc: .6, parlak: 3500, gurultuG: .5 }); A.SES.sicrama(hedef);
          for (let i = 0; i < 12; i++) emit(hedef.x + rand(-2, 2), hedef.y, hedef.z + rand(-2, 2), rand(-4, 4), rand(2, 5), rand(-4, 4), rand(.8, 1.4), rand(.5, .8));
          if (me.car.root.position.distanceTo(hedef) < 50) A.sarsinti(.25);
        }
        if (!ucan) {
          yer += dt;
          hitRacers(s, x, 1.15, 1.1, r => {   // alan yatan kova kadar
            knock(r, { slow: .7, jump: 2.4, kick: rand(-.25, .25), shake: .4, msg: 'KOVA!' });
            A.SES.tok(g.position, { f0: 180, f1: 80, sure: .18, guc: .5, parlak: 3000, gurultuG: .4 });
            if (!ucan) { frameAt(s, F2); ucan = { v: F2.t.clone().multiplyScalar(r.v * .55).setY(12), t: 0 }; A.OLAY_ENGEL.delete(eng); }
          }, hit);
          if (me.s > s + 120) { this.dispose(); return false; }
        } else {
          ucan.t += dt; ucan.v.y -= 40 * dt; g.position.addScaledVector(ucan.v, dt); g.rotation.x += 7 * dt;
          if (g.position.y < zemin + KOVA_R) { g.position.y = zemin + KOVA_R; ucan.v.multiplyScalar(.5); ucan.v.y = Math.abs(ucan.v.y) * .35; }
          if (ucan.t > 2.5) { this.dispose(); return false; }
        }
        return true;
      },
      dispose() { A.scene.remove(g); A.scene.remove(mark); mark.material.dispose(); A.OLAY_ENGEL.delete(eng); },
    });
  }
  // --- Çayırçimen Sk.: simitçinin tablası devrilir; simitler kaldırımdan bariyerin üstünden sekip
  //     ilk şeride hızla, oradan ortaya yavaşça yuvarlanır (ikincisi ilk şeritte kalır) ---
  function simitYuvarla(s0) {
    const me = A.me, dir = -disari;
    const parcalar = [0, 1].map(i => {
      const s = s0 + i * rand(7, 10), o = { x: disari * (HW + 13 + i * 2), dir, v: 0, hizli: rand(12, 14), yavas: i ? 0 : 1.3 };
      const m = mk(A.scene, FG.simit, M.simit); A.kenarlik(m, 'kirmizi', .18);
      frameAt(s, F1); m.rotation.set(0, Math.atan2(F1.t.x, F1.t.z), 0);
      return { m, s, o, gec: i * .45, hit: new Set(), bitti: false, eng: A.olayEngel(s, o.x, SIMIT_R + SIMIT_T) };
    });
    let t = 0, git = false, dedi = false;
    addFx({
      update(dt) {
        t += dt;
        if (!git && s0 - me.s < 380) { git = true; frameAt(RG.arabaci, F1); A.SES.tok(F1.p, { f0: 160, f1: 70, sure: .2, guc: .4, parlak: 2000, gurultuG: .5 }); }
        for (const b of parcalar) {
          if (b.bitti) continue;
          const v = git && (b.gec -= dt) <= 0 ? A.yanAdim(b.o, dt) : 0; b.eng.x = b.o.x;
          const cit = Math.max(0, 3.4 - Math.abs(Math.abs(b.o.x) - (HW + 3.8)));   // bariyerin üstünden seker
          frameAt(b.s, F1); b.m.position.copy(F1.p).addScaledVector(F1.r, b.o.x); b.m.position.y += SIMIT_R + SIMIT_T + .2 + cit * .95;
          b.m.rotateOnWorldAxis(F1.t, -b.o.dir * v * dt / (SIMIT_R + SIMIT_T));
          // simit yalnızca yerdeyken vurur (bariyerin üstünden sekerken altından geçilir); alan simidin kalınlığı kadar
          if (git && cit < .5) hitRacers(b.s, b.o.x, SIMIT_T + .05, SIMIT_R + SIMIT_T, r => {
            b.bitti = true; A.scene.remove(b.m); A.OLAY_ENGEL.delete(b.eng); A.SES.kirilma(b.m.position, 'tahta');
            knock(r, { slow: .76, jump: 2, kick: b.o.dir * .22, shake: .3, msg: dedi ? '' : 'SİMİT!' }); dedi = true;
            A.shatter(b.m.position, F1.t.clone().multiplyScalar(r.v * .4), FG.kirinti, M.simit, 7, rand(.5, .8));
          }, b.hit);
        }
        if (t > 60 || me.s > s0 + 90) { this.dispose(); return false; }
        return true;
      },
      dispose() { parcalar.forEach(b => { A.scene.remove(b.m); A.OLAY_ENGEL.delete(b.eng); }); },
    });
  }
  // --- Talatpaşa Cd.: eski su borusu patlar; rögar kapağı fırlar, şeridin ortasından su fışkırır,
  //     geride kaygan bir su birikintisi kalır (tek şerit) ---
  function suPatlat(s) {
    const me = A.me, x = A.LANES[Math.floor(Math.random() * 4)];
    const p = A.roadPt(s, x); p.y += .22;
    // rögar kapağı patlamaya kadar yolda durmaz (etkisiz nesne olmasın): patlama anında yerinden fırlar
    const kapak = mk(A.scene, FG.kapak, M.rogar); kapak.position.copy(p); kapak.visible = false;
    const su = new THREE.Mesh(FG.su, M.su); su.position.copy(p); su.scale.set(1, .01, 1); A.scene.add(su);
    const bir = new THREE.Mesh(FG.birikinti, M.birikinti); bir.position.copy(p); bir.position.y += .03; A.scene.add(bir);
    A.kenarlik(bir, 'kirmizi', .3); bir.scale.setScalar(.01);   // kenarlık tam boyda hesaplanır, birikinti sonra büyür
    let t = 0, bekle = 0, bas = false, kv = null, sesT = 0; const hitS = new Set(), hitB = new Set(), eng = A.olayEngel(s, x, 0);   // botlar patlamadan önce görünmeyen şeyden kaçmasın
    const SURE = 6;
    addFx({
      update(dt) {
        if (!bas) {   // yaklaşmanı bekler (en fazla 60 sn; sonra olay iptal olur)
          if (s - me.s < 320) { bas = true; kapak.visible = true; eng.w = 1.8; A.SES.tok(p, { f0: 140, f1: 50, sure: .3, guc: .7, parlak: 1200, gurultuG: .6 }); A.SES.sicrama(p); kv = new THREE.Vector3(rand(-3, 3), 26, rand(-3, 3)); }
          else { bekle += dt; return bekle < 60 || (this.dispose(), false); }
        }
        t += dt;
        if (kv) { kv.y -= 40 * dt; kapak.position.addScaledVector(kv, dt); kapak.rotation.x += 9 * dt; kapak.rotation.z += 5 * dt; if (kapak.position.y < p.y && kv.y < 0) { kapak.position.y = p.y; kv = null; A.scene.remove(kapak); } }
        const k = sstep(0, .35, t) * (1 - sstep(SURE - .8, SURE, t));
        su.scale.set(1 + .15 * Math.sin(t * 23), Math.max(.01, k * (15 + 2 * Math.sin(t * 9))), 1 + .15 * Math.cos(t * 19));
        bir.scale.setScalar(Math.max(.01, sstep(0, 1.2, t)));
        if (k > .05 && (sesT -= dt) <= 0) { sesT = .9; A.SES.sicrama(p); }
        if (k > .05) for (let i = 0; i < 2; i++) emit(p.x + rand(-.6, .6), p.y + su.scale.y, p.z + rand(-.6, .6), rand(-4, 4), rand(1, 4), rand(-4, 4), rand(.6, 1.1), rand(.5, .9));
        // su sütunu: görünür yükseklikteyken (≥ ~1 m) vurur; başta ve sonda görünüp vurmayan an kalmasın
        if (k > .07) hitRacers(s, x, 1.1, 1.1, r => knock(r, { slow: .66, jump: 4.5, kick: rand(-.25, .25), shake: .5, msg: 'SU BORUSU PATLADI!' }), hitS, 3);
        // birikinti: etki alanı görünen daireyle birlikte büyür (arabanın gövdesi daireye değince kayar)
        const rb = 1.8 * bir.scale.x;
        if (rb > .4) for (const r of A.racers) {
          if (r.remote || hitB.has(r) || r.y > .3) continue;
          const ex = Math.max(0, Math.abs(r.x - x) - r.car.hw), es = Math.max(0, Math.abs(r.s - s) - r.car.hl);
          if (ex * ex + es * es > rb * rb) continue;
          hitB.add(r); if (hitS.has(r) || A.kalkanKullan(r)) continue;
          r.slipT = Math.max(r.slipT, 1.1); r.slipDir = Math.random() < .5 ? -1 : 1; r.v *= .92; if (r.me) A.toast('ISLAK ZEMİN!');
        }
        if (me.s > s + 120 || t > 40) { this.dispose(); return false; }
        return true;
      },
      dispose() { A.scene.remove(kapak); A.scene.remove(su); A.scene.remove(bir); A.OLAY_ENGEL.delete(eng); },
    });
  }

  if (A.DBG.has('debug')) window.__levent = { kova: () => kovaDusur(A.me.s + 110), ruzgar: ruzgarBaslat, simit: () => simitYuvarla(A.me.s + 200), su: () => suPatlat(A.me.s + 200), Z, A, M };
  // start ışıkları geri sayımla yanar; gökyüzü kameraya eşlik eder
  function kare(time) {
    if (RG.gok) RG.gok.position.copy(A.camera.position);
    const T_GO = 2.2, n = time < T_GO ? Math.min(5, Math.floor(time / (T_GO / 5.5))) : 0, yesil = time >= T_GO && time < T_GO + 2.5;
    RG.isiklar.forEach((m, i) => {
      const yan = yesil || i < n; m.emissiveIntensity = yan ? 3 : 0;
      m.emissive.setHex(yesil ? 0x30ff60 : 0xff2a1a); m.color.setHex(yan ? (yesil ? 0x2a6a32 : 0x6a1a1a) : 0x2a1a1a);
    });
  }

  return {
    id: 'levent', ad: 'LEVENT PLAZALAR', baslik: 'Levent Plazalar', ctrl: CTRL, start: START, seed: 4108,
    kur, bolgeler, olay, olaySifirla, kare, virajFren: true,
    get yasak() { return Z.koseler; },
    isik: { gok: 0xd8e6fa, yer: 0x8a8378, gokG: 1.0, gunes: 0xfff1dc, gunesG: 2.9, gunesYon: [-.5, .65, .55], isikYon: [-.5, .72, .48],
      sis: 0xcfdbe6, sisYakin: 520, sisUzak: 3400, pozlama: 1.03, arka: null, ton: [.8, .82, .88], golge: [.01, .015, .03], gunesParlama: false,
      golgeKutu: 150, golgeUzak: 900 },
    get engel() { return { boxes: M.koli, oil: M.mazot, ramp: M.rampa, kenar: mat('#3b3d42'), adKutu: 'KOLİLER!', adYag: 'MAZOT! kayıyorsun', adRampa: 'RAMPA! +HIZ', renkYag: '#15161a' }; },
  };
}

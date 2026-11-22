// DEV MUTFAK teması — araçlar 3 cm'lik oyuncak arabalar; pist gerçek ölçülü bir mutfağın yerinde.
// Ölçek: 1 cm = 1,5 birim (araç 4,4 birim ≈ 3 cm). Pist yere yapıştırılmış bantlarla çizilmiş,
// kenarlarında mandallarla tutturulmuş karton şeritler var.
// Bölgeler: Dolap Dibi → Ocak Başı → Buzdolabı → Karton Boru → Yemek Masası → Kedi Köşesi
// Bu dosya oyunun ortak araçlarını index.html'deki API nesnesinden alır.
export function tema(A) {
  const { THREE, mk, mat, box, cyl, sph, canvasTex, rrect, frameAt, F1, F2, ribbon, pedKur, PED_YERI,
    inRange, sd, clamp, lerp, sstep, rand, srand, HW, W, UP, emit, knock, hitRacers, addFx,
    setLights, FXG, FXM, dummy, mergeGeometries } = A;
  const K = 1.5, c = v => v * K;
  // alt yüzü y0'da duran kutu (ölçüler cm)
  const kutu = (p, w, h, d, m, x, y0, z, o = {}) => mk(p, box(c(w), c(h), c(d)), m, c(x), c(y0 + h / 2), c(z), o);

  /* ---------- PİST (cm: x doğu, z güney; üçüncü değer yükseklik, birim) ----------
     Batı dolaplarının önünden kuzeye → kuzey tezgâhı boyunca doğuya (ocak, buzdolabı) →
     doğuda karton borunun içinden güneye → yemek masasının altından batıya → kedi köşesi → başa */
  const YOL = [
    [90, 520], [90, 380], [90, 240], [96, 150], [130, 100], [200, 88], [330, 88], [460, 88], [560, 95],
    [630, 118], [720, 135], [800, 141], [855, 153], [890, 182], [900, 230], [900, 300], [900, 370],
    [897, 425], [872, 468], [815, 487, .15], [740, 486, .38], [640, 485, .38], [545, 486, .38], [475, 500, .15],
    [400, 540], [330, 597], [260, 638], [180, 650], [120, 630], [92, 590]];
  const CTRL = YOL.map(([x, z, y = 0]) => [c(x), y, c(z)]);
  const BORU_R = 15, BORU_DIS = 16.2, BORU_Y = BORU_DIS;   // karton borunun iç/dış yarıçapı (birim), yerde yatıyor
  const boru = { a: 0, b: 0 }, masa = { a: 0, b: 0 };
  let buzA = 0, buzB = 0, kediA = 0, kediB = 0;   // buzdolabı önü ve kedi köşesi (yandan gelenlerin yeri)

  /* ---------- dokular ---------- */
  // terakota fayans (el yapımı görünüm: her karo biraz farklı ton, kenarları hafif koyu), açık krem derz
  const tileTex = canvasTex(512, 512, (g, w, h) => {
    const n = 2, s = w / n;
    g.fillStyle = '#d9c7aa'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = srand() * 26 - 13, x0 = i * s + 6, y0 = j * s + 6, ss = s - 12;
      g.fillStyle = `rgb(${176 + v},${96 + v * .6},${62 + v * .4})`; g.fillRect(x0, y0, ss, ss);
      for (let k = 0; k < 1800; k++) { const r = 1 + srand() * 6; g.fillStyle = `rgba(${srand() < .5 ? '90,40,20' : '230,170,120'},${srand() * .08})`; g.fillRect(x0 + srand() * ss, y0 + srand() * ss, r, r); }
      const gr = g.createRadialGradient(x0 + ss / 2, y0 + ss / 2, ss * .2, x0 + ss / 2, y0 + ss / 2, ss * .75); gr.addColorStop(0, 'rgba(255,200,150,.07)'); gr.addColorStop(1, 'rgba(60,20,5,.28)');
      g.fillStyle = gr; g.fillRect(x0, y0, ss, ss);
    }
    g.fillStyle = 'rgba(120,100,80,.25)'; for (let i = 0; i <= n; i++) { g.fillRect(i * s - 1, 0, 2, h); g.fillRect(0, i * s - 1, w, 2); }
  }, true);  tileTex.repeat.set(1100 / 60, 850 / 60);
  // yola yapıştırılmış bantlar: ortada mavi boya bandı, şerit aralarında kâğıt bant (kesikli)
  const bantTex = canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const serit = (u, gen, renk) => {
      const x = u * w - gen / 2, y1 = h * .56;
      g.fillStyle = renk; g.beginPath(); g.moveTo(x, 2); g.lineTo(x + gen, 0); g.lineTo(x + gen, y1); g.lineTo(x + gen * .6, y1 + 3); g.lineTo(x + gen * .3, y1 - 2); g.lineTo(x, y1 + 2); g.closePath(); g.fill();
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${srand() * .07})`; g.fillRect(x + srand() * gen, srand() * y1, 1, 2 + srand() * 8); }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 1, 0, 2, y1);
    };
    serit(.5, 16, '#3c7fd4');
    serit((-3.9 + 8) / 16, 10, '#eee6d4'); serit((3.9 + 8) / 16, 10, '#eee6d4');
  }, true);
  const kerbTex = canvasTex(32, 128, (g, w, h) => {
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f1ebdf' : '#d4362f'; g.fillRect(0, i * h / 4, w, h / 4); }
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${srand() * .06})`; g.fillRect(srand() * w, srand() * h, 1, 3); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
  }, true);
  // oluklu karton (bariyer şeridi): u = şeridin yüksekliği, v = pist boyunca
  const kartonTex = canvasTex(64, 512, (g, w, h) => {
    g.fillStyle = '#c39a66'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5) { g.fillStyle = 'rgba(90,55,25,.07)'; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(80,50,20,${srand() * .08})`; g.fillRect(srand() * w, srand() * h, 2 + srand() * 4, 1); }
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(60,35,15,.25)'); gr.addColorStop(.25, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w * .55, h * .3); g.rotate(Math.PI / 2); g.fillStyle = 'rgba(170,40,35,.75)'; g.font = 'bold 15px sans-serif'; g.fillText('DİKKAT · KIRILIR', 0, 0); g.restore();
    g.save(); g.translate(w * .55, h * .8); g.rotate(Math.PI / 2); g.fillStyle = 'rgba(40,30,25,.6)'; g.font = 'bold 18px sans-serif'; g.fillText('↑ ↑  BU TARAF ÜST', 0, 0); g.restore();
  }, true);
  const ahsapTex = (a, b) => canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = srand() * w, k = srand(); g.strokeStyle = k < .5 ? `rgba(70,35,15,${.06 + srand() * .1})` : `rgba(255,220,170,${srand() * .08})`; g.lineWidth = 1 + srand() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * .02 + i) * 6, y); g.stroke(); }
    g.fillStyle = b; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(srand() * w, srand() * h, 3 + srand() * 5, 10 + srand() * 18, 0, 0, 7); g.fill(); }
  }, true);
  const masaTex = ahsapTex('#a8703f', 'rgba(70,35,15,.25)'), sandTex = ahsapTex('#8a5a33', 'rgba(50,25,10,.3)');
  // dolap kapağı (çerçeveli panel) ve çekmece yüzü
  const panelTex = (w0, h0) => canvasTex(w0, h0, (g, w, h) => {
    g.fillStyle = '#7d9483'; g.fillRect(0, 0, w, h);
    const f = Math.min(w, h) * .13;
    g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 3, w, 3); g.fillRect(w - 3, 0, 3, h);
    g.fillStyle = '#738a79'; g.fillRect(f, f, w - 2 * f, h - 2 * f);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(f, f, w - 2 * f, 3); g.fillRect(f, f, 3, h - 2 * f);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(f, h - f - 3, w - 2 * f, 3); g.fillRect(w - f - 3, f, 3, h - 2 * f);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${srand() * .03})`; g.fillRect(srand() * w, srand() * h, 2, 2); }
  });
  const kapakTex = panelTex(256, 320), cekmeceTex = panelTex(256, 96);
  const fayansTex = canvasTex(256, 256, (g, w, h) => {   // tezgâh arası beyaz metro fayansı
    g.fillStyle = '#cfcac2'; g.fillRect(0, 0, w, h);
    const bw = 128, bh = 42;
    for (let r = 0; r * bh < h; r++) for (let k = -1; k * bw < w; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0), y = r * bh, v = srand() * 8;
      const gr = g.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, `rgb(${250 - v},${248 - v},${243 - v})`); gr.addColorStop(1, `rgb(${232 - v},${229 - v},${222 - v})`);
      g.fillStyle = gr; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
  }, true);
  const tasTex = canvasTex(256, 256, (g, w, h) => {   // açık renk kuvars tezgâh
    g.fillStyle = '#e3ded6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = srand(); g.fillStyle = v < .5 ? `rgba(120,110,100,${srand() * .25})` : `rgba(255,255,255,${srand() * .4})`; g.fillRect(srand() * w, srand() * h, 1 + srand() * 2, 1 + srand() * 2); }
  }, true);
  const celikTex = canvasTex(64, 256, (g, w, h) => {   // fırçalanmış çelik
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${srand() < .5 ? '255,255,255' : '40,45,50'},${srand() * .1})`; g.fillRect(0, y, w, 1); }
  }, true);
  const firinCamTex = canvasTex(256, 192, (g, w, h) => {   // fırın kapağı: siyah cam, içte turuncu ışık ve tel ızgara
    g.fillStyle = '#0d0c0e'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h * .62, 10, w / 2, h * .6, w * .55); gr.addColorStop(0, 'rgba(255,150,50,.95)'); gr.addColorStop(.6, 'rgba(200,70,20,.55)'); gr.addColorStop(1, 'rgba(40,10,0,0)');
    g.fillStyle = gr; rrect(g, 26, 34, w - 52, h - 62, 10); g.fill();
    g.strokeStyle = 'rgba(40,20,10,.8)'; g.lineWidth = 3; for (let x = 40; x < w - 30; x += 14) { g.beginPath(); g.moveTo(x, h * .55); g.lineTo(x, h * .72); g.stroke(); }
    g.fillStyle = 'rgba(70,35,20,.9)'; rrect(g, w * .3, h * .5, w * .4, h * .08, 6); g.fill();   // tepside kurabiyeler
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * .45, 0); g.lineTo(0, h * .5); g.fill();
  });
  const cizimTex = canvasTex(256, 320, (g, w, h) => {   // buzdolabındaki çocuk çizimi
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h);
    g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#f2b416'; g.beginPath(); g.arc(200, 60, 28, 0, 7); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * .785; g.beginPath(); g.moveTo(200 + Math.cos(a) * 38, 60 + Math.sin(a) * 38); g.lineTo(200 + Math.cos(a) * 52, 60 + Math.sin(a) * 52); g.stroke(); }
    g.strokeStyle = '#d6453a'; g.strokeRect(50, 160, 110, 90); g.beginPath(); g.moveTo(40, 165); g.lineTo(105, 105); g.lineTo(170, 165); g.stroke();
    g.strokeStyle = '#3a7bd5'; g.strokeRect(90, 200, 30, 50);
    g.strokeStyle = '#3c9a4a'; g.beginPath(); g.moveTo(0, 270); for (let x = 0; x <= w; x += 20) g.lineTo(x, 268 + Math.sin(x) * 6); g.stroke();
    g.fillStyle = '#7a3fbf'; g.font = 'bold 30px "Comic Sans MS", cursive'; g.fillText('EVİMİZ', 70, 305);
  });
  const kilimTex = canvasTex(512, 340, (g, w, h) => {   // yemek masasının altındaki kilim
    g.fillStyle = '#9c2f24'; g.fillRect(0, 0, w, h);
    const renk = ['#e7c98a', '#1f3b5c', '#d9822b', '#f3ead8', '#5b1d18'];
    g.fillStyle = renk[1]; g.fillRect(14, 14, w - 28, h - 28); g.fillStyle = '#9c2f24'; g.fillRect(34, 34, w - 68, h - 68);
    for (let x = 40; x < w - 40; x += 24) { g.fillStyle = renk[(x / 24 | 0) % 2 ? 0 : 2]; g.beginPath(); g.moveTo(x, 18); g.lineTo(x + 12, 30); g.lineTo(x, 42); g.lineTo(x - 12, 30); g.fill(); g.beginPath(); g.moveTo(x, h - 18); g.lineTo(x + 12, h - 30); g.lineTo(x, h - 42); g.lineTo(x - 12, h - 30); g.fill(); }
    for (let i = 0; i < 3; i++) {
      const cx = w * (.25 + i * .25), cy = h / 2;
      for (let k = 4; k > 0; k--) { g.fillStyle = renk[k % renk.length]; g.beginPath(); g.moveTo(cx, cy - k * 26); g.lineTo(cx + k * 20, cy); g.lineTo(cx, cy + k * 26); g.lineTo(cx - k * 20, cy); g.fill(); }
    }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${srand() < .5 ? '0,0,0' : '255,240,220'},${srand() * .08})`; g.fillRect(srand() * w, srand() * h, 1 + srand() * 2, 1); }
  });
  const pencereTex = canvasTex(256, 256, (g, w, h) => {   // pencereden görünen bahçe
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe0ff'); gr.addColorStop(.6, '#fff3dc'); gr.addColorStop(1, '#f6e2bf'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(110,150,90,.55)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(srand() * w, h * .75 + srand() * 40, 20 + srand() * 30, 0, 7); g.fill(); }
  });
  // güneşin pencereden yere düşen izi (dört cam, ortada kayıt)
  const isikTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.filter = 'blur(6px)'; g.fillStyle = '#fff';
    const m = 14, p = 10;
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.fillRect(p + x * (w / 2) + (x ? m / 2 : 0), p + y * (h / 2) + (y ? m / 2 : 0), w / 2 - p - m / 2, h / 2 - p - m / 2);
    g.filter = 'none';
  });
  const sekerTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${srand() < .5 ? '150,150,160' : '255,255,255'},${srand() * .5})`; g.fillRect(srand() * w, srand() * h, 1 + srand() * 2, 1 + srand() * 2); }
  });
  const cetvelTex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#d9b07a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a2a1c'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, (y % 40 === 0 ? 22 : 12), 2);
  }, true);
  const yunTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c23a4a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${srand() < .5 ? '90,10,25' : '255,170,180'},${.25 + srand() * .3})`; g.lineWidth = 2; g.beginPath(); const y = srand() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rand(-30, 30), w * .7, y + rand(-30, 30), w, y + rand(-10, 10)); g.stroke(); }
  });
  const sosisTex = canvasTex(128, 32, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a3a1f'); gr.addColorStop(.5, '#c2683a'); gr.addColorStop(1, '#7a3018'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,15,5,.6)'; g.lineWidth = 3; for (let x = 20; x < w; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 10, h); g.stroke(); }
  }, true);
  const kutuTex = (zemin, yazi, alt, renk) => canvasTex(128, 256, (g, w, h) => {   // başlangıç kemerinin süt/meyve suyu kutuları
    g.fillStyle = zemin; g.fillRect(0, 0, w, h);
    g.fillStyle = renk; g.beginPath(); g.arc(w / 2, h * .55, 34, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 30px "Russo One", sans-serif'; g.textAlign = 'center'; g.fillText(yazi, w / 2, h * .25);
    g.font = '15px sans-serif'; g.fillText(alt, w / 2, h * .85);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 4, h);
  });
  const bayrakTex = canvasTex(512, 96, (g, w, h) => {
    const s = 24; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = ((x + y) / s) % 2 ? '#17151c' : '#f6f3ec'; g.fillRect(x, y, s, s); }
    g.fillStyle = '#fbf6ea'; rrect(g, w / 2 - 170, 12, 340, h - 24, 10); g.fill();
    g.fillStyle = '#d23b33'; g.font = 'bold 44px "Comic Sans MS", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DEV MUTFAK GP', w / 2, h / 2 + 2);
  });
  const okTex = canvasTex(128, 96, (g, w, h) => {   // virajlarda çocuğun keçeli kalemle çizdiği ok
    g.fillStyle = '#fbf9f3'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d23b33'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(22, h / 2); g.lineTo(100, h / 2); g.moveTo(70, 22); g.lineTo(104, h / 2); g.lineTo(70, h - 22); g.stroke();
  });
  const kediTex = canvasTex(256, 128, (g, w, h) => {   // tekir kedi tüyü
    g.fillStyle = '#e39a4b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,70,20,.6)'; g.lineWidth = 9; for (let x = 10; x < w; x += 26) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 10, h / 2, x - 4, h); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,230,190,${srand() * .1})`; g.fillRect(srand() * w, srand() * h, 1, 3); }
  }, true);

  /* ---------- malzemeler ---------- */
  let ENV = null;
  const M = {};
  function malzemeler() {
    const S = (o) => new THREE.MeshStandardMaterial(o);
    M.zemin = S({ map: tileTex, roughness: .7, envMap: ENV, envMapIntensity: .15 });   // yere çok alçaktan bakıldığı için az yansıtır (yoksa beyaza boğulur)
    M.bant = S({ map: bantTex, alphaTest: .5, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.kerb = S({ map: kerbTex, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.karton = S({ map: kartonTex, roughness: .92, side: THREE.DoubleSide });
    M.kartonUst = mat('#b48852', { roughness: .95 });
    M.duvar = mat('#efe6da', { roughness: .95 });
    M.tavan = mat('#f6f2ec', { roughness: 1 });
    M.supurgelik = mat('#f4f1ea', { roughness: .6 });
    M.govde = mat('#6f8575', { roughness: .7 });
    M.kapak = S({ map: kapakTex, roughness: .55 });
    M.cekmece = S({ map: cekmeceTex, roughness: .55 });
    M.supurgelikDolap = mat('#2a2826', { roughness: .9 });
    M.tezgah = S({ map: tasTex, roughness: .28, envMap: ENV, envMapIntensity: .6 });
    M.fayans = S({ map: fayansTex, roughness: .2, envMap: ENV, envMapIntensity: .5 });
    M.pirinc = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: .85, roughness: .3, envMap: ENV });
    M.celik = new THREE.MeshStandardMaterial({ map: celikTex, color: 0xffffff, metalness: .8, roughness: .34, envMap: ENV });
    M.celikKoyu = new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: .7, roughness: .4, envMap: ENV });
    M.siyahCam = new THREE.MeshStandardMaterial({ color: 0x111113, metalness: .3, roughness: .08, envMap: ENV });
    M.firinCam = new THREE.MeshStandardMaterial({ map: firinCamTex, emissive: 0xffffff, emissiveMap: firinCamTex, emissiveIntensity: .9, roughness: .1, envMap: ENV });
    M.buzIc = new THREE.MeshStandardMaterial({ color: 0xeef8ff, emissive: 0xdff2ff, emissiveIntensity: 1.1 });
    M.plastikBeyaz = mat('#f2f0ea', { roughness: .45 });
    M.masa = S({ map: masaTex, roughness: .5, envMap: ENV, envMapIntensity: .35 });
    M.sandalye = S({ map: sandTex, roughness: .55 });
    M.kilim = S({ map: kilimTex, roughness: 1 });
    M.pencere = new THREE.MeshBasicMaterial({ map: pencereTex, toneMapped: false });
    M.cerceve = mat('#f7f5f0', { roughness: .5 });
    M.perde = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: .95, side: THREE.DoubleSide, emissive: 0x3a3226 });
    M.isik = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: isikTex, color: 0xffd9a6, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
    M.golge = new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    M.sosis = S({ map: sosisTex, roughness: .38, envMap: ENV, envMapIntensity: .4 });
    M.tava = new THREE.MeshStandardMaterial({ color: 0x2b2a2d, metalness: .5, roughness: .35, envMap: ENV });
    M.seramik = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: .15, envMap: ENV, envMapIntensity: .6 });
    M.yun = S({ map: yunTex, roughness: 1 });
    M.kedi = S({ map: kediTex, roughness: .95 });
    M.borudis = S({ map: boruTex(false), roughness: .9 });
    M.boruic = S({ map: boruTex(true), roughness: .95, side: THREE.BackSide });
    M.boruKenar = mat('#d9b27c', { roughness: .95, side: THREE.DoubleSide });
    M.cizim = S({ map: cizimTex, roughness: .8 });
    M.buz = new THREE.MeshStandardMaterial({ color: 0xd9f1ff, roughness: .06, metalness: .1, transparent: true, opacity: .72, envMap: ENV, envMapIntensity: 1.4 });
    M.kofte = mat('#6b3a22', { roughness: .85, flatShading: true });
    M.ok = S({ map: okTex, roughness: .8, side: THREE.DoubleSide });
    M.bayrak = S({ map: bayrakTex, roughness: .8, side: THREE.DoubleSide });
    M.cetvel = S({ map: cetvelTex, roughness: .6 });
    M.seker = S({ map: sekerTex, roughness: .75 });
    M.sut = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f1, roughness: .12, clearcoat: 1, clearcoatRoughness: .05, envMap: ENV, transparent: true, opacity: .97 });
  }
  function boruTex(ic) {   // sarmal dikişli karton boru
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = ic ? '#b08458' : '#b8875a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${srand() < .5 ? '70,40,15' : '255,225,180'},${srand() * .07})`; g.fillRect(srand() * w, srand() * h, 3 + srand() * 6, 1); }
      g.strokeStyle = ic ? 'rgba(50,28,10,.45)' : 'rgba(80,48,20,.5)'; g.lineWidth = 3;
      for (let k = -2; k < 3; k++) { g.beginPath(); g.moveTo(0, k * h / 2); g.lineTo(w, k * h / 2 + h / 2); g.stroke(); }
      g.strokeStyle = 'rgba(255,230,190,.18)'; g.lineWidth = 2;
      for (let k = -2; k < 3; k++) { g.beginPath(); g.moveTo(0, k * h / 2 + 4); g.lineTo(w, k * h / 2 + h / 2 + 4); g.stroke(); }
    }, true);
    return t;
  }
  // iç mekân yansıması: oda kutusu + parlak pencere
  function ortamKur() {
    const pm = new THREE.PMREMGenerator(A.renderer), es = new THREE.Scene();
    const yuz = ['#fff0dc', '#e9dccb', '#fbf7f1', '#b9a088', '#e8dccb', '#d7c7b3'].map(x => new THREE.MeshBasicMaterial({ color: x, side: THREE.BackSide }));
    es.add(new THREE.Mesh(new THREE.BoxGeometry(100, 40, 80), yuz));
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4), side: THREE.DoubleSide }));
    pen.position.set(49.5, 4, 0); pen.rotation.y = -Math.PI / 2; es.add(pen);
    const tex = pm.fromScene(es, .03, 1, 300).texture; pm.dispose();
    return tex;
  }

  /* =========================================================
     DÜNYA
     ========================================================= */
  const RG = { tava: null, kapi: null };   // olayların kullandığı dekor noktaları
  function kur(D) {
    ENV = ortamKur(); malzemeler();
    boru.a = A.sAt(c(900), c(238)); boru.b = A.sAt(c(900), c(364));
    masa.a = A.sAt(c(712), c(486)); masa.b = A.sAt(c(568), c(486));   // köfte yalnızca masanın üstünden düşer
    buzA = A.sAt(c(580), c(100)); buzB = A.sAt(c(740), c(138));
    kediA = A.sAt(c(330), c(597)); kediB = A.sAt(c(130), c(645));
    const L = A.L, START_S = A.START_S;
    const disBoru = (a, b) => [boru.b + 4, boru.a - 4];

    /* zemin, duvarlar, tavan */
    mk(D, new THREE.PlaneGeometry(c(1100), c(850)).rotateX(-Math.PI / 2), M.zemin, c(500), 0, c(375), { cast: false, recv: true });
    const H = 260;
    kutu(D, 1020, H, 10, M.duvar, 500, 0, -5, { cast: false, recv: true });                // kuzey
    kutu(D, 10, H, 760, M.duvar, -5, 0, 375, { cast: false, recv: true });                 // batı
    kutu(D, 400, H, 10, M.duvar, 200, 0, 755, { cast: false, recv: true });                // güney (kapının iki yanı)
    kutu(D, 510, H, 10, M.duvar, 745, 0, 755, { cast: false, recv: true });
    kutu(D, 90, 55, 10, M.duvar, 445, 205, 755, { cast: false });
    // doğu duvarı pencere boşluğuyla
    kutu(D, 10, H, 200, M.duvar, 1005, 0, 100, { cast: false, recv: true });
    kutu(D, 10, H, 300, M.duvar, 1005, 0, 600, { cast: false, recv: true });
    kutu(D, 10, 95, 250, M.duvar, 1005, 0, 325, { cast: false, recv: true });
    kutu(D, 10, 40, 250, M.duvar, 1005, 220, 325, { cast: false });
    mk(D, new THREE.PlaneGeometry(c(1020), c(770)).rotateX(Math.PI / 2), M.tavan, c(500), c(H), c(375), { cast: false });
    // süpürgelikler
    for (const [w, d, x, z] of [[310, 1.5, 845, .75], [1.5, 330, .75, 585], [400, 1.5, 200, 749.2], [510, 1.5, 745, 749.2], [1.5, 200, 999.2, 100], [1.5, 300, 999.2, 600], [1.5, 250, 999.2, 325]])
      kutu(D, w, 8, d, M.supurgelik, x, 0, z, { cast: false });
    // kapı (güney)
    kutu(D, 90, 205, 4, mat('#c9a57c', { roughness: .6 }), 445, 0, 752);
    kutu(D, 6, 210, 2, M.cerceve, 397, 0, 749); kutu(D, 6, 210, 2, M.cerceve, 493, 0, 749); kutu(D, 102, 6, 2, M.cerceve, 445, 205, 749);
    mk(D, sph(c(2.2), 14, 10), M.pirinc, c(482), c(100), c(748));

    /* --- tezgâh dolapları (kuzey ve batı, L biçiminde) --- */
    const kuzey = new THREE.Group(); D.add(kuzey);
    dolapSirasi(kuzey, 600, [[0, 60, 'kapak'], [60, 120, 'cekmece'], [120, 200, 'cift'], [200, 260, 'bulasik'], [260, 320, 'firin'], [320, 380, 'cekmece'], [380, 453, 'kapak'], [453, 526, 'kapak'], [526, 600, 'kapak']], true);
    const bati = new THREE.Group(); bati.position.set(0, 0, c(420)); bati.rotation.y = Math.PI / 2; D.add(bati);
    dolapSirasi(bati, 360, [[0, 60, 'kapak'], [60, 120, 'cekmece'], [120, 240, 'cift'], [240, 300, 'kapak'], [300, 360, 'cekmece']], false);
    // dolap altlarında temas gölgesi
    golgeSerit(D, 0, 600, 60, 'x'); golgeSerit(D, 60, 420, 60, 'z');

    /* --- buzdolabı (x 610–690), kapısı hafif aralık --- */
    {
      const g = new THREE.Group(); g.position.set(c(610), 0, 0); D.add(g);
      kutu(g, 80, 185, 64, M.celik, 40, 0, 32, { recv: true });
      kutu(g, 74, 118, 3, M.buzIc, 40, 64, 64.5, { cast: false });                       // içerisi (aralıktan görünür)
      for (const y of [85, 115, 145]) kutu(g, 72, 1, 4, mat('#d8eefa', { roughness: .1, transparent: true, opacity: .7 }), 40, y, 63, { cast: false });
      kutu(g, 80, 58, 6, M.celik, 40, 2, 67);                                             // alttaki dondurucu çekmecesi
      kutu(g, 50, 2.5, 3, M.celikKoyu, 40, 52, 71.5);                                     // çekmece kolu
      kutu(g, 76, 2, 2, M.celikKoyu, 40, 0, 69, { cast: false });                         // havalandırma ızgarası
      const kapi = new THREE.Group(); kapi.position.set(c(80), 0, c(64)); kapi.rotation.y = .3; g.add(kapi); RG.kapi = kapi;
      kutu(kapi, 80, 120, 6, M.celik, -40, 62, 3);
      kutu(kapi, 3, 60, 4, M.celikKoyu, -74, 110, 8);                                     // kol
      mk(kapi, new THREE.PlaneGeometry(c(26), c(32)), M.cizim, c(-38), c(128), c(6.1), { cast: false, r: [0, 0, .06] });
      for (const [x, y, r] of [[-38, 146, '#e0453a'], [-58, 150, '#3a7bd5'], [-22, 112, '#45b36b'], [-60, 96, '#f2c230']]) mk(kapi, cyl(c(2.2), c(2.2), c(1), 14), mat(r, { roughness: .4 }), c(x), c(y), c(6.6), { r: [Math.PI / 2, 0, 0], cast: false });
      kutu(kapi, 74, 3, 8, M.plastikBeyaz, -40, 70, -2, { cast: false });                 // kapı içi raf
      kutu(kapi, 74, 3, 8, M.plastikBeyaz, -40, 110, -2, { cast: false });
      golge(D, c(650), c(82), c(60), c(30), .5);
    }
    // çöp kovası ve saksı
    mk(D, cyl(c(15), c(14), c(45), 28), M.celik, c(760), c(22.5), c(30), { recv: true });
    mk(D, cyl(c(15.2), c(15.2), c(3), 28), M.celikKoyu, c(760), c(46), c(30));
    golge(D, c(760), c(30), c(24), c(24), .45);

    /* --- pencere, perde, radyatör, bitki --- */
    {
      const pz = 325, y0 = 95, y1 = 220;
      mk(D, new THREE.PlaneGeometry(c(250), c(y1 - y0)), M.pencere, c(1008), c(y0 + (y1 - y0) / 2), c(pz), { r: [0, -Math.PI / 2, 0], cast: false });
      kutu(D, 6, 6, 252, M.cerceve, 1000, y0 - 3, pz); kutu(D, 6, 6, 252, M.cerceve, 1000, y1 - 3, pz);
      kutu(D, 6, y1 - y0, 6, M.cerceve, 1000, y0, pz - 123); kutu(D, 6, y1 - y0, 6, M.cerceve, 1000, y0, pz + 123); kutu(D, 5, y1 - y0, 5, M.cerceve, 1000, y0, pz);
      kutu(D, 5, 5, 250, M.cerceve, 1000, (y0 + y1) / 2, pz);
      kutu(D, 16, 3, 262, M.cerceve, 994, y0 - 3, pz);                                    // denizlik
      mk(D, cyl(c(1), c(1), c(330), 8), M.pirinc, c(990), c(235), c(pz), { r: [Math.PI / 2, 0, 0] });
      for (const zc of [pz - 150, pz + 150]) perde(D, c(988), c(zc));
      // radyatör
      const rad = new THREE.Group(); rad.position.set(c(990), c(14), c(pz)); D.add(rad);
      for (let i = -9; i <= 9; i++) mk(rad, box(c(7), c(60), c(5)), M.plastikBeyaz, 0, c(30), c(i * 8.4), { recv: true });
      // saksı (denizlikte)
      mk(D, cyl(c(9), c(7), c(14), 20), mat('#c86a3e', { roughness: .8 }), c(992), c(y0 + 7), c(pz + 80));
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; mk(D, sph(c(5), 10, 8), mat('#4f8a3c', { roughness: .8 }), c(992 + Math.cos(a) * 5), c(y0 + 22 + (i % 2) * 6), c(pz + 80 + Math.sin(a) * 6), { s: [.6, 1.4, 1] }); }
    }
    // pencereden yere düşen güneş: cam köşeleri ışık yönünde zemine izdüşürülür
    {
      const LD = new THREE.Vector3(.72, .62, .3).normalize();
      const proj = (y, z) => [c(1000) - c(y) * LD.x / LD.y, .08, c(z) - c(y) * LD.z / LD.y];
      const p = [proj(220, 200), proj(220, 450), proj(95, 200), proj(95, 450)];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.flat(), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      const m = new THREE.Mesh(g, M.isik); m.renderOrder = 3; m.userData.noMerge = true; D.add(m);
    }

    /* --- yemek masası, sandalyeler, kilim --- */
    {
      const mx = 640, mz = 485;
      mk(D, new THREE.PlaneGeometry(c(300), c(200)).rotateX(-Math.PI / 2), M.kilim, c(mx), .36, c(mz), { cast: false, recv: true });
      mk(D, new THREE.BoxGeometry(c(300), .3, c(200)), mat('#7c261d', { roughness: 1 }), c(mx), .15, c(mz), { cast: false, recv: true });   // kalınlık (üstü desenin altında kalır)
      // püsküller
      const pg = cyl(.18, .18, c(4), 4), pm = mat('#efe5cf', { roughness: 1 });
      for (const sx of [-1, 1]) for (let z = -95; z <= 95; z += 4) mk(D, pg, pm, c(mx + sx * 152), .2, c(mz + z), { r: [0, 0, Math.PI / 2], cast: false });
      // masa
      kutu(D, 180, 4, 90, M.masa, mx, 71, mz, { recv: true });
      kutu(D, 166, 8, 3, M.masa, mx, 63, mz - 40); kutu(D, 166, 8, 3, M.masa, mx, 63, mz + 40);
      kutu(D, 3, 8, 76, M.masa, mx - 82, 63, mz); kutu(D, 3, 8, 76, M.masa, mx + 82, 63, mz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mk(D, cyl(c(2.6), c(3.2), c(71), 6), M.masa, c(mx + sx * 84), c(35.5), c(mz + sz * 39), { recv: true });
      golge(D, c(mx), c(mz), c(120), c(70), .38);
      // masadaki eşyalar (uzaktan görünür)
      for (const [x, z] of [[600, 455], [690, 515], [560, 510]]) { mk(D, cyl(c(12), c(8), c(2), 28), M.seramik, c(x), c(76), c(z)); }
      for (let i = 0; i < 5; i++) mk(D, sph(c(2.2), 12, 9), M.kofte, c(600 + rand(-5, 5)), c(78.5), c(455 + rand(-5, 5)));
      mk(D, cyl(c(3.5), c(3), c(12), 20), new THREE.MeshStandardMaterial({ color: 0xdff1ff, roughness: .05, transparent: true, opacity: .45, envMap: ENV }), c(675), c(81), c(470));
      peceteKur(D, c(735), c(71 + 4), c(mz - 45));
      sandalye(D, 600, 418, 0.08); sandalye(D, 695, 412, -0.12); sandalye(D, 590, 553, Math.PI + .1); sandalye(D, 700, 560, Math.PI - .15);
      // sarkıt lamba
      mk(D, cyl(c(.4), c(.4), c(95), 6), M.celikKoyu, c(mx), c(212), c(mz), { cast: false });
      mk(D, new THREE.CylinderGeometry(c(5), c(22), c(18), 32, 1, true), mat('#2d4a3e', { roughness: .5, side: THREE.DoubleSide }), c(mx), c(155), c(mz), { cast: false });
      mk(D, sph(c(5), 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe0a8, emissiveIntensity: 3 }), c(mx), c(148), c(mz), { cast: false });
    }

    /* --- kedi köşesi --- */
    {
      const bx = 120, bz = 712;
      mk(D, new THREE.TorusGeometry(c(26), c(8), 12, 36).rotateX(Math.PI / 2), mat('#8a6fb3', { roughness: 1 }), c(bx), c(7), c(bz), { recv: true });
      mk(D, cyl(c(26), c(26), c(4), 36), mat('#d9cbe8', { roughness: 1 }), c(bx), c(2), c(bz), { recv: true });
      kedi(D, c(bx), c(4), c(bz));
      for (const [x, z, r] of [[250, 718, '#d6453a'], [285, 722, '#3a7bd5']]) {
        mk(D, new THREE.LatheGeometry([[0, 0], [c(8), 0], [c(9.5), c(5)], [c(8.5), c(5)], [c(7), c(1)], [0, c(1)]].map(([a, b]) => new THREE.Vector2(a, b)), 28), mat(r, { roughness: .35 }), c(x), 0, c(z));
        golge(D, c(x), c(z), c(13), c(13), .35);
      }
      mk(D, cyl(c(7), c(7), c(.5), 24), new THREE.MeshStandardMaterial({ color: 0x9fc6d8, roughness: .02, metalness: .2, envMap: ENV }), c(285), c(3.5), c(722), { cast: false });
      const mama = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(c(.8), 0), mat('#7a4a2a', { roughness: .9, flatShading: true }), 40);
      for (let i = 0; i < 40; i++) { const a = srand() * 7, r = i < 28 ? srand() * 6 : 10 + srand() * 25; dummy.position.set(c(250 + Math.cos(a) * r), i < 28 ? c(3.5) : c(.5), c(718 + Math.sin(a) * r)); dummy.rotation.set(srand() * 3, srand() * 3, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); mama.setMatrixAt(i, dummy.matrix); }
      mama.castShadow = true; D.add(mama);
      golge(D, c(bx), c(bz), c(36), c(36), .4);
      // köşede kova ve paspas
      mk(D, cyl(c(16), c(13), c(30), 28), mat('#3e86c9', { roughness: .4 }), c(930), c(15), c(705), { recv: true });
      mk(D, cyl(c(.9), c(.9), c(140), 8), mat('#c7c2b8', { roughness: .5 }), c(940), c(70), c(718), { r: [.25, 0, 0] });
      golge(D, c(930), c(705), c(22), c(22), .4);
    }

    /* --- yerdeki küçük şeyler: kırıntılar, bezelyeler, kaşık, kapak, oyuncak blok --- */
    {
      const kir = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat('#d9b27a', { roughness: 1, flatShading: true }), 220);
      for (let i = 0; i < 220; i++) {
        const t = srand(); let x, z;
        if (t < .5) { x = 560 + srand() * 170; z = 430 + srand() * 110; } else if (t < .75) { x = 120 + srand() * 300; z = 75 + srand() * 40; } else { frameAt(srand() * L, F1); const s = (srand() < .5 ? -1 : 1) * (HW + 5 + srand() * 10); x = (F1.p.x + F1.r.x * s) / K; z = (F1.p.z + F1.r.z * s) / K; }
        dummy.position.set(c(x), .25, c(z)); dummy.rotation.set(srand() * 3, srand() * 3, srand() * 3); dummy.scale.setScalar(.2 + srand() * .55); dummy.updateMatrix(); kir.setMatrixAt(i, dummy.matrix);
      }
      kir.receiveShadow = true; D.add(kir);
      const bez = new THREE.InstancedMesh(sph(c(.45), 10, 8), mat('#6aa53a', { roughness: .55 }), 14);
      for (let i = 0; i < 14; i++) { dummy.position.set(c(570 + srand() * 140), c(.45), c(420 + srand() * 25 + (i % 2) * 105)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); bez.setMatrixAt(i, dummy.matrix); }
      bez.castShadow = true; D.add(bez);
      // tahta kaşık
      { const g = new THREE.Group(); g.position.set(c(420), c(.6), c(122)); g.rotation.y = .12; D.add(g);
        mk(g, box(c(22), c(.9), c(1.8)), M.masa, c(-6), 0, 0); mk(g, sph(c(3.2), 16, 8), M.masa, c(8), 0, 0, { s: [1.3, .25, 1] }); }
      // şişe kapağı, oyuncak blok, kalem
      mk(D, cyl(c(1.6), c(1.6), c(.6), 20), mat('#c8322d', { roughness: .35, metalness: .4 }), c(745), c(.3), c(170));
      { const g = new THREE.Group(); g.position.set(c(860), 0, c(520)); g.rotation.y = .5; D.add(g); kutu(g, 4, 4, 4, mat('#3a7bd5', { roughness: .45 }), 0, 0, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mk(g, cyl(c(.6), c(.6), c(.5), 12), mat('#3a7bd5', { roughness: .45 }), c(x), c(4.25), c(z)); }
      { const g = new THREE.Group(); g.position.set(c(62), c(.4), c(560)); g.rotation.y = .9; D.add(g); mk(g, cyl(c(.4), c(.4), c(17), 6), mat('#f0b829', { roughness: .5 }), 0, 0, 0, { r: [0, 0, Math.PI / 2] }); mk(g, new THREE.ConeGeometry(c(.4), c(1.6), 6).rotateZ(-Math.PI / 2), mat('#e9cf9c'), c(9.3), 0, 0); }
    }

    /* --- karton boru --- */
    {
      frameAt(boru.a, F1); frameAt(boru.b, F2);
      const pa = F1.p.clone(), pb = F2.p.clone(), dir = pb.clone().sub(pa), len = dir.length() + 2; dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir), mid = pa.clone().add(pb).multiplyScalar(.5); mid.y = BORU_Y;
      const dis = new THREE.Mesh(new THREE.CylinderGeometry(BORU_DIS, BORU_DIS, len, 56, 1, true), M.borudis);
      const ic = new THREE.Mesh(new THREE.CylinderGeometry(BORU_R, BORU_R, len, 56, 1, true), M.boruic);
      M.borudis.map.repeat.set(2, len / 40); M.boruic.map.repeat.set(2, len / 40);
      for (const m of [dis, ic]) { m.position.copy(mid); m.quaternion.copy(q); m.castShadow = true; m.receiveShadow = true; D.add(m); }
      for (const sgn of [-1, 1]) {   // ağız halkaları (katmanlı karton kesiti)
        const r = new THREE.Mesh(new THREE.RingGeometry(BORU_R, BORU_DIS, 56), M.boruKenar);
        r.position.copy(mid).addScaledVector(dir, sgn * len / 2); r.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)); D.add(r);
      }
      golge(D, mid.x + 6, mid.z, BORU_DIS * 1.4, len * .55, .4, Math.atan2(dir.x, dir.z));
    }

    /* --- pist: bantlar, kenar bantları, karton bariyer, mandallar --- */
    const [ra, rb] = disBoru();
    ribbon(-HW, HW, .06, .06, 12, M.bant, true, ra, rb);
    ribbon(HW, HW + 1.3, .07, .07, 3, M.kerb, true, ra, rb);
    ribbon(-HW - 1.3, -HW, .07, .07, 3, M.kerb, true, ra, rb);
    for (const sg of [-1, 1]) {
      const a = sg * (HW + 3.4), b = sg * (HW + 3.85);
      ribbon(a, a, 0, 1.75, 30, M.karton, true, ra, rb).castShadow = true;
      ribbon(b, b, 0, 1.75, 30, M.karton, false, ra, rb);
      ribbon(Math.min(a, b), Math.max(a, b), 1.75, 1.75, 30, M.kartonUst, false, ra, rb);
    }
    mandallar(D, ra, rb);
    // bitiş çizgisi (damalı bant)
    {
      frameAt(START_S, F1);
      const g = new THREE.Group(); g.position.copy(F1.p); g.position.y += .075; g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
      const t = A.TEX.finish.clone(); t.needsUpdate = true; t.repeat.set(8, 1);
      mk(g, new THREE.PlaneGeometry(W, 2), new THREE.MeshStandardMaterial({ map: t, roughness: .6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 0, 0, 0, { r: [-Math.PI / 2, 0, 0], cast: false, recv: true });
    }
    baslangicKemeri(D, START_S);
    virajKartlari(D);
    // tavada cızırdayan sosisler (ocak, x 260–320): sap tezgâhın kenarından taşar, yerden görünür
    {
      const g = new THREE.Group(); g.position.set(c(282), c(90.6), c(38)); D.add(g); RG.tava = g.position.clone().add(new THREE.Vector3(0, c(6), 0));
      mk(g, cyl(c(13), c(11.5), c(4.5), 40), M.tava, 0, c(2.25), 0);
      mk(g, new THREE.CylinderGeometry(c(12.2), c(12.2), c(.4), 40), mat('#3a2d22', { roughness: .3 }), 0, c(1.2), 0, { cast: false });
      mk(g, box(c(2.4), c(1.4), c(20)), mat('#1d1c1f', { roughness: .6 }), c(2), c(3.2), c(23), { r: [-.18, 0, 0] });
      for (const [x, z, r] of [[-5, -3, .3], [1, 2, -.2], [6, -4, .6]]) mk(g, new THREE.CapsuleGeometry(c(1.2), c(7), 6, 14).rotateZ(Math.PI / 2), M.sosis, c(x), c(2.6), c(z), { r: [0, r, 0] });
    }

    const pads = pedKur(PED_YERI, [[boru.a, boru.b]]);
    // kedi nefes alıyor, buzdolabı kapısı hafifçe titriyor
    return { pads, env: ENV };
  }

  /* ---------- yardımcı yapıcılar ---------- */
  // dolap sırası: yerel x duvar boyunca, ön yüz yerel +z'de (z = 60 cm)
  function dolapSirasi(g, uzun, birimler, kuzeyMi) {
    kutu(g, uzun, 10, 52, M.supurgelikDolap, uzun / 2, 0, 26, { cast: false, recv: true });
    kutu(g, uzun, 76, 58, M.govde, uzun / 2, 10, 29, { recv: true });
    kutu(g, uzun + (kuzeyMi ? 0 : 3), 4, 63, M.tezgah, uzun / 2 + (kuzeyMi ? 0 : 1.5), 86, 31.5, { recv: true });
    // tezgâh arası fayans ve üst dolaplar
    const fm = M.fayans.clone(); fm.map = M.fayans.map.clone(); fm.map.needsUpdate = true; fm.map.repeat.set(uzun / 40, 55 / 40);
    const fy = new THREE.Mesh(new THREE.PlaneGeometry(c(uzun), c(55)), fm); fy.position.set(c(uzun / 2), c(117.5), c(.3)); fy.receiveShadow = true; g.add(fy);
    const ust = kuzeyMi ? [[0, 255], [325, 600]] : [[0, 360]];
    for (const [a, b] of ust) {
      kutu(g, b - a, 70, 35, M.govde, (a + b) / 2, 145, 17.5);
      for (let x = a; x < b - 1; x += (b - a) / Math.round((b - a) / 60)) { const w = (b - a) / Math.round((b - a) / 60); kutu(g, w - .6, 69, 2, M.kapak, x + w / 2, 145.5, 36); kutu(g, 1.6, 12, 1.6, M.pirinc, x + w - 5, 149, 38); }
    }
    for (const [a, b, tur] of birimler) {
      const w = b - a, cx = (a + b) / 2, z = 59;
      if (tur === 'kapak' || tur === 'cift') {
        const n = tur === 'cift' ? 2 : 1, dw = w / n;
        for (let i = 0; i < n; i++) { const x0 = a + i * dw; kutu(g, dw - .6, 72, 2, M.kapak, x0 + dw / 2, 12, z + 1); kutu(g, 1.6, 14, 1.6, M.pirinc, x0 + (i === n - 1 && n === 2 ? 5 : dw - 5), 66, z + 3); }
      } else if (tur === 'cekmece') {
        let y = 84;
        for (const hh of [18, 26, 28]) { y -= hh; kutu(g, w - .6, hh - .6, 2, M.cekmece, cx, y + .3, z + 1); kutu(g, 16, 1.6, 1.6, M.pirinc, cx, y + hh - 6, z + 3); }
      } else if (tur === 'bulasik') {
        kutu(g, w - .6, 72, 2, M.celik, cx, 12, z + 1); kutu(g, w - .6, 6, 2.2, M.celikKoyu, cx, 78, z + 1.1); kutu(g, 40, 1.8, 2.4, M.celikKoyu, cx, 72, z + 3);
      } else if (tur === 'firin') {
        kutu(g, w - .6, 72, 2, M.celikKoyu, cx, 12, z + 1);
        mk(g, new THREE.PlaneGeometry(c(w - 8), c(46)), M.firinCam, c(cx), c(17 + 23), c(z + 2.15), { cast: false });
        mk(g, cyl(c(1), c(1), c(48), 12), M.celik, c(cx), c(67), c(z + 5), { r: [0, 0, Math.PI / 2] });
        for (const s of [-1, 1]) kutu(g, 1.6, 1.6, 4, M.celik, cx + s * 22, 66.2, z + 3);
        for (let i = 0; i < 4; i++) mk(g, cyl(c(1.8), c(1.8), c(1.8), 16), M.celik, c(a + 10 + i * 13.5), c(78), c(z + 2.5), { r: [Math.PI / 2, 0, 0] });
        // ocak camı ve aspiratör
        kutu(g, 56, .6, 50, M.siyahCam, cx, 90, 30);
        kutu(g, 60, 8, 50, M.celik, cx, 172, 25); mk(g, new THREE.CylinderGeometry(c(12), c(30), c(22), 4, 1), M.celik, c(cx), c(191), c(20), { r: [0, Math.PI / 4, 0], s: [1, 1, .7] });
      }
    }
    // tezgâh üstü eşyalar (uzaktan görünür)
    if (kuzeyMi) {
      mk(g, cyl(c(8), c(9), c(20), 24), mat('#d9473b', { roughness: .3, metalness: .3 }), c(150), c(100), c(30));           // su ısıtıcısı
      mk(g, sph(c(3), 12, 8), mat('#1d1c1f'), c(150), c(111), c(30));
      kutu(g, 28, 18, 16, M.celik, 350, 90, 25); kutu(g, 20, 1, 3, mat('#1d1c1f'), 350, 108, 22); kutu(g, 20, 1, 3, mat('#1d1c1f'), 350, 108, 28);   // ekmek kızartma makinesi
      for (const [x, h, r] of [[420, 22, '#e9d7b9'], [436, 18, '#d8c39d'], [452, 26, '#f1e6d2']]) { mk(g, cyl(c(6), c(6), c(h), 20), new THREE.MeshStandardMaterial({ color: 0xf2f6f8, roughness: .05, transparent: true, opacity: .5, envMap: ENV }), c(x), c(90 + h / 2), c(18)); mk(g, cyl(c(5.4), c(5.4), c(h * .7), 16), mat(r, { roughness: 1 }), c(x), c(90 + h * .35), c(18)); mk(g, cyl(c(6.3), c(6.3), c(2.5), 20), mat('#b07a4a'), c(x), c(90 + h + 1.2), c(18)); }
      kutu(g, 40, 50, 3, M.masa, 520, 90, 5, { r: [-.12, 0, 0] });                       // duvara yaslı kesme tahtası
      for (let i = 0; i < 4; i++) mk(g, sph(c(4.5), 14, 10), mat(['#c9342b', '#e0b13a', '#7fb041', '#c9342b'][i], { roughness: .4 }), c(560 + (i % 2) * 8), c(95 + (i > 1 ? 6 : 0)), c(30 + (i % 3) * 6));
    } else {
      kutu(g, 30, 9, 30, mat('#b07a4a', { roughness: .6 }), 200, 90, 30);                // meyve kâsesi (tahta)
      for (let i = 0; i < 5; i++) mk(g, sph(c(4.2), 14, 10), mat(['#e7c42e', '#d2412f', '#e98a2a', '#7fb041', '#d2412f'][i], { roughness: .45 }), c(190 + i * 5), c(103 + (i % 2) * 3), c(26 + (i % 3) * 5));
      mk(g, cyl(c(9), c(7), c(14), 20), mat('#c86a3e', { roughness: .8 }), c(300), c(97), c(22));
      for (let i = 0; i < 6; i++) mk(g, sph(c(4), 8, 6), mat('#5d9b45', { roughness: .8 }), c(300 + Math.cos(i) * 5), c(110 + (i % 3) * 4), c(22 + Math.sin(i) * 5), { s: [.7, 1.3, .7] });
    }
  }
  // yere yumuşak temas gölgesi (dikdörtgen ya da yuvarlak leke)
  let golgeTex = null;
  function golge(D, x, z, rx, rz, op, rot = 0) {
    golgeTex ??= canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a120c, alphaMap: golgeTex, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.position.set(x, .1, z); m.rotation.y = rot; m.userData.noMerge = true; m.renderOrder = 2; D.add(m);
  }
  function golgeSerit(D, a, b, on, eksen) {   // dolap dibi boyunca koyu şerit
    const t = canvasTex(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const len = c(b - a), d = c(18);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(eksen === 'x' ? len : d, eksen === 'x' ? d : len).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a120c, alphaMap: t, transparent: true, opacity: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    if (eksen === 'x') m.position.set(c((a + b) / 2), .1, c(on) + d / 2);
    else { m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(len, d).rotateX(-Math.PI / 2); m.rotation.y = Math.PI / 2; m.position.set(c(on) + d / 2, .1, c((a + b) / 2)); }
    m.userData.noMerge = true; m.renderOrder = 2; D.add(m);
  }
  function perde(D, x, z) {
    const g = new THREE.PlaneGeometry(c(50), c(228), 24, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / c(50) * Math.PI * 6) * c(2.2));
    g.computeVertexNormals();
    mk(D, g, M.perde, x, c(119), z, { r: [0, Math.PI / 2, 0] });
  }
  function peceteKur(D, x, y, z) {   // masanın kenarından sarkan peçete
    const g = new THREE.PlaneGeometry(c(30), c(34), 10, 14); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i) + c(17);     // v: 0 (masa içi) … 34 (sarkan uç)
      const icerde = c(12);
      if (v < icerde) p.setXYZ(i, u, 0, -v);
      else { const d = v - icerde; p.setXYZ(i, u + Math.sin(d * .3) * .6, -d, -icerde - Math.sin(Math.min(d / c(20), 1) * 1.2) * c(2)); }
    }
    g.computeVertexNormals();
    mk(D, g, new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: .9, side: THREE.DoubleSide }), x, y + .1, z + c(12));
  }
  function sandalye(D, x, z, rot) {
    const g = new THREE.Group(); g.position.set(c(x), 0, c(z)); g.rotation.y = rot; D.add(g);
    kutu(g, 44, 4, 44, M.sandalye, 0, 44, 0, { recv: true });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kutu(g, 3.6, 44, 3.6, M.sandalye, sx * 19, 0, sz * 19);
    for (const sx of [-1, 1]) kutu(g, 3.6, 48, 3.6, M.sandalye, sx * 19, 48, -19);
    for (const y of [64, 76, 88]) kutu(g, 38, 5, 2, M.sandalye, 0, y, -19);
    for (const sz of [-1, 1]) kutu(g, 36, 3, 2, M.sandalye, 0, 14, sz * 19);
    golge(D, c(x), c(z), c(30), c(30), .32);
  }
  let kediGovde = null;
  function kedi(D, x, y, z) {   // simit gibi kıvrılıp uyuyan tekir
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = .6; g.userData.dyn = true; D.add(g);
    const govde = mk(g, sph(c(15), 24, 16), M.kedi, 0, c(8), 0, { s: [1.15, .62, .95] }); govde.userData.noMerge = true;   // nefes alır (birleştirilmez)
    mk(g, sph(c(8), 20, 14), M.kedi, c(12), c(9), c(9), { s: [1, .9, 1.05] });
    for (const s of [-1, 1]) mk(g, new THREE.ConeGeometry(c(3), c(5), 4), M.kedi, c(12 + s * 4), c(16), c(8 + s * 1.5), { r: [0, 0, s * -.3] });
    for (const s of [-1, 1]) mk(g, box(c(3), c(.4), c(.3)), mat('#3a2418'), c(15 + s * 2.5), c(10.5), c(16.8), { cast: false, r: [0, 0, s * .15] });
    mk(g, new THREE.TorusGeometry(c(13), c(2.6), 8, 24, Math.PI * 1.1), M.kedi, 0, c(4), 0, { r: [Math.PI / 2, 0, 1.6] });
    kediGovde = govde;
  }
  function baslangicKemeri(D, s) {
    frameAt(s, F1);
    const g = new THREE.Group(); g.position.copy(F1.p); g.rotation.y = Math.atan2(F1.t.x, F1.t.z); D.add(g);
    const sut = new THREE.MeshStandardMaterial({ map: kutuTex('#2f7ed8', 'SÜT', 'tam yağlı · 1 L', '#ffffff'), roughness: .5 });
    const meyve = new THREE.MeshStandardMaterial({ map: kutuTex('#f08a24', 'PORTAKAL', '%100 meyve suyu', '#ffc94a'), roughness: .5 });
    const x0 = HW + 6;
    for (const [sx, m] of [[-1, sut], [1, meyve]]) {
      mk(g, box(c(7), c(20), c(7)), [m, m, mat('#f4f1ea'), mat('#f4f1ea'), m, m], sx * x0, c(10), 0, { recv: true });
      mk(g, new THREE.CylinderGeometry(.1, c(3.6), c(3), 4, 1).rotateY(Math.PI / 4), mat('#f4f1ea'), sx * x0, c(21.5), 0);
    }
    mk(g, box(x0 * 2 + c(10), c(.4), c(3)), M.cetvel, 0, c(20.2), 0);
    const ban = mk(g, new THREE.PlaneGeometry(x0 * 2 - c(4), c(6)), M.bayrak, 0, c(16.6), c(-.2), { cast: true });
    ban.rotation.set(-.06, Math.PI, 0);   // gelen arabalara dönük
  }
  function mandallar(D, ra, rb) {
    // iki kol şeridin iki yanından kıstırır (yerel z = pistin yanı)
    const ag = new THREE.BoxGeometry(.55, 2.3, .32), sol = ag.clone().translate(0, 1.5, -.36), sag = ag.clone().translate(0, 1.5, .36);
    const yay = new THREE.CylinderGeometry(.18, .18, .95, 8).rotateX(Math.PI / 2).translate(0, 1.9, 0);
    const geo = mergeGeometries([sol, sag, yay].map(g => g.toNonIndexed()));
    const step = 9, cnt = Math.ceil(A.L / step) * 2 + 4;
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .45 }), cnt);
    const renk = ['#e0453a', '#3a7bd5', '#45b36b', '#f2c230', '#f4f1ea'].map(x => new THREE.Color(x));
    let k = 0;
    const len = ((rb - ra) % A.L + A.L) % A.L;
    for (let s = ra + 3; s < ra + len - 3; s += step) for (const side of [-1, 1]) {
      frameAt(s, F1); dummy.position.copy(F1.p).addScaledVector(F1.r, side * (HW + 3.62));
      dummy.rotation.set(0, Math.atan2(F1.r.x, F1.r.z), 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, renk[Math.floor(srand() * renk.length)]); k++;
    }
    im.count = k; im.castShadow = true; D.add(im);
  }
  function virajKartlari(D) {
    let son = -999;
    const kart = new THREE.PlaneGeometry(c(5), c(3.6));
    for (let s = 0; s < A.L; s += 4) {
      if (inRange(s, boru.a - 30, boru.b + 20) || Math.abs(sd(s, A.START_S)) < 30) continue;
      frameAt(s, F1); frameAt(s + 30, F2);
      const ang = Math.acos(clamp(F1.t.dot(F2.t), -1, 1));
      if (ang < .3 || s - son < 26) continue;
      son = s; const sag = F1.t.x * F2.t.z - F1.t.z * F2.t.x < 0, side = sag ? -1 : 1;
      const g = new THREE.Group(); g.position.copy(F1.p).addScaledVector(F1.r, side * (HW + 6.2)); g.rotation.y = Math.atan2(F1.t.x, F1.t.z) + Math.PI; D.add(g);
      for (const k of [-1, 1]) { const m = mk(g, kart, M.ok, 0, c(1.7), k * c(1.1), { r: [k * .55, 0, 0] }); if (!sag) m.scale.x = -1; }
    }
  }

  /* =========================================================
     KAVİSLİ ZEMİN: karton borunun içinde araç duvara tırmanır
     ========================================================= */
  function boruK(s) {   // 0 dışarıda … 1 içeride (ağızlarda yumuşak geçiş)
    if (!inRange(s, boru.a - 30, boru.b + 30)) return 0;
    return sstep(-6, 5, sd(s, boru.a)) * sstep(-6, 5, sd(boru.b, s));
  }
  function yuzey(s, x) {
    const k = boruK(s); if (k <= 0) return null;
    const xx = clamp(x, -BORU_R + 2, BORU_R - 2), r = Math.sqrt(BORU_R * BORU_R - xx * xx);
    return { dy: (BORU_Y - r) * k, egim: xx / r * k };
  }

  /* =========================================================
     BÖLGELER ve OLAYLAR
     ========================================================= */
  const bolgeler = [
    { name: 'KEDİ KÖŞESİ', sub: 'Yün yumakları yuvarlanıyor', test: p => p.z > c(560) && p.x < c(430) },
    { name: 'YEMEK MASASI', sub: 'Masadan düşenlere dikkat', test: p => p.z > c(420) && p.x < c(850) },
    { name: 'KARTON BORU', sub: 'Borunun içinden geç!', test: p => p.x >= c(845) },
    { name: 'BUZDOLABI', sub: 'Buz küpleri kayıyor', test: p => p.x >= c(560) && p.z < c(300) },
    { name: 'OCAK BAŞI', sub: 'Tavadan sosis fırlıyor!', test: p => p.x >= c(180) && p.z < c(200) },
    { name: 'DOLAP DİBİ', sub: 'Dev mutfak dolaplarının dibinden', test: () => true },
  ];
  const bolgeAdi = p => bolgeler.find(b => b.test(p)).name;
  const Z = { zone: {}, sosisT: 0, buzT: 0, kofteT: 0, yunT: 0, karanlik: false, buharT: 0, sisT: 0 };
  // hepsi tek şeride sığar (aynı anda iki şeridi kapatmaz)
  const KOFTE_R = 1.9, YUN_R = 1.9, BUZ_B = 3.0;
  const FG = {
    sosis: new THREE.CapsuleGeometry(1.8, 11, 6, 16).rotateX(Math.PI / 2),
    buz: null, kofte: new THREE.IcosahedronGeometry(KOFTE_R, 1), yun: new THREE.SphereGeometry(YUN_R, 18, 12), kirinti: new THREE.DodecahedronGeometry(1, 0),
  };
  // [a, b] pist aralığında, en az `once` kadar ileride rastgele bir nokta (aralık geçildiyse ya da çok yakınsa null)
  function ileride(a, b, once) {
    const me = A.me, ilk = me.s + Math.max(once, sd(a, me.s)), son = me.s + sd(b, me.s);
    return son - ilk > 4 ? rand(ilk, son) : null;
  }
  function olay(dt, raceT) {
    const me = A.me, p = me.car.root.position;
    const aktif = raceT > 0 && !me.finished, reg = bolgeAdi(p);
    // tavadan sosis tepeden düşer: yalnızca ocak başındayken. Yandan gelenler (buz, köfte, yün) ise
    // o noktaya yaklaşırken önceden yola çıkar ki yolun ortasına vardığında sen hâlâ uzakta ol.
    const ocak = aktif && reg === 'OCAK BAŞI';
    if (ocak && !Z.zone.ocak) Z.sosisT = 1.2;
    Z.zone = { ocak };
    if (ocak && (Z.sosisT -= dt) <= 0) { sosisFirlat(); Z.sosisT = rand(3.2, 4.8); }
    if (aktif && (Z.buzT -= dt) <= 0) { const s = ileride(buzA, buzB, 340); if (s !== null) { buzKaydir(s); Z.buzT = rand(5, 7); } else Z.buzT = .5; }
    if (aktif && (Z.kofteT -= dt) <= 0) { const s = ileride(masa.a, masa.b, 340); if (s !== null) { kofteDusur(s); Z.kofteT = rand(4.5, 6.5); } else Z.kofteT = .5; }
    if (aktif && (Z.yunT -= dt) <= 0) { const s = ileride(kediA, kediB, 340); if (s !== null) { yunYumagi(s); Z.yunT = rand(5, 8); } else Z.yunT = .5; }
    // borunun içi loş: pozlama düşer, farlar yanar, motor sesi yankılanır
    const k = boruK(me.s);
    A.SES.yanki(k);
    if (k > .001) { setLights(1 - .38 * k); Z.karanlik = true; } else if (Z.karanlik) { setLights(1); Z.karanlik = false; }
    // ocakta buhar, buzdolabının aralığından soğuk sis
    const dTava = RG.tava ? p.distanceTo(RG.tava) : 1e9;
    if (dTava < 380 && (Z.buharT -= dt) <= 0) { Z.buharT = .12; emit(RG.tava.x + rand(-12, 12), RG.tava.y + 2, RG.tava.z + rand(-10, 10), rand(-1, 1), rand(4, 7), rand(-1, 1), rand(5, 9), rand(1.4, 2.2)); }
    if (RG.kapi && p.x > c(520) && p.x < c(860) && p.z < c(260) && (Z.sisT -= dt) <= 0) { Z.sisT = .1; emit(c(612) + rand(0, 18), rand(2, 30), c(68) + rand(0, 6), rand(-2, 2), rand(-1.5, -.5), rand(4, 9), rand(4, 7), rand(1.5, 2.4)); }
    if (kediGovde) kediGovde.scale.y = .62 + Math.sin(A.time * 2.2) * .025;
  }
  function olaySifirla() { Z.zone = {}; Z.karanlik = false; Z.buzT = Z.kofteT = Z.yunT = 0; A.SES.yanki(0); }
  // --- Ocak başı: tavadan fırlayan dev sosis, tek bir şeride boylamasına düşüp bir süre yatar ---
  function sosisFirlat() {
    const me = A.me, s = me.s + rand(85, 120), x = Math.random() < .5 ? A.LANES.reduce((a, b) => Math.abs(b - me.x) < Math.abs(a - me.x) ? b : a) : A.LANES[Math.floor(Math.random() * 4)];
    const hedef = A.roadPt(s, x); hedef.y += 1.8;
    const from = RG.tava.clone();
    const m = mk(A.scene, FG.sosis, M.sosis);
    const mark = new THREE.Mesh(FXG.ring, FXM.marker.clone()); mark.position.copy(hedef); mark.position.y = hedef.y - 1.6; mark.scale.set(.6, 1, 1.9); frameAt(s, F1); mark.rotation.y = Math.atan2(F1.t.x, F1.t.z); A.scene.add(mark);
    const yaw = Math.atan2(F1.t.x, F1.t.z);
    const T = 1.35; let t = 0, yer = 0; const hit = new Set(), carp = new Set(), eng = A.olayEngel(s, x, 0);
    for (let i = 0; i < 8; i++) emit(from.x + rand(-6, 6), from.y, from.z + rand(-6, 6), rand(-3, 3), rand(5, 9), rand(-3, 3), rand(4, 7), 1.2);
    A.SES.cizirti(from);
    addFx({
      update(dt) {
        t += dt;
        if (t < T) {
          const k = t / T; m.position.lerpVectors(from, hedef, k); m.position.y += Math.sin(Math.PI * k) * 55;
          m.rotation.set(t * 9, yaw + t * 4, 0);
          mark.material.opacity = .35 + .45 * Math.abs(Math.sin(t * 12)); return true;
        }
        if (!yer) {
          yer = 1; m.position.copy(hedef); m.rotation.set(0, yaw, 0); A.scene.remove(mark); mark.material.dispose(); eng.w = 1.8;
          A.SES.tok(hedef, { f0: 120, f1: 55, sure: .25, guc: .8, parlak: 900, gurultuG: .4 });
          for (let i = 0; i < 14; i++) emit(hedef.x + rand(-4, 4), hedef.y, hedef.z + rand(-4, 4), rand(-4, 4), rand(1, 4), rand(-4, 4), rand(1.2, 2), rand(.6, 1));
          hitRacers(s, x, 7, 1.8, r => knock(r, { slow: .6, jump: 3.5, kick: rand(-.25, .25), shake: .5, msg: 'SOSİS!' }), hit);
          if (me.car.root.position.distanceTo(hedef) < 50) A.sarsinti(.35);
        }
        yer += dt;
        hitRacers(s, x, 7, 1.8, r => { if (!hit.has(r)) knock(r, { slow: .72, jump: 2.5, kick: rand(-.2, .2), shake: .3, msg: 'SOSİS!' }); }, carp);
        if (yer > 3.2) { const k = clamp((yer - 3.2) / .4, 0, 1); m.scale.setScalar(1 - k); eng.w = 0; }
        if (yer > 3.6 || me.s > s + 160) { this.dispose(); return false; }
        return true;
      },
      dispose() { A.scene.remove(m); A.scene.remove(mark); A.OLAY_ENGEL.delete(eng); }
    });
  }
  // --- Buzdolabı: aralıktan buz küpleri banketlere düşer; ilk şeride hızla kayar, oradan ortaya yavaşça ---
  function buzKaydir(s0) {
    FG.buz ??= new A.RoundedBoxGeometry(BUZ_B, BUZ_B, BUZ_B, 2, .55);
    const me = A.me, dir = 1;   // buzdolabı yolun solunda
    const parca = [0, 1].map(i => {
      const s = s0 + i * rand(6, 9), o = { x: -(HW + 1.6), dir, v: 0, hizli: rand(11, 14), yavas: i ? 0 : 1.3 };   // ikincisi ilk şeritte kalır
      return { m: mk(A.scene, FG.buz, M.buz), s, o, y: 30 + i * 9, vy: 0, gec: i * .35, w: rand(-3, 3), bitti: false, yere: false, hit: new Set(), eng: A.olayEngel(s, o.x, BUZ_B / 2) };
    });
    let t = 0, git = false, dedi = false;
    addFx({
      update(dt) {
        t += dt;
        if (!git && s0 - me.s < 400) git = true;
        for (const b of parca) {
          if (b.bitti) continue;
          if (git) { b.vy -= 70 * dt; b.y += b.vy * dt; if (b.y < BUZ_B / 2 + .05) { b.y = BUZ_B / 2 + .05; if (!b.yere) { b.yere = true; frameAt(b.s, F1); A.SES.tok(F1.p.clone().addScaledVector(F1.r, b.o.x), { f0: 420, f1: 180, sure: .09, guc: .3, parlak: 6000, gurultuG: .45 }); } b.vy = Math.abs(b.vy) > 10 ? -b.vy * .25 : 0; } }
          const v = git && b.yere && (b.gec -= dt) <= 0 ? A.yanAdim(b.o, dt) : 0; b.eng.x = b.o.x;
          frameAt(b.s, F1); b.m.position.copy(F1.p).addScaledVector(F1.r, b.o.x); b.m.position.y += b.y; b.m.rotation.y += b.w * dt * (v > .5 ? 1 : .05);
          if (git) hitRacers(b.s, b.o.x, BUZ_B / 2 + .2, BUZ_B / 2, r => {
            b.bitti = true; A.scene.remove(b.m); A.OLAY_ENGEL.delete(b.eng); A.SES.kirilma(b.m.position, 'buz');
            knock(r, { slow: .8, kick: dir * .2, shake: .3, msg: dedi ? '' : 'BUZ!' }); dedi = true; r.slipT = Math.max(r.slipT, .9); r.slipDir = Math.random() < .5 ? -1 : 1;
            A.shatter(b.m.position, F1.t.clone().multiplyScalar(r.v * .4), FG.kirinti, M.buz, 6, rand(.5, .8));
          }, b.hit);
        }
        if (t > 60 || me.s > s0 + 80) { this.dispose(); return false; }
        return true;
      },
      dispose() { parca.forEach(b => { A.scene.remove(b.m); A.OLAY_ENGEL.delete(b.eng); }); }
    });
  }
  // --- Yemek masası: köfte masanın kenarında bekler; sen yaklaşırken yuvarlanıp bankete düşer,
  //     ilk şeride hızla, oradan ortaya yavaşça yuvarlanıp durur ---
  function kofteDusur(s) {
    const me = A.me, side = Math.random() < .5 ? -1 : 1, inis = side * (HW + 1.6);
    const o = { x: side * 62, dir: -side, v: 0, hizli: 12, yavas: 1.3 };
    let y = 112.5 + KOFTE_R, vy = 0, t = 0, yerde = false, dustu = false;
    const vx = (62 - Math.abs(inis)) / Math.sqrt(2 * (y - KOFTE_R) / 75);   // tam bankete düşecek yatay hız
    const m = mk(A.scene, FG.kofte, M.kofte); const hit = new Set(), eng = A.olayEngel(s, o.x, KOFTE_R);
    addFx({
      update(dt) {
        t += dt;
        frameAt(s, F1);
        if (!dustu && s - me.s > 400) { m.position.copy(F1.p).addScaledVector(F1.r, o.x); m.position.y = F1.p.y + y; return t < 60 || (this.dispose(), false); }
        dustu = true;
        if (!yerde) {
          vy -= 75 * dt; y += vy * dt;
          if (side * o.x > Math.abs(inis)) o.x = side * Math.max(Math.abs(inis), Math.abs(o.x) - vx * dt);
          if (y < KOFTE_R) { y = KOFTE_R; if (vy < -12) { vy = -vy * .3; A.SES.tok(m.position, { f0: 95, f1: 45, sure: .2, guc: .55, parlak: 700, gurultuG: .3 }); for (let i = 0; i < 6; i++) emit(m.position.x, 1, m.position.z, rand(-3, 3), rand(1, 3), rand(-3, 3), 2, .7); } else { vy = 0; yerde = true; } }
        }
        const v = yerde ? A.yanAdim(o, dt) : 0; eng.x = o.x;
        m.position.copy(F1.p).addScaledVector(F1.r, o.x); m.position.y = F1.p.y + y;   // masa altında yol kilimin üstünde
        m.rotateOnWorldAxis(F1.t, o.dir * v * dt / KOFTE_R);
        let kir = false;
        if (y < 5) hitRacers(s, o.x, KOFTE_R + .3, KOFTE_R, r => {
          if (kir) return; kir = true; knock(r, { slow: .66, jump: 3, kick: o.dir * .28, shake: .45, msg: 'KÖFTE!' });
          A.SES.tok(m.position, { f0: 80, f1: 40, sure: .25, guc: .7, parlak: 500, gurultuG: .5 });
          A.shatter(m.position, F1.t.clone().multiplyScalar(r.v * .5), FG.kirinti, M.kofte, 8, rand(.5, .8));
        }, hit);
        if (kir || t > 60 || me.s > s + 60) { this.dispose(); return false; }
        return true;
      },
      dispose() { A.scene.remove(m); A.OLAY_ENGEL.delete(eng); }
    });
  }
  // --- Kedi köşesi: yün yumağı ipini çözerek ilk şeride hızla, oradan ortaya yavaşça yuvarlanır ---
  function yunYumagi(s) {
    const me = A.me, dir = Math.random() < .65 ? 1 : -1;
    const o = { x: -dir * rand(26, 34), dir, v: 0, hizli: 13, yavas: 1.3 };
    let t = 0, ucan = null, git = false;
    const m = mk(A.scene, FG.yun, M.yun); const hit = new Set(), eng = A.olayEngel(s, o.x, YUN_R);
    const ipNok = new Float32Array(3 * 24), ip = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ipNok, 3)), new THREE.LineBasicMaterial({ color: 0xc23a4a }));
    ip.frustumCulled = false; A.scene.add(ip);
    frameAt(s, F1); const bas = F1.p.clone().addScaledVector(F1.r, o.x);
    addFx({
      update(dt) {
        t += dt;
        frameAt(s, F1);
        if (!ucan) {
          if (!git && s - me.s < 400) git = true;
          const v = git ? A.yanAdim(o, dt) : 0; eng.x = o.x;
          const cit = Math.max(0, 3.5 - Math.abs(Math.abs(o.x) - (HW + 3.6)));   // karton bariyerin üstünden zıplar
          m.position.copy(F1.p).addScaledVector(F1.r, o.x); m.position.y = F1.p.y + YUN_R + cit * .9;
          m.rotateOnWorldAxis(F1.t, o.dir * v * dt / YUN_R);
          hitRacers(s, o.x, YUN_R + .3, YUN_R, r => {
            knock(r, { slow: .72, jump: 2.5, kick: o.dir * .3, shake: .4, msg: 'YÜN YUMAĞI!' }); A.OLAY_ENGEL.delete(eng);
            A.SES.tok(m.position, { f0: 70, f1: 40, sure: .15, guc: .35, parlak: 400, gurultuG: .5 });
            ucan = { v: F1.t.clone().multiplyScalar(r.v * .55).setY(14), t: 0 };
          }, hit);
          if (t > 60 || me.s > s + 60) { this.dispose(); return false; }
        } else {
          ucan.t += dt; ucan.v.y -= 40 * dt; m.position.addScaledVector(ucan.v, dt); m.rotation.x += 6 * dt;
          if (m.position.y < YUN_R) { m.position.y = YUN_R; ucan.v.multiplyScalar(.5); ucan.v.y = Math.abs(ucan.v.y) * .4; }
          if (ucan.t > 2.5) { this.dispose(); return false; }
        }
        for (let i = 0; i < 24; i++) { const k = i / 23; ipNok[i * 3] = lerp(bas.x, m.position.x, k); ipNok[i * 3 + 1] = .3 + Math.sin(k * Math.PI) * .2 + (k > .9 ? (k - .9) * 15 : 0); ipNok[i * 3 + 2] = lerp(bas.z, m.position.z, k) + Math.sin(k * 9) * .8; }
        ip.geometry.attributes.position.needsUpdate = true;
        return true;
      },
      dispose() { A.scene.remove(m); A.scene.remove(ip); ip.geometry.dispose(); ip.material.dispose(); A.OLAY_ENGEL.delete(eng); }
    });
  }

  return {
    id: 'mutfak', ad: 'DEV MUTFAK', baslik: 'Dev Mutfak', ctrl: CTRL, start: [c(90), c(330)], seed: 7702,
    kur, bolgeler, olay, olaySifirla, yuzey,
    get yasak() { return [[boru.a, boru.b]]; },
    isik: { gok: 0xfff0e0, yer: 0x7a5a44, gokG: .62, gunes: 0xffdcb4, gunesG: 2.1, gunesYon: [.72, .62, .3], isikYon: [.72, .62, .3],
      sis: 0xe6dccd, sisYakin: 600, sisUzak: 3200, pozlama: .94, arka: 0xe6dccd, ton: [.82, .76, .7], golge: [.02, .012, 0], gunesParlama: false },
    get engel() { return { boxes: M.seker, oil: M.sut, ramp: M.cetvel, kenar: mat('#d9d2c4'), adKutu: 'ŞEKER KÜPLERİ!', adYag: 'SÜT! kayıyorsun', adRampa: 'CETVEL RAMPASI! +HIZ', renkYag: '#f4efe4' }; },
  };
}

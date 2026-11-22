// Crown Rally sesleri — hepsi Web Audio ile üretilir (dosya indirilmez).
// İlke: her şeye ses konmaz. Motor sürekli ama alçak; lastik/bariyer sürtünmesi yalnızca olurken;
// yukarıdan/yandan gelen tehlikelerin kendi sesleri (gülle ıslığı ve patlaması, kaya gümbürtüsü, fıçı, T-Rex,
// sosis cızırtısı, buz) mesafeye ve yöne göre (sağ/sol) duyulur. Arayüz sesleri: geri sayım, tur, bitiş.
// Tarayıcılar sesi ancak bir dokunuştan/tuştan sonra açar: baslat() ilk etkileşimde çağrılır.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function sesKur() {
  let ctx = null, ana = null, motorK = null, surtK = null, yankiK = null, ruzgarK = null, gurultu = null;
  // tarayıcı depolamayı engellediyse (gizli mod, çerezler kapalı) oyun açılmaya devam etsin
  const depo = { al: k => { try { return localStorage.getItem(k); } catch { return null; } }, yaz: (k, v) => { try { localStorage.setItem(k, v); } catch { /* yok say */ } } };
  let acik = depo.al('crownSes') !== '0';
  const dinleyici = { x: 0, y: 0, z: 0, sx: 1, sz: 0 };   // kamera konumu ve sağ yönü

  function baslat() {
    if (ctx) { if (ctx.state === 'suspended' && acik && !document.hidden) ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    // ana çıkış: yumuşak sıkıştırıcı (ani patlamalar kulak tırmalamasın)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .25;
    ana = ctx.createGain(); ana.gain.value = acik ? .85 : 0;
    ana.connect(comp); comp.connect(ctx.destination);
    // beyaz gürültü (2 sn, döngüde kullanılır)
    gurultu = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = gurultu.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // tünel/boru yankısı: kısa gecikme + geri besleme (motor buraya da gider)
    const gec = ctx.createDelay(.5); gec.delayTime.value = .075;
    const geri = ctx.createGain(); geri.gain.value = .42;
    const yf = ctx.createBiquadFilter(); yf.type = 'lowpass'; yf.frequency.value = 1800;
    yankiK = ctx.createGain(); yankiK.gain.value = 0;
    yankiK.connect(gec); gec.connect(yf); yf.connect(geri); geri.connect(gec); yf.connect(ana);
    motorKur(); surtunmeKur(); ruzgarKur();
  }
  const zaman = () => ctx.currentTime;
  function gurultuKaynak(dongu = true) { const s = ctx.createBufferSource(); s.buffer = gurultu; s.loop = dongu; return s; }
  function filtre(tip, f, q = .7) { const b = ctx.createBiquadFilter(); b.type = tip; b.frequency.value = f; b.Q.value = q; return b; }
  // dünyadaki bir noktanın sesi: uzaklıkla azalır, sağ/sol kanala dağılır
  function konumla(p, menzil = 60) {
    const g = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (!p) { g.gain.value = 1; g.connect(pan || ana); if (pan) pan.connect(ana); return g; }
    const dx = p.x - dinleyici.x, dz = p.z - dinleyici.z, dy = (p.y || 0) - dinleyici.y, dist = Math.hypot(dx, dy, dz);
    g.gain.value = 1 / (1 + Math.pow(dist / menzil, 1.6));
    if (pan) { pan.pan.value = clamp((dx * dinleyici.sx + dz * dinleyici.sz) / Math.max(dist, 1), -1, 1) * .8; g.connect(pan); pan.connect(ana); }
    else g.connect(ana);
    return g;
  }

  /* ---------- MOTOR: dört silindirli benzinli, sanal vites kutusu ---------- */
  // Ateşleme frekansı = devir/30 Hz. Testere dişi dalgalar + gürültü "hırıltısı" bozulmadan geçip
  // devir ve gaza göre açılan bir alçak geçiren filtreden çıkar. Gaz kesilince ses koyulaşır ve alçalır.
  const VITES = [0, .17, .33, .5, .68, .86];   // hız oranında vites geçişleri
  const motor = { rpm: 900, vites: 1, yuk: 0, ses: 0 };
  function motorKur() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square';
    const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain(); g1.gain.value = .5; g2.gain.value = .55; g3.gain.value = .08;
    // ateşleme vuruntusu: gürültü, ateşleme frekansında genlik modülasyonuyla "pır pır"
    const n = gurultuKaynak(), nb = filtre('bandpass', 700, .9), ng = ctx.createGain(); ng.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; const lfoG = ctx.createGain(); lfoG.gain.value = .5;
    lfo.connect(lfoG); lfoG.connect(ng.gain);
    const nm = ctx.createGain(); nm.gain.value = .35;
    // yumuşak doyum (metalik değil, dolgun)
    const sek = ctx.createWaveShaper(); const egri = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; egri[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); } sek.curve = egri;
    const lp = filtre('lowpass', 400, 1.1), lp2 = filtre('lowpass', 2600, .5);
    const govde = filtre('peaking', 120, 1); govde.gain.value = 5;   // egzoz gövdesi
    const cikis = ctx.createGain(); cikis.gain.value = 0;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); [g1, g2, g3].forEach((g) => g.connect(sek));
    n.connect(nb); nb.connect(ng); ng.connect(nm); nm.connect(sek);
    sek.connect(lp); lp.connect(govde); govde.connect(lp2); lp2.connect(cikis); cikis.connect(ana); cikis.connect(yankiK);
    [o1, o2, o3, n, lfo].forEach((s) => s.start());
    motorK = { o1, o2, o3, nb, ng, lfo, lp, cikis };
  }
  // her kare: v hız, ust tepe hız, gaz basılı mı, nitro, aktif (yarışta mı)
  function motorGuncelle({ v = 0, ust = 50, gaz = false, nitro = false, aktif = false, dt = 1 / 60 }) {
    if (!ctx || !motorK) return;
    const f = clamp(Math.abs(v) / (ust * 1.25), 0, 1);
    let vites = 1; for (let i = 1; i < VITES.length; i++) if (f >= VITES[i]) vites = i + 1;
    vites = Math.min(vites, VITES.length);
    const alt = VITES[vites - 1], ustS = VITES[vites] ?? 1.08, oran = clamp((f - alt) / (ustS - alt), 0, 1);
    const hedefRpm = v < .5 ? (gaz ? 2600 : 900) : (vites === 1 ? 1400 : 3300) + oran * 3900 + (nitro ? 400 : 0);
    motor.rpm += (hedefRpm - motor.rpm) * (1 - Math.exp(-dt * (vites !== motor.vites ? 6 : 9)));
    motor.vites = vites;
    motor.yuk += ((gaz || nitro ? 1 : 0) - motor.yuk) * (1 - Math.exp(-dt * 7));
    motor.ses += ((aktif ? 1 : 0) - motor.ses) * (1 - Math.exp(-dt * 3));
    const ates = motor.rpm / 30, t = zaman(), k = .06;
    motorK.o1.frequency.setTargetAtTime(ates, t, k);
    motorK.o2.frequency.setTargetAtTime(ates * .5, t, k);
    motorK.o3.frequency.setTargetAtTime(ates * 2.01, t, k);
    motorK.lfo.frequency.setTargetAtTime(ates, t, k);
    motorK.nb.frequency.setTargetAtTime(500 + motor.rpm * .25, t, k);
    motorK.ng.gain.setTargetAtTime(.25 + motor.yuk * .45, t, k);
    motorK.lp.frequency.setTargetAtTime(220 + motor.rpm * .09 + motor.yuk * 700, t, k);
    // ses düzeyi: alçak tutulur (baskın olmasın), gazda biraz yükselir
    motorK.cikis.gain.setTargetAtTime(motor.ses * (.05 + motor.yuk * .045 + (motor.rpm / 7000) * .025), t, .08);
  }

  /* ---------- lastik kayması ve bariyer sürtünmesi (sürekli, yalnızca olurken duyulur) ---------- */
  function surtunmeKur() {
    const n = gurultuKaynak(), bp = filtre('bandpass', 2300, 6), g = ctx.createGain(); g.gain.value = 0;
    const n2 = gurultuKaynak(), bp2 = filtre('bandpass', 650, 1.2), g2 = ctx.createGain(); g2.gain.value = 0;
    n.connect(bp); bp.connect(g); g.connect(ana); n2.connect(bp2); bp2.connect(g2); g2.connect(ana);
    n.start(); n2.start(Math.random());
    surtK = { kayma: g, kaymaF: bp, bariyer: g2 };
  }
  function surtunme(kayma, bariyer) {
    if (!ctx) return;
    const t = zaman();
    surtK.kayma.gain.setTargetAtTime(clamp(kayma, 0, 1) * .05, t, .05);
    surtK.kaymaF.frequency.setTargetAtTime(1900 + Math.random() * 500, t, .05);
    surtK.bariyer.gain.setTargetAtTime(bariyer ? .09 : 0, t, .04);
  }
  /* ---------- rüzgâr (köprüde yan rüzgâr) ---------- */
  function ruzgarKur() {
    const n = gurultuKaynak(), lp = filtre('lowpass', 500, .5), g = ctx.createGain(); g.gain.value = 0;
    n.connect(lp); lp.connect(g); g.connect(ana); n.start();
    ruzgarK = { g, lp };
  }
  function ruzgar(seviye, t0) {
    if (!ctx) return;
    const t = zaman(), s = clamp(seviye, 0, 1);
    ruzgarK.g.gain.setTargetAtTime(s * (.05 + .03 * Math.sin(t0 * 1.3)), t, .2);
    ruzgarK.lp.frequency.setTargetAtTime(350 + s * 450 + 120 * Math.sin(t0 * 2.1), t, .2);
  }
  // tünel / karton boru: motor sesi yankılanır (0 dışarıda … 1 içeride)
  function yanki(k) { if (ctx) yankiK.gain.setTargetAtTime(clamp(k, 0, 1) * .55, zaman(), .15); }

  /* ---------- tek seferlik sesler ---------- */
  // tok vuruş: düşen frekanslı sinüs (gövde) + kısa gürültü (çıtırtı)
  function tok(p, { f0 = 95, f1 = 42, sure = .22, guc = 1, parlak = 1400, gurultuG = .5, menzil = 50 } = {}) {
    if (!ctx) return;
    const t = zaman(), cik = konumla(p, menzil);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + sure);
    og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(.55 * guc, t + .006); og.gain.exponentialRampToValueAtTime(.0001, t + sure);
    o.connect(og); og.connect(cik); o.start(t); o.stop(t + sure + .05);
    const n = gurultuKaynak(false), lp = filtre('lowpass', parlak, .7), ng = ctx.createGain();
    ng.gain.setValueAtTime(.0001, t); ng.gain.exponentialRampToValueAtTime(gurultuG * guc, t + .004); ng.gain.exponentialRampToValueAtTime(.0001, t + sure * .6);
    n.connect(lp); lp.connect(ng); ng.connect(cik); n.start(t, Math.random()); n.stop(t + sure);
  }
  // patlama / top atışı: alçak gürültü süpürmesi + derin gümleme, uzun kuyruk
  function patlama(p, buyukluk = 1, menzil = 90) {
    if (!ctx) return;
    const t = zaman(), cik = konumla(p, menzil), sure = .9 + buyukluk * .6;
    const n = gurultuKaynak(false), lp = filtre('lowpass', 1800, .8), g = ctx.createGain();
    lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(140, t + sure);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.7 * buyukluk, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + sure);
    n.connect(lp); lp.connect(g); g.connect(cik); n.start(t, Math.random()); n.stop(t + sure);
    tok(p, { f0: 70, f1: 30, sure: .6, guc: .9 * buyukluk, parlak: 400, gurultuG: .2, menzil });
  }
  // havadan gelen şeyin ıslığı (gülle): yaklaştıkça yükselen, frekansı düşen ince ses
  function islik(sure, konumFn) {
    if (!ctx) return;
    const t = zaman(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(520, t + sure);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + sure * .85); g.gain.exponentialRampToValueAtTime(.0001, t + sure);
    const cik = konumla(konumFn?.(), 120); o.connect(g); g.connect(cik); o.start(t); o.stop(t + sure + .05);
  }
  // sürekli gümbürtü (yuvarlanan kaya / fıçı): tutamacı döner, her kare konum ve hız verilir
  function gumburtu(tur = 'kaya') {
    if (!ctx) return { guncelle() {}, bitir() {} };
    const n = gurultuKaynak(), lp = filtre('lowpass', tur === 'kaya' ? 170 : 320, 1.4), g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    // fıçı: tahta tıkırtısı için genlik dalgalanması
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = tur === 'kaya' ? .2 : .6;
    lfo.connect(lg); const mod = ctx.createGain(); mod.gain.value = 1; lg.connect(mod.gain);
    n.connect(lp); lp.connect(mod); mod.connect(g); g.connect(pan || ana); if (pan) pan.connect(ana);
    n.start(0, Math.random()); lfo.start();
    let bitti = false;
    return {
      guncelle(p, hiz) {
        if (bitti) return;
        const dx = p.x - dinleyici.x, dz = p.z - dinleyici.z, dist = Math.hypot(dx, dz), t = zaman();
        const duz = clamp(hiz / 14, 0, 1) / (1 + Math.pow(dist / 45, 1.6));
        g.gain.setTargetAtTime((tur === 'kaya' ? .5 : .3) * duz, t, .08);
        lfo.frequency.setTargetAtTime(2 + hiz * .6, t, .1);
        if (pan) pan.pan.setTargetAtTime(clamp((dx * dinleyici.sx + dz * dinleyici.sz) / Math.max(dist, 1), -1, 1) * .8, t, .08);
      },
      bitir() { if (bitti) return; bitti = true; const t = zaman(); g.gain.setTargetAtTime(0, t, .08); n.stop(t + .5); lfo.stop(t + .5); },
    };
  }
  // kırılma: taş/odun/karton parçalanması (birkaç kısa çıtırtı + gövde)
  function kirilma(p, tur = 'tas') {
    if (!ctx) return;
    const t = zaman(), cik = konumla(p, 55);
    const ayar = { tas: [900, .5], tahta: [1300, .45], karton: [2600, .35], buz: [5200, .3] }[tur] || [1200, .4];
    for (let i = 0; i < 5; i++) {
      const t0 = t + i * (.018 + Math.random() * .03), n = gurultuKaynak(false), bp = filtre('bandpass', ayar[0] * (.7 + Math.random() * .6), 2.5), g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(ayar[1] * (1 - i * .15), t0 + .003); g.gain.exponentialRampToValueAtTime(.0001, t0 + .07);
      n.connect(bp); bp.connect(g); g.connect(cik); n.start(t0, Math.random()); n.stop(t0 + .08);
    }
    if (tur === 'buz') for (const f of [2100, 3400, 5300]) {   // cam gibi çınlama
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * (.97 + Math.random() * .06);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .35);
      o.connect(g); g.connect(cik); o.start(t); o.stop(t + .4);
    }
    tok(p, { f0: tur === 'buz' ? 180 : 110, f1: 50, sure: .25, guc: .7, parlak: 900, gurultuG: .25, menzil: 55 });
  }
  // su sıçraması (ahtapot kolu denizden çıkarken)
  function sicrama(p) {
    if (!ctx) return;
    const t = zaman(), cik = konumla(p, 70), n = gurultuKaynak(false), hp = filtre('highpass', 700, .6), lp = filtre('lowpass', 5000, .6), g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(cik); n.start(t, Math.random()); n.stop(t + 1);
  }
  // tavada cızırtı (sosis fırlarken)
  function cizirti(p) {
    if (!ctx) return;
    const t = zaman(), cik = konumla(p, 80), n = gurultuKaynak(false), hp = filtre('highpass', 3500, .5), g = ctx.createGain();
    const am = ctx.createOscillator(), amg = ctx.createGain(); am.type = 'square'; am.frequency.value = 23; amg.gain.value = .12;
    am.connect(amg); amg.connect(g.gain);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .8);
    n.connect(hp); hp.connect(g); g.connect(cik); n.start(t, Math.random()); n.stop(t + .85); am.start(t); am.stop(t + .85);
  }
  // T-Rex kükremesi: alçak, titreşimli, ağız boşluğu filtresi açılıp kapanan, kanyonda yankılanan
  function kukreme(p) {
    if (!ctx) return;
    const t = zaman(), sure = 2.1, cik = konumla(p, 160);
    const yan = ctx.createDelay(1); yan.delayTime.value = .32; const yg = ctx.createGain(); yg.gain.value = .35; const yf = filtre('lowpass', 900, .5);
    const tum = ctx.createGain(); tum.gain.value = 1; tum.connect(cik); tum.connect(yan); yan.connect(yf); yf.connect(yg); yg.connect(cik);
    const agiz = filtre('bandpass', 300, 3); agiz.frequency.setValueAtTime(260, t); agiz.frequency.linearRampToValueAtTime(620, t + .5); agiz.frequency.linearRampToValueAtTime(230, t + sure);
    const sek = ctx.createWaveShaper(); const e = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; e[i] = Math.tanh(x * 4); } sek.curve = e;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .25); g.gain.setValueAtTime(.5, t + 1.3); g.gain.exponentialRampToValueAtTime(.0001, t + sure);
    for (const [f, tip, gg] of [[58, 'sawtooth', .6], [87, 'sawtooth', .35], [43, 'square', .25]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = tip; og.gain.value = gg;
      o.frequency.setValueAtTime(f * 1.15, t); o.frequency.linearRampToValueAtTime(f * 1.3, t + .4); o.frequency.linearRampToValueAtTime(f * .85, t + sure);
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 9; vg.gain.value = f * .06; vib.connect(vg); vg.connect(o.frequency);
      o.connect(og); og.connect(sek); o.start(t); o.stop(t + sure); vib.start(t); vib.stop(t + sure);
    }
    const n = gurultuKaynak(false), nl = filtre('lowpass', 1400, .5), ng = ctx.createGain(); ng.gain.value = .5;
    n.connect(nl); nl.connect(ng); ng.connect(sek); n.start(t, Math.random()); n.stop(t + sure);
    sek.connect(agiz); agiz.connect(g); g.connect(tum);
  }
  // nitro: basınçlı gaz "pşşş" + turbo ıslığı
  function nitro() {
    if (!ctx) return;
    const t = zaman(), n = gurultuKaynak(false), bp = filtre('bandpass', 900, .8), g = ctx.createGain();
    bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(3200, t + .5);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .04); g.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
    n.connect(bp); bp.connect(g); g.connect(ana); n.start(t, Math.random()); n.stop(t + 1.2);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(2300, t + .7);
    og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(.025, t + .1); og.gain.exponentialRampToValueAtTime(.0001, t + 1);
    o.connect(og); og.connect(ana); o.start(t); o.stop(t + 1.05);
  }
  // hız pedi: kısa hava hışırtısı
  function ped() {
    if (!ctx) return;
    const t = zaman(), n = gurultuKaynak(false), bp = filtre('bandpass', 1500, 1.2), g = ctx.createGain();
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2600, t + .3);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.09, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
    n.connect(bp); bp.connect(g); g.connect(ana); n.start(t, Math.random()); n.stop(t + .5);
  }
  // elektrik kesilmesi (tünelde ışıklar söner): alçalan uğultu + şak
  function elektrik() {
    if (!ctx) return;
    const t = zaman(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + .5);
    g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
    const lp = filtre('lowpass', 600); o.connect(lp); lp.connect(g); g.connect(ana); o.start(t); o.stop(t + .55);
    tok(null, { f0: 160, f1: 60, sure: .12, guc: .5, parlak: 3000, gurultuG: .6 });
  }
  // arayüz: geri sayım bipleri, tur ve bitiş sesleri (kısa, temiz)
  function nota(f, t0, sure, guc = .12, tip = 'triangle') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tip; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(guc, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + sure);
    o.connect(g); g.connect(ana); o.start(t0); o.stop(t0 + sure + .02);
  }
  function bip(go = false) { if (ctx) { const t = zaman(); nota(go ? 1046 : 523, t, go ? .55 : .18, .14, 'square'); if (go) nota(523, t, .55, .06, 'triangle'); } }
  function tur() { if (ctx) { const t = zaman(); nota(784, t, .18); nota(1175, t + .12, .3); } }
  function bitis() { if (ctx) { const t = zaman(); [523, 659, 784, 1046].forEach((f, i) => nota(f, t + i * .11, i === 3 ? .7 : .2, .13)); } }
  // eşya kutusu alındı: kısa, parlak yükselen üçlü; kalkan bir darbeyi karşıladı: metalik çınlama
  function esya() { if (ctx) { const t = zaman(); [784, 988, 1319].forEach((f, i) => nota(f, t + i * .055, .14, .09)); } }
  function kalkan() { if (ctx) { const t = zaman(); nota(1568, t, .35, .07, 'sine'); nota(2093, t + .02, .3, .05, 'sine'); } }

  function acKapa(yeni = !acik) {
    acik = yeni; depo.yaz('crownSes', acik ? '1' : '0');
    if (ctx) { ana.gain.setTargetAtTime(acik ? .85 : 0, zaman(), .05); if (acik) ctx.resume().catch(() => {}); }
    return acik;
  }
  // sekme arka plana geçince ses tamamen durur (pil)
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else if (acik) ctx.resume().catch(() => {}); });
  // tarayıcı izni: ilk dokunuş/tuşla ses açılır
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, baslat, { passive: true });

  return {
    baslat, acKapa, acikMi: () => acik,
    // kamera: konum ve sağ yön (sağ/sol kanal için)
    dinle(cam) {
      dinleyici.x = cam.position.x; dinleyici.y = cam.position.y; dinleyici.z = cam.position.z;
      const e = cam.matrixWorld.elements, l = Math.hypot(e[0], e[2]) || 1;   // kameranın sağ ekseni (yatay)
      dinleyici.sx = e[0] / l; dinleyici.sz = e[2] / l;
    },
    motor: motorGuncelle, surtunme, ruzgar, yanki,
    tok, patlama, islik, gumburtu, kirilma, sicrama, cizirti, kukreme, nitro, ped, elektrik, bip, tur, bitis, esya, kalkan,
  };
}

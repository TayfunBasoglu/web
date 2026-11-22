// Crown Rally çok oyunculu katmanı: lobiler, tema oylaması, araç seçimi ve yarış eşitlemesi
// (Firebase Realtime Database).
//
// BİRDEN ÇOK LOBİ: oyunu açan önce lobi listesini görür; bir lobiye katılır ya da yeni lobi kurar.
// Hiç lobi yoksa ilk gelen için lobi kendiliğinden kurulur. Oylaması/yarışı başlamış ya da dolu (5) lobiye
// katılınmaz (listede görünür, düğmesi kapalıdır). Lobideki insanların hepsi çıkınca lobi kayıtlarıyla silinir;
// herkes aniden kaybolursa (yöneticinin nabzı 30 sn gelmezse) listeyi gören ilk kişi siler.
// Lobi içinde: herkes "Hazırım" deyince → tema oylaması → araç seçimi → geri sayım → yarış → sonuçlar → yeniden lobi.
// Herkes basmadan yarış başlamaz (ekranı kapalı / uygulamadan çıkmış oyuncu beklenmez).
// Kadro her zaman 5 araçtır: hazır olan oyuncular + boş koltuklarda botlar.
// Lobiyi en önce giren (ekranı açık, sinyali gelen) oyuncu, yani yönetici yürütür: aşamaları ilerletir, botları sürer,
// yol engellerini üretir, liste özetini yazar. Ayrılırsa, ekranını kapatırsa ya da 16 sn sinyali gelmezse sıradaki devralır.
// Aşama geçişleri işlem (transaction) ile yazılır ve sunucu onaylayınca görünür: aynı anda iki cihaz yönetici sansa bile tek geçiş olur.
// Yarışta 8 sn'den uzun uzak kalanın / bağlantısı kopanın yerine bot geçer; daha kısa kopmalar affedilir.
// Oyuncunun kayıtları bağlantısı kopunca silinir; bağlantı geri gelince aynı lobiye otomatik yeniden girer
// (hazır/oy/araç seçimi korunur). Aynı hesap iki yerde açılırsa sonra açılan geçerli olur.
//
// Veritabanı (yaris/):
//   liste/<lobi>                = { ad, kurucu, kisi, faz, nabiz }   (lobi listesi özeti; o lobinin yöneticisi yazar)
//   lobi/<lobi>/oyuncular/<uid> = { ad, oturum, katilma, nabiz, uzakta?, hazir: tur, oy: "tur:tema", arac: "tur:tip" }
//   lobi/<lobi>/durum           = { faz, tur, bitis, katilimci, tema, kadro, baslangic, ilkBitis, sonuc }   (yönetici yazar)
//   lobi/<lobi>/canli/<anahtar> = { s, x, y, v, vx, b, sl, f, t }   (oyuncu kendi aracını; botları yönetici yazar)
//   lobi/<lobi>/engel/<id>      = { tip, s, x, v }                  (yönetici üretir; v = 1: kutular dağıldı)
//   aktif/<uid>                 = oturum                           (aynı hesabın en son açılan sekmesi)
export const MAX_OYUNCU = 5;
// İleride yeni temalar ve araçlar bu listelere eklenir.
export const TEMALAR = [
  { id: 'kraliyet', ad: 'Kraliyet Turu', alt: 'Kıyı yolu · Korsan koyu · Kale · Dino kanyonu · Değirmen vadisi' },
  { id: 'mutfak', ad: 'Dev Mutfak', alt: 'Dolap dibi · Ocak başı · Buzdolabı · Karton boru · Masa altı · Kedi köşesi' },
  { id: 'levent', ad: 'Levent Plazalar · ZORLU', alt: 'Büyükdere yan yolu · Ahmet Kemal Aru Sk. · Çamlık Cd. · Çayırçimen Sk. · Talatpaşa Cd.' },
];
// Araçlar yalnızca görünüşte farklıdır; hepsinin hızı ve yol tutuşu aynıdır.
export const ARACLAR = [
  { tip: 'sports', ad: 'Şimşek' }, { tip: 'muscle', ad: 'Kaslı' }, { tip: 'mini', ad: 'Minik' },
  { tip: 'van', ad: 'Karavan' }, { tip: 'buggy', ad: 'Buggy' },
  { tip: 'santa', ad: 'Noel Baba' }, { tip: 'space', ad: 'Uzay Gemisi' }, { tip: 'fire', ad: 'İtfaiye' },
  { tip: 'hotdog', ad: 'Sosisli' }, { tip: 'duck', ad: 'Ördek' },
];
const KOLTUK_RENK = ['#c0392b', '#6c3ad6', '#1690b0', '#c43a6c', '#2f9441'];
// ms. gec: başlangıçtan bu kadar sonra yarışa girilmez (izleyici olunur); sessiz: bu kadar süre konum yollamayan
// oyuncunun yerine bot geçer; enUzun: yarış ne olursa olsun bu sürede biter (unutulmuş kayıt kalmasın).
// kayip: bağlantısı kısa süre kopan oyuncu bu kadar beklenir; nabiz: her oyuncu bu aralıkla 'buradayım' yazar,
// nabizOlu: bu kadar süre nabzı gelmeyen oyuncu yönetici sayılmaz (sinyali giden telefon herkesi dondurmasın);
// listeOlu: listedeki özeti bu kadar süre tazelenmeyen lobi terk edilmiş sayılır ve silinir
const SURE = { tema: 15000, arac: 15000, hazirlik: 3000, bekle: 60000, sonuc: 12000, uzakta: 8000, gec: 5000, sessiz: 10000, enUzun: 8 * 60000,
  kayip: 8000, nabiz: 5000, nabizOlu: 16000, listeOlu: 30000 };
const FAZLAR = ['lobi', 'tema', 'arac', 'yaris', 'sonuc'];
const Y = 'yaris/';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rastgele = (a) => a[Math.floor(Math.random() * a.length)];
const karistir = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const yeniTur = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const turDegeri = (v, tur) => (typeof v === 'string' && v.startsWith(tur + ':') ? v.slice(tur.length + 1) : null);
// veritabanı listeleri nesne olarak da döndürebilir ({0: …, 1: …})
const liste = (v) => (Array.isArray(v) ? v : Object.keys(v || {}).sort((a, b) => a - b).map((k) => v[k]));

// Firebase bağlantısı: menüdeki oturum aynı sitede paylaşıldığı için burada yeniden giriş gerekmez.
async function firebaseBaglan() {
  const sdk = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const [{ initializeApp, getApps }, A, D, { firebaseConfig }] = await Promise.all([
    import(sdk + 'firebase-app.js'), import(sdk + 'firebase-auth.js'), import(sdk + 'firebase-database.js'), import('../firebase-ayar.js'),
  ]);
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const user = await new Promise((tamam) => { const kapat = A.onAuthStateChanged(auth, (u) => { kapat(); tamam(u); }); });
  if (!user) throw new Error('giris');
  const db = D.getDatabase(app);
  const r = (p) => D.ref(db, p);
  const ad = String((await D.get(r('kullanicilar/' + user.uid + '/ad'))).val() || user.email.split('@')[0]).slice(0, 20);
  let fark = 0;
  D.onValue(r('.info/serverTimeOffset'), (s) => { fark = s.val() || 0; });
  return {
    uid: user.uid, ad,
    now: () => Date.now() + fark,                       // sunucu saati (ms)
    damga: () => D.serverTimestamp(),                   // yazılırken sunucunun saati
    set: (p, v) => D.set(r(p), v), update: (p, v) => D.update(r(p), v), remove: (p) => D.remove(r(p)),
    // applyLocally: false → aşama ancak sunucu onaylayınca görünür (iki yönetici aynı anda yazarsa kaybedenin kadrosuyla yarış başlamaz)
    islem: (p, fn) => D.runTransaction(r(p), fn, { applyLocally: false }).then((s) => s.committed),
    on: (p, cb, hata) => D.onValue(r(p), (s) => cb(s.val()), hata),   // dinlemeyi bırakan işlevi döndürür
    // alt kayıtlar tek tek: her değişiklikte bütün listeyi yeniden indirmez (canlı konumlar için)
    onAlt: (p, degis, sil, hata) => {
      const b = [D.onChildAdded(r(p), (s) => degis(s.key, s.val()), hata), D.onChildChanged(r(p), (s) => degis(s.key, s.val()), hata),
        D.onChildRemoved(r(p), (s) => sil(s.key), hata)];
      return () => b.forEach((f) => f());
    },
    yeniId: () => D.push(r(Y + 'liste')).key,
    baglanti: (cb) => D.onValue(r('.info/connected'), (s) => cb(!!s.val())),
    kopunca: (p) => D.onDisconnect(r(p)).remove(), kopuncaIptal: (p) => D.onDisconnect(r(p)).cancel(),
  };
}

export async function agBaslat({ kok, oyun, yerel }) {
  const menuyeDon = () => { if (window.parent !== window) window.parent.postMessage({ tip: 'yaris-cik' }, location.origin); else location.href = '../index.html'; };
  // bağlanırken de menüye dönülebilsin (bağlantı uzun sürerse oyuncu takılı kalmasın)
  kok.innerHTML = '<div class="lb"><div class="ust"><button class="lbtn2" id="ilkCik">← Menüye dön</button></div><h2 class="it">Lobilere bağlanılıyor…</h2></div>';
  kok.querySelector('#ilkCik').onclick = menuyeDon;
  let db;
  try {
    db = yerel ? (await import('/yerel-db.js')).yerelDb(yerel) : await firebaseBaglan();
  } catch (e) {
    if (e.message === 'giris') throw new Error('Yarışa katılmak için önce Oyun Odası\'ndan giriş yapmalısın.');
    throw new Error('Lobiye bağlanılamadı (' + (e.code || e.message) + ').');
  }
  const ben = db.uid;
  // aynı hesap başka bir sekmede/cihazda açılırsa sonra açılan geçerli olur, bu oturum kendini kapatır
  const oturum = Math.random().toString(36).slice(2, 10);
  const gizli = () => document.hidden || !!window.__testGizli;
  let bagli = true, ilkBaglanti = false, baskaYerde = false, aktifSon = null;   // aktifSon: hesabın sunucudaki geçerli oturumu
  let lobi = null;                 // içinde bulunulan lobi oturumu (yoksa liste ekranı)
  let lobiler = {}, listeGeldi = false, otomatikDenendi = false, listeNotu = '', kuruluyor = false;
  let sonCizim = '';

  // Veritabanı hatası. İzin hatası (kurallar yayınlanmamış) kalıcıdır: sebebi gösterilir, yeniden denenmez.
  // Diğer hatalar (internet takılması vb.) geçicidir: mesaj gösterilir, lobiye girilince kendiliğinden kalkar.
  let hataMetni = '', izinYok = false, yavas = false;
  function hataGoster(e) {
    console.warn('Crown Rally veritabanı hatası:', e);
    if (izinYok) return;
    if (/permission[_ ]denied/i.test(`${e?.code} ${e?.message}`)) {
      izinYok = true;
      hataMetni = 'Veritabanı izin vermedi. <b>firebase-rules.json</b> dosyasının son hâlini Firebase konsolunda yayınla: Realtime Database → Rules → dosyanın tamamını yapıştır → <b>Publish</b>. Sonra bu sayfayı yenile.';
    } else if (!lobi?.katildiMi()) hataMetni = 'Bağlanılamadı (' + esc(e?.code || e?.message || e) + '). Yeniden deneniyor… İnternetini kontrol et.';
    ciz();
  }
  setTimeout(() => { if (!listeGeldi || (lobi && !lobi.katildiMi())) { yavas = true; ciz(); } }, 12000);

  // ---------- çizim (liste ya da lobi; genel durumlar önce) ----------
  function goster(ust, h) {
    // görünen bir şey değişmediyse sayfa yeniden kurulmaz (dokunuşlar boşa gitmesin)
    const html = `<div class="lb">${ust}${h}</div>`;
    if (html !== sonCizim) { sonCizim = html; kok.innerHTML = html; }
    sayacGuncelle();
  }
  function sayacGuncelle() {
    for (const el of kok.querySelectorAll('[data-bitis]')) el.textContent = Math.max(0, Math.ceil((+el.dataset.bitis - db.now()) / 1000)) + ' sn';
  }
  function ciz() {
    const menuUst = '<div class="ust"><button class="lbtn2" data-act="menu">← Menüye dön</button></div>';
    if (izinYok) return goster(menuUst, `<h2 class="it">LOBİYE GİRİLEMEDİ</h2><div class="alt">${hataMetni}</div>`);
    if (baskaYerde) return goster(menuUst, '<h2 class="it">BAŞKA YERDE AÇIK</h2><div class="alt">Bu hesapla yarış başka bir sekmede ya da cihazda açıldı. Oradan devam edebilirsin.</div>');
    if (!bagli) return goster(menuUst, '<h2 class="it">BAĞLANTI KOPTU</h2><div class="alt">İnternet bağlantın geri gelince otomatik olarak yeniden bağlanılacak.</div>');
    if (lobi) return lobi.ciz();
    listeCiz(menuUst);
  }
  const yavasNot = () => (hataMetni ? `<div class="alt">${hataMetni}</div>` : yavas ? '<div class="alt">Bağlantı uzun sürüyor. İnternetini kontrol et; sorun sürerse sayfayı yenile.</div>' : '');

  // ---------- lobi listesi ----------
  const canliLobi = (l) => !!l && db.now() - (+l.nabiz || 0) < SURE.listeOlu;
  const katilinir = (l) => l.faz === 'lobi' && (+l.kisi || 0) < MAX_OYUNCU;
  const FAZ_AD = { lobi: 'Bekliyor', tema: 'Tema oylaması', arac: 'Araç seçimi', yaris: 'Yarışta', sonuc: 'Sonuçlar' };
  // katılınabilenler üstte, kalabalık olan önce
  const acikLobiler = () => Object.entries(lobiler).filter(([, l]) => canliLobi(l))
    .sort((a, b) => (katilinir(b[1]) - katilinir(a[1])) || ((+b[1].kisi || 0) - (+a[1].kisi || 0)));
  function listeCiz(ust) {
    if (!listeGeldi || kuruluyor) return goster(ust, `<h2 class="it">${kuruluyor ? 'Lobi kuruluyor…' : 'Lobilere bağlanılıyor…'}</h2>${yavasNot()}`);
    const satirlar = acikLobiler().map(([id, l]) => {
      const ac = katilinir(l), dolu = l.faz === 'lobi' && !ac;
      return `<div class="lsatir${ac ? '' : ' kapali'}"><b>${esc(l.ad)}</b><span>${+l.kisi || 0}/${MAX_OYUNCU} oyuncu · ${dolu ? 'Dolu' : FAZ_AD[l.faz] || ''}</span>` +
        `<button class="lbtn2" data-act="katil" data-v="${esc(id)}"${ac ? '' : ' disabled'}>${ac ? 'Katıl' : dolu ? 'Dolu' : 'Yarış bitince'}</button></div>`;
    }).join('');
    goster(ust, `<h2 class="it">LOBİLER</h2>${listeNotu ? `<div class="alt">${listeNotu}</div>` : ''}
      <div class="lliste">${satirlar || '<div class="alt">Şu an açık lobi yok.</div>'}</div>
      <button class="lbtn" data-act="kur">+ YENİ LOBİ KUR</button>
      <div class="alt">Bir lobiye katıl ya da kendi lobini kur. Oylaması ya da yarışı başlamış lobiye, yarış bitince katılabilirsin.</div>`);
  }
  // terk edilmiş lobiler (herkes aniden kaybolmuş) listeyi gören ilk kişi tarafından silinir
  function copTopla() {
    for (const [id, l] of Object.entries(lobiler)) {
      if (canliLobi(l) || id === lobi?.id) continue;
      db.remove(Y + 'liste/' + id).catch(() => {}); db.remove(Y + 'lobi/' + id).catch(() => {});
    }
  }
  function otomatikKur() {   // hiç lobi yoksa ilk gelen için lobi kendiliğinden kurulur (sayfa açılışında bir kez)
    if (otomatikDenendi || lobi || !listeGeldi || !ilkBaglanti || !bagli || izinYok || baskaYerde) return;
    otomatikDenendi = true;
    if (!acikLobiler().length) lobiKur();
  }
  async function lobiKur() {
    if (lobi || kuruluyor || izinYok || baskaYerde || !bagli) return;
    kuruluyor = true; listeNotu = ''; ciz();
    const id = db.yeniId();
    try {
      await db.set(Y + 'liste/' + id, { ad: db.ad, kurucu: ben, kisi: 0, faz: 'lobi', nabiz: db.damga() });
      kuruluyor = false; lobiyeGir(id, true);
    } catch (e) { kuruluyor = false; hataGoster(e); ciz(); }
  }
  function lobiyeGir(id, yeni = false) {
    if (lobi || izinYok || baskaYerde) return;
    const l = lobiler[id];
    if (!yeni && (!l || !katilinir(l))) { listeNotu = 'Bu lobide yarış başladı ya da lobi doldu. Başka bir lobi seç ya da yeni lobi kur.'; return ciz(); }
    listeNotu = '';
    const o = lobiOturumu(id);
    if (!o.bittiMi()) lobi = o;   // kurulurken hemen kapandıysa (ör. o anda yarış başlamış) listede kalınır
    ciz();
  }
  // lobi oturumu bitince (çıkış, dolu, yarış başlamış) liste ekranına dönülür
  function listeyeDon(not = '') {
    lobi = null; listeNotu = not; sonCizim = '';
    oyun.lobiyeDon(); kok.classList.remove('hidden'); ciz();
  }
  function baskaYerdeAcildi() {
    if (baskaYerde) return;
    baskaYerde = true;
    // lobideki kaydımız bu sekmeye aitse sil: yoksa lobide "bekliyor…" diye kalan hayalet oyuncu yarışın başlamasını engellerdi
    if (lobi) db.islem(Y + 'lobi/' + lobi.id + '/oyuncular/' + ben, (cur) => (cur && cur.oturum === oturum ? null : undefined)).catch(() => {});
    lobi?.birak(); lobi = null;
    db.kopuncaIptal(Y + 'aktif/' + ben);   // kapanınca yeni oturumun 'aktif' kaydını silmeyelim
    oyun.lobiyeDon(); kok.classList.remove('hidden'); ciz();
  }

  // ---------- aynı hesap iki yerde: en son açılan geçerli ----------
  db.set(Y + 'aktif/' + ben, oturum).catch(() => {});
  db.on(Y + 'aktif/' + ben, (v) => { aktifSon = v || null; if (v && v !== oturum) baskaYerdeAcildi(); }, () => {});
  // eski tek lobili sürümden kalan kayıtlar (bir kez temizlenir; izin yoksa önemsiz)
  for (const k of ['oyuncular', 'durum', 'canli', 'engel']) db.remove(Y + k).catch(() => {});

  // ---------- bağlantı ----------
  // Firebase açılışta önce "bağlı değil", sonra "bağlı" bildirir: ilk "bağlı"dan önceki durum kopma sayılmaz.
  db.baglanti((b) => {
    if (b) {
      const geriGeldi = ilkBaglanti && !bagli;
      bagli = true; ilkBaglanti = true;
      if (!baskaYerde) db.kopunca(Y + 'aktif/' + ben);   // başka yerde açıldıysak kapanınca yeni oturumun kaydını silmeyelim
      // kopunca sunucu "aktif" kaydımızı sildi: başka sekme almadıysa geri yaz
      if (geriGeldi && !baskaYerde) db.islem(Y + 'aktif/' + ben, (cur) => (!cur || cur === oturum ? oturum : undefined)).catch(() => {});
      lobi?.baglandi(geriGeldi);
      otomatikKur();
    } else if (ilkBaglanti) bagli = false;
    ciz();
  });
  db.on(Y + 'liste', (v) => { lobiler = v || {}; listeGeldi = true; if (!lobi) { copTopla(); otomatikKur(); } ciz(); }, hataGoster);
  setInterval(() => { if (!lobi && listeGeldi) { copTopla(); ciz(); } }, 3000);   // eskiyen lobiler listeden düşsün

  // ---------- tıklamalar ----------
  kok.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'menu') return menuyeDon();
    if (act === 'kur') return lobiKur();
    if (act === 'katil') return lobiyeGir(b.dataset.v);
    lobi?.tikla(act, b);
  });

  /* =========================================================
     LOBİ OTURUMU: bir lobinin içindeki her şey (giriş, yönetici, aşamalar, çizim, ağ)
     ========================================================= */
  function lobiOturumu(lobiId) {
    const K = Y + 'lobi/' + lobiId + '/', LISTE = Y + 'liste/' + lobiId;
    let oyuncular = {}, durum = null, sonDurum = null, durumGeldi = false, oyuncularGeldi = false;
    const canli = {};
    let katildim = false, giriyor = false, benHost = false, yaris = null, not = '', cikiyor = false, bitti = false, ilkGiris = true;
    const kopunca = new Set();   // yöneticiyken bağlantı kopunca silinecek yollar
    const abone = [], zaman = [];

    // ---------- yardımcılar ----------
    const sirali = () => Object.entries(oyuncular)
      .sort((a, b) => ((+a[1].katilma || 0) - (+b[1].katilma || 0)) || (a[0] < b[0] ? -1 : 1)).map((e) => e[0]);
    const aktifler = () => sirali().slice(0, MAX_OYUNCU).filter((id) => !oyuncular[id].uzakta);   // ekranı açık olanlar
    // kısa süre uygulamadan çıkan (ör. bildirime bakan) oyuncu koltuğunu kaybetmez
    const uzun = (o, now = db.now()) => !!o.uzakta && now - o.uzakta > SURE.uzakta;
    const katilimcilar = (d) => Object.keys(d.katilimci || {}).filter((id) => oyuncular[id] && !uzun(oyuncular[id]));
    // nabzı gelen (sinyali olan) oyuncu; nabzı hiç yazılmamışsa giriş zamanı sayılır
    const canliMi = (id) => { const o = oyuncular[id]; return !!o && db.now() - Math.max(+o.nabiz || 0, +o.katilma || 0) < SURE.nabizOlu; };
    // "Hazırım" beklenenler: ekranı açık ve sinyali gelen oyuncular (telefonu kilitlenip sinyali kesilen lobiyi bekletmez)
    const beklenenler = () => aktifler().filter(canliMi);
    const sonGorulme = {};   // yarışta her aracın son konum zamanı (bağlantı kopunca canli kaydı silinse de kalır)
    const gecerliTema = (t) => TEMALAR.some((x) => x.id === t), gecerliArac = (t) => ARACLAR.some((x) => x.tip === t);
    const kayip = {};   // yarışta kaydı kaybolan oyuncunun ilk kaybolma anı (kısa kopmalar affedilir)
    function kopuncaSil(yol) { if (!kopunca.has(yol)) { kopunca.add(yol); db.kopunca(yol); } }
    function kopuncaBirak() { for (const y of kopunca) db.kopuncaIptal(y); kopunca.clear(); }
    // Aşama geçişi: durum hâlâ beklenen aşama/turdaysa yazılır; başka bir cihaz önce yazdıysa vazgeçilir.
    let gecisSuruyor = false;
    // Her yazımda sürüm (rev) bir artar ve yalnızca okunan sürüm hâlâ sunucudaysa yazılır: bağlantısı kopup dönen
    // eski yönetici, çevrimdışıyken sıraya giren eski kararlarıyla (ör. herkesi "düştü" sayan kadro) durumu ezemez.
    function gec(d, yeni) {
      yeni = { ...yeni, rev: ((d ? d.rev : yeni.rev) || 0) + 1 };
      sonDurum = yeni; gecisSuruyor = true;
      return db.islem(K + 'durum', (cur) => (d === null ? (cur ? undefined : yeni)
        : cur && cur.faz === d.faz && cur.tur === d.tur && (cur.rev || 0) === (d.rev || 0) ? yeni : undefined)).catch(hataGoster).finally(() => { gecisSuruyor = false; });
    }
    // oturumu bitir: dinlemeyi bırak, zamanlayıcıları durdur, onDisconnect görevlerini iptal et
    function birak() {
      if (bitti) return;
      bitti = true;
      abone.forEach((f) => { try { f?.(); } catch { /* zaten kapalı */ } }); zaman.forEach(clearInterval);
      document.removeEventListener('visibilitychange', gorunurluk);
      if (benHost) { benHost = false; oyun.hostDegisti(false); }
      kopuncaBirak(); db.kopuncaIptal(K + 'oyuncular/' + ben); db.kopuncaIptal(K + 'canli/' + ben);
      yaris = null;
    }

    // ---------- lobiye giriş (en fazla 5 kişi) ----------
    let secimlerim = {};   // bağlantı kısa süre koparsa yeniden girerken hazır/oy/araç seçimi kaybolmasın
    async function katilmayiDene() {
      if (bitti || katildim || giriyor || !bagli || cikiyor || baskaYerde || izinYok || !oyuncularGeldi || !durumGeldi) return;
      if (aktifSon && aktifSon !== oturum) return;   // hesap başka sekmede/cihazda geçerli: bu sekme lobiye yazmaz
      // listeden ilk girişte: bu arada oylama/yarış başladıysa ya da lobi dolduysa girmeden listeye dön
      if (ilkGiris && !oyuncular[ben] && ((durum && durum.faz !== 'lobi') || Object.keys(oyuncular).length >= MAX_OYUNCU)) {
        birak(); return listeyeDon('Bu lobide yarış başladı ya da lobi doldu. Başka bir lobi seç ya da yeni lobi kur.');
      }
      if (!oyuncular[ben] && Object.keys(oyuncular).length >= MAX_OYUNCU) {   // bağlantı koptuğu sırada yerimiz dolmuş
        birak(); return listeyeDon('Bağlantın koptuğu sırada lobi doldu. Başka bir lobi seç ya da yeni lobi kur.');
      }
      giriyor = true;
      const g = gizli(), tur = durum?.tur, eski = {};
      if (tur) for (const k of ['hazir', 'oy', 'arac']) { const v = secimlerim[k]; if (v && (v === tur || String(v).startsWith(tur + ':'))) eski[k] = v; }
      try {
        await db.set(K + 'oyuncular/' + ben, { ad: db.ad, oturum, katilma: db.damga(), nabiz: db.damga(), ...eski, ...(g ? { uzakta: db.damga() } : {}) });
        // giriş sürerken çıkıldıysa (ya da başka yerde açıldıysa) yazdığımız kayıt koltuğu sonsuza dek tutmasın
        if (bitti) { db.islem(K + 'oyuncular/' + ben, (cur) => (cur && cur.oturum === oturum ? null : undefined)).catch(() => {}); return; }
        db.kopunca(K + 'oyuncular/' + ben); db.kopunca(K + 'canli/' + ben);
        katildim = true; ilkGiris = false; hataMetni = ''; yavas = false;
        if (gizli() !== g) db.update(K + 'oyuncular/' + ben, { uzakta: gizli() ? db.damga() : null });   // giriş sırasında ekran açıldı/kapandı
      } catch (e) { hataGoster(e); } finally { giriyor = false; }
    }
    // "buradayım" sinyali: yöneticinin hâlâ bağlı olduğu buradan anlaşılır
    zaman.push(setInterval(() => { if (katildim && bagli && !gizli()) db.update(K + 'oyuncular/' + ben, { nabiz: db.damga() }).catch(() => {}); }, SURE.nabiz));
    // ekranı kapatan / uygulamadan çıkan oyuncu "uzakta" sayılır: lobiyi bekletmez, yönetici olmaz
    function gorunurluk() {
      if (katildim) db.update(K + 'oyuncular/' + ben, gizli() ? { uzakta: db.damga() } : { uzakta: null, nabiz: db.damga() });
    }
    document.addEventListener('visibilitychange', gorunurluk);

    // ---------- yönetici ----------
    // Yarış sürerken yönetici yarışan oyunculardan seçilir (botları sürebilmesi için); yoksa lobideki ilk kişi.
    function yoneticiAdayi() {
      const d = durum, hepsi = aktifler(), ak = hepsi.filter(canliMi).length ? hepsi.filter(canliMi) : hepsi;   // sinyali gidenler atlanır
      if (d && (d.faz === 'yaris' || d.faz === 'sonuc') && d.kadro) {
        const yarisan = ak.find((id) => d.kadro[id] && d.kadro[id].insan && !d.kadro[id].dustu);
        if (yarisan) return yarisan;
      }
      return ak[0];
    }
    let sonListe = '', sonListeT = 0;
    function hostKontrol() {
      const yeni = katildim && !cikiyor && !bitti && !gizli() && yoneticiAdayi() === ben;
      if (yeni === benHost) return;
      benHost = yeni; sonListe = '';
      // Not: yönetici koparsa durum/engel/liste SİLİNMEZ (silinince oylama ve araç seçimi herkes için baştan başlıyordu).
      // Herkes aniden giderse terk edilmiş lobiyi liste ekranındaki çöp toplama 30 sn içinde siler.
      if (!benHost) kopuncaBirak();
      oyun.hostDegisti(benHost);
    }
    // liste özeti (lobi adı, kişi sayısı, aşama): değişince hemen, değişmese de nabız için 5 sn'de bir yazılır
    function listeYaz() {
      if (!benHost || !katildim) return;
      const ilk = sirali()[0] || ben, ad = (oyuncular[ilk] || oyuncular[ben] || { ad: db.ad }).ad;
      const kisi = Object.keys(oyuncular).length, faz = durum?.faz || 'lobi', imza = `${ad}|${kisi}|${faz}`, now = db.now();
      if (imza === sonListe && now - sonListeT < SURE.nabiz) return;
      sonListe = imza; sonListeT = now;
      db.set(LISTE, { ad, kurucu: ilk, kisi, faz, nabiz: db.damga() }).catch(() => {});
    }
    function temaSec(oylar) {
      oylar = oylar.filter(gecerliTema);
      if (!oylar.length) return rastgele(TEMALAR).id;
      const say = {}; for (const o of oylar) say[o] = (say[o] || 0) + 1;
      const enCok = Math.max(...Object.values(say));
      return rastgele(Object.keys(say).filter((t) => say[t] === enCok));   // eşitlikte oy alanlardan rastgele
    }
    function kadroKur(kat, secim) {
      const koltuk = karistir([0, 1, 2, 3, 4]), kadro = {};
      kat = kat.slice(0, MAX_OYUNCU);
      // aracın rengi tipinden gelir (seçim ekranındaki resimle aynı)
      kat.forEach((id, i) => { kadro[id] = { ad: oyuncular[id].ad, insan: true, tip: secim(id) || rastgele(ARACLAR).tip, grid: koltuk[i] }; });
      for (let b = 0; kat.length + b < 5; b++) kadro['bot' + (b + 1)] = { ad: 'BOT ' + (b + 1), insan: false, tip: rastgele(ARACLAR).tip, grid: koltuk[kat.length + b] };
      return kadro;
    }
    // yönetici yarışta değilse (çok nadir) sonuç canlı verilerden çıkarılır
    function sonucCanli(d) {
      return Object.entries(d.kadro).map(([id, k]) => {
        const c = (k.dustu && canli['bot_' + id]) || canli[id] || canli['bot_' + id] || {};   // düşen oyuncunun yerine geçen botun konumu
        return { id, ad: k.ad, insan: !!k.insan, t: c.f ?? 9999, tahmini: c.f == null, s: c.s || 0 };
      }).sort((a, b) => (a.tahmini - b.tahmini) || (a.tahmini ? b.s - a.s : a.t - b.t)).map(({ s, ...x }) => x);
    }
    function hostIsle() {
      if (!benHost || gecisSuruyor || bitti) return;   // önceki aşama yazısı sunucuda onaylanmadan yenisi denenmez
      if (!bagli) return;   // çevrimdışıyken karar verilmez (herkes "sessiz" görünür; sıraya giren yazılar dönünce durumu bozardı)
      listeYaz();
      const now = db.now(), d = durum;
      if (!d) {   // ilk kez ya da önceki yönetici ayrıldı: kaldığı yerden devam et
        const devam = sonDurum && (sonDurum.faz === 'yaris' || sonDurum.faz === 'sonuc');
        gec(null, devam ? sonDurum : { faz: 'lobi', tur: yeniTur() });
        return;
      }
      // tanınmayan / eksik durum (ör. eski sürümden kalma): lobiyi baştan aç
      if (!FAZLAR.includes(d.faz) || typeof d.tur !== 'string' || ((d.faz === 'yaris' || d.faz === 'sonuc') && !d.kadro)) return gec(d, { faz: 'lobi', tur: yeniTur() });
      if (d.faz === 'lobi') {
        // lobideki herkes (ekranı açık olanlar) "Hazırım" deyince başlar; herkes basmadan başlamaz
        const ids = beklenenler();
        if (ids.length && ids.every((id) => oyuncular[id].hazir === d.tur)) {
          gec(d, { faz: 'tema', tur: d.tur, katilimci: Object.fromEntries(ids.map((id) => [id, true])), bitis: now + SURE.tema });
        }
      } else if (d.faz === 'tema') {
        const kat = katilimcilar(d);
        if (!kat.length) return gec(d, { faz: 'lobi', tur: yeniTur() });
        const oylar = kat.map((id) => turDegeri(oyuncular[id].oy, d.tur)).filter(Boolean);
        if (oylar.length === kat.length || now >= d.bitis) gec(d, { ...d, faz: 'arac', tema: temaSec(oylar), bitis: now + SURE.arac });
      } else if (d.faz === 'arac') {
        const kat = katilimcilar(d);
        if (!kat.length) return gec(d, { faz: 'lobi', tur: yeniTur() });
        const secim = (id) => { const t = turDegeri(oyuncular[id].arac, d.tur); return gecerliArac(t) ? t : null; };
        if (kat.every(secim) || now >= d.bitis) {
          db.remove(K + 'engel'); db.remove(K + 'canli');
          gec(d, { faz: 'yaris', tur: d.tur, tema: d.tema, kadro: kadroKur(kat, secim), baslangic: now + SURE.hazirlik });
        }
      } else if (d.faz === 'yaris') {
        const insanlar = Object.entries(d.kadro).filter(([, k]) => k.insan && !k.dustu);
        // bağlantısı kopan, uzun süre ekranı kapalı kalan ya da yarışta konum yollamayan oyuncunun yerine bot geçer
        const sessiz = (id) => now - Math.max(d.baslangic, canli[id]?.t || 0, sonGorulme[id] || 0) > SURE.sessiz;
        // kaydı kaybolan (bağlantısı kopan) oyuncu SURE.kayip kadar beklenir: kısa kopmada yarıştan atılmaz
        const kayboldu = (id) => { if (oyuncular[id]) { delete kayip[id]; return false; } kayip[id] ??= now; return now - kayip[id] > SURE.kayip; };
        const dusen = insanlar.filter(([id]) => kayboldu(id) || (oyuncular[id] && uzun(oyuncular[id], now)) || sessiz(id));
        if (dusen.length) {
          const kadro = { ...d.kadro }; for (const [id] of dusen) kadro[id] = { ...kadro[id], dustu: true };
          return gec(d, { ...d, kadro });
        }
        if (!insanlar.length) { db.remove(K + 'engel'); db.remove(K + 'canli'); return gec(d, { faz: 'lobi', tur: yeniTur() }); }
        const yarista = oyun.yarista();
        const hepsiBitti = yarista ? oyun.insanlarBitti() : insanlar.every(([id]) => canli[id]?.f != null);
        const biriBitti = yarista ? oyun.ilkBitisVar() : insanlar.some(([id]) => canli[id]?.f != null);
        if (hepsiBitti || (d.ilkBitis && now >= d.ilkBitis + SURE.bekle) || now >= d.baslangic + SURE.enUzun) {
          const sonuc = yarista ? oyun.sonucHesapla() : sonucCanli(d);
          db.remove(K + 'engel');
          gec(d, { faz: 'sonuc', tur: d.tur, tema: d.tema, kadro: d.kadro, sonuc, bitis: now + SURE.sonuc });
        } else if (!d.ilkBitis && biriBitti) gec(d, { ...d, ilkBitis: now });
      } else if (d.faz === 'sonuc') {
        if (now >= d.bitis) { db.remove(K + 'engel'); db.remove(K + 'canli'); gec(d, { faz: 'lobi', tur: yeniTur() }); }
      }
    }

    // ---------- durum değişince oyunu yönlendir ----------
    function durumDegisti() {
      const d = durum;
      if (!d) return;
      sonDurum = d;
      const benim = d.kadro && d.kadro[ben];
      // yarışa yalnızca başlarken girilir; çoktan başlamış bir yarışa (ör. sayfayı sonradan açınca) izleyici olunur
      if (d.faz === 'yaris' && benim && !benim.dustu && yaris !== d.tur && db.now() - d.baslangic < SURE.gec) {
        yaris = d.tur; not = '';
        kok.classList.add('hidden');
        oyun.yarisBaslat({ kadro: d.kadro, baslangic: d.baslangic, ben, host: benHost, tema: d.tema });
      } else if (d.faz === 'yaris' && yaris === d.tur) {
        if (benim && benim.dustu) {   // uzun süre uzakta kaldık: yarıştan çıkarıldık, izleyiciye dön
          yaris = null; not = 'Yarışla bağlantın bir süre kesildiği için yerine bot geçti. Yarış bitince sıradaki yarışa katılabilirsin.';
          oyun.lobiyeDon();
        } else oyun.kadroGuncelle(d.kadro);
      } else if (d.faz === 'sonuc' && yaris === d.tur) oyun.sonucGeldi(liste(d.sonuc));
      else if (d.faz === 'lobi' || d.faz === 'tema' || d.faz === 'arac') {
        if (yaris) { yaris = null; oyun.lobiyeDon(); }
        if (d.faz === 'arac' && d.tema) oyun.temaHazirla(d.tema);   // seçilen temanın dünyası araç seçimi sırasında hazırlanır
        if (d.faz === 'lobi') not = '';
      }
      if (yaris !== d.tur) kok.classList.remove('hidden');
      // yeni turda önceki turdan kalan seçimlerimi sil
      const o = oyuncular[ben];
      if (d.faz === 'lobi' && o && ['hazir', 'oy', 'arac'].some((k) => o[k] && o[k] !== d.tur && !String(o[k]).startsWith(d.tur + ':'))) {
        db.update(K + 'oyuncular/' + ben, { hazir: null, oy: null, arac: null });
      }
    }

    // ---------- çizim ----------
    function koltuklar(d) {
      const ids = sirali(), h = [], yonetici = yoneticiAdayi();
      for (let i = 0; i < MAX_OYUNCU; i++) {
        const id = ids[i];
        if (!id) { h.push('<div class="koltuk bos"><b>BOT</b><small>boş koltuk</small></div>'); continue; }
        const o = oyuncular[id], hazir = d && o.hazir === d.tur;
        const etiket = o.uzakta ? 'uzakta (beklenmiyor)' : !canliMi(id) ? 'bağlantı yok (beklenmiyor)' : hazir ? '✓ HAZIR' : 'bekliyor…';
        h.push(`<div class="koltuk insan${id === ben ? ' ben' : ''}${o.uzakta ? ' uzak' : ''}" style="--c:${KOLTUK_RENK[i]}"><b>${esc(o.ad)}</b>` +
          `<small class="${hazir && !o.uzakta ? 'hz' : ''}">${etiket}</small>${id === yonetici ? '<small>yönetici</small>' : ''}</div>`);
      }
      return `<div class="koltuklar">${h.join('')}</div>`;
    }
    const sayac = (bitis) => `<div class="sure" data-bitis="${bitis}"></div>`;
    function lobiCiz() {
      const d = durum, n = Object.keys(oyuncular).length;
      const ust = `<div class="ust"><button class="lbtn2" data-act="cik">← Lobilerden çık</button><span class="lbtn2" style="cursor:default">${n}/${MAX_OYUNCU} oyuncu</span></div>`;
      let h;
      if (!katildim || !d) h = '<h2 class="it">Lobiye giriliyor…</h2>' + yavasNot();
      else {
        const benimki = oyuncular[ben] || {}, katilimci = !!(d.katilimci && d.katilimci[ben]);
        if (d.faz === 'lobi') {
          const hazir = benimki.hazir === d.tur, ak = beklenenler(), hazirSay = ak.filter((id) => oyuncular[id].hazir === d.tur).length;
          h = `<h2 class="it">YARIŞ LOBİSİ</h2>${koltuklar(d)}
            <button class="lbtn${hazir ? ' on' : ''}" data-act="hazir">${hazir ? '✓ HAZIRSIN' : 'HAZIRIM'}</button>
            <div class="alt"><b>${hazirSay}/${ak.length}</b> hazır. Lobideki herkes hazır olunca tema oylaması başlar; boş koltuklara <b>bot</b> geçer.${hazir ? '<br>Vazgeçmek için tekrar bas.' : ''}</div>`;
        } else if (d.faz === 'tema') {
          const oyu = turDegeri(benimki.oy, d.tur);
          const kart = TEMALAR.map((t) => {
            const verenler = katilimcilar(d).filter((id) => turDegeri(oyuncular[id].oy, d.tur) === t.id).map((id) => oyuncular[id].ad);
            return `<button class="kart2 tema${oyu === t.id ? ' sec' : ''}" data-act="oy" data-v="${t.id}"${katilimci ? '' : ' disabled'}>
              <img src="${oyun.temaResim(t.id)}" alt=""><b>${esc(t.ad)}</b><small class="kim">${esc(t.alt)}</small>
              <span class="oy">${verenler.length} oy</span><span class="kim">${esc(verenler.join(', '))}</span></button>`;
          }).join('');
          h = `<h2 class="it">TEMA OYLAMASI</h2>${sayac(d.bitis)}<div class="secim">${kart}</div>
            <div class="alt">${katilimci ? 'Bir temaya dokunarak oy ver. <b>En çok oy alan</b> tema seçilir; eşitlikte oy alanlardan biri rastgele seçilir.' : 'Bu tur başladı; sıradaki yarışa katılacaksın.'}</div>`;
        } else if (d.faz === 'arac') {
          const secimim = turDegeri(benimki.arac, d.tur), tema = TEMALAR.find((t) => t.id === d.tema);
          const kart = ARACLAR.map((a) => {
            const secenler = katilimcilar(d).filter((id) => turDegeri(oyuncular[id].arac, d.tur) === a.tip).map((id) => oyuncular[id].ad);
            return `<button class="kart2${secimim === a.tip ? ' sec' : ''}" data-act="arac" data-v="${a.tip}"${katilimci ? '' : ' disabled'}>
              <img src="${oyun.aracResim(a.tip)}" alt=""><b>${esc(a.ad)}</b><span class="kim">${esc(secenler.join(', '))}</span></button>`;
          }).join('');
          h = `<h2 class="it">ARACINI SEÇ</h2><div class="alt">Tema: <b>${esc(tema ? tema.ad : d.tema)}</b></div>${sayac(d.bitis)}<div class="secim araclar">${kart}</div>
            <div class="alt">${katilimci ? 'Aynı aracı birden fazla kişi seçebilir. Süre bitince seçmeyene rastgele araç verilir.' : 'Bu tur başladı; sıradaki yarışa katılacaksın.'}</div>`;
        } else if (d.faz === 'yaris') {
          const adlar = Object.values(d.kadro || {}).map((k) => esc(k.ad) + (k.dustu ? ' (bot)' : '')).join(' · ');
          h = `<h2 class="it">YARIŞ SÜRÜYOR</h2><div class="alt">${adlar}</div><div class="alt">${not || 'Yarış bitince sıradaki yarışa katılabilirsin.'}</div>`;
        } else {
          const satir = liste(d.sonuc).map((x, i) => `${i + 1}. ${esc(x.ad)}${x.id === ben ? ' (Sen)' : ''}`).join('<br>');
          h = `<h2 class="it">SONUÇLAR</h2><div class="alt">${satir}</div><div class="alt">Yeni tur açılıyor:</div>${sayac(d.bitis)}`;
        }
      }
      goster(ust, h);
    }
    function guncelle() { if (bitti) return; hostKontrol(); hostIsle(); ciz(); }

    // ---------- oyuncu işlemleri ----------
    function tikla(act, b) {
      if (act === 'cik') return cik();
      const d = durum, benimki = oyuncular[ben];
      if (!d || !benimki) return;
      if (act === 'hazir' && d.faz === 'lobi') db.update(K + 'oyuncular/' + ben, { hazir: benimki.hazir === d.tur ? null : d.tur });
      if (act === 'oy' && d.faz === 'tema') db.update(K + 'oyuncular/' + ben, { oy: d.tur + ':' + b.dataset.v });
      if (act === 'arac' && d.faz === 'arac') db.update(K + 'oyuncular/' + ben, { arac: d.tur + ':' + b.dataset.v });
    }
    // lobiden çık → liste. Yalnızca bu oturumun kendi kaydına dokunulur; son kişiysek lobinin bütün kayıtları silinir.
    async function cik() {
      if (cikiyor || bitti) return;
      const benim = katildim && oyuncularGeldi && oyuncular[ben]?.oturum === oturum;
      cikiyor = true; katildim = false;
      const sonKisi = benim && Object.keys(oyuncular).every((id) => id === ben);
      // yöneticiysek: başkaları varsa ortak kayıtları silme görevini bırak (yeni yönetici kaldığı yerden devam etsin)
      if (benHost && !sonKisi) kopuncaBirak();
      if (benHost) { benHost = false; oyun.hostDegisti(false); }
      if (benim) {
        const sil = sonKisi
          ? [db.remove(Y + 'lobi/' + lobiId), db.remove(LISTE)]
          : [db.remove(K + 'oyuncular/' + ben), db.remove(K + 'canli/' + ben)];
        // bağlantı yoksa silme hiç onaylanmaz: en fazla 1,5 sn beklenir (bağlantı kopunca sunucu zaten siler)
        await Promise.race([Promise.all(sil).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
      }
      birak(); listeyeDon();
    }

    // ---------- dinleyiciler ----------
    // lobiye girmeyi yarıda bırakan bir durum olursa (bağlantı) birkaç saniyede bir yeniden dene
    zaman.push(setInterval(() => { if (!katildim && !giriyor) katilmayiDene().then(guncelle); }, 3000));
    abone.push(db.on(K + 'oyuncular', (v) => {
      if (bitti) return;
      oyuncular = v || {}; oyuncularGeldi = true;
      // aynı hesap bu lobiye başka yerden girdi. Ama geçerli oturum hâlâ biziz ise (ör. bağlantısı dönen eski sekme
      // bayat bilgiyle kaydımızın üstüne yazdı) çıkmayız, kaydımızı yeniden yazarız; eski sekme kendini kapatır.
      if (katildim && oyuncular[ben] && oyuncular[ben].oturum !== oturum) {
        if (aktifSon && aktifSon !== oturum) return baskaYerdeAcildi();
        katildim = false;
      }
      if (katildim && !oyuncular[ben]) katildim = false;   // kaydımız silinmiş (ör. bağlantı koptu): yeniden gir
      if (oyuncular[ben]?.oturum === oturum) secimlerim = { hazir: oyuncular[ben].hazir, oy: oyuncular[ben].oy, arac: oyuncular[ben].arac };
      // aynı anda iki kişi girip 5'i aşarsa en son giren çıkar ve listeye döner (yarış kadrosu 5 koltuk)
      if (katildim && sirali().indexOf(ben) >= MAX_OYUNCU) {
        katildim = false; db.remove(K + 'oyuncular/' + ben).catch(() => {});
        birak(); return listeyeDon('Lobi doldu. Başka bir lobi seç ya da yeni lobi kur.');
      }
      katilmayiDene().then(guncelle);
      guncelle();
    }, hataGoster));
    abone.push(db.on(K + 'durum', (v) => { if (bitti) return; durum = v; durumGeldi = true; durumDegisti(); katilmayiDene().then(guncelle); guncelle(); }, hataGoster));
    abone.push(db.onAlt(K + 'canli', (k, st) => { canli[k] = st; if (+st?.t) sonGorulme[k] = Math.max(sonGorulme[k] || 0, +st.t); if (k !== ben && !bitti) oyun.uzakDurum(k, st); }, (k) => { delete canli[k]; }, hataGoster));
    abone.push(db.onAlt(K + 'engel', (id, e) => { if (!bitti) oyun.engel(id, e); }, () => {}, hataGoster));
    zaman.push(setInterval(() => { if (!bitti) { hostKontrol(); hostIsle(); sayacGuncelle(); } }, 300));

    let engelNo = 0;
    return {
      id: lobiId, ciz: lobiCiz, tikla, cik, birak, bittiMi: () => bitti,
      katildiMi: () => katildim,
      // bağlantı geri gelince sunucu kaydımızı silmiştir: yeniden gir (yöneticilik baştan belirlenir)
      // (yöneticiyken koptuysak oyuna da haber verilir: yoksa iki cihaz birden botları sürer, engel üretirdi)
      baglandi(geriGeldi) { if (geriGeldi) { katildim = false; if (benHost) { benHost = false; oyun.hostDegisti(false); } kopunca.clear(); } katilmayiDene().then(guncelle); },
      // kendi aracının (yöneticiyse botların) anlık durumu
      gonder(anahtar, st) {
        if (cikiyor || bitti || baskaYerde || !bagli) return;   // bağlantı yokken konumlar birikip sonra topluca gitmesin
        if (anahtar !== ben && benHost) kopuncaSil(K + 'canli/' + anahtar);
        db.set(K + 'canli/' + anahtar, { ...st, t: db.now() });
      },
      engelId: () => 'e' + (++engelNo) + Math.random().toString(36).slice(2, 5),
      // ek: { b: oyuncunun bıraktığı (olay sırasını etkilemez), g: gecikmeli düşen tuzak }
      engelEkle(id, tip, s, x, ek = {}) { db.set(K + 'engel/' + id, { tip, s: +s.toFixed(1), x, v: 0, ...ek }); },
      engelVur(id) { db.update(K + 'engel/' + id, { v: 1 }).catch(() => {}); },   // engel çoktan silinmişse kurallar reddeder: sorun değil
    };
  }

  // ---------- yarış sayfasına verilenler (o anki lobiye yönlendirilir) ----------
  const api = {
    simdi: db.now,
    gonder: (k, st) => lobi?.gonder(k, st),
    engelId: () => lobi?.engelId() || 'e' + Math.random().toString(36).slice(2, 7),
    engelEkle: (...a) => lobi?.engelEkle(...a),
    engelVur: (id) => lobi?.engelVur(id),
    lobiGoster() { kok.classList.remove('hidden'); sonCizim = ''; ciz(); },
    // yarıştaki "✕ ÇIK" ve telefonun geri tuşu: lobideyse lobiden çıkıp listeye döner, listedeyse menüye
    cik() { if (lobi) lobi.cik(); else menuyeDon(); },
  };
  ciz();
  return api;
}

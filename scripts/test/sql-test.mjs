// SQL testi: PGlite (WASM Postgres) ile migration zincirini temiz DB'de uygular, kuyruk/kredi/kill switch mantığını doğrular. DB'ye dokunmaz.
// Supabase'e özgü parçalar (auth, roller, vault) sql-kur.mjs içinde taklit edilir.
import { kur } from "./sql-kur.mjs";
const orig = console.log; console.log = () => {};
const db = await kur();
console.log = orig;

let gecen = 0, kalan = 0;
const ok = (ad, kosul, ayrinti = "") => { if (kosul) gecen++; else kalan++; console.log(kosul ? "PASS" : "FAIL", ad, kosul ? "" : ayrinti); };
const q = async (s, p) => (await db.query(s, p)).rows;
const hata = async (s) => { try { await db.exec(s); return null; } catch (e) { return e; } };

// Veri
const [{ id: kat }] = await q("select id from asistan_mesaj.kategoriler limit 1");
const [{ id: proje }] = await q("insert into asistan_mesaj.projeler (kategori_id, ad, slug, api_key_hash) values ($1,'P','p','h') returning id", [kat]);
const [{ id: pk }] = await q("insert into asistan_mesaj.proje_kullanicilari (proje_id, dis_kullanici_id) values ($1,'u1') returning id", [proje]);
await q("insert into asistan_mesaj.kredi_cuzdanlari (proje_kullanici_id, kanal, bakiye) values ($1,'sms',5)", [pk]);
const yeniIstek = async (sandbox = false, icerik = "merhaba") => {
  const [{ id }] = await q(`insert into asistan_mesaj.mesaj_istekleri (proje_kullanici_id, kanal, mesaj_tipi, alici_hash, alici_maskeli, icerik, durum, planlanan_zaman, sandbox)
     values ($1,'sms','hizmet','h','m',$2,'queued', now() - interval '1 minute', $3) returning id`, [pk, icerik, sandbox]);
  if (!sandbox) await q("select * from asistan_mesaj.kredi_rezerve_et($1,'sms',1,$2)", [pk, id]);
  await q("insert into asistan_mesaj.mesaj_alicilari (istek_id, alici) values ($1,'905321112233')", [id]);
  return id;
};
const bakiye = async () => (await q("select bakiye from asistan_mesaj.kredi_cuzdanlari where proje_kullanici_id=$1", [pk]))[0].bakiye;
const s = async (sql, p) => (await q(sql, p))[0].s;

// 1) Kuyruk alma + lease
const a = await yeniIstek(), b = await yeniIstek(true);
ok("rezervasyon bakiyeyi düşürdü", (await bakiye()) === 4);
const alinan = await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)");
ok("iki istek alındı", alinan.length === 2, String(alinan.length));
ok("ham alıcı worker'a geldi", alinan.every((r) => r.alici === "905321112233"));
ok("sandbox bayrağı taşındı", alinan.some((r) => r.sandbox === true));
ok("lease: ikinci çağrı boş", (await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)")).length === 0);

// 2) Başarılı sonuçlandırma
ok("sonuçlandır true", (await s("select asistan_mesaj.mesaj_sonuclandir($1,true,'X1',null) as s", [a])) === true);
ok("durum sent", (await q("select durum from asistan_mesaj.mesaj_istekleri where id=$1", [a]))[0].durum === "sent");
ok("kesinlesme hareketi var", (await q("select count(*)::int c from asistan_mesaj.kredi_hareketleri where mesaj_istek_id=$1 and sebep='kesinlesme'", [a]))[0].c === 1);
ok("ham alıcı silindi", (await q("select count(*)::int c from asistan_mesaj.mesaj_alicilari where istek_id=$1", [a]))[0].c === 0);
const log = (await q("select * from asistan_mesaj.mesaj_loglari where istek_id=$1", [a]))[0];
ok("log: dusen_kredi=1, icerik_hash dolu", log.dusen_kredi === 1 && log.icerik_hash?.length === 64, JSON.stringify(log));
ok("çift çağrı false", (await s("select asistan_mesaj.mesaj_sonuclandir($1,true,'X1',null) as s", [a])) === false);
ok("hâlâ tek kesinlesme", (await q("select count(*)::int c from asistan_mesaj.kredi_hareketleri where mesaj_istek_id=$1 and sebep='kesinlesme'", [a]))[0].c === 1);

// 3) Sandbox
ok("sandbox sonuçlandır", (await s("select asistan_mesaj.mesaj_sonuclandir($1,true,'sandbox-1',null) as s", [b])) === true);
ok("sandbox: kredi hareketi yok", (await q("select count(*)::int c from asistan_mesaj.kredi_hareketleri where mesaj_istek_id=$1", [b]))[0].c === 0);
ok("sandbox: bakiye değişmedi", (await bakiye()) === 4);

// 4) Başarısız -> iade (bir kez)
const c = await yeniIstek();
await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)");
ok("iade öncesi bakiye 3", (await bakiye()) === 3);
await q("select asistan_mesaj.mesaj_sonuclandir($1,false,null,'netgsm_40')", [c]);
ok("iade sonrası bakiye 4", (await bakiye()) === 4);
await q("select asistan_mesaj.mesaj_sonuclandir($1,false,null,'netgsm_40')", [c]);
ok("çift iade yok", (await bakiye()) === 4);
ok("durum failed + hata_kodu", (await q("select durum, hata_kodu from asistan_mesaj.mesaj_istekleri where id=$1", [c]))[0].hata_kodu === "netgsm_40");

// 5) Ertele
const d = await yeniIstek();
await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)");
await q("select asistan_mesaj.mesaj_ertele($1, 3600, 'http_503')", [d]);
ok("ertelenen hemen alınmaz", (await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)")).length === 0);
ok("deneme_sayisi 1", (await q("select deneme_sayisi from asistan_mesaj.mesaj_istekleri where id=$1", [d]))[0].deneme_sayisi === 1);
await q("update asistan_mesaj.mesaj_istekleri set sonraki_deneme = now() - interval '1 second' where id=$1", [d]);
ok("vadesi gelince alınır", (await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)")).length === 1);
await q("select asistan_mesaj.mesaj_sonuclandir($1,true,'X2',null)", [d]);

// 6) Kill switch
const [{ id: admin }] = await q("insert into auth.users (email) values ('a@x.com') returning id");
await q("update core.profiles set rol='super_admin' where id=$1", [admin]);
const [{ id: digerAdmin }] = await q("insert into auth.users (email) values ('d@x.com') returning id");
await db.exec(`select set_config('request.jwt.claim.sub','${digerAdmin}',false)`);
const yetkisiz = await hata("select asistan_mesaj.gonderim_durdur('genel',null,null,'x')");
ok("yetkisiz kullanıcı durduramaz (42501)", yetkisiz?.code === "42501", yetkisiz?.message);
await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false)`);
const e = await yeniIstek();
const durdurma = await s("select asistan_mesaj.gonderim_durdur('proje',null,$1,'sızan anahtar') as s", [proje]);
ok("gonderim_engeli sebebi döndürür", (await s("select asistan_mesaj.gonderim_engeli($1,'sms') as s", [proje])) === "sızan anahtar");
ok("durdurulmuş proje kuyruktan alınmaz", (await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)")).length === 0);
const cift = await hata(`select asistan_mesaj.gonderim_durdur('proje',null,'${proje}','tekrar')`);
ok("aynı kapsamda ikinci aktif durdurma reddedilir", !!cift, "hata beklenirdi");
await q("select asistan_mesaj.gonderim_baslat($1)", [durdurma]);
ok("başlatınca engel kalkar", (await s("select asistan_mesaj.gonderim_engeli($1,'sms') as s", [proje])) === null);
ok("durdurulan mesaj kaybolmadı, şimdi alınır", (await q("select * from asistan_mesaj.mesaj_kuyruktan_al(10)")).length === 1);
await q("select asistan_mesaj.mesaj_sonuclandir($1,true,'X3',null)", [e]);
await q("select asistan_mesaj.gonderim_durdur('kanal','eposta',null,'resend kesintisi')");
ok("eposta durdurması sms'i etkilemez", (await s("select asistan_mesaj.gonderim_engeli($1,'sms') as s", [proje])) === null);
ok("eposta durdurması eposta'yı engeller", (await s("select asistan_mesaj.gonderim_engeli($1,'eposta') as s", [proje])) === "resend kesintisi");
await q("select asistan_mesaj.gonderim_durdur('genel',null,null,'acil')");
ok("genel durdurma sms'i de engeller", (await s("select asistan_mesaj.gonderim_engeli($1,'sms') as s", [proje])) !== null);
ok("audit: 3 durdur + 1 baslat", (await q("select count(*)::int c from asistan_mesaj.audit_log where eylem in ('gonderim_durdur','gonderim_baslat')"))[0].c === 4);
ok("sebepsiz durdurma reddedilir", !!(await hata("select asistan_mesaj.gonderim_durdur('kanal','telegram',null,'  ')")));

// 7) Sandbox ayarı + teslim
await q("select asistan_mesaj.proje_sandbox_ayarla($1,true)", [proje]);
ok("proje sandbox açıldı", (await q("select sandbox from asistan_mesaj.projeler where id=$1", [proje]))[0].sandbox === true);
ok("teslim_kaydet eşleşir", (await s("select asistan_mesaj.teslim_kaydet('X1','delivered', now()) as s")) === true);
ok("teslim_durumu yazıldı", (await q("select teslim_durumu from asistan_mesaj.mesaj_loglari where istek_id=$1", [a]))[0].teslim_durumu === "delivered");
ok("bilinmeyen dis id false", (await s("select asistan_mesaj.teslim_kaydet('YOK','delivered', now()) as s")) === false);

// 8) Kredi bildirimi + askıda bekleme + yenilenince devam
await q("select asistan_mesaj.proje_sandbox_ayarla($1,false)", [proje]);
await q("select asistan_mesaj.gonderim_baslat(id) from asistan_mesaj.gonderim_durdurmalari where aktif");
const [{ id: pk2 }] = await q("insert into asistan_mesaj.proje_kullanicilari (proje_id, dis_kullanici_id, eposta) values ($1,'u2','u2@x.com') returning id", [proje]);
await q("insert into asistan_mesaj.kredi_cuzdanlari (proje_kullanici_id, kanal, bakiye, esik) values ($1,'sms',3,3)", [pk2]);
const bildirimler = async () => (await q("select olay from asistan_mesaj.kredi_bildirimleri where proje_kullanici_id=$1 order by created_at, olay", [pk2])).map((r) => r.olay);
const bakiye2 = async () => (await q("select bakiye from asistan_mesaj.kredi_cuzdanlari where proje_kullanici_id=$1", [pk2]))[0].bakiye;
// API akışının aynısı: pending satır + ham alıcı, sonra rezervasyon; olmazsa askıya al.
const apiIstegi = async (planlanan = null) => {
  const [{ id }] = await q(`insert into asistan_mesaj.mesaj_istekleri (proje_kullanici_id, kanal, mesaj_tipi, alici_hash, alici_maskeli, icerik, durum, planlanan_zaman)
     values ($1,'sms','hizmet','h','m','x','pending',$2) returning id`, [pk2, planlanan]);
  await q("insert into asistan_mesaj.mesaj_alicilari (istek_id, alici) values ($1,'905321112233')", [id]);
  const r = await q("select * from asistan_mesaj.kredi_rezerve_et($1,'sms',1,$2)", [pk2, id]);
  if (r.length) { await q("update asistan_mesaj.mesaj_istekleri set durum='queued' where id=$1", [id]); return { id, durum: "queued" }; }
  const [a] = await q("select * from asistan_mesaj.mesaj_askiya_al($1)", [id]);
  return { id, durum: a.durum, bakiye: a.bakiye };
};
const durum = async (id) => (await q("select durum, askiya_alinma, hata_kodu from asistan_mesaj.mesaj_istekleri where id=$1", [id]))[0];

const m1 = await apiIstegi();
ok("eşik altına inince kredi.esik_alti bildirimi", JSON.stringify(await bildirimler()) === '["kredi.esik_alti"]', JSON.stringify(await bildirimler()));
await apiIstegi();
ok("eşik altında ikinci düşüşte tekrar bildirim yok", (await bildirimler()).length === 1);
await apiIstegi();
ok("sıfıra inince kredi.tukendi bildirimi", (await bildirimler()).includes("kredi.tukendi"), JSON.stringify(await bildirimler()));
const h1 = await apiIstegi(), h2 = await apiIstegi(), h3 = await apiIstegi();
ok("kredi yokken mesaj askıya alınır", h1.durum === "askida" && h2.durum === "askida" && h3.durum === "askida", JSON.stringify(h1));
const d1 = await durum(h1.id);
ok("askıdaki: pending + askiya_alinma + yetersiz_kredi", d1.durum === "pending" && d1.askiya_alinma && d1.hata_kodu === "yetersiz_kredi", JSON.stringify(d1));
ok("askıdaki ham alıcı silinmedi", (await q("select count(*)::int c from asistan_mesaj.mesaj_alicilari where istek_id=$1", [h1.id]))[0].c === 1);
ok("askıdaki worker'a gitmez", !(await q("select istek_id from asistan_mesaj.mesaj_kuyruktan_al(100)")).some((r) => [h1.id, h2.id, h3.id].includes(r.istek_id)));
ok("askıya almada kredi düşmez", (await bakiye2()) === 0);
ok("tükendi bildirimi tekrarlanmaz", (await bildirimler()).filter((o) => o === "kredi.tukendi").length === 1);

// Yükleme: 2 kredi → en eski iki askıdaki sırayla kuyruğa girer, üçüncüsü bekler
await q("update asistan_mesaj.kredi_cuzdanlari set bakiye = bakiye + 2, bakiye_versiyonu = bakiye_versiyonu + 1 where proje_kullanici_id=$1", [pk2]);
ok("yükleme sonrası en eski askıdaki kuyrukta", (await durum(h1.id)).durum === "queued" && (await durum(h2.id)).durum === "queued");
ok("bakiye yetmeyen askıda kalır", (await durum(h3.id)).durum === "pending" && !!(await durum(h3.id)).askiya_alinma);
ok("devam eden için rezervasyon hareketi var", (await q("select count(*)::int c from asistan_mesaj.kredi_hareketleri where mesaj_istek_id=$1 and sebep='rezervasyon'", [h1.id]))[0].c === 1);
ok("devam edince bakiye 0", (await bakiye2()) === 0);
ok("devam eden hata_kodu temizlendi", (await durum(h1.id)).hata_kodu === null);
// İade de bakiyeyi artırır → askıdaki devam eder
await q("select * from asistan_mesaj.mesaj_kuyruktan_al(100)");
await q("select asistan_mesaj.mesaj_sonuclandir($1,false,null,'netgsm_40')", [h1.id]);
ok("iade sonrası kalan askıdaki de devam eder", (await durum(h3.id)).durum === "queued");
ok("iade + devam sonrası bakiye 0", (await bakiye2()) === 0);
ok("ilk mesaj etkilenmedi", (await durum(m1.id)).durum === "queued" || (await durum(m1.id)).durum === "sent");

// Askıya alırken kredi gelmişse (yarış) mesaj askıda unutulmaz
const h4 = await apiIstegi();
ok("yarış öncesi askıda", h4.durum === "askida");
const [{ id: y5 }] = await q(`insert into asistan_mesaj.mesaj_istekleri (proje_kullanici_id, kanal, mesaj_tipi, alici_hash, alici_maskeli, icerik, durum)
   values ($1,'sms','hizmet','h','m','x','pending') returning id`, [pk2]);
await q("update asistan_mesaj.kredi_cuzdanlari set bakiye = 2 where proje_kullanici_id=$1", [pk2]);
const [r5] = await q("select * from asistan_mesaj.mesaj_askiya_al($1)", [y5]);
ok("askıya alma anında bakiye varsa hemen kuyruğa girer", r5.durum === "queued" && (await durum(h4.id)).durum === "queued", JSON.stringify(r5));

// Sandbox mesaj askıya alınmaz
const [{ id: sb }] = await q(`insert into asistan_mesaj.mesaj_istekleri (proje_kullanici_id, kanal, mesaj_tipi, alici_hash, alici_maskeli, icerik, durum, sandbox)
   values ($1,'sms','hizmet','h','m','x','pending',true) returning id`, [pk2]);
ok("sandbox askıya alınmaz", (await q("select * from asistan_mesaj.mesaj_askiya_al($1)", [sb])).length === 0);

// Zaman aşımı: 30 günü geçen askıdaki kapanır, ham alıcı silinir
await q("update asistan_mesaj.kredi_cuzdanlari set bakiye = 0 where proje_kullanici_id=$1", [pk2]);
const h6 = await apiIstegi();
await q("update asistan_mesaj.mesaj_istekleri set askiya_alinma = now() - interval '31 days' where id=$1", [h6.id]);
ok("zaman aşımı 1 mesaj kapattı", (await s("select asistan_mesaj.askidaki_zaman_asimi(30) as s")) === 1);
const d6 = await durum(h6.id);
ok("zaman aşımı: failed/askida_zaman_asimi", d6.durum === "failed" && d6.hata_kodu === "askida_zaman_asimi", JSON.stringify(d6));
ok("zaman aşımı: ham alıcı silindi", (await q("select count(*)::int c from asistan_mesaj.mesaj_alicilari where istek_id=$1", [h6.id]))[0].c === 0);
ok("zaman aşımı: log yazıldı", (await q("select sonuc from asistan_mesaj.mesaj_loglari where istek_id=$1", [h6.id]))[0]?.sonuc === "askida_zaman_asimi");
ok("tara: bakiye yokken 0", (await s("select asistan_mesaj.askidakileri_tara() as s")) === 0);

// Sessiz saat: 22:00 TRT → ertesi 08:00 TRT; 12:00 TRT → aynen
ok("sessiz saat 22:00 TRT → 08:00", new Date((await s("select asistan_mesaj.sessiz_saat_sonrasi('2026-10-01T19:00:00Z') as s"))).toISOString() === "2026-10-02T05:00:00.000Z");
ok("sessiz saat 03:00 TRT → aynı gün 08:00", new Date((await s("select asistan_mesaj.sessiz_saat_sonrasi('2026-10-01T00:00:00Z') as s"))).toISOString() === "2026-10-01T05:00:00.000Z");
ok("gündüz aynen", new Date((await s("select asistan_mesaj.sessiz_saat_sonrasi('2026-10-01T09:00:00Z') as s"))).toISOString() === "2026-10-01T09:00:00.000Z");

// Bildirim alma (lease) + hedef bilgileri
const alinanBildirim = await q("select * from asistan_mesaj.kredi_bildirimi_al(10)");
ok("bildirim alındı + e-posta hedefi taşındı", alinanBildirim.length >= 2 && alinanBildirim.every((b) => b.kullanici_eposta === "u2@x.com"), JSON.stringify(alinanBildirim[0]));
ok("bildirim lease: ikinci çağrı boş", (await q("select * from asistan_mesaj.kredi_bildirimi_al(10)")).length === 0);

console.log(`\n${gecen} geçti, ${kalan} kaldı`);
process.exit(kalan ? 1 : 0);

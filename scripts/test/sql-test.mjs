// SQL testi: PGlite (WASM Postgres) ile migration zincirini temiz DB'de uygular, kuyruk/kredi/kill switch mantığını doğrular. DB'ye dokunmaz.
// Supabase'e özgü parçalar (auth, roller, vault) sql-kur.mjs içinde taklit edilir.
import { kur } from "./sql-kur.mjs";
const orig = console.log; console.log = () => {};
const db = await kur();
console.log = orig;

let gecen = 0, kalan = 0;
const ok = (ad, kosul, ayrinti = "") => { kosul ? gecen++ : kalan++; console.log(kosul ? "PASS" : "FAIL", ad, kosul ? "" : ayrinti); };
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

console.log(`\n${gecen} geçti, ${kalan} kaldı`);
process.exit(kalan ? 1 : 0);

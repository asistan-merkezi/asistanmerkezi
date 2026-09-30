// Repo içindeki .tmp-test/ altına TS kaynaklarını kopyalayıp (server-only ve @/ takma adı temizlenmiş)
// Node'un tip-soyma moduyla çalıştırır. Repo'ya kalıcı bir şey eklemez; sonunda klasör silinir.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const HEDEF = join(REPO, ".tmp-test");
rmSync(HEDEF, { recursive: true, force: true });

const dosyalar = [
  "lib/saglayicilar/tipler.ts", "lib/saglayicilar/ayar.ts", "lib/saglayicilar/netgsm.ts",
  "lib/saglayicilar/resend.ts", "lib/saglayicilar/sandbox.ts", "lib/saglayicilar/svix.ts",
  "lib/mesaj/gonderim-motoru.ts", "lib/mesaj/webhook-isle.ts", "lib/paralel.ts",
  "lib/mesaj/imza.ts", "lib/mesaj/kredi-bildirim.ts",
];
for (const d of dosyalar) {
  let kaynak = readFileSync(join(REPO, d), "utf8").replace(/import "server-only";\r?\n/, "");
  kaynak = kaynak.replace(/from "@\/lib\/([^"]+)"/g, (_, yol) => {
    let goreli = relative(dirname(join(HEDEF, d)), join(HEDEF, "lib", yol)).replace(/\\/g, "/");
    if (!goreli.startsWith(".")) goreli = "./" + goreli;
    return `from "${goreli}.ts"`;
  });
  const hedef = join(HEDEF, d);
  mkdirSync(dirname(hedef), { recursive: true });
  writeFileSync(hedef, kaynak);
}
const yukle = (d) => import(pathToFileURL(join(HEDEF, d)).href);

let gecen = 0, kalan = 0;
const ok = (ad, k, ayrinti = "") => { if (k) gecen++; else kalan++; console.log(k ? "PASS" : "FAIL", ad, k ? "" : ayrinti); };
const gercekFetch = globalThis.fetch;
const sahteFetch = (yanitla) => { const cagrilar = []; globalThis.fetch = async (url, init) => { cagrilar.push({ url, init }); return yanitla(url, init); }; return cagrilar; };
const json = (govde, durum = 200, basliklar = {}) => new Response(JSON.stringify(govde), { status: durum, headers: basliklar });

try {
  // ── Svix (Svix dokümanındaki resmî test vektörü) ──
  const { svixDogrula } = await yukle("lib/saglayicilar/svix.ts");
  const gercekNow = Date.now;
  Date.now = () => 1614265330 * 1000;
  const sir = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", id = "msg_p5jXN8AQM9LWM0D4loKWxJek", ts = "1614265330";
  const govde = '{"test": 2432232314}', imza = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
  ok("svix: resmî vektör geçerli", svixDogrula(sir, govde, id, ts, imza));
  ok("svix: çoklu imza içinden eşleşir", svixDogrula(sir, govde, id, ts, `v1,AAAA ${imza}`));
  ok("svix: gövde değişince reddedilir", !svixDogrula(sir, govde + " ", id, ts, imza));
  ok("svix: yanlış imza reddedilir", !svixDogrula(sir, govde, id, ts, "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OA="));
  ok("svix: başlık eksik reddedilir", !svixDogrula(sir, govde, null, ts, imza));
  Date.now = () => (1614265330 + 301) * 1000;
  ok("svix: 5 dk'dan eski zaman reddedilir", !svixDogrula(sir, govde, id, ts, imza));
  Date.now = gercekNow;

  // ── Sandbox ──
  const { sandboxGonder } = await yukle("lib/saglayicilar/sandbox.ts");
  ok("sandbox: normal → başarılı", sandboxGonder({ istekId: "i1", alici: "5321112233" }).tur === "basarili");
  ok("sandbox: …000 → kalıcı", sandboxGonder({ istekId: "i1", alici: "5321110000" }).tur === "kalici_hata");
  ok("sandbox: …500 → geçici", sandboxGonder({ istekId: "i1", alici: "5321110500" }).tur === "gecici_hata");

  // ── Netgsm ──
  const { netgsmGonder, netgsmNumara } = await yukle("lib/saglayicilar/netgsm.ts");
  ok("netgsm numara: +90 5xx", netgsmNumara("+90 532 111 22 33") === "5321112233");
  ok("netgsm numara: 0 5xx", netgsmNumara("0532 111 22 33") === "5321112233");
  ok("netgsm numara: geçersiz", netgsmNumara("12345") === null);
  const nAyar = { apiUrl: "https://api.netgsm.com.tr/sms/rest/v2/", kullaniciKodu: "8500000000", sifre: "s3", baslik: "ASISTAN" };
  const nIstek = { istekId: "i1", alici: "+905321112233", icerik: "Merhaba", konu: null, gonderen: { ad: null, adres: null, smsBasligi: null } };

  let c = sahteFetch(() => json({ code: "00", jobid: 12345 }));
  let s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: 00 → başarılı + jobid", s.tur === "basarili" && s.disMesajId === "12345", JSON.stringify(s));
  ok("netgsm: URL /send", c[0].url === "https://api.netgsm.com.tr/sms/rest/v2/send", c[0].url);
  ok("netgsm: Basic auth", c[0].init.headers.Authorization === `Basic ${Buffer.from("8500000000:s3").toString("base64")}`);
  const nGovde = JSON.parse(c[0].init.body);
  ok("netgsm: gövde alanları", nGovde.msgheader === "ASISTAN" && nGovde.encoding === "TR" && nGovde.messages[0].no === "5321112233" && nGovde.messages[0].msg === "Merhaba", c[0].init.body);
  sahteFetch(() => json({ code: "30" })); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: 30 → kalıcı netgsm_30", s.tur === "kalici_hata" && s.kod === "netgsm_30");
  sahteFetch(() => json({ code: "40" })); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: 40 → kalıcı", s.tur === "kalici_hata" && s.kod === "netgsm_40");
  sahteFetch(() => json({ code: "80" })); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: 80 → geçici", s.tur === "gecici_hata");
  sahteFetch(() => json({}, 503, { "retry-after": "42" })); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: HTTP 503 → geçici + Retry-After", s.tur === "gecici_hata" && s.beklemeSn === 42, JSON.stringify(s));
  sahteFetch(() => json({}, 429)); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: HTTP 429 → geçici", s.tur === "gecici_hata");
  sahteFetch(() => { throw new Error("ağ"); }); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: ağ hatası → geçici", s.tur === "gecici_hata" && s.kod === "ag_hatasi");
  sahteFetch(() => new Response("<html>", { status: 200 })); s = await netgsmGonder(nAyar, nIstek);
  ok("netgsm: okunamayan yanıt → kalıcı (çift SMS riski alma)", s.tur === "kalici_hata");
  c = sahteFetch(() => json({ code: "00" })); s = await netgsmGonder(nAyar, { ...nIstek, alici: "abc" });
  ok("netgsm: geçersiz alıcıda istek atılmaz", s.tur === "kalici_hata" && c.length === 0);

  // ── Resend ──
  const { resendGonder } = await yukle("lib/saglayicilar/resend.ts");
  const rAyar = { apiUrl: "https://api.resend.com", apiAnahtari: "re_x", varsayilanGonderen: "bildirim@asistanmerkezi.com" };
  const rIstek = { istekId: "istek-1", alici: "a@b.com", icerik: "Merhaba", konu: "Konu", gonderen: { ad: null, adres: null, smsBasligi: null } };
  c = sahteFetch(() => json({ id: "em_1" }));
  s = await resendGonder(rAyar, rIstek);
  ok("resend: 200 → başarılı + id", s.tur === "basarili" && s.disMesajId === "em_1");
  ok("resend: URL /emails + Bearer + Idempotency-Key", c[0].url === "https://api.resend.com/emails" && c[0].init.headers.Authorization === "Bearer re_x" && c[0].init.headers["Idempotency-Key"] === "istek-1");
  const rGovde = JSON.parse(c[0].init.body);
  ok("resend: from/to/subject", rGovde.from === "bildirim@asistanmerkezi.com" && rGovde.to[0] === "a@b.com" && rGovde.subject === "Konu");
  c = sahteFetch(() => json({ id: "em_2" }));
  await resendGonder(rAyar, { ...rIstek, gonderen: { ad: 'Klinik "X"', adres: "klinik@x.com", smsBasligi: null } });
  ok("resend: gönderen adı/adresi", JSON.parse(c[0].init.body).from === "Klinik X <klinik@x.com>", c[0].init.body);
  sahteFetch(() => json({ name: "rate_limit_exceeded" }, 429, { "retry-after": "2" })); s = await resendGonder(rAyar, rIstek);
  ok("resend: 429 → geçici", s.tur === "gecici_hata" && s.beklemeSn === 2);
  sahteFetch(() => json({ name: "validation_error", message: "gizli@x.com hatalı" }, 422)); s = await resendGonder(rAyar, rIstek);
  ok("resend: 422 → kalıcı resend_validation_error (mesaj sızmaz)", s.tur === "kalici_hata" && s.kod === "resend_validation_error" && !JSON.stringify(s).includes("gizli"));
  sahteFetch(() => json({}, 500)); s = await resendGonder(rAyar, rIstek);
  ok("resend: 500 → geçici", s.tur === "gecici_hata");
  c = sahteFetch(() => json({ id: "x" })); s = await resendGonder(rAyar, { ...rIstek, alici: "eposta-degil" });
  ok("resend: geçersiz e-postada istek atılmaz", s.tur === "kalici_hata" && c.length === 0);

  // ── Motor (sahte veritabanı) ──
  const { kuyruguIsle } = await yukle("lib/mesaj/gonderim-motoru.ts");
  const sahteAdmin = ({ satirlar, ayar = null, gizli = {} }) => {
    const rpcler = [];
    return {
      rpcler,
      rpc: async (ad, p) => {
        rpcler.push({ ad, p });
        if (ad === "mesaj_kuyruktan_al") return { data: satirlar, error: null };
        if (ad === "kanal_gizli_oku") return { data: gizli[p.p_anahtar] ?? null, error: null };
        return { data: true, error: null };
      },
      from: (tablo) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            maybeSingle: async () => ({ data: tablo === "saglayici_ayarlari" ? ayar : null }),
          }),
        }),
      }),
    };
  };
  const satir = (o = {}) => ({ istek_id: "r1", kanal: "sms", icerik: "Merhaba", konu: null, sandbox: false, deneme_sayisi: 0, gonderen_kimlik_id: null, alici: "5321112233", ...o });
  const smsAyar = { saglayici: "Netgsm", aktif: true, api_url: "https://api.netgsm.com.tr/sms/rest/v2", api_versiyonu: null, ayarlar: { kullanici_kodu: "85", ortak_baslik: "ASISTAN" } };
  const bul = (a, ad) => a.rpcler.find((r) => r.ad === ad);

  let a = sahteAdmin({ satirlar: [satir({ sandbox: true })] });
  let ozet = await kuyruguIsle(a);
  ok("motor: sandbox → sağlayıcı ayarı olmadan başarılı", ozet.gonderilen === 1 && bul(a, "mesaj_sonuclandir").p.p_basarili === true && bul(a, "mesaj_sonuclandir").p.p_dis_mesaj_id === "sandbox-r1", JSON.stringify(ozet));

  a = sahteAdmin({ satirlar: [satir()], ayar: null });
  ozet = await kuyruguIsle(a);
  ok("motor: ayar yok → kalıcı saglayici_yapilandirilmamis + iade yolu", ozet.basarisiz === 1 && bul(a, "mesaj_sonuclandir").p.p_hata_kodu === "saglayici_yapilandirilmamis");

  a = sahteAdmin({ satirlar: [satir({ kanal: "whatsapp" })], ayar: { ...smsAyar, aktif: true } });
  ozet = await kuyruguIsle(a);
  ok("motor: whatsapp → kanal_desteklenmiyor", bul(a, "mesaj_sonuclandir").p.p_hata_kodu === "kanal_desteklenmiyor");

  a = sahteAdmin({ satirlar: [satir({ alici: null })], ayar: smsAyar });
  await kuyruguIsle(a);
  ok("motor: ham alıcı yok → alici_yok", bul(a, "mesaj_sonuclandir").p.p_hata_kodu === "alici_yok");

  sahteFetch(() => json({ code: "00", jobid: 99 }));
  a = sahteAdmin({ satirlar: [satir()], ayar: smsAyar, gizli: { sifre: "pw" } });
  ozet = await kuyruguIsle(a);
  ok("motor: SMS başarılı → sonuclandir(true, jobid)", ozet.gonderilen === 1 && bul(a, "mesaj_sonuclandir").p.p_dis_mesaj_id === "99");

  sahteFetch(() => json({}, 503));
  a = sahteAdmin({ satirlar: [satir({ deneme_sayisi: 0 })], ayar: smsAyar, gizli: { sifre: "pw" } });
  ozet = await kuyruguIsle(a);
  const ert = bul(a, "mesaj_ertele");
  ok("motor: geçici hata (1. deneme) → ertele, kredi dokunulmaz", ozet.ertelenen === 1 && !!ert && !bul(a, "mesaj_sonuclandir") && ert.p.p_saniye >= 30 && ert.p.p_saniye <= 38, JSON.stringify(ert));

  a = sahteAdmin({ satirlar: [satir({ deneme_sayisi: 1 })], ayar: smsAyar, gizli: { sifre: "pw" } });
  await kuyruguIsle(a);
  ok("motor: 2. denemede bekleme ≥ 60 sn (üstel)", bul(a, "mesaj_ertele").p.p_saniye >= 60);

  a = sahteAdmin({ satirlar: [satir({ deneme_sayisi: 2 })], ayar: smsAyar, gizli: { sifre: "pw" } });
  ozet = await kuyruguIsle(a);
  ok("motor: 3. denemede tükenir → başarısız (iade yolu)", ozet.basarisiz === 1 && bul(a, "mesaj_sonuclandir").p.p_hata_kodu === "http_503_denemeler_tukendi" && !bul(a, "mesaj_ertele"));

  sahteFetch(() => json({ code: "40" }));
  a = sahteAdmin({ satirlar: [satir()], ayar: smsAyar, gizli: { sifre: "pw" } });
  await kuyruguIsle(a);
  ok("motor: kalıcı hata ilk denemede sonuçlanır", bul(a, "mesaj_sonuclandir").p.p_hata_kodu === "netgsm_40" && !bul(a, "mesaj_ertele"));

  a = sahteAdmin({ satirlar: [satir({ kanal: "eposta", alici: "a@b.com", konu: "K" })], ayar: { ...smsAyar, api_url: "https://api.resend.com", ayarlar: {} }, gizli: { api_anahtari: "re_k" } });
  c = sahteFetch(() => json({ id: "em_9" }));
  await kuyruguIsle(a);
  ok("motor: e-posta → Resend, varsayılan gönderen", JSON.parse(c[0].init.body).from === "bildirim@asistanmerkezi.com" && bul(a, "mesaj_sonuclandir").p.p_dis_mesaj_id === "em_9");

  a = sahteAdmin({ satirlar: [satir({ kanal: "sms" })], ayar: { ...smsAyar, ayarlar: { kullanici_kodu: "85" } }, gizli: { sifre: "pw" } });
  await kuyruguIsle(a);
  ok("motor: SMS başlığı yoksa sms_basligi_yok", bul(a, "mesaj_sonuclandir").p.p_hata_kodu === "sms_basligi_yok");

  // ── Kredi bildirimi teslimi (sahte veritabanı) ──
  const { krediBildirimleriniIsle, bildirimMetni } = await yukle("lib/mesaj/kredi-bildirim.ts");
  const { imzaDogrula } = await yukle("lib/mesaj/imza.ts");
  process.env.MERKEZ_INTERNAL_SECRET = "gizli-sir";
  const bildirimAdmin = ({ satirlar, epostaAyar = { saglayici: "Resend", aktif: true, api_url: "https://api.resend.com", api_versiyonu: null, ayarlar: {} } }) => {
    const guncellemeler = [];
    return {
      guncellemeler,
      rpc: async (ad, p) => {
        if (ad === "kredi_bildirimi_al") return { data: satirlar, error: null };
        if (ad === "kanal_gizli_oku") return { data: p.p_anahtar === "api_anahtari" ? "re_k" : null, error: null };
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: epostaAyar }) }) }),
        update: (deger) => ({ eq: async (_k, id) => { guncellemeler.push({ id, ...deger }); return { error: null }; } }),
      }),
    };
  };
  const bildirim = (o = {}) => ({ id: "b1", olay: "kredi.esik_alti", kanal: "sms", bakiye: 49, esik: 50, deneme_sayisi: 0, webhook_durumu: "bekliyor", eposta_durumu: "bekliyor", created_at: "2026-09-30T10:00:00Z", dis_kullanici_id: "u1", kullanici_ad: "Ayşe", kullanici_eposta: "ayse@x.com", webhook_url: "https://alt.example/hook", ...o });

  c = sahteFetch((url) => (String(url).includes("resend") ? json({ id: "em_1" }) : json({ ok: true })));
  a = bildirimAdmin({ satirlar: [bildirim()] });
  await krediBildirimleriniIsle(a);
  const hook = c.find((x) => String(x.url).includes("alt.example"));
  const mail = c.find((x) => String(x.url).includes("resend"));
  ok("bildirim: webhook olay + imzalı gövde", !!hook && JSON.parse(hook.init.body).olay === "kredi.esik_alti" && imzaDogrula("gizli-sir", hook.init.body, hook.init.headers["X-Imza"]));
  ok("bildirim: e-posta kullanıcıya, konu 'azalıyor'", !!mail && JSON.parse(mail.init.body).to[0] === "ayse@x.com" && JSON.parse(mail.init.body).subject.includes("azalıyor"));
  ok("bildirim: e-posta Idempotency-Key bildirim id'sine bağlı", mail?.init.headers["Idempotency-Key"] === "kredi-bildirim-b1");
  ok("bildirim: ikisi de gönderildi → işlendi", a.guncellemeler[0].webhook_durumu === "gonderildi" && a.guncellemeler[0].eposta_durumu === "gonderildi" && !!a.guncellemeler[0].islendi_at, JSON.stringify(a.guncellemeler[0]));

  c = sahteFetch((url) => (String(url).includes("resend") ? json({ id: "em_2" }) : json({}, 503)));
  a = bildirimAdmin({ satirlar: [bildirim()] });
  await krediBildirimleriniIsle(a);
  ok("bildirim: webhook 503 → bekliyor + sonraki deneme, e-posta gönderildi", a.guncellemeler[0].webhook_durumu === "bekliyor" && a.guncellemeler[0].eposta_durumu === "gonderildi" && !a.guncellemeler[0].islendi_at && !!a.guncellemeler[0].sonraki_deneme);

  c = sahteFetch(() => json({ ok: true }));
  a = bildirimAdmin({ satirlar: [bildirim({ eposta_durumu: "gonderildi" })] });
  await krediBildirimleriniIsle(a);
  ok("bildirim: yeniden denemede gönderilmiş e-posta tekrar gitmez", c.length === 1 && String(c[0].url).includes("alt.example") && !!a.guncellemeler[0].islendi_at);

  c = sahteFetch(() => json({}, 500));
  a = bildirimAdmin({ satirlar: [bildirim({ deneme_sayisi: 4, eposta_durumu: "gonderildi" })] });
  await krediBildirimleriniIsle(a);
  ok("bildirim: 5. denemede tükenir → hata + işlendi", a.guncellemeler[0].webhook_durumu === "hata" && !!a.guncellemeler[0].islendi_at);

  c = sahteFetch(() => json({ ok: true }));
  a = bildirimAdmin({ satirlar: [bildirim({ webhook_url: null, kullanici_eposta: null })] });
  await krediBildirimleriniIsle(a);
  ok("bildirim: hedef yoksa istek atılmaz, 'yok' + işlendi", c.length === 0 && a.guncellemeler[0].webhook_durumu === "yok" && a.guncellemeler[0].eposta_durumu === "yok" && !!a.guncellemeler[0].islendi_at);

  const tukendiMetni = bildirimMetni({ olay: "kredi.tukendi", kanal: "sms", bakiye: 0, esik: 50, kullanici_ad: null });
  ok("bildirim metni: tükendi → askıda + kaldığı yerden", tukendiMetni.konu === "SMS mesaj krediniz bitti" && tukendiMetni.icerik.includes("askıya") && tukendiMetni.icerik.includes("kaldığı yerden"));
} finally {
  globalThis.fetch = gercekFetch;
  rmSync(HEDEF, { recursive: true, force: true });
}
console.log(`\n${gecen} geçti, ${kalan} kaldı`);
process.exit(kalan ? 1 : 0);

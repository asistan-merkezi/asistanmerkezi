# Asistan Merkezi

## 1. Proje Özeti

**asistanmerkezi.com** — sektörel AI destekli mikro-asistan modüllerinin çatı markası ve hub sitesi. İki işi birlikte taşır:

1. **Hub:** modül tanıtımı, merkezi kayıt/giriş, deneme süresi (trial) yönetimi, abonelik bariyeri. Her modül kendi bağımsız domaininde çalışır; hub kullanıcı/kiracı yaşam döngüsünü tek merkezden yönetir.
2. **Mesaj Merkezi:** tüm modüllerin SMS / WhatsApp / e-posta / Telegram gönderimlerini yürüten merkezi servis + genel yönetim paneli (§6). Ayrı proje değildir — aynı Next.js uygulaması, aynı Supabase projesi, kendi şeması (`asistan_mesaj`) ve kendi route segmenti.

İş modeli: 30 gün ücretsiz deneme → aylık abonelik. Bazı modüller (ör. klinik) ayrıca münferit kurulum olarak da satılır. Mesaj kullanımı ayrı kredi sistemiyle ücretlendirilir.

**Kapsam dışı:** nukhetbu.com (ayrı marka), Ganyan (ayrı hesaba taşınıyor).

## 2. Stack ve Altyapı

| Katman | Seçim | Not |
|---|---|---|
| Frontend | Next.js 16.3.5 (App Router) + React 19.2.8 + TypeScript + Tailwind CSS | Türkçe arayüz varsayılan; istek öncesi mantık `proxy.ts`'te (Next.js 16'da `middleware.ts` yerine geçti) |
| Veritabanı | Supabase / PostgreSQL (Pro Plan) | Frankfurt region — **Vodafone Cloud Türkiye (kiralık yerel sunucu) taşıması planlandı, hedef 2026-09-28 haftası**; ana sayfadaki "veriler yurt içinde saklanır" iddiası bu taşımaya dayanır |
| Hosting | Vercel | Her modül ayrı Vercel projesi |
| DNS / Trafik | Cloudflare | Modüller ayrı domainlerde, subdomain değil |
| E-posta | Resend | EU region |
| AI | Claude API | Yalnızca danışma/yorum rolünde |
| Kuyruk / Zamanlayıcı | Upstash QStash | Yalnız mesaj merkezinde; `QueueAdapter` arkasında |
| Sır yönetimi | Supabase Vault | Sağlayıcı token/key'leri; env'de düz metin yok |

**DB migration bağlantısı (pooler):** Doğrudan host (`db.epzpbfgvekfdbzierrss.supabase.co`) bu ağda yalnızca IPv6'ya çözümleniyor — A kaydı yok, Node/psql'den `ENOTFOUND` verir (`ENETUNREACH` değil). Pooler kullan: host `aws-0-eu-central-1.pooler.supabase.com` — ilk denemede bağlandı (script `aws-1`'i hiç denemedi, `aws-0` başarılı olunca durdu; nslookup'ta ikisi de çözümleniyor ama bu projeye atanan pooler `aws-0`). **Port 5432 (session mode)** kullanıldı — 6543 (transaction mode) hiç denenmedi, Villavilla'daki bilinen "prepared statement already exists" riski nedeniyle önerilmiyor. Kullanıcı: `postgres.epzpbfgvekfdbzierrss`, database `postgres`. Şifre `.env.local`'daki `SUPABASE_DB_PASSWORD`. (2026-09-14 doğrulandı, `supabase/migrations/20260914095651_core_profiles.sql` bu yöntemle çalıştırıldı.)

**Kritik kural:** iş kuralları ve dış servis entegrasyonları harici otomasyon araçlarıyla (n8n vb.) değil, doğrudan uygulama katmanında ve veritabanı mantığında (RLS, trigger, function) işlenir. Deterministik mantık ile LLM danışma rolü kesin olarak ayrılır; LLM hiçbir akışta karar verici değildir. QStash bu kuralın istisnası değildir — iş kuralı taşımaz, yalnızca taşıma ve zamanlama altyapısıdır.

## 3. Modül Haritası

Resmî tanıtım listesi (9 modül). Hub'ın modül listesi bu tabloyla birebir eşleşir.
Durum kolonu iç yol haritasını yansıtır; hub'ın herkese açık ana sayfası
henüz hiçbir modül canlı olmadığı için tümünü tek tip "Geliştirmede"
rozetiyle gösterir (bkz. §8/§9 — Klinik önceliği bu iç durumla ilgilidir,
kamuya açık rozetle değil).

| # | Modül | Domain | Durum |
|---|---|---|---|
| 1 | Catering & Yeme-İçme | villavillaasistan.com / davetyemek | Geliştirmede |
| 2 | Okul & Kreş Yönetim | okulcrm.net | Geliştirmede |
| 3 | Muayene & Sağlık (Klinik Asistanı) | — | Aktif geliştirme (öncelik) |
| 4 | Otel & Konaklama | — | Planlandı |
| 5 | Market & Tekel | — | Planlandı |
| 6 | Mağaza & Butik | — | Planlandı |
| 7 | Sekreterya / Arama / Randevu Takip | — | Planlandı |
| 8 | Ev Ekonomisi | — | Geliştirmede |
| 9 | Sosyal Medya & Dijital Pazarlama | medyaasistan.com | Geliştirmede |

Borsa & Piyasa Asistanı iptal edildi (2026-09-16); `borsaasistan.com` artık kullanılmıyor.

Bu liste aynı zamanda mesaj merkezindeki **kategori** hiyerarşisinin kaynağıdır (§6.2).
`asistan_mesaj.kategoriler` içindeki `'Borsa & Ev Ekonomisi'` (slug `borsa`) satırı henüz
güncellenmedi — DB tarafı bu iptalden ayrı bir kapsam olarak bekliyor.

## 4. Veri Modeli

Tek Supabase projesi, çoklu PostgreSQL şeması. `public` yığını kullanılmaz.

| Şema | Kapsam |
|---|---|
| `core` / `public` | profiles, tenants, abonelik/trial, yetkilendirme, audit log |
| `asistan_mesaj` | mesaj merkezi: kategori/proje/kullanıcı, kredi, gönderim, zamanlayıcı (§6.2) |
| `asistan_finans` | borsa + ev ekonomisi (takip_listesi, portfoy) |
| `asistan_catering` | catering/davet operasyonu |
| `asistan_yonetim` | mağaza/market + esnek sektörel veri (JSONB) |

**Çekirdek alanlar** tüm modüllerde sabittir: tenant, yetkili kişi, şirket bilgileri, trial durumu, auth ilişkisi. Modüle özel alanlar `custom_fields` JSONB kolonunda tutulur — çekirdeğe kolon eklenmez.

Tenant izolasyonu RLS ile zorunlu; her sorgu `tenant_id` üzerinden filtrelenir, uygulama katmanı filtresine güvenilmez.

## 5. İş Kuralları

### 5.1 Kayıt ve onboarding
Landing (tanıtım + giriş/kayıt/şifremi unuttum + kullanım kılavuzu PDF) → kayıt formu: kişisel bilgiler, işletme bilgileri, vergi dairesi/no, görev, tam yetkili değilse tam yetkilinin bilgisi, sözleşme onayı.

### 5.2 Tam yetkili doğrulama (soft verification)
Kayıtta tam yetkiliye bilgilendirme + onay linkli mail gider. Onay gelmeden de deneme başlar; ancak onaysız hesapta **ödeme, hesap silme ve yetki devri** işlemleri kısıtlıdır.

### 5.3 Deneme süresi
- Her yeni kiracıya otomatik 30 gün (DB varsayılanı). Tanıtım metinleri (ana sayfa, kayıt sayfası, meta açıklama) 2026-09-24 itibarıyla "21 gün" diyor — site henüz kullanımda değil, sistem bilinçli olarak değiştirilmedi; canlıya çıkmadan önce ikisi eşitlenmeli.
- Kalan gün sayısı panelde sürekli görünür.
- Abonelik başlayınca trial verileri kaldığı yerden devam eder; sıfırlama yok.

### 5.4 Deneme bitişi
Hesap kapatılmaz. Salt-okunur moda geçer: eski veriler görüntülenebilir ve dışa aktarılabilir, yeni kayıt/düzenleme pasiftir, panelde "Aboneliği Başlat" bariyeri gösterilir. Salt-okunur moddaki kiracı mesaj gönderemez; mevcut kredisi silinmez, dondurulur.

### 5.5 Veri saklama (retention)
Abonelik başlamazsa veriler **6 ay** saklanır. Silinmeden önce kademeli bildirim: 5. ay sonunda bir mail, silinmeye 7 gün kala ikinci mail. Silme işlemi audit log'a yazılır.

### 5.6 Denetim
Yetki değişiklikleri, abonelik durumu geçişleri, veri dışa aktarımı, silme ve manuel kredi ekleme işlemleri audit log'a kaydedilir. Log kayıtları uygulama üzerinden düzenlenemez/silinemez (append-only).

## 6. Mesaj Merkezi

### 6.1 Rol ve sınırlar
- Tüm modüllerin mesaj **ve** mail çıkışı buradan geçer. Alt projelerde sağlayıcı SDK'sı (Netgsm, Meta, Resend) **bulunmaz**; tek çıkış noktası alt projedeki `lib/mesaj/merkez-client.ts`.
- **İstisna:** Supabase Auth mailleri (şifre sıfırlama, doğrulama, davet) merkeze bağlanmaz, Supabase SMTP'den doğrudan gider — merkez kesintisi hiçbir modülün girişini kilitlemez.
- Kuyruk **alt projede yereldir** ve aynı zamanda log'dur; merkeze ulaşılamazsa mesaj kaybolmaz, üstel geri çekilmeyle tekrar denenir.
- Dış müşteriye toplu mesaj ürünü olarak satış ertelendi; odak dahili kullanım.

| Kanal | Sağlayıcı | Not |
|---|---|---|
| SMS | Netgsm | BTK onaylı ortak başlık; isteyen modül kendi başlığını bağlar |
| WhatsApp | Meta Cloud API (doğrudan, BSP yok) | Tek Meta Tech Provider App; kiracılar **Embedded Signup** ile kendi WABA'sını bağlar |
| E-posta | Resend (EU) | Domain doğrulaması merkezde |
| Telegram | Ortak system bot (deep link eşleştirme) + opsiyonel kendi bot token'ı | |

Sağlayıcı sarmalayıcıları `lib/saglayicilar/*.ts` — `import 'server-only'`, Zod ile sınır dönüşümü, API versiyonu URL'de sabit ("latest" yok).

### 6.2 Veri modeli (`asistan_mesaj`)
Hiyerarşi: **kategori → proje → proje kullanıcısı → gönderen kimliği**

| Tablo | Amaç / kritik alanlar |
|---|---|
| `kategoriler` | §3'teki 10 modül: `ad`, `slug`, `sira`, `aktif` |
| `projeler` | Alt proje: `kategori_id`, `slug`, `domain`, `api_key_hash`, `webhook_url`, `aktif` |
| `proje_kullanicilari` | Mesajı tetikleyen kiracı: `dis_kullanici_id`, `ad`, `eposta`, `telefon` — UNIQUE(`proje_id`,`dis_kullanici_id`) |
| `gonderen_kimlikleri` | kullanıcı ↔ kanal ↔ teknik kimlik. WhatsApp: `waba_id`, `phone_number_id`, `baglanti_durumu` (pending/connected/revoked); E-posta: `gonderen_ad/adres`; SMS: `sms_basligi`; Telegram: `bot_token` (şifreli) |
| `kredi_cuzdanlari` | Defterin kendisi: kanal bazlı bakiye + `bakiye_versiyonu` |
| `kredi_hareketleri` | `kanal`, `miktar` (+/-), `sebep` (yukleme/rezervasyon/kesinlesme/iade), `odeme_id` |
| `kredi_paketleri` / `odemeler` | Paket tanımları; ödeme günü, tutar, sağlayıcı ref, durum |
| `mesaj_istekleri` | `kanal`, `alici_hash`, `alici_maskeli`, `icerik`, `durum` (pending/queued/sent/failed/iys_rejected), `oncelik`, `planlanan_zaman`, `dis_mesaj_id`, `hata_kodu`, `kaynak_bolum` (opsiyonel — alt projenin hangi iç modülü/ekranı tetikledi, ör. "randevu_hatirlatma"; Mesaj Günlüğü panelinde proje→kanal drill-down'unda saatlik kırılım için) |
| `mesaj_loglari` | Sonuç + teslim (webhook'la güncellenir), `dusen_kredi`, `icerik_hash`, `icerik_silinme_tarihi` |
| `iys_izinleri` | `alici_hash`, `kanal`, `durum` (PERMIT/REFUSE), `kaynak`, `son_kontrol` |
| `whatsapp_sablonlari` | `sablon_adi`, `dil`, `durum` — Meta webhook'uyla senkron |
| `idempotency_kayitlari` | UNIQUE(`proje_kullanici_id`,`anahtar`), `istek_hash`, `yanit`, `http_status` — 24 saat |
| `webhook_olaylari` | Gelen ham webhook: `saglayici`, `dis_olay_id` (UNIQUE), `islendi_mi` |
| `planli_gorevler` + `..._calismalari` | Merkezi cron defteri: `hedef_url`, `govde`, `cron` (**UTC**), `aktif`, `son_calisma` |

- Panel rolleri (`core.profiles.rol`): `super_admin` (tam yetki), `destek` (salt-okunur, ham telefon göremez). Helper'lar: `asistan_mesaj.is_super_admin()`, `is_personel()`.
- Her tabloda RLS açık. Alt proje kullanıcıları bu şemaya doğrudan erişmez; `/api/v1` istekleri API key doğrulandıktan sonra **proje bağlamı enjekte edilerek** çalışır. `service_role` yalnızca worker/webhook/scheduler'da.
- Raporlama `rapor_gunluk_kullanim` materialized view üzerinden; panel ham tablo taramaz.

### 6.3 İş kuralları

**Gönderen kimliği.** Mesaj her zaman tetikleyen kullanıcının kendi kimliğinden gider. İsim/numara alt projenin "şirket bilgileri" ayarından senkronize edilir (`POST /api/v1/kullanici/senkron`), ayrıca sorulmaz; merkez alt projenin veritabanını okumaz. WhatsApp'ta bu yetmez — `baglanti_durumu ≠ connected` ise gönderim reddedilir, kredi düşmez.

**Kredi.** Rezervasyon modeli: atomik `UPDATE ... WHERE bakiye >= :adet` (satır kilidi + transaction), başarılı gönderimde kesinleşir, başarısızda iade edilir; `if (bakiye > 0)` kontrolüne güvenilmez. Defter merkezdedir — alt projedeki `mesaj_kredileri` yerel yansımadır, merkezin döndüğü `kalanBakiye` + `bakiyeVersiyonu` ile yazılır (versiyon guard'ı: eski yanıt yeniyi ezemez). Alt projede yalnız `tip='yukleme'` hareketi tutulur. Bakiye eşiğin altına inince (varsayılan 50) kullanıcıya ve panele uyarı düşer.

**Akış.** `[İstek] → [İdempotency] → [Kimlik/kanal doğrulama] → [İYS izni (ticari ise)] → [Kredi rezervasyonu] → [Kuyruk] → [Sağlayıcı] → [Kesinleşme/İade] → [Teslim webhook'u]`
- Her mesaj `mesaj_tipi` taşır: `hizmet` | `ticari`. İYS kontrolü yalnız ticaride; izin yoksa kredi düşmez, `iys_rejected` loglanır. İYS erişilemezse fail-open (5-15 dk cache).
- WhatsApp 24 saat penceresi dışında serbest metin yasak — onaylı `sablon_adi` + `degiskenler` zorunlu, API katmanında sert kontrol.
- Sessiz saat (varsayılan **21:00–08:00** TRT) gönderimi iptal etmez, erteler. Bitiş 09:00 değil 08:00'dir; aksi halde sabah tetikleyicileri kendi kuralına takılır.
- Retry yalnız geçici hatalarda (429, 5xx, ağ): en fazla 3 deneme, üstel bekleme + jitter.

**İdempotency sözleşmesi (alt projelere verilen taahhüt).** Her yazma isteği `Idempotency-Key` taşır. (1) Çakışma yoksa işi yap, yanıtı kaydet. (2) Çakışma var + yanıt dolu → **kredi düşme**, kayıtlı yanıtı döndür (`X-Idempotent-Replay: true`). (3) Çakışma var + yanıt boş → `409`. (4) Aynı anahtar farklı `istek_hash` → `422`. Alt proje anahtarı deterministik üretir (`{proje}:{kuyruk_id}`), deneme sayısını anahtara katmaz.

**Zamanlanmış işler (pull modeli).** Tüm cron mantığı merkezdedir; hiçbir dikeyde zamanlanmış görev yoktur. Merkez `planli_gorevler` tanımına göre alt projenin `/api/internal/*` endpoint'ini imzalı çağırır; alt proje kendi kurallarını uygulayıp kendi kuyruğuna yazar. Merkez ham randevu/hasta verisi çekmez (KVKK: gereksiz aktarım yok). Vercel cron kullanılmaz, QStash Schedules kullanılır. Klinik tanımları (UTC): hatırlatma-sabah `0 5 * * *`, hatırlatma-akşam `0 15 * * *`, kuyruk-isle `*/5 * * * *`, kredi-senkron `0 * * * *`.

**Güvenlik.** Alt proje → merkez: `X-Api-Key` (hash karşılaştırması) + `X-Imza: t=<unix>,v1=<hmac>` (taban `${t}.${rawBody}`, ±300 sn, `timingSafeEqual`). Merkez → alt proje: aynı desen, `MERKEZ_INTERNAL_SECRET`. Sağlayıcı webhook'ları imza doğrulanmadan işlenmez (ham kayıt + hızlı 200, işleme asenkron). Rate limit iki katmanlı: sağlayıcı + proje kullanıcısı. Panelde telefon maskeli (`+90 532 *** ** 88`); tam numarayı yalnız `super_admin` görür ve görüntüleme audit'e yazılır. Log'larda ham telefon/e-posta/içerik/token asla basılmaz.

### 6.4 Panel (`/yonetim/mesaj`)
Yalnızca Asistan Merkezi ekibine açıktır; kiracılar buraya giriş yapmaz, kendi kullanım/kredi ekranlarını kendi modüllerinde görür.

| Ekran | İçerik |
|---|---|
| Genel Bakış | Bugün/bu ay gönderim, kanal kırılımı, hata oranı, düşük bakiye ve kopan WhatsApp bağlantısı uyarıları |
| Kategoriler | 8 kategori kartı → kategori toplamı → proje listesi (drill-down) |
| Projeler | Kullanıcı listesi, API key durumu, webhook sağlığı, kanal bağlantıları |
| Kullanıcılar | Gün/ay/yıl kırılımlı kullanım + cari (bakiye, yükleme geçmişi) aynı ekranda |
| Mesaj Günlüğü | İki sekme — **Bağlantılar** (kanal başına, SMS/WhatsApp/E-posta/Telegram: tüm projelerdeki gönderen kimliği bağlantı durumu) ve **Projeler** (kategori kutucukları → proje kutucukları → kanal kutucukları → seçili proje+kanal için mesaj dökümü: saat, kaynak bölüm, maskeli alıcı, durum, hata kodu, sağlayıcı yanıtı) |
| Ödemeler | Ödeme günü, tutar, eklenen paket, manuel kredi ekleme (audit'li, yalnız `super_admin`) |
| Şablonlar / Zamanlayıcı / Sistem | WhatsApp şablon durumları; planlı görevler + son çalışmalar + elle tetikleme; audit log, webhook olayları |

### 6.5 API yüzeyi (`/api/v1`)
`POST /mesaj/gonder` (Idempotency-Key zorunlu) · `POST /mesaj/toplu` (≤1000 alıcı) · `GET /mesaj/:id` · `GET /kredi/bakiye` · `POST /kredi/yukleme-talebi` · `POST /kullanici/senkron` · `POST /whatsapp/baglanti`

`/mesaj/gonder` ve `/mesaj/toplu` gövdesinde opsiyonel `kaynakBolum` alanı kabul edilir — alt proje gönderimi tetikleyen kendi iç modülünü/ekranını serbest metinle etiketleyebilir (ör. `"randevu_hatirlatma"`). Doldurulmazsa `null` kalır; mevcut alt proje entegrasyonları etkilenmez.

Giden webhook (proje `webhook_url`'ine): `mesaj.gonderildi`, `mesaj.teslim`, `mesaj.basarisiz`, `kredi.esik_alti`.

## 7. Konvansiyonlar

- Arayüz dili Türkçe; tarih `GG.AA.YYYY`, para `₺` ve binlik ayraç nokta.
- Tablo/kolon adları Türkçe, snake_case, Türkçe karaktersiz; `id`, `created_at`, `updated_at` İngilizce.
- Rol adları ve durum değerleri veritabanında İngilizce enum, arayüzde Türkçe etiket.
- Yetki dinamiktir: roller sabit kodlanmaz, tenant bazında tanımlanır.
- Zaman: DB'de `timestamptz`; iş kuralları **Europe/Istanbul** (sabit UTC+3), cron ifadeleri **UTC**. Dönüşüm tek yerde (`lib/zaman.ts`).
- Saklama: `mesaj_loglari` içeriği 90 gün sonra redakte edilir (meta veri kalır); `kredi_hareketleri` ve `odemeler` mali kayıt, 10 yıl; `iys_izinleri` son durum + 2 yıl; bağlantı kopan `gonderen_kimlikleri` token'ı hemen silinir. Kredi hareketlerinde soft delete yok.
- Varsayılan gönderen: `bildirim@asistanmerkezi.com` (modül kendi doğrulanmış domainini bağlarsa o kullanılır).
- Modül ekleme, hub'ın modül listesine satır eklemekle başlar; tanıtım listesi dışına modül çıkılmaz.
- Repolar `asistan-merkezi` GitHub org'unda; skill/agent paylaşımı `claude-config` reposundan merkezî bağlanır.

## 8. Yol Haritası

| Faz | Kapsam |
|---|---|
| Faz 1 | Hub landing + 10 modül tanıtımı + merkezi kayıt/giriş |
| Faz 2 | **Mesaj Merkezi MVP:** `asistan_mesaj` şeması + RLS ✅, kredi rezervasyonu ✅, QStash `QueueAdapter` (arayüz hazır, gerçek bağlantı bekliyor — Upstash hesabı yok), Vault, webhook imzası (yalnız alt proje→merkez yönü ✅, sağlayıcı webhook'ları henüz yok), İYS cache (tablo + okuma ✅, dış senkron yok), idempotency ✅, maskeleme ✅, 90 gün redaksiyon, audit (telefon görüntüleme + manuel kredi ✅, genel kapsam eksik); panelin Genel Bakış / Kategoriler / Kullanıcılar / Mesaj Günlüğü ekranları ✅ |
| Faz 3 | Trial motoru, salt-okunur mod, retention bildirimleri |
| Faz 4 | Ortak modüller (personel, muhasebe, randevu) paylaşıma açılır |
| Faz 5 | Monorepo geçişi (pnpm workspaces + Turborepo) |
| Sonra | Mesaj Merkezi Faz 2: DLQ + inceleme paneli, circuit breaker, WhatsApp `quality_rating` senkronu, aylık partition, sandbox modu, kampanya kavramı, API key rotasyon UI |

## 9. Güncel Durum

- [x] Cloudflare yönlendirme ve Supabase Pro mimarisi
- [x] Ortak onboarding/trial deseninin tanımlanması
- [x] Ortak personel modülü tasarımı (4 sekme, 12 tablo)
- [ ] Hub modül listesinin tanıtım PDF'iyle eşitlenmesi
- [ ] **Mesaj Merkezi Faz 1** — (1) `asistan_mesaj` migration'ı ✅, (2) `/api/v1` API yüzeyi ✅ (`mesaj/gonder`, `mesaj/toplu`, `mesaj/:id`, `kredi/bakiye`, `kredi/yukleme-talebi`, `kullanici/senkron` — yalnız `whatsapp/baglanti` bekliyor, Meta Tech Provider önkoşulu), (3) panel ekranları ✅ (Genel Bakış/Kategoriler/Kullanıcılar/Mesaj Günlüğü — Faz 2'den erken taşındı; Projeler/Ödemeler/Şablonlar/Zamanlayıcı/Sistem sidebar'da "Yakında"), (4) klinik `merkez-client.ts`'in bağlanması — sıradaki (klinik repo eldeyken)
- [x] Kayıt formunun §5.1 kapsamına tamamlanması (kişisel/işletme bilgileri, vergi no, görev, tam yetkili, sözleşme onayı — `core.tenants` + `core.profiles.ad_soyad`); tam yetkiliye onay-linkli mail (§5.2) Resend kurulana kadar gönderilmiyor
- [ ] Klinik Asistanı'nın tamamlanması — **öncelik**; klinik mesaj modülü merkeze bağlı olduğu için Mesaj Merkezi Faz 1 bunun önkoşuludur, rakibi değil
- [ ] Monorepo geçişi — bilinçli olarak ertelendi, klinik bitince ele alınacak

**Açık sorunlar:**
- Repolar üç ayrı GitHub hesabına dağılmış (asistan-merkezi org, hakansenipek, nukhetsenipek); monorepo öncesi tek org altında toplanmalı.
- Ödeme tahsilatı sağlayıcısı seçilmedi; `/api/v1/kredi/yukleme-talebi` alt projeden "talep" kaydı oluşturuyor (yalnız tanımlı `kredi_paketleri`'nden, serbest tutar girilemiyor — bedava kredi kapısı riski API katmanında kapatıldı), ama onay/kredi ekleme hâlâ elle: panel Ödemeler ekranı henüz yok.
- Meta Tech Provider başvurusu tamamlanmadı — WhatsApp hattı bu olmadan canlıya çıkamaz.
- Alt proje "şirket bilgileri" senkronizasyonu: push yönü `/api/v1/gonderen/senkron` ile ✅ (gonderen_ad/gonderen_adres/sms_basligi; bağlantı durumu alanlarına dokunmaz). Merkezin alt projeye dönüp cache pull fallback yapması hâlâ yok — hiçbir alt proje merkeze imzalı `/api/internal/*` ile bağlı değil.
- Sızan `CRON_SECRET` yenilenip `MERKEZ_INTERNAL_SECRET` olarak her iki tarafa girilecek.

---
Son güncelleme: 2026-09-21

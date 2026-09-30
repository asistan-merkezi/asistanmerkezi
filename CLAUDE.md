# Asistan Merkezi

## 1. Proje Özeti

**asistanmerkezi.com** — sektörel AI destekli mikro-asistan modüllerinin çatı markası ve hub sitesi. İki işi birlikte taşır:

1. **Hub:** modül tanıtımı, merkezi kayıt/giriş, deneme süresi (trial) yönetimi, abonelik bariyeri. Her modül kendi bağımsız domaininde çalışır; hub kullanıcı/kiracı yaşam döngüsünü tek merkezden yönetir.
2. **Mesaj Merkezi:** tüm modüllerin SMS / WhatsApp / e-posta / Telegram gönderimlerini yürüten merkezi servis + genel yönetim paneli (§6). Ayrı proje değildir — aynı Next.js uygulaması, aynı Supabase projesi, kendi şeması (`asistan_mesaj`) ve kendi route segmenti.

İş modeli: 21 gün ücretsiz deneme → aylık abonelik. Bazı modüller (ör. klinik) ayrıca münferit kurulum olarak da satılır. Mesaj kullanımı ayrı kredi sistemiyle ücretlendirilir.

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
| Kuyruk / Zamanlayıcı | DB kuyruğu (`mesaj_istekleri`, lease + `skip locked`) + sunucu cron (`deploy/kuyruk-isle.sh`, imzalı; **şimdilik günde bir kez** 05:05 UTC = 08:05 TRT, kuyruk boşalana kadar tur atar — mesajlar ~24 saat gecikebilir, geçici hata yeniden denemeleri günlük olur; sıklaştırmak yalnız cron satırını değiştirmektir) | Yalnız mesaj merkezinde. Upstash QStash kullanılmıyor (hesap açılmadı; Vodafone kurulumunda gerekmiyor) — `QueueAdapter` no-op kaldı, ileride QStash'e dönmek istenirse arayüz hazır |
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

Bu liste aynı zamanda mesaj merkezindeki **kategori** hiyerarşisinin kaynağıdır (§6.2). Tek istisna: modül olmayan, müşteriye özel projeler için ayrı bir **Özel Proje** kategorisi (slug `ozel-proje`, `20260930110000_kategori_ozel_proje.sql`) — hub'ın modül listesinde yer almaz.
`asistan_mesaj.kategoriler` içindeki `'Borsa & Ev Ekonomisi'` (slug `borsa`) satırı
`'Ev Ekonomisi'` olarak yeniden adlandırıldı (slug değişmez) —
`20260930100000_kategori_ev_ekonomisi.sql` DB'ye uygulandı (2026-09-30).

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
- Her yeni kiracıya otomatik 21 gün (DB varsayılanı, `20260930140000_trial_21_gun.sql`; 2026-09-30'da 30'dan çekildi, tanıtım metinleriyle eşit). Mevcut kiracıların bitiş tarihi değişmedi.
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
| `kategoriler` | §3'teki modüller + **Özel Proje** (slug `ozel-proje`): `ad`, `slug`, `sira`, `aktif` |
| `projeler` | Alt proje: `kategori_id`, `slug`, `domain`, `api_key_hash`, `webhook_url`, `aktif`, `sandbox` (açıkken gerçek sağlayıcıya gidilmez, kredi düşmez; `proje_sandbox_ayarla` RPC'si, audit'li). Oluşturma/anahtar yenileme/güncelleme yalnız `proje_olustur` / `proje_anahtar_yenile` / `proje_guncelle` RPC'leriyle (`super_admin`, audit'li); API anahtarı (`amk_…`) ekranda bir kez gösterilir, DB'ye yalnız SHA-256 hash'i gider; `X-Imza` aynı anahtarla atılır |
| `saglayici_ayarlari` | Kanal başına (`sms`/`whatsapp`/`eposta`/`telegram`/`odeme`) sağlayıcı bağlantısı: `saglayici`, `aktif`, `api_url`, `api_versiyonu`, `ayarlar` (gizli olmayan alanlar), `gizli_referanslari` (Vault secret id'leri). Yazma yalnız `kanal_ayari_kaydet` RPC'siyle (`super_admin`, audit'li); sır okuma `kanal_gizli_oku` yalnız `service_role` |
| `proje_kullanicilari` | Mesajı tetikleyen kiracı: `dis_kullanici_id`, `ad`, `eposta`, `telefon` — UNIQUE(`proje_id`,`dis_kullanici_id`) |
| `gonderen_kimlikleri` | kullanıcı ↔ kanal ↔ teknik kimlik. WhatsApp: `waba_id`, `phone_number_id`, `baglanti_durumu` (pending/connected/revoked); E-posta: `gonderen_ad/adres`; SMS: `sms_basligi`; Telegram: `bot_token` (şifreli) |
| `kredi_cuzdanlari` | Defterin kendisi: kanal bazlı bakiye + `bakiye_versiyonu` |
| `kredi_hareketleri` | `kanal`, `miktar` (+/-), `sebep` (yukleme/rezervasyon/kesinlesme/iade), `odeme_id` |
| `kredi_bildirimleri` | Eşik altı / tükendi bildirim kuyruğu: `olay` (`kredi.esik_alti`/`kredi.tukendi`), `bakiye`, `esik`, `webhook_durumu`/`eposta_durumu` (bekliyor/gonderildi/yok/hata), lease + deneme alanları, `islendi_at` |
| `kredi_paketleri` / `odemeler` | Paket tanımları; ödeme günü, tutar, sağlayıcı ref, durum |
| `mesaj_istekleri` | `kanal`, `alici_hash`, `alici_maskeli`, `icerik`, `durum` (pending/queued/sent/failed/iys_rejected), `oncelik`, `planlanan_zaman`, `dis_mesaj_id`, `hata_kodu`, `kaynak_bolum` (opsiyonel — alt projenin hangi iç modülü/ekranı tetikledi, ör. "randevu_hatirlatma"; Mesaj Takibi panelinde proje→kanal drill-down'unda saatlik kırılım için), `konu` (e-posta), `sandbox`, `deneme_sayisi`/`sonraki_deneme`/`kilit_zamani` (kuyruk lease'i; yeni enum değeri yok) |
| `mesaj_alicilari` | **Ham alıcı yalnız uçuşta**: gönderim tamamlanana (`mesaj_sonuclandir`) kadar tutulur, sonra silinir (KVKK). RLS açık, politika yok — yalnız `service_role` |
| `gonderim_durdurmalari` | Kill switch: `kapsam` (genel/kanal/proje), `kanal`, `proje_id`, `sebep`, `aktif`. Yazma yalnız `gonderim_durdur` / `gonderim_baslat` RPC'leriyle (`super_admin`, audit'li) |
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

**Kredi.** Rezervasyon modeli: atomik `UPDATE ... WHERE bakiye >= :adet` (satır kilidi + transaction), başarılı gönderimde kesinleşir, başarısızda iade edilir; `if (bakiye > 0)` kontrolüne güvenilmez. Defter merkezdedir — alt projedeki `mesaj_kredileri` yerel yansımadır, merkezin döndüğü `kalanBakiye` + `bakiyeVersiyonu` ile yazılır (versiyon guard'ı: eski yanıt yeniyi ezemez). Alt projede yalnız `tip='yukleme'` hareketi tutulur. **Bildirim:** cüzdan bakiyesi eşiğin altına indiği anda (`esik`, varsayılan 50) `kredi.esik_alti`, sıfıra düştüğü anda `kredi.tukendi` — tetik DB'de (`kredi_cuzdani_degisti` tetikleyicisi → `kredi_bildirimleri`), aynı olay cüzdan başına 24 saatte bir. Teslim `lib/mesaj/kredi-bildirim.ts`: alt projenin `webhook_url`'ine imzalı olay (`MERKEZ_INTERNAL_SECRET`) + kullanıcının e-postasına sistem maili (merkezin Resend ayarıyla, krediden düşmez); API yanıtından sonra (`after`) ve kuyruk turunda, hedef başına ayrı izlenir, 5 deneme. Panel Genel Bakış'ta düşük bakiye + askıdaki mesaj sayısı. **Askıda:** kredi yetmezse mesaj reddedilmez — `pending` + `askiya_alinma`, ham alıcı bekler, API 202 `durum: askida` (kalıcı yanıt, alt proje yeniden göndermez). Bakiye hangi yoldan artarsa artsın (yükleme, iade, elle düzeltme) aynı tetikleyici askıdakileri geliş sırasıyla, bakiye yettiği kadar rezerve edip kuyruğa alır: kaldığı yerden devam; geçmişte kalan planlanan zaman şimdiye çekilir (sessiz saatse 08:00 TRT). Askıda 30 günü aşan `failed/askida_zaman_asimi` olur, ham alıcı silinir (KVKK). Kuyruk turu ayrıca `askidakileri_tara()` ile yarış güvenlik ağı çalıştırır (`20260930170000_kredi_askida_bildirim.sql`).

**Akış.** `[İstek] → [İdempotency] → [Kimlik/kanal doğrulama] → [İYS izni (ticari ise)] → [Kredi rezervasyonu] → [Kuyruk] → [Sağlayıcı] → [Kesinleşme/İade] → [Teslim webhook'u]`
- **Gönderim motoru** (`lib/mesaj/gonderim-motoru.ts`, `POST /api/internal/kuyruk-isle`, `MERKEZ_INTERNAL_SECRET` imzalı): `mesaj_kuyruktan_al` vadesi gelen `queued` satırları 5 dk lease'le alır; sağlayıcı ayarı `saglayici_ayarlari` + Vault'tan okunur (`lib/saglayicilar/*`: Netgsm SMS, Resend e-posta, sandbox; WhatsApp/Telegram henüz `kanal_desteklenmiyor`). Sonuç tek atomik `mesaj_sonuclandir` RPC'sinde: durum + kredi kesinleşme/iade + `mesaj_loglari` + ham alıcının silinmesi (çift çağrı güvenli). Geçici hata: 3 deneme, 30/60/120 sn + %25 jitter; kalıcı hata ilk denemede sonuçlanır ve kredi iade edilir. Bilinen sınır: SMS'te sağlayıcı yanıtı alındıktan sonra sonuç yazılamadan çökme, lease dolunca çift SMS üretebilir (Resend `Idempotency-Key` ile korunur).
- **Kill switch:** aktif durdurma varsa girişte `503` + `kod: gonderim_durduruldu` (alt proje yerel kuyrukta tutup yeniden dener; anahtar serbest kalır), kuyruktaki satırlar worker'da atlanır (kaybolmaz, kredi rezerve kalır). **Sandbox:** proje `sandbox` açıksa kredi rezervasyonu yapılmaz, sağlayıcıya gidilmez; alıcı sonu `…000` kalıcı, `…500` geçici hata simüle eder.
- Her mesaj `mesaj_tipi` taşır: `hizmet` | `ticari`. İYS kontrolü yalnız ticaride; izin yoksa kredi düşmez, `iys_rejected` loglanır. İYS erişilemezse fail-open (5-15 dk cache).
- WhatsApp 24 saat penceresi dışında serbest metin yasak — onaylı `sablon_adi` + `degiskenler` zorunlu, API katmanında sert kontrol.
- Sessiz saat (varsayılan **21:00–08:00** TRT) gönderimi iptal etmez, erteler. Bitiş 09:00 değil 08:00'dir; aksi halde sabah tetikleyicileri kendi kuralına takılır.
- Retry yalnız geçici hatalarda (429, 5xx, ağ): en fazla 3 deneme, üstel bekleme + jitter.

**İdempotency sözleşmesi (alt projelere verilen taahhüt).** Her yazma isteği `Idempotency-Key` taşır. (1) Çakışma yoksa işi yap, yanıtı kaydet. (2) Çakışma var + yanıt dolu → **kredi düşme**, kayıtlı yanıtı döndür (`X-Idempotent-Replay: true`). (3) Çakışma var + yanıt boş → `409`; yanıtsız kayıt 5 dk'dan eskiyse (çöken istek) sonraki istek devralır. (4) Aynı anahtar farklı `istek_hash` → `422`. **Geçici sonuçlar (5xx, 402) saklanmaz**, anahtar serbest kalır ve aynı anahtarla yeniden denenebilir; kalıcı yanıtlar (200/201, 400/404/422) saklanıp replay edilir. Kayıtlar 24 saat sonra `asistan_mesaj.idempotency_temizle()` ile silinir (migration `20260930150000` uygulandı; günlük çağrı merkezi zamanlayıcı bağlanınca — o zamana kadar elle). Alt proje anahtarı deterministik üretir (`{proje}:{kuyruk_id}`), deneme sayısını anahtara katmaz.

**Zamanlanmış işler (pull modeli).** Tüm cron mantığı merkezdedir; hiçbir dikeyde zamanlanmış görev yoktur. Merkez `planli_gorevler` tanımına göre alt projenin `/api/internal/*` endpoint'ini imzalı çağırır; alt proje kendi kurallarını uygulayıp kendi kuyruğuna yazar. Merkez ham randevu/hasta verisi çekmez (KVKK: gereksiz aktarım yok). Vercel cron kullanılmaz, QStash Schedules kullanılır. Klinik tanımları (UTC): hatırlatma-sabah `0 5 * * *`, hatırlatma-akşam `0 15 * * *`, kuyruk-isle `*/5 * * * *`, kredi-senkron `0 * * * *`.

**Güvenlik.** Alt proje → merkez: `X-Api-Key` (hash karşılaştırması) + `X-Imza: t=<unix>,v1=<hmac>` (taban `${t}.${rawBody}`, ±300 sn, `timingSafeEqual`). Merkez → alt proje: aynı desen, `MERKEZ_INTERNAL_SECRET`. Sağlayıcı webhook'ları imza doğrulanmadan işlenmez (ham kayıt + hızlı 200, işleme asenkron). Rate limit iki katmanlı: sağlayıcı + proje kullanıcısı. **Hedef sayılar (henüz uygulanmıyor; Netgsm/Meta gerçek limitleriyle doğrulanıp uygulanacak):** proje kullanıcısı başına dakikada 50 / saatte 500 mesaj, proje başına saatte 5.000; aşımda `429` + `Retry-After`. Sağlayıcı katmanı ilgili sağlayıcının yayımlanmış limitinin altında tutulur. Kredi rezervasyonu zararı bakiyeyle sınırlar; hız limiti sızan anahtarın hızlı tükenmesini önler. Panelde telefon maskeli (`+90 532 *** ** 88`); tam numarayı yalnız `super_admin` görür ve görüntüleme audit'e yazılır. Log'larda ham telefon/e-posta/içerik/token asla basılmaz.

### 6.4 Panel (`/yonetim/mesaj`)
Yalnızca Asistan Merkezi ekibine açıktır; kiracılar buraya giriş yapmaz, kendi kullanım/kredi ekranlarını kendi modüllerinde görür.

| Ekran | İçerik |
|---|---|
| Genel Bakış | Seçili dönem (gün/ay/yıl süzgeci) için toplam/iletilen istek, hata oranı ve kanal kırılımı; düşük bakiye ve kopan WhatsApp bağlantısı uyarıları anlık (süzgeçsiz). Mobil görünümde bugün + bekleyen kuyruk kartları süzgeçsiz kaldı |
| Projeler | Kategori listesi (proje sayılarıyla) → seçili kategorinin projeleri (kullanıcı sayısı, API anahtarı/webhook durumu). Proje sayfasında: ayarlar, API anahtarı üretme/yenileme, sisteme bağlantı kodları (env, `merkez-client.ts` örneği, uç noktalar). "Proje Ekle" kategoriye bağlı. `/kategoriler` bu ekrana yönlenir |
| Kullanıcılar | Kullanıcı listesi (kategori sütunu + kategori filtresi, bakiye, WhatsApp durumu), üstte **Takip Şeması** (kategori → proje → kullanıcı → gönderen kimliği, canlı sayılarla), altta **Mesaj Şeması** (gün/ay/yıl süzgeciyle kullanıcı bazında gerçekleşen SMS/WhatsApp/Telegram/E-posta, sırada `pending`+`queued`, hata `failed`; sayım uygulamada yapılır, en fazla 20.000 satır — hacim büyürse SQL fonksiyonuna taşınmalı). Yükleme geçmişi henüz yok; kullanıcı listesi son 50 kayıtla sınırlı |
| Mesaj Takibi (`/mesaj-gunlugu`; rota adı eski, arayüzde her yerde "Mesaj Takibi") | İki sekme — **Bağlantılar** (kanal başına, SMS/WhatsApp/E-posta/Telegram: tüm projelerdeki gönderen kimliği bağlantı durumu) ve **Projeler** (kategori kutucukları → proje kutucukları → kanal kutucukları → seçili proje+kanal için mesaj dökümü: saat, kaynak bölüm, maskeli alıcı, durum, hata kodu, sağlayıcı yanıtı). Gün/ay/yıl süzgeci Projeler sekmesinde proje seçilince görünür (kanal sayıları, döküm, kaynak bölüm dağılımı süzülür); Bağlantılar sekmesi anlık durum olduğu için süzgeçsiz |
| Finans | Alt bölümler: **Ödemeler** (ödeme günü, tutar, eklenen paket, manuel kredi ekleme — audit'li, yalnız `super_admin`), Personel, Gelen Faturalar, Giderler, Raporlar (son dördü "Yakında") |
| Sistem | **Bağlantı Ayarları** (SMS/WhatsApp/E-posta/Telegram/Ödeme: sağlayıcı, API adresi ve versiyonu, kimlik bilgileri — sırlar Vault'ta, geri okunamaz —, webhook dönüş adresi; `/sistem/baglanti-ayarlari/<kanal>`), **Şablonlar** (WhatsApp şablon durumları, "Yakında"), **Zamanlayıcı** (planlı görevler + son çalışmalar + elle tetikleme, "Yakında"), **Acil Durdurma** (kill switch: proje/kanal/genel durdur ve yeniden başlat, aktif durdurmalar, sebep zorunlu; Genel Bakış'ta aktif durdurma bandı; `/sistem/acil-durdurma`); audit log ve webhook olayları sonra |

### 6.5 API yüzeyi (`/api/v1`)
`POST /mesaj/gonder` (Idempotency-Key zorunlu) · `POST /mesaj/toplu` (≤1000 alıcı) · `GET /mesaj/:id` · `GET /kredi/bakiye` · `POST /kredi/yukleme-talebi` · `POST /kullanici/senkron` · `POST /whatsapp/baglanti`

`/mesaj/gonder` ve `/mesaj/toplu` gövdesinde opsiyonel `kaynakBolum` alanı kabul edilir — alt proje gönderimi tetikleyen kendi iç modülünü/ekranını serbest metinle etiketleyebilir (ör. `"randevu_hatirlatma"`). Doldurulmazsa `null` kalır; mevcut alt proje entegrasyonları etkilenmez.

Giden webhook (proje `webhook_url`'ine): `mesaj.gonderildi`, `mesaj.teslim`, `mesaj.basarisiz` (henüz gönderilmiyor), `kredi.esik_alti` ve `kredi.tukendi` (gönderiliyor, `X-Imza` = `MERKEZ_INTERNAL_SECRET`).

## 7. Konvansiyonlar

- Arayüz dili Türkçe; tarih `GG.AA.YYYY`, para `₺` ve binlik ayraç nokta.
- Tablo/kolon adları Türkçe, snake_case, Türkçe karaktersiz; `id`, `created_at`, `updated_at` İngilizce.
- Rol adları ve durum değerleri veritabanında İngilizce enum, arayüzde Türkçe etiket.
- Yetki dinamiktir: roller sabit kodlanmaz, tenant bazında tanımlanır.
- Zaman: DB'de `timestamptz`; iş kuralları **Europe/Istanbul** (sabit UTC+3), cron ifadeleri **UTC**. Dönüşüm tek yerde (`lib/zaman.ts`).
- **Panel dönem süzgeci:** zamana bağlı panel ekranları ortak `DonemFiltresi` (`app/yonetim/mesaj/_bilesenler/donem-filtresi.tsx`) + `donemCoz` (`lib/donem.ts`) kullanır: Aylık/Yıllık/Günlük + Önceki/Sonraki, durum URL'de (`?donem=gun|ay|yil&t=YYYY-MM-DD`), aralık `created_at` üzerinden TRT günü sınırlarıyla `[baslangic, bitis)`, gelecek döneme geçilemez. Yeni zamana bağlı ekran aynı bileşeni kullanır. Şu an bağlı: Genel Bakış, Kullanıcılar (Mesaj Şeması), Mesaj Takibi›Projeler. Bağlanmadı: üst çubuktaki "Son 30 gün" düğmesi (`layout.tsx`, işlevsiz), Finans›Ödemeler (yer tutucu).
- **Doğrulanacak (hukuk):** `iys_izinleri` yalnız son durumu tutuyor; şikayette ispat için izin zamanı/kaynağı geçmişi değişmez tutulmalı ve saklama süresi (şu an 2 yıl) mevzuatla teyit edilmeli. Ticari mesaj içeriği 90 gün sonra redakte olsa da `icerik_hash` kalır.
- Saklama: `mesaj_loglari` içeriği 90 gün sonra redakte edilir (meta veri kalır); `kredi_hareketleri` ve `odemeler` mali kayıt, 10 yıl; `iys_izinleri` son durum + 2 yıl; bağlantı kopan `gonderen_kimlikleri` token'ı hemen silinir. Kredi hareketlerinde soft delete yok.
- Varsayılan gönderen: `bildirim@asistanmerkezi.com` (modül kendi doğrulanmış domainini bağlarsa o kullanılır).
- Modül ekleme, hub'ın modül listesine satır eklemekle başlar; tanıtım listesi dışına modül çıkılmaz.
- **RLS kontrolü:** yeni tablo/migration sonrası `npm run rls:kontrol` çalıştırılır (`scripts/rls-kontrol.mjs`, RLS'i kapalı tablo varsa hata verir). Aynısı `.github/workflows/rls-kontrol.yml` ile migration değişen PR'larda koşar (repo secret'ı `SUPABASE_DB_PASSWORD` gerekli).
- **Testler:** `npm test` = `test:sql` (PGlite ile migration zinciri + kuyruk/kredi iade/kill switch/askıda-devam/kredi bildirimi mantığı, gerçek DB'ye dokunmaz) + `test:saglayici` (Netgsm/Resend/Svix/sandbox/motor/kredi bildirimi teslimi, sahte `fetch`).
- **Performans kuralları:** `proxy.ts` `/api/*`'yi kapsamaz (API anahtar/imzayla girilir) ve oturum çerezi yoksa Auth'a gitmez; korumalı rotada `getClaims()` kullanır. `requirePersonel` React `cache()` ile istek başına bir kez çalışır (layout + sayfa). `/api/v1` mesaj akışında bağımsız okuma/yazmalar `Promise.all` ile paralel, istek içi tekrarlar `IstekOnbellegi` ile paylaşılır; toplu işler `lib/paralel.ts` `sinirliParalel` ile sınırlı eşzamanlılıkta koşar (toplu mesaj 10, motor 5). Gönderim motoru kanal ayarı/Vault sırrı/gönderen kimliğini tur başına bir kez okur. Yeni kodda sırayla `await` edilen bağımsız DB çağrısı bırakma. Yeni migration'da `test:sql` zincirin temiz DB'de uygulandığını da doğrular; `.github/workflows/test.yml` her PR'da tsc + lint + test koşar.
- Ek dokümanlar `docs/` altında: `hata-kodlari.md` (API hata kataloğu), `entegrasyon-checklist.md` (alt proje bağlama + smoke test), `kararlar.md` (kısa ADR), `vodafone-tasima.md` (Vodafone Cloud kurulum/taşıma runbook'u). Yeni API hatası eklenince kataloğu da güncelle.
- Repolar `asistan-merkezi` GitHub org'unda; skill/agent paylaşımı `claude-config` reposundan merkezî bağlanır.

## 8. Yol Haritası

| Faz | Kapsam |
|---|---|
| Faz 1 | Hub landing + 10 modül tanıtımı + merkezi kayıt/giriş |
| Faz 2 | **Mesaj Merkezi MVP:** `asistan_mesaj` şeması + RLS ✅, kredi rezervasyonu ✅, gönderim motoru ✅ (DB kuyruğu + Netgsm/Resend/sandbox; kod tamam, canlı sağlayıcı hesabıyla uçtan uca doğrulanmadı), kill switch ✅, sandbox ✅, kredi eşik/tükendi bildirimi + yetersiz kredide askıda bekleme ✅, Vault, webhook imzası (alt proje→merkez ✅; Resend teslim webhook'u ✅; Netgsm/Meta/Telegram webhook'ları yok), İYS cache (tablo + okuma ✅, dış senkron yok), idempotency ✅, maskeleme ✅, 90 gün redaksiyon, audit (telefon görüntüleme + manuel kredi ✅, genel kapsam eksik); panelin Genel Bakış / Projeler / Kullanıcılar / Mesaj Takibi / Sistem›Bağlantı Ayarları ekranları ✅ |
| Faz 3 | Trial motoru, salt-okunur mod, retention bildirimleri |
| Faz 4 | Ortak modüller (personel, muhasebe, randevu) paylaşıma açılır |
| Faz 5 | Monorepo geçişi (pnpm workspaces + Turborepo) |
| Sonra | Mesaj Merkezi Faz 2: DLQ + inceleme paneli, circuit breaker, WhatsApp `quality_rating` senkronu, aylık partition, sandbox modu, kampanya kavramı, API key rotasyon UI |
| Sonra (2026-09-30 değerlendirmesi) | ✅ Yapıldı: sandbox modu, kill switch (panel Sistem›Acil Durdurma), sağlayıcı ayarlarının gönderim koduna bağlanması, Resend webhook'u. **Öncelikli:** hız limiti uygulaması (§6.3), Netgsm teslim raporu, "bağlantıyı test et", Genel Bakış'ta sistem sağlığı kutusu (`/api/health` ✅ hazır, yalnız DB'yi kontrol eder; Vault/QStash/sağlayıcı kontrolleri yok), Vodafone taşıması öncesi yedek RPO/RTO ve migration rollback (expand-contract) notu. **Daha sonra:** yedek sağlayıcı fallback'i (SMS'te yedek için ayrı BTK başlık onayı gerekir; gönderim kodu artık `saglayici_ayarlari`'nı okuyor), anomali tespiti + hesap dondurma, İYS dış senkron ve izin geçmişi, API versiyonlama/sunset politikası, secret rotasyon takvimi, incident runbook, `idempotency_temizle()` günlük çağrısının zamanlayıcıya bağlanması |

## 9. Güncel Durum

- [x] Cloudflare yönlendirme ve Supabase Pro mimarisi
- [x] Ortak onboarding/trial deseninin tanımlanması
- [x] Ortak personel modülü tasarımı (4 sekme, 12 tablo)
- [ ] Hub modül listesinin tanıtım PDF'iyle eşitlenmesi
- [ ] **Mesaj Merkezi Faz 1** — (1) `asistan_mesaj` migration'ı ✅, (2) `/api/v1` API yüzeyi ✅ (`mesaj/gonder`, `mesaj/toplu`, `mesaj/:id`, `kredi/bakiye`, `kredi/yukleme-talebi`, `kullanici/senkron` — yalnız `whatsapp/baglanti` bekliyor, Meta Tech Provider önkoşulu), (3) panel ekranları ✅ (Genel Bakış/Projeler/Kullanıcılar/Mesaj Takibi/Sistem›Bağlantı Ayarları — Faz 2'den erken taşındı; Finans alt bölümleri ve Sistem›Şablonlar/Zamanlayıcı "Yakında"), (4) klinik `merkez-client.ts`'in bağlanması — sıradaki (klinik repo eldeyken)
- [x] Kayıt formunun §5.1 kapsamına tamamlanması (kişisel/işletme bilgileri, vergi no, görev, tam yetkili, sözleşme onayı — `core.tenants` + `core.profiles.ad_soyad`); tam yetkiliye onay-linkli mail (§5.2) Resend kurulana kadar gönderilmiyor
- [ ] Klinik Asistanı'nın tamamlanması — **öncelik**; klinik mesaj modülü merkeze bağlı olduğu için Mesaj Merkezi Faz 1 bunun önkoşuludur, rakibi değil
- [ ] **Vodafone Cloud kurulumu** (karar 2026-09-30: veritabanı + uygulama birlikte sunucuda, self-hosted Supabase + Docker + Caddy; veri sıfırdan, Frankfurt'tan taşınmıyor). Repoda hazır: `Dockerfile`, `deploy/`, `npm run db:kur`, `/api/health`, runbook `docs/vodafone-tasima.md`. Bekleyen: sunucu erişimi, kurulum, doğrulama; bitince §2 Hosting/pooler satırları güncellenecek. "Yurt içi" iddiası üçüncü taraf servisler (Resend, Claude API, Meta, Cloudflare proxy) nedeniyle daraltılmalı (runbook §8)
- [ ] Monorepo geçişi — bilinçli olarak ertelendi, klinik bitince ele alınacak

**Açık sorunlar:**
- Repolar üç ayrı GitHub hesabına dağılmış (asistan-merkezi org, hakansenipek, nukhetsenipek); monorepo öncesi tek org altında toplanmalı.
- Ödeme tahsilatı sağlayıcısı seçilmedi; `/api/v1/kredi/yukleme-talebi` alt projeden "talep" kaydı oluşturuyor (yalnız tanımlı `kredi_paketleri`'nden, serbest tutar girilemiyor — bedava kredi kapısı riski API katmanında kapatıldı), ama onay/kredi ekleme hâlâ elle: panel Finans›Ödemeler ekranı henüz yok (yer tutucu). Gönderim kodu artık Sistem›Bağlantı Ayarları'nı okuyor (SMS: Netgsm `kullanici_kodu` + `sifre` + başlık; e-posta: Resend `api_anahtari`); Netgsm REST v2 istek biçimi resmî kaynaktan kısmen doğrulandı, **canlı hesapla denenmedi**. Webhook: yalnız `/api/webhooks/resend` var; Netgsm/WhatsApp/Telegram/ödeme webhook'ları ve "bağlantıyı test et" yok. Giden webhook'lardan yalnız `kredi.esik_alti` / `kredi.tukendi` gönderiliyor; `mesaj.gonderildi` / `mesaj.teslim` / `mesaj.basarisiz` henüz gönderilmiyor.
- Meta Tech Provider başvurusu tamamlanmadı — WhatsApp hattı bu olmadan canlıya çıkamaz.
- Alt proje "şirket bilgileri" senkronizasyonu: push yönü `/api/v1/gonderen/senkron` ile ✅ (gonderen_ad/gonderen_adres/sms_basligi; bağlantı durumu alanlarına dokunmaz). Merkezin alt projeye dönüp cache pull fallback yapması hâlâ yok — hiçbir alt proje merkeze imzalı `/api/internal/*` ile bağlı değil.
- Sızan `CRON_SECRET` iptal edilip yeni bir `MERKEZ_INTERNAL_SECRET` üretilecek. Artık kodda **kullanılıyor**: `/api/internal/kuyruk-isle` bu sırla imzalı çağrılır (eksikse 503), yani sunucuya girilmeden kuyruk işlenmez. Vodafone kurulumunda yeni ortamda üretilir; eski `CRON_SECRET` hiçbir yerde kullanılmamalı.
- Gönderim motoru migration'ı (`20260930160000_gonderim_motoru.sql`) uygulanmadan yeni kod deploy edilmemeli (kod `sandbox`/`konu` kolonlarına ve yeni RPC'lere dayanır).
- Kredi askıda/bildirim migration'ı (`20260930170000_kredi_askida_bildirim.sql`) DB'ye uygulandı (2026-09-30; kolon/tablo/tetikleyici/6 fonksiyon canlıda doğrulandı, `rls:kontrol` temiz). Kredi bildirimi e-postası Resend (Sistem › Bağlantı Ayarları › E-posta) girilene kadar gitmez (`eposta_durumu = yok`, sonradan tekrar denenmez); webhook'u `MERKEZ_INTERNAL_SECRET` tanımlanana kadar gitmez. Kuyruk günde bir işlendiği için kredi yüklenince askıdan çıkan mesaj sonraki 08:05 turunda gönderilir. Askıda saklama süresi 30 gün (`lib/mesaj/kredi-bildirim.ts` `ASKIDA_SAKLAMA_GUN`) — randevu hatırlatması gibi zamana duyarlı mesajlar için kısaltılması değerlendirilmeli.

---
Son güncelleme: 2026-09-30

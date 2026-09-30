# Hata Kodu Kataloğu (`/api/v1`)

Yanıt gövdesi hata durumunda `{ "hata": "<Türkçe mesaj>" }`. Aşağıdaki tablo bugünkü koddan çıkarılmıştır (2026-09-30); yeni hata eklerken buraya da satır ekleyin.

## HTTP durumları ve alt projenin davranışı

| Status | Anlam | Nerede | Alt proje ne yapar |
|---|---|---|---|
| 200 | Kuyruğa alındı (`durum: queued`) ya da İYS reddi (`durum: iys_rejected`, kredi düşmez) | `/mesaj/gonder`, `/mesaj/toplu` | Başarı. `iys_rejected` kalıcı sonuçtur, tekrar deneme |
| 201 | Talep oluşturuldu | `/kredi/yukleme-talebi` | Başarı |
| 400 | Geçersiz gövde / eksik `Idempotency-Key` / eksik parametre | tümü | Kalıcı hata. Tekrar deneme, kodu düzelt |
| 401 | Geçersiz API anahtarı ya da geçersiz/süresi geçmiş `X-Imza` (±300 sn) | tümü | Kalıcı hata. Saat kaymasını ve anahtarı kontrol et; anahtar yenilendiyse env'i güncelle |
| 202 | Kredi yetersiz → mesaj **askıda** (`durum: askida`, `sebep: yetersiz_kredi`). Merkezde bekler; kredi yüklenince geliş sırasıyla kendiliğinden kuyruğa girer. 30 günde kredi gelmezse `failed/askida_zaman_asimi` | `/mesaj/gonder`, `/mesaj/toplu` (kalem bazında, özette `askida` sayısı) | Başarı gibi kaydet, **yeniden gönderme** (202 saklanır, aynı anahtar replay eder). Kullanıcıya "kredi bekliyor" göster; durumu `GET /mesaj/:id` ile izle |
| 402 | Yetersiz kredi — yalnız askıya alma adımı başarısız olursa (yedek yol) | `/mesaj/gonder` | Yerel kuyrukta tut, **aynı anahtarla** yeniden dene (402 saklanmaz) |
| 404 | Proje kullanıcısı / mesaj / kredi paketi bulunamadı | çoğu | Önce `/kullanici/senkron` çağır, sonra yeni anahtarla dene |
| 409 | Aynı `Idempotency-Key` hâlâ işleniyor | `/mesaj/gonder` | Kısa bekleyip **aynı anahtarla** tekrar dene |
| 422 | Aynı anahtar farklı gövdeyle kullanıldı **ya da** WhatsApp gönderen kimliği bağlı değil | `/mesaj/gonder` | Kalıcı hata; ikincisinde kullanıcıyı WhatsApp bağlamaya yönlendir |
| 429 | Hız limiti (henüz uygulanmıyor; bkz. CLAUDE.md §6.3 hız limiti) | — | `Retry-After`'a uy, üstel bekleme + jitter |
| 503 | Gönderim durduruldu (kill switch), gövdede `kod: "gonderim_durduruldu"` | `/mesaj/gonder`, `/mesaj/toplu` (kalem bazında) | Geçici: mesajı **yerel kuyrukta tut**, üstel geri çekilmeyle **aynı anahtarla** tekrar dene; kaybolmaz. Kaldırılınca gönderilir |
| 5xx | Merkez hatası | tümü | Geçici hata: üstel geri çekilme (en fazla 3 deneme), **aynı anahtarla** (5xx saklanmaz, anahtar serbest) |

## `mesaj_istekleri.hata_kodu` değerleri

| Kod | Anlam | Kredi |
|---|---|---|
| `rezervasyon_hatasi` | `kredi_rezerve_et` RPC hatası | Düşmedi |
| `yetersiz_kredi` | Bakiye yetmedi. Durum `pending` + `askiya_alinma` doluysa **askıda** (API'de `askida`); kredi gelince kod temizlenip `queued` olur | Düşmedi (devam ederken rezerve edilir) |
| `askida_zaman_asimi` | Askıda 30 günü aştı, kapatıldı; ham alıcı silindi | Düşmedi |
| `alici_kaydedilemedi` | Ham alıcı geçici tabloya yazılamadı (kredi iade edildi) | İade |

### Gönderim motoru kodları (durum `failed`; `GET /mesaj/:id` ile görülür)

Kalıcı hata ilk denemede sonuçlanır; geçici hata (429, 5xx, ağ) 3 denemede tükenirse `<kod>_denemeler_tukendi` olur. Başarısız her mesajda kredi **iade** edilir.

| Kod | Anlam | Alt proje ne yapar |
|---|---|---|
| `saglayici_yapilandirilmamis` | Kanal ayarı yok/pasif ya da sır girilmemiş | Merkez ekibine bildir (Sistem › Bağlantı Ayarları) |
| `kanal_desteklenmiyor` | WhatsApp (Meta Tech Provider bekliyor) / Telegram henüz yok | Bu kanalı kullanma |
| `gecersiz_alici` | Numara/e-posta biçimi geçersiz | Kullanıcı verisini düzelt |
| `icerik_yok` | Serbest metin gerekli (SMS/e-posta) | İçerik gönder |
| `sms_basligi_yok` | Ortak başlık ve kullanıcı başlığı tanımsız | Başlık tanımla |
| `alici_yok` | Kayıt tutarsızlığı | Yeniden gönder (yeni anahtar) |
| `netgsm_20/30/40/50/51…` | Netgsm yanıt kodu (20 metin, 30 yetki, 40 başlık tanımsız, 50/51 İYS) | Kodun anlamına göre |
| `netgsm_yanit_okunamadi` | Yanıt belirsiz; çift SMS riski nedeniyle tekrar denenmez | Panelden kontrol et |
| `resend_<ad>` | Resend hata adı (`validation_error`, …) | Adına göre |
| `http_429`, `http_5xx`, `ag_hatasi`, `netgsm_80/85` | Geçici; tükenirse `…_denemeler_tukendi` | Yeni istekle yeniden dene |
| `sandbox_simule_hata` / `sandbox_simule_gecici` | Sandbox alıcı sonu `…000` / `…500` | Beklenen |

Teslim durumu (`mesaj_loglari.teslim_durumu`): `delivered`, `bounced`, `complained`, `delayed` — şimdilik yalnız e-posta (Resend webhook'u). Netgsm teslim raporu ve WhatsApp/Telegram webhook'ları henüz yok.

## Idempotency davranışı (2026-09-30 düzeltmesi)

- **Saklanan yanıtlar:** 200/201 ve kalıcı 4xx (400/404/422). Bunlar aynı anahtarla `X-Idempotent-Replay: true` ile aynen döner.
- **Askıda (202)** kalıcı yanıttır, saklanır ve replay edilir — aynı mesaj iki kez askıya alınmaz.
- **Saklanmayan (anahtar serbest kalır):** 5xx ve 402. Aynı anahtarla yeniden denemek yeni işlem yapar.
- **Çöken istek:** yanıtsız kayıt 5 dakikadan eskiyse (fonksiyon süresinin üstü) sonraki istek kaydı devralır; o zamana kadar 409.
- **Bilinen sınır:** istek satırı açıldıktan sonra beklenmeyen istisna olursa anahtar (çifte kredi düşmesin diye) 5 dakika kilitli kalır. `enqueue` hatası isteği başarısız saymaz.
- `idempotency_kayitlari` temizliği: `20260930150000_idempotency_temizleme.sql` (`asistan_mesaj.idempotency_temizle()`, service_role) — uygulandı; zamanlayıcı bağlanınca günde bir çağıracak, o zamana kadar elle.

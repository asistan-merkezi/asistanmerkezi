# Alt Proje Entegrasyon Checklist'i

Bir modülü (ör. klinik) Mesaj Merkezi'ne bağlarken sırayla:

1. **Proje oluştur** — Panel › Projeler › kategori › "Proje Ekle". `amk_…` anahtarı **yalnız bir kez** gösterilir; kopyala.
2. **Env'ler** (alt projenin Vercel ayarları; Vault değil, düz env):
   - `MERKEZ_BASE_URL` — merkezin kök adresi
   - `MERKEZ_API_KEY` — `amk_…`
   - `MERKEZ_INTERNAL_SECRET` — merkez → alt proje imzası (Faz 2; sızan `CRON_SECRET` yenilenince girilecek)
   Alt projede sağlayıcı SDK'sı (Netgsm/Meta/Resend) ve sağlayıcı anahtarı **olmaz**.
3. **`lib/mesaj/merkez-client.ts`** — panelde proje sayfasındaki "bağlantı kodları" örneğini kullan. Ham gövde üzerinden `X-Imza` (`t=<unix>,v1=<hmac>`).
4. **Idempotency-Key** — `{proje}:{kuyruk_id}`, deterministik; deneme sayısı anahtara girmez. Kredi yetersizse 202 `askida` döner: mesaj merkezde bekler, **yeniden gönderme** — kredi yüklenince kendiliğinden gider (bkz. [hata-kodlari.md](hata-kodlari.md)).
5. **Kullanıcı senkronu** — ilk gönderimden önce `POST /kullanici/senkron`, ardından `POST /gonderen/senkron` (ad/adres/SMS başlığı). WhatsApp için ayrıca Embedded Signup gerekir.
6. **Yerel kuyruk = log** — merkeze ulaşılamazsa mesaj kaybolmaz; 5xx/ağ hatasında üstel geri çekilme, en fazla 3 deneme.
7. **`kalanBakiye` + `bakiyeVersiyonu`** — yalnız versiyon daha yeniyse yerel `mesaj_kredileri`'ne yaz.
7a. **Kredi webhook'u** — `webhook_url` tanımlıysa merkez `kredi.esik_alti` / `kredi.tukendi` olaylarını POST eder (`X-Imza`, `MERKEZ_INTERNAL_SECRET` ile; gövde: `olay, bildirimId, disKullaniciId, kanal, bakiye, esik, zaman`). İmzayı doğrula, `bildirimId` ile tekrarları ayıkla, kullanıcıya panelde uyarı göster. Kullanıcının e-postası senkronlanmışsa merkez ayrıca ona sistem maili atar (krediden düşmez).
8. **`kaynakBolum`** — tetikleyen ekranı etiketle (ör. `randevu_hatirlatma`); Mesaj Takibi'nde kırılım verir.
9. **Smoke test** (canlıya çıkmadan, sırayla):
   - [ ] Yanlış anahtarla istek → 401
   - [ ] `Idempotency-Key`'siz `/mesaj/gonder` → 400
   - [ ] Aynı anahtar + aynı gövde iki kez → ikincisi `X-Idempotent-Replay: true`, kredi bir kez düşer
   - [ ] Aynı anahtar + farklı gövde → 422
   - [ ] Bakiyesiz kullanıcı → 202 `durum: askida`, kredi değişmez; kredi yükleyince `GET /mesaj/:id` → `queued`/`sent`
   - [ ] Ticari mesaj, `REFUSE` alıcı → `iys_rejected`, kredi düşmez
   - [ ] Panel › Mesaj Takibi'nde kayıt maskeli alıcıyla görünüyor
10. **Log kuralı** — ham telefon/e-posta/içerik/token log'a yazılmaz; korelasyon için `mesajIstekId` ve `Idempotency-Key` kullan.

## Sandbox modu (canlıya çıkmadan önce)

Panel › Projeler › proje › **Sandbox'ı aç**. Açıkken mesajlar gerçek sağlayıcıya gitmez ve kredi düşmez; yanıtlar gerçekteki gibi döner (`sandbox: true` alanı eklenir, `kalanBakiye` mevcut bakiyeyi yansıtır). Alıcı sonuna göre davranış:

| Alıcı sonu | Sonuç |
|---|---|
| `…000` | Kalıcı hata `sandbox_simule_hata` |
| `…500` | Geçici hata, 3 denemede `…_denemeler_tukendi` |
| diğer | Başarılı, `dis_mesaj_id = sandbox-<istek id>` |

Sandbox smoke testleri: başarılı gönderim, kalıcı hata, geçici hata + yeniden deneme, **kill switch (503) sırasında yerel kuyruğun mesajı tutup sonra göndermesi**, idempotent tekrar. Hepsi geçince sandbox'ı kapatın. Uyarı: sandbox açıkken bile SMS/e-posta yapılandırması gerekmez, ama gerçek gönderimi doğrulamak için son adımda tek bir canlı test mesajı atın.

E-posta konusu için isteğe bağlı `konu` alanı gönderilebilir (varsayılan "Bildirim").

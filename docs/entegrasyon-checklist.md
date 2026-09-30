# Alt Proje Entegrasyon Checklist'i

Bir modülü (ör. klinik) Mesaj Merkezi'ne bağlarken sırayla:

1. **Proje oluştur** — Panel › Projeler › kategori › "Proje Ekle". `amk_…` anahtarı **yalnız bir kez** gösterilir; kopyala.
2. **Env'ler** (alt projenin Vercel ayarları; Vault değil, düz env):
   - `MERKEZ_BASE_URL` — merkezin kök adresi
   - `MERKEZ_API_KEY` — `amk_…`
   - `MERKEZ_INTERNAL_SECRET` — merkez → alt proje imzası (Faz 2; sızan `CRON_SECRET` yenilenince girilecek)
   Alt projede sağlayıcı SDK'sı (Netgsm/Meta/Resend) ve sağlayıcı anahtarı **olmaz**.
3. **`lib/mesaj/merkez-client.ts`** — panelde proje sayfasındaki "bağlantı kodları" örneğini kullan. Ham gövde üzerinden `X-Imza` (`t=<unix>,v1=<hmac>`).
4. **Idempotency-Key** — `{proje}:{kuyruk_id}`, deterministik; deneme sayısı anahtara girmez. 402 sonrası yeni deneme için yeni kuyruk kaydı/anahtar (bkz. [hata-kodlari.md](hata-kodlari.md)).
5. **Kullanıcı senkronu** — ilk gönderimden önce `POST /kullanici/senkron`, ardından `POST /gonderen/senkron` (ad/adres/SMS başlığı). WhatsApp için ayrıca Embedded Signup gerekir.
6. **Yerel kuyruk = log** — merkeze ulaşılamazsa mesaj kaybolmaz; 5xx/ağ hatasında üstel geri çekilme, en fazla 3 deneme.
7. **`kalanBakiye` + `bakiyeVersiyonu`** — yalnız versiyon daha yeniyse yerel `mesaj_kredileri`'ne yaz.
8. **`kaynakBolum`** — tetikleyen ekranı etiketle (ör. `randevu_hatirlatma`); Mesaj Takibi'nde kırılım verir.
9. **Smoke test** (canlıya çıkmadan, sırayla):
   - [ ] Yanlış anahtarla istek → 401
   - [ ] `Idempotency-Key`'siz `/mesaj/gonder` → 400
   - [ ] Aynı anahtar + aynı gövde iki kez → ikincisi `X-Idempotent-Replay: true`, kredi bir kez düşer
   - [ ] Aynı anahtar + farklı gövde → 422
   - [ ] Bakiyesiz kullanıcı → 402, kredi değişmez
   - [ ] Ticari mesaj, `REFUSE` alıcı → `iys_rejected`, kredi düşmez
   - [ ] Panel › Mesaj Takibi'nde kayıt maskeli alıcıyla görünüyor
10. **Log kuralı** — ham telefon/e-posta/içerik/token log'a yazılmaz; korelasyon için `mesajIstekId` ve `Idempotency-Key` kullan.

> Sandbox modu henüz yok (CLAUDE.md §8 "Sonra"): smoke test gerçek kredi ve gerçek sağlayıcı harcar. Test için ayrı bir proje + küçük kredi kullan.

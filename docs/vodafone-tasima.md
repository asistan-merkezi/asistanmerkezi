# Vodafone Cloud Kurulum ve Taşıma Runbook'u

**Karar (2026-09-30):** Veritabanı **ve** uygulama Vodafone Cloud'daki kiralık sunucuda çalışacak; Vercel ve Supabase Frankfurt'tan çıkılıyor. Veri **sıfırdan** başlıyor (canlı kiracı yok), Frankfurt'tan veri taşınmayacak. Sunucu erişimi henüz yok — bu belge erişim gelince uygulanacak sıradır.

Hazır olanlar (repoda): `Dockerfile`, `deploy/` (compose, Caddyfile, env şablonu, yedek scripti), `npm run db:kur`, `npm run rls:kontrol`, `/api/health`.

## 0. Mimari

Tek sunucu (VM), hepsi Docker:

```
Cloudflare (DNS)
   │
 Caddy :80/:443 ── asistanmerkezi.com     → uygulama:3000 (Next.js standalone)
                └─ api.asistanmerkezi.com → kong:8000 (Supabase API geçidi)
Supabase (resmî docker compose): db, auth, rest, kong, vault, pooler, studio…
```

Migration'lar Supabase'e özgü şeylere bağlı (`auth.users`/`auth.uid()`, `supabase_vault`, `anon/authenticated/service_role` rolleri), bu yüzden düz Postgres değil **self-hosted Supabase** kuruluyor.

## 1. Vodafone'dan istenecekler / sorulacaklar

- [ ] Ubuntu 22.04 veya 24.04 LTS, en az 4 vCPU / 8 GB RAM / 100 GB SSD (Supabase yığını ~10 konteyner; 4 GB yetmez)
- [ ] SSH erişimi (anahtarlı), root veya sudo
- [ ] Sabit genel IPv4; **80 ve 443 dışarıya açık**
- [ ] Vodafone'un sunduğu **snapshot/yedek hizmeti** var mı, fiyatı ve saklama süresi (yedek.sh'ye ek koruma)
- [ ] Sunucu dışı yedek hedefi için **Türkiye içinde ikinci bir konum** (başka sunucu ya da nesne depolama)
- [ ] Sunucu konumunun/sözleşmesinin yazılı belgesi (KVKK "yurt içi" iddiası için dayanak)

## 2. Sunucu hazırlığı

1. `apt update && apt upgrade`, otomatik güvenlik güncellemeleri (`unattended-upgrades`).
2. SSH: parola girişi kapalı, yalnız anahtar; `fail2ban`.
3. Güvenlik duvarı (`ufw`): yalnız **22, 80, 443**. Postgres (5432/6543) ve Studio dışarı **kapalı**.
4. Docker Engine + compose eklentisi. `/etc/docker/daemon.json` içinde log rotasyonu (`max-size: 10m`, `max-file: 5`).
5. Saat dilimi UTC, `chrony` ile senkron (imza doğrulaması ±300 sn'ye bağlı).
6. Repo'yu `/opt/asistanmerkezi` altına klonla.

## 3. Self-hosted Supabase

Resmî kaynak: `github.com/supabase/supabase` → `docker/` klasörü. Sürümü sabitle (etiketli/commit'li klon), `latest`'e güvenme.

1. `docker/` içeriğini `/opt/supabase` altına kopyala, `.env.example` → `.env`.
2. **Tüm örnek sırları değiştir** (`docker/utils/generate-keys.sh` ile): `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `DASHBOARD_PASSWORD`, `VAULT_ENC_KEY` (32 karakter).
3. **`VAULT_ENC_KEY` ve `.env` dosyasını sunucu dışında, şifreli yedekle.** Bu anahtar kaybolursa Vault'taki tüm sağlayıcı sırları (Netgsm/Meta/Resend) çözülemez. DB yedeği tek başına yetmez.
4. Adresler: `SUPABASE_PUBLIC_URL=https://api.asistanmerkezi.com`, `API_EXTERNAL_URL=https://api.asistanmerkezi.com/auth/v1`, `SITE_URL=https://asistanmerkezi.com`.
5. **`PGRST_DB_SCHEMAS=public,graphql_public,core,asistan_mesaj`** — migration'ların "Exposed schemas" notunun self-hosted karşılığı. Eksikse API `PGRST106` verir. (Yeni şema eklenirse buraya da eklenmeli.)
6. **Auth e-postaları:** CLAUDE.md §6.1 gereği Supabase Auth mailleri merkezi çıkıştan değil doğrudan SMTP'den gider. `.env` içindeki `SMTP_*` alanlarını doldur (Resend SMTP veya başka). Bu yapılmazsa kayıt/şifre sıfırlama mailleri **gitmez**.
7. `docker compose pull && docker compose up -d`; `docker compose ps` hepsi healthy.
8. Konteyner adı ve ağ adını doğrula: `docker network ls` → `supabase_default`, `docker ps` → `supabase-db` (yedek.sh ve `deploy/docker-compose.uygulama.yml` bunlara dayanır).

## 4. Veritabanı kurulumu

Migration'ları **siz uygularsınız** (bkz. hafıza notu). Sırayla:

```
# .env.local'da hedefi sunucuya çevir (Frankfurt değerleri değil):
#   SUPABASE_DB_HOST=<sunucu IP/alan adı>   SUPABASE_DB_PORT=5432
#   SUPABASE_DB_USER=postgres               SUPABASE_DB_SSL=false  (TLS yoksa)
#   SUPABASE_DB_PASSWORD=<POSTGRES_PASSWORD>
npm run db:kur                # PLAN: hangi migration'lar uygulanacak, hedefe yazmaz
npm run db:kur -- --uygula    # uygular (her dosya kendi transaction'ında, hatada durur)
npm run rls:kontrol           # tüm tablolarda RLS açık mı
```

`db:kur` hedef host `supabase.co/.com` ise çalışmayı reddeder (yanlışlıkla Frankfurt'a uygulamayı önlemek için). Postgres portu dışarı kapalı olduğu için SSH tüneli gerekir: `ssh -L 5432:localhost:5432 kullanici@sunucu` ve `SUPABASE_DB_HOST=localhost`. (Supavisor kullanılıyorsa kullanıcı `postgres.<tenant-id>` olabilir; doğrudan `supabase-db` portuna tünelleyin.)

Doğrulama:
- [ ] `select * from asistan_mesaj.kategoriler` → modül kategorileri + `ozel-proje` dolu (migration'la tohumlanır)
- [ ] `select extname from pg_extension where extname='supabase_vault'` → 1 satır
- [ ] `select asistan_mesaj.idempotency_temizle()` → hata vermeden `0` döner
- [ ] İlk **super_admin**: uygulamadan kayıt ol, sonra `core.profiles.rol='super_admin'` yap (yeni DB'de kimse yok, bu adım unutulursa `/yonetim` açılmaz)

## 5. Uygulama

```
cd /opt/asistanmerkezi/deploy
cp uretim.env.example .env.uretim      # değerleri doldur (Supabase .env'den ANON/SERVICE_ROLE)
docker compose -f docker-compose.uygulama.yml --env-file .env.uretim up -d --build
curl -s https://asistanmerkezi.com/api/health     # {"durum":"ok","veritabani":true}
```

- `NEXT_PUBLIC_*` build'e gömülür: adres/anahtar değişirse `--build` ile yeniden derle.
- **Cloudflare:** `asistanmerkezi.com` ve `api.` kayıtlarını sunucu IP'sine yönlendir. İlk sertifika alınana kadar "DNS only" (gri bulut); sonra proxy açılırsa SSL modu **Full (strict)**.
- **Kuyruk işçisi (zorunlu, yoksa mesaj gitmez):** sunucu cron'una dakikada bir `deploy/kuyruk-isle.sh` ekle (`* * * * * /opt/asistanmerkezi/deploy/kuyruk-isle.sh >> /var/log/asistan-kuyruk.log 2>&1`). `.env.uretim`'de `MERKEZ_INTERNAL_SECRET` dolu olmalı; yoksa uç `503` döner. Elle deneme: script'i çalıştır, `{"kuyruk":{"alinan":0,…}}` dönmeli. Aynı cron satırının yanına günlük `select asistan_mesaj.idempotency_temizle();` çağrısı da eklenebilir (`docker exec supabase-db psql -U postgres -c "…"`).
- **Resend webhook'u:** Resend panelinde webhook adresi `https://<UYGULAMA_ALAN_ADI>/api/webhooks/resend`; olaylar `email.delivered/bounced/complained/delivery_delayed`. Resend'in verdiği `whsec_…` sırrı Panel › Sistem › Bağlantı Ayarları › E-posta › "Webhook imza sırrı"na girilir.
- Yeni ortam = **yeni tüm sırlar**: `MERKEZ_INTERNAL_SECRET` yeniden üretilir (sızan `CRON_SECRET` bu ortamda kullanılmaz; CLAUDE.md açık sorunu kapanır).

## 6. Doğrulama (canlıya almadan)

- [ ] `/api/health` 200
- [ ] Kayıt → e-posta gelir → giriş → `/dashboard`
- [ ] `/yonetim/mesaj` açılır (super_admin), Genel Bakış boş ama hatasız
- [ ] Panelden proje oluştur → `amk_…` göster → [entegrasyon-checklist.md](entegrasyon-checklist.md) smoke testi
- [ ] `npm run rls:kontrol` yeşil
- [ ] Sunucu yeniden başlatılınca her şey kendiliğinden kalkıyor (`restart: unless-stopped`; `reboot` ile dene)
- [ ] Yedek: `deploy/yedek.sh` elle çalıştır → dosya oluştu, `DIS_HEDEF` kopyası geldi

## 7. Yedek, RPO / RTO

| | Hedef | Nasıl |
|---|---|---|
| **RPO** | ≤ 24 saat | `deploy/yedek.sh` günlük 02:30 (cron), 14 gün yerel saklama |
| **RTO** | ≤ 4 saat | Yeni VM + `docker compose up` + `pg_restore` + `.env`/`VAULT_ENC_KEY` |
| Yedek konumları | 3 | Sunucu diski, **TR içinde ikinci konum**, `.env`+`VAULT_ENC_KEY` ayrı şifreli |

- **Geri yükleme testi ayda bir** (boş bir Supabase örneğine `pg_restore`, `rls:kontrol`, birkaç sorgu). Test edilmemiş yedek yedek sayılmaz.
- "Tenant yanlışlıkla silindi" senaryosu: tam geri yükleme yerine yedeği geçici bir DB'ye aç, ilgili kiracının satırlarını oradan çek. Kredi/ödeme tabloları 10 yıl saklanır (CLAUDE.md §7); geri yüklemede bu tablolar öncelikli doğrulanır.
- Kritik tablolar için ileride sürekli arşivleme (WAL/PITR) değerlendirilebilir; şimdilik günlük dump.

## 8. Yurt içi iddiası — canlıya çıkmadan karar verilecek

Ana sayfadaki "Tüm veriler yurt içindeki yerel sunucularda saklanır" metni, bu taşımayla **veritabanı ve uygulama** için doğru olur. Ancak aşağıdakiler yurt dışına veri/metaveri götürür; metin bunlarla çelişmemeli ya da bunlar açıkça belirtilmeli:

| Servis | Ne gider | Durum |
|---|---|---|
| Resend (EU) | E-posta içeriği/alıcı, loglar | Yurt dışı |
| Claude API | Yalnız danışma amaçlı istemler (veri minimizasyonu gerek) | Yurt dışı |
| Upstash QStash | Görev gövdeleri (henüz bağlı değil) | Bölge seçilecek |
| Meta WhatsApp | Mesaj içeriği/alıcı | Yurt dışı (kaçınılmaz) |
| Cloudflare proxy | Tüm HTTP trafiği | Turuncu bulut açıksa yurt dışı PoP'lardan geçer |
| Netgsm | SMS | Türkiye |

Öneri: iddiayı "veritabanı ve uygulama sunucularımız Türkiye'dedir" biçimine daralt ve üçüncü taraf sağlayıcıları Aydınlatma Metni'nde say. Bu bir hukuk kararıdır (`kvkk-legal`/avukat); ben değiştirmedim.

## 9. Geri dönüş

Sıfırdan kurulum olduğu için Frankfurt/Vercel kurulumu **taşıma bitene kadar dokunulmadan kalır** ve DNS tek adımda geri çevrilebilir. Canlı kiracı olmadığından veri kaybı riski yok. Vercel ve Frankfurt projesini, Vodafone kurulumu §6 checklist'ini geçip bir hafta sorunsuz çalışana kadar **kapatma**.

## 10. Taşıma bitince güncellenecek

- CLAUDE.md §2: Veritabanı/Hosting satırları ("Vercel", "Frankfurt … planlandı"), pooler bağlantı notu (artık `SUPABASE_DB_HOST` sunucu; `aws-0` pooler geçersiz), `.env.local` değişken listesi
- CLAUDE.md §9: açık sorunlardaki `CRON_SECRET` maddesi
- `vodafone-cloud-tasima` hafıza notu (taşıma tamam)
- Ana sayfa "yurt içi" metni (§8 kararına göre)
- Modül hub'ları Vercel'de kalıyorsa (her modül ayrı Vercel projesi, CLAUDE.md §2) — bu belge yalnız Asistan Merkezi'ni kapsar; modüllerin barındırma yeri ayrı karar.

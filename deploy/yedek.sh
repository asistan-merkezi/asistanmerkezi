#!/usr/bin/env bash
# Günlük Postgres yedeği (self-hosted Supabase). Sunucuda cron ile çalıştırın:
#   30 2 * * *  /opt/asistanmerkezi/deploy/yedek.sh >> /var/log/asistan-yedek.log 2>&1
# Hedef: RPO ≤ 24 saat. Yerel yedek 14 gün tutulur; SUNUCU DIŞI kopya ŞART (aksi halde
# disk/sunucu kaybında yedek de gider) — aşağıdaki DIS_HEDEF ile (rsync/scp/rclone).
set -euo pipefail

YEDEK_DIZINI="${YEDEK_DIZINI:-/var/backups/asistanmerkezi}"
DB_KONTEYNER="${DB_KONTEYNER:-supabase-db}"
SAKLAMA_GUN="${SAKLAMA_GUN:-14}"
DIS_HEDEF="${DIS_HEDEF:-}"   # örn. yedek@baska-sunucu:/yedekler/asistan (TR içinde tutun)

mkdir -p "$YEDEK_DIZINI"
umask 077
DOSYA="$YEDEK_DIZINI/db-$(date +%Y%m%d-%H%M%S).dump"

# Özel format: pg_restore ile seçmeli/paralel geri yüklenebilir. Vault sırları şifreli
# tutulur; onları çözen VAULT_ENC_KEY dump'ta YOK — .env ayrıca (şifreli) yedeklenmeli.
docker exec "$DB_KONTEYNER" pg_dump -U postgres -d postgres -Fc --no-owner > "$DOSYA"

# Boş/bozuk yedeği kabul etme.
[ -s "$DOSYA" ] || { echo "HATA: yedek boş: $DOSYA" >&2; rm -f "$DOSYA"; exit 1; }
head -c5 "$DOSYA" | grep -q PGDMP || { echo "HATA: geçerli pg_dump başlığı yok" >&2; exit 1; }

find "$YEDEK_DIZINI" -name 'db-*.dump' -mtime +"$SAKLAMA_GUN" -delete

if [ -n "$DIS_HEDEF" ]; then
  rsync -a "$DOSYA" "$DIS_HEDEF/"
fi
echo "$(date -Is) yedek tamam: $DOSYA ($(du -h "$DOSYA" | cut -f1))"

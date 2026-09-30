#!/usr/bin/env bash
# Merkezi zamanlayıcı: kuyruğu işleyen uç noktayı imzalı çağırır (CLAUDE.md §6.3).
# Sunucuda cron ile DAKİKADA BİR çalıştırın (QStash/Vercel cron kullanılmıyor):
#   * * * * *  /opt/asistanmerkezi/deploy/kuyruk-isle.sh >> /var/log/asistan-kuyruk.log 2>&1
# Gereken: deploy/.env.uretim içinde UYGULAMA_ALAN_ADI ve MERKEZ_INTERNAL_SECRET.
# Eşzamanlı çalışmalar güvenlidir (satırlar lease + skip locked ile alınır).
set -euo pipefail

KLASOR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
# shellcheck disable=SC1091
. "$KLASOR/.env.uretim"
set +a

: "${UYGULAMA_ALAN_ADI:?UYGULAMA_ALAN_ADI tanımlı değil}"
: "${MERKEZ_INTERNAL_SECRET:?MERKEZ_INTERNAL_SECRET tanımlı değil}"

ADET="${KUYRUK_ADET:-20}"
GOVDE="{\"adet\":${ADET}}"
ZAMAN="$(date +%s)"
# Taban: ${t}.${hamGovde} — uygulamadaki lib/mesaj/imza.ts ile aynı desen (±300 sn).
IMZA="$(printf '%s' "${ZAMAN}.${GOVDE}" | openssl dgst -sha256 -hmac "$MERKEZ_INTERNAL_SECRET" -hex | sed 's/^.* //')"

curl -fsS -m 55 -X POST "https://${UYGULAMA_ALAN_ADI}/api/internal/kuyruk-isle" \
  -H "Content-Type: application/json" \
  -H "X-Imza: t=${ZAMAN},v1=${IMZA}" \
  -d "$GOVDE"
echo

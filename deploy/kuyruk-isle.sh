#!/usr/bin/env bash
# Merkezi zamanlayıcı: kuyruğu işleyen uç noktayı imzalı çağırır (CLAUDE.md §6.3).
# GEÇİCİ DÜZEN: şimdilik GÜNDE BİR kez çalıştırılır; sonra sıklaştırılacak (aşağıya bakın).
# Sunucuda cron (QStash/Vercel cron kullanılmıyor):
#   5 5 * * *  /opt/asistanmerkezi/deploy/kuyruk-isle.sh >> /var/log/asistan-kuyruk.log 2>&1
#   (05:05 UTC = 08:05 TRT: sessiz saat 08:00'de biter, o saate ertelenen mesajlar da bu turda gider.)
# Sıklaştırmak için yalnız cron satırını değiştir, ör. dakikada bir: "* * * * *".
# Günlük çalışmanın sonuçları:
#   - Mesajlar en geç ~24 saat gecikmeyle gider; anlık/acil bildirim için uygun DEĞİL.
#   - Geçici hatada (429/5xx/ağ) yeniden deneme bir sonraki çalıştırmaya kalır
#     (3 deneme = 3 gün); kredi bu sürede rezerve kalır.
#   - Bu yüzden script kuyruk boşalana kadar tur atar (tek çağrıya sığmayan hacim için).
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

ADET="${KUYRUK_ADET:-50}"          # tur başına (uç nokta en fazla 100 kabul eder)
MAKS_TUR="${KUYRUK_MAKS_TUR:-200}" # güvenlik sınırı: en çok ADET x MAKS_TUR mesaj

for ((tur = 1; tur <= MAKS_TUR; tur++)); do
  GOVDE="{\"adet\":${ADET}}"
  ZAMAN="$(date +%s)"
  # Taban: ${t}.${hamGovde} — uygulamadaki lib/mesaj/imza.ts ile aynı desen (±300 sn).
  IMZA="$(printf '%s' "${ZAMAN}.${GOVDE}" | openssl dgst -sha256 -hmac "$MERKEZ_INTERNAL_SECRET" -hex | sed 's/^.* //')"

  YANIT="$(curl -fsS -m 55 -X POST "https://${UYGULAMA_ALAN_ADI}/api/internal/kuyruk-isle" \
    -H "Content-Type: application/json" \
    -H "X-Imza: t=${ZAMAN},v1=${IMZA}" \
    -d "$GOVDE")"
  echo "tur ${tur}: ${YANIT}"

  ALINAN="$(printf '%s' "$YANIT" | grep -o '"alinan":[0-9]*' | head -1 | cut -d: -f2)"
  # Tur dolmadıysa kuyruk boşalmıştır (ya da kalanlar ertelenmiş/durdurulmuş): bitir.
  if [ -z "$ALINAN" ] || [ "$ALINAN" -lt "$ADET" ]; then
    break
  fi
done

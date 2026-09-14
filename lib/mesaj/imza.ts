import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Alt proje → merkez istek doğrulaması (CLAUDE.md §6.3 "Güvenlik"):
// X-Api-Key (hash karşılaştırması) + X-İmza: t=<unix>,v1=<hmac>
// (taban ${t}.${rawBody}, ±300 sn, timingSafeEqual). Merkez → alt proje
// yönü aynı deseni kullanacağı için fonksiyonlar simetrik tutuldu.

const IMZA_PENCERESI_SANIYE = 300;

function sabitZamanEsitMi(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function apiKeyDogrula(saglananAnahtar: string, saklananHash: string): boolean {
  const hesaplanan = createHash("sha256").update(saglananAnahtar).digest("hex");
  return sabitZamanEsitMi(hesaplanan, saklananHash);
}

export function imzaOlustur(
  gizliAnahtar: string,
  hamGovde: string,
  zaman: number = Math.floor(Date.now() / 1000),
): string {
  const taban = `${zaman}.${hamGovde}`;
  const hmac = createHmac("sha256", gizliAnahtar).update(taban).digest("hex");
  return `t=${zaman},v1=${hmac}`;
}

export function imzaDogrula(
  gizliAnahtar: string,
  hamGovde: string,
  imzaBasligi: string | null,
): boolean {
  if (!imzaBasligi) return false;

  const parcalar = new Map(
    imzaBasligi.split(",").map((parca) => {
      const [anahtar, deger] = parca.split("=");
      return [anahtar?.trim(), deger?.trim()];
    }),
  );

  const zamanMetni = parcalar.get("t");
  const alinanHmac = parcalar.get("v1");
  if (!zamanMetni || !alinanHmac) return false;

  const zaman = Number(zamanMetni);
  if (!Number.isFinite(zaman)) return false;

  const simdi = Math.floor(Date.now() / 1000);
  if (Math.abs(simdi - zaman) > IMZA_PENCERESI_SANIYE) return false;

  const beklenenHmac = createHmac("sha256", gizliAnahtar)
    .update(`${zaman}.${hamGovde}`)
    .digest("hex");

  return sabitZamanEsitMi(alinanHmac, beklenenHmac);
}

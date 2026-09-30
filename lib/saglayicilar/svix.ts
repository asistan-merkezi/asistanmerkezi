import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Svix imza doğrulaması (Resend webhook'ları): taban `${id}.${timestamp}.${hamGovde}`,
// anahtar = `whsec_` sonrası base64 çözülmüş sır, HMAC-SHA256, başlık "v1,<base64> v1,<base64>".
const TOLERANS_SANIYE = 300;

export function svixDogrula(
  sir: string,
  hamGovde: string,
  id: string | null,
  zaman: string | null,
  imzalar: string | null,
): boolean {
  if (!id || !zaman || !imzalar) return false;

  const zamanSayi = Number(zaman);
  if (!Number.isFinite(zamanSayi)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - zamanSayi) > TOLERANS_SANIYE) return false;

  const anahtar = Buffer.from(sir.replace(/^whsec_/, ""), "base64");
  const beklenen = createHmac("sha256", anahtar).update(`${id}.${zaman}.${hamGovde}`).digest();

  return imzalar.split(" ").some((parca) => {
    const [surum, deger] = parca.split(",");
    if (surum !== "v1" || !deger) return false;
    const alinan = Buffer.from(deger, "base64");
    return alinan.length === beklenen.length && timingSafeEqual(alinan, beklenen);
  });
}

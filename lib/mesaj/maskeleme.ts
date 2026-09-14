import "server-only";

import { createHash } from "node:crypto";

// mesaj_istekleri.alici_hash / alici_maskeli üretimi (CLAUDE.md §6.2/§6.3).
// Ham alıcı (telefon/e-posta) hiçbir zaman mesaj_istekleri'ne yazılmaz —
// yalnızca hash (İYS/idempotency eşleştirmesi için) ve maskeli gösterim.

export function aliciHashle(aliciHam: string): string {
  return createHash("sha256").update(aliciHam.trim().toLowerCase()).digest("hex");
}

export function aliciMaskele(aliciHam: string): string {
  const deger = aliciHam.trim();

  if (deger.includes("@")) {
    const [yerel, alanAdi] = deger.split("@");
    if (!alanAdi) return "***";
    const gorunen = yerel.slice(0, 2);
    return `${gorunen}${"*".repeat(Math.max(yerel.length - 2, 1))}@${alanAdi}`;
  }

  // telefon: +90 532 *** ** 88 deseni — baş 3-4 ve son 2 hane görünür kalır.
  const rakamlar = deger.replace(/\D/g, "");
  if (rakamlar.length < 6) return "*".repeat(deger.length);

  const bas = deger.slice(0, deger.length - rakamlar.length + 6);
  const son = deger.slice(-2);
  const ortaUzunluk = Math.max(deger.length - bas.length - 2, 3);

  return `${bas} ${"*".repeat(ortaUzunluk)} ${son}`;
}

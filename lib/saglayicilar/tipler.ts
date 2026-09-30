// Sağlayıcı sarmalayıcılarının ortak sözleşmesi (CLAUDE.md §6.1).
// Sonuç üç türlüdür; gönderim motoru buna göre kesinleştirir / iade eder / tekrar dener.

export type GonderimIstegi = {
  istekId: string;
  alici: string;
  icerik: string | null;
  konu: string | null;
  gonderen: {
    ad: string | null;
    adres: string | null;
    smsBasligi: string | null;
  };
};

export type GonderimSonucu =
  | { tur: "basarili"; disMesajId: string }
  // Geçici (429, 5xx, ağ): en fazla 3 deneme, üstel bekleme (CLAUDE.md §6.3).
  | { tur: "gecici_hata"; kod: string; beklemeSn?: number }
  // Kalıcı: tekrar denenmez, kredi iade edilir.
  | { tur: "kalici_hata"; kod: string };

export const ISTEK_ZAMAN_ASIMI_MS = 15_000;

// Retry-After başlığı (saniye) → sayı; okunamazsa undefined.
export function beklemeSaniyesi(basliklar: Headers): number | undefined {
  const deger = Number(basliklar.get("retry-after"));
  return Number.isFinite(deger) && deger > 0 ? Math.min(deger, 3600) : undefined;
}

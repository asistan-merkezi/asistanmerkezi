// Panel genelindeki gün / ay / yıl süzgeci. Durum URL'de tutulur
// (?donem=gun|ay|yil&t=YYYY-MM-DD), sayfalar `donemCoz` ile aralığı alır.
// Sınırlar Europe/Istanbul (sabit UTC+3) günüdür; dönüşüm lib/zaman.ts ile aynı ofset.

export type DonemTipi = "gun" | "ay" | "yil";

const TRT_OFSET_MS = 3 * 60 * 60 * 1000;
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export type DonemSonucu = {
  tip: DonemTipi;
  /** Seçili dönemin bulunduğu gün, YYYY-MM-DD */
  t: string;
  /** [baslangic, bitis) — ISO, gerçek UTC anı */
  baslangic: string;
  bitis: string;
  etiket: string;
  onceki: { t: string; etiket: string };
  sonraki: { t: string; etiket: string; devreDisi: boolean };
};

function ymd(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10);
}

function trtGunUtc(an: Date): number {
  const t = new Date(an.getTime() + TRT_OFSET_MS);
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

export function donemCoz(donem?: string, t?: string, simdi: Date = new Date()): DonemSonucu {
  const tip: DonemTipi = donem === "ay" || donem === "yil" ? donem : "gun";
  const bugun = trtGunUtc(simdi);
  let capa = bugun;
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, g] = t.split("-").map(Number);
    const adayi = Date.UTC(y, m - 1, g);
    if (!Number.isNaN(adayi) && ymd(adayi) === t) capa = Math.min(adayi, bugun);
  }
  const c = new Date(capa);
  const y = c.getUTCFullYear();
  const m = c.getUTCMonth();

  const baslangicUtc = tip === "gun" ? capa : tip === "ay" ? Date.UTC(y, m, 1) : Date.UTC(y, 0, 1);
  const bitisUtc = tip === "gun" ? capa + 86400000 : tip === "ay" ? Date.UTC(y, m + 1, 1) : Date.UTC(y + 1, 0, 1);
  const oncekiUtc = tip === "gun" ? capa - 86400000 : tip === "ay" ? Date.UTC(y, m - 1, 1) : Date.UTC(y - 1, 0, 1);
  const sonrakiUtc = bitisUtc;

  const etiketle = (utc: number) => {
    const d = new Date(utc);
    if (tip === "yil") return String(d.getUTCFullYear());
    if (tip === "ay") return `${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()} ${GUNLER[d.getUTCDay()]}`;
  };

  return {
    tip,
    t: ymd(capa),
    baslangic: new Date(baslangicUtc - TRT_OFSET_MS).toISOString(),
    bitis: new Date(bitisUtc - TRT_OFSET_MS).toISOString(),
    etiket: etiketle(capa),
    onceki: { t: ymd(oncekiUtc), etiket: etiketle(oncekiUtc) },
    sonraki: { t: ymd(sonrakiUtc), etiket: etiketle(sonrakiUtc), devreDisi: sonrakiUtc > bugun },
  };
}

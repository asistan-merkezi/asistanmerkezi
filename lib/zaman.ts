// Europe/Istanbul ⇄ UTC dönüşümü tek yerde burada yapılır (CLAUDE.md §7).
// Türkiye 2016'dan beri yaz saati uygulamadığı için sabit UTC+3 kullanılır —
// IANA tz veritabanına ihtiyaç yok, basit ofset yeterli.

const TRT_OFSET_MS = 3 * 60 * 60 * 1000;

// CLAUDE.md §6.3: sessiz saat varsayılan 21:00–08:00 TRT. Bitiş 08:00'dir,
// 09:00 değil — aksi halde sabah tetikleyicileri (§6.3 klinik hatırlatma-sabah
// 05:00 UTC = 08:00 TRT) kendi kuralına takılır.
const SESSIZ_SAAT_BASLANGIC = 21;
const SESSIZ_SAAT_BITIS = 8;

function istanbulAlanlari(tarih: Date): Date {
  return new Date(tarih.getTime() + TRT_OFSET_MS);
}

export function sessizSaatteMi(tarih: Date = new Date()): boolean {
  const saat = istanbulAlanlari(tarih).getUTCHours();
  return saat >= SESSIZ_SAAT_BASLANGIC || saat < SESSIZ_SAAT_BITIS;
}

// Verilen andan sonraki ilk 08:00 TRT'yi (gerçek UTC instant olarak) döndürür.
export function sonrakiSessizSaatBitisi(tarih: Date = new Date()): Date {
  const trt = istanbulAlanlari(tarih);
  const gunEklemesi = trt.getUTCHours() < SESSIZ_SAAT_BITIS ? 0 : 1;
  const bitisIstanbulAlanlariUtcTemsili = Date.UTC(
    trt.getUTCFullYear(),
    trt.getUTCMonth(),
    trt.getUTCDate() + gunEklemesi,
    SESSIZ_SAAT_BITIS,
    0,
    0,
    0,
  );
  return new Date(bitisIstanbulAlanlariUtcTemsili - TRT_OFSET_MS);
}

export function istanbulGunBaslangici(tarih: Date = new Date()): Date {
  const trt = istanbulAlanlari(tarih);
  const baslangicUtcTemsili = Date.UTC(trt.getUTCFullYear(), trt.getUTCMonth(), trt.getUTCDate(), 0, 0, 0, 0);
  return new Date(baslangicUtcTemsili - TRT_OFSET_MS);
}

export function istanbulAyBaslangici(tarih: Date = new Date()): Date {
  const trt = istanbulAlanlari(tarih);
  const baslangicUtcTemsili = Date.UTC(trt.getUTCFullYear(), trt.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(baslangicUtcTemsili - TRT_OFSET_MS);
}

// React Server Component render gövdesinde doğrudan `Date.now()`/`new Date()`
// çağırmak "impure function" lint hatası verir (react-hooks/purity) — bu
// yüzden "N saat önce" hesabı da istanbulGunBaslangici gibi burada, varsayılan
// parametre içinde yapılıyor.
export function saatOncesi(saat: number, tarih: Date = new Date()): Date {
  return new Date(tarih.getTime() - saat * 60 * 60 * 1000);
}

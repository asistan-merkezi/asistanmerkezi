// Operatör görünen adı ve avatar baş harfleri — mobil üst bar (§ mobil konsol)
// ve masaüstü header arasında ortak; ad_soyad boşsa e-posta'ya düşer.
export function operatorGoruntuAdi(adSoyad: string | null, email: string): string {
  if (adSoyad && adSoyad.trim().length > 0) {
    return adSoyad.trim().split(/\s+/)[0];
  }
  return email.split("@")[0];
}

export function operatorBasHarfleri(adSoyad: string | null, email: string): string {
  const kaynak = adSoyad && adSoyad.trim().length > 0 ? adSoyad.trim() : email.split("@")[0];
  const kelimeler = kaynak.split(/\s+/).filter(Boolean);
  const harfler = kelimeler.slice(0, 2).map((k) => k[0]);
  return harfler.join("").toLocaleUpperCase("tr-TR") || "OP";
}

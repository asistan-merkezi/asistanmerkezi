// Panel "Finans" bölümünün alt ekranları. Hub kartları ve alt sayfalar buradan beslenir.
export const FINANS_YOLU = "/yonetim/mesaj/finans";

export const FINANS_BOLUMLERI = [
  {
    slug: "odemeler",
    ad: "Ödemeler",
    ikon: "payments",
    aciklama:
      "Kredi paketi alımları, ödeme günü/tutar ve mutabakat kayıtları; manuel kredi ekleme (audit'li, yalnız super_admin). Ödeme tahsilat sağlayıcısı seçilene kadar açılmayacak (CLAUDE.md §9).",
  },
  {
    slug: "personel",
    ad: "Personel",
    ikon: "badge",
    aciklama: "Asistan Merkezi ekibinin maaş, prim ve izin kayıtları.",
  },
  {
    slug: "gelen-faturalar",
    ad: "Gelen Faturalar",
    ikon: "receipt",
    aciklama: "Tedarikçilerden (Netgsm, Meta, Resend, Vercel, Supabase vb.) gelen faturaların kaydı ve ödeme takibi.",
  },
  {
    slug: "giderler",
    ad: "Giderler",
    ikon: "account_balance_wallet",
    aciklama: "Sağlayıcı ve altyapı giderleri, kategori bazlı kırılım.",
  },
  {
    slug: "raporlar",
    ad: "Raporlar",
    ikon: "monitoring",
    aciklama: "Gelir–gider, kredi satışı ve mesaj maliyeti raporları.",
  },
] as const;

export function finansBolumuBul(slug: string) {
  return FINANS_BOLUMLERI.find((b) => b.slug === slug);
}

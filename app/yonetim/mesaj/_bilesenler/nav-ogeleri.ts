// Sidebar (masaüstü) ve alt navigasyon + menü çekmecesi (mobil) aynı
// kaynaktan beslenir ki route ve "hazır/yakında" durumu birbirinden sapmasın.
export const NAV_OGELERI = [
  { yol: "/yonetim/mesaj", etiket: "Genel Bakış", ikon: "dashboard", hazir: true },
  { yol: "/yonetim/mesaj/kategoriler", etiket: "Kategoriler", ikon: "category", hazir: true },
  { yol: "/yonetim/mesaj/projeler", etiket: "Projeler", ikon: "folder_open", hazir: false },
  { yol: "/yonetim/mesaj/kullanicilar", etiket: "Kullanıcılar", ikon: "group", hazir: true },
  { yol: "/yonetim/mesaj/mesaj-gunlugu", etiket: "Mesaj Günlüğü", ikon: "receipt_long", hazir: true },
  { yol: "/yonetim/mesaj/odemeler", etiket: "Ödemeler", ikon: "payments", hazir: false },
  { yol: "/yonetim/mesaj/sablonlar", etiket: "Şablonlar", ikon: "drafts", hazir: false },
  { yol: "/yonetim/mesaj/zamanlayici", etiket: "Zamanlayıcı", ikon: "schedule", hazir: false },
  { yol: "/yonetim/mesaj/sistem", etiket: "Sistem", ikon: "settings", hazir: true },
] as const;

// Sistem bölümünün alt sayfaları (kanal/sağlayıcı bağlantıları) — sidebar'da
// Sistem'in altında açılır. Yol/etiket kaynağı lib/mesaj/kanal-tanimlari.ts.
export const SISTEM_YOLU = "/yonetim/mesaj/sistem";

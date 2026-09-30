// Sidebar (masaüstü) ve alt navigasyon + menü çekmecesi (mobil) aynı
// kaynaktan beslenir ki route ve "hazır/yakında" durumu birbirinden sapmasın.
export const NAV_OGELERI = [
  { yol: "/yonetim/mesaj", etiket: "Genel Bakış", ikon: "dashboard", hazir: true },
  { yol: "/yonetim/mesaj/projeler", etiket: "Projeler", ikon: "folder_open", hazir: true },
  { yol: "/yonetim/mesaj/kullanicilar", etiket: "Kullanıcılar", ikon: "group", hazir: true },
  { yol: "/yonetim/mesaj/mesaj-gunlugu", etiket: "Mesaj Takibi", ikon: "receipt_long", hazir: true },
  { yol: "/yonetim/mesaj/finans", etiket: "Finans", ikon: "account_balance", hazir: true },
  { yol: "/yonetim/mesaj/sistem", etiket: "Sistem", ikon: "settings", hazir: true },
] as const;

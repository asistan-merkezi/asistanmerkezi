// Sidebar (masaüstü) ve alt navigasyon + menü çekmecesi (mobil) aynı
// kaynaktan beslenir ki route ve "hazır/yakında" durumu birbirinden sapmasın.
export const NAV_OGELERI = [
  { yol: "/yonetim/mesaj", etiket: "Genel Bakış", ikon: "dashboard", hazir: true },
  { yol: "/yonetim/mesaj/kategoriler", etiket: "Kategoriler", ikon: "category", hazir: true },
  { yol: "/yonetim/mesaj/projeler", etiket: "Projeler", ikon: "folder_open", hazir: false },
  { yol: "/yonetim/mesaj/kullanicilar", etiket: "Kullanıcılar", ikon: "group", hazir: true },
  { yol: "/yonetim/mesaj/mesaj-gunlugu", etiket: "Mesaj Günlüğü", ikon: "receipt_long", hazir: true },
  { yol: "/yonetim/mesaj/kanallar/sms", etiket: "SMS", ikon: "sms", hazir: true },
  { yol: "/yonetim/mesaj/kanallar/whatsapp", etiket: "WhatsApp", ikon: "chat", hazir: true },
  { yol: "/yonetim/mesaj/kanallar/eposta", etiket: "E-posta", ikon: "mail", hazir: true },
  { yol: "/yonetim/mesaj/kanallar/telegram", etiket: "Telegram", ikon: "send", hazir: true },
  { yol: "/yonetim/mesaj/kanallar/odeme", etiket: "Ödeme Bağlantısı", ikon: "credit_card", hazir: true },
  { yol: "/yonetim/mesaj/odemeler", etiket: "Ödemeler", ikon: "payments", hazir: false },
  { yol: "/yonetim/mesaj/sablonlar", etiket: "Şablonlar", ikon: "drafts", hazir: false },
  { yol: "/yonetim/mesaj/zamanlayici", etiket: "Zamanlayıcı", ikon: "schedule", hazir: false },
  { yol: "/yonetim/mesaj/sistem", etiket: "Sistem", ikon: "settings", hazir: false },
] as const;

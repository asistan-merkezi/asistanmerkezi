// Kanal bağlantı ekranlarının tek kaynağı (CLAUDE.md §6.1 tablosu + ödeme).
// depo: "ayar" → saglayici_ayarlari.ayarlar (jsonb), "gizli" → Supabase Vault.
// Varsayılan URL'ler yalnız ön-dolum; ekrandan değiştirilebilir. API versiyonu URL'de sabit ("latest" yok).

export type KanalSlug = "sms" | "whatsapp" | "eposta" | "telegram" | "odeme";

export type AlanTanimi = {
  anahtar: string;
  etiket: string;
  depo: "ayar" | "gizli";
  ipucu?: string;
};

export type KanalTanimi = {
  slug: KanalSlug;
  ad: string;
  ikon: string;
  ozet: string;
  varsayilanSaglayici: string;
  varsayilanUrl: string;
  varsayilanVersiyon?: string;
  webhookYolu: string | null;
  alanlar: AlanTanimi[];
};

export const KANALLAR: KanalTanimi[] = [
  {
    slug: "sms",
    ad: "SMS",
    ikon: "sms",
    ozet: "SMS çıkışı — Netgsm. BTK onaylı ortak başlık; isteyen modül kendi başlığını bağlar.",
    varsayilanSaglayici: "Netgsm",
    varsayilanUrl: "https://api.netgsm.com.tr/sms/rest/v2",
    webhookYolu: "/api/webhooks/netgsm",
    alanlar: [
      { anahtar: "kullanici_kodu", etiket: "Kullanıcı kodu", depo: "ayar" },
      { anahtar: "sifre", etiket: "API şifresi", depo: "gizli" },
      { anahtar: "ortak_baslik", etiket: "Ortak SMS başlığı", depo: "ayar", ipucu: "BTK onaylı başlık" },
    ],
  },
  {
    slug: "whatsapp",
    ad: "WhatsApp",
    ikon: "chat",
    ozet: "Meta Cloud API (doğrudan, BSP yok). Tek Tech Provider App; kiracılar Embedded Signup ile kendi WABA'sını bağlar.",
    varsayilanSaglayici: "Meta Cloud API",
    varsayilanUrl: "https://graph.facebook.com",
    varsayilanVersiyon: "v21.0",
    webhookYolu: "/api/webhooks/whatsapp",
    alanlar: [
      { anahtar: "app_id", etiket: "Meta App ID", depo: "ayar" },
      { anahtar: "embedded_signup_config_id", etiket: "Embedded Signup config ID", depo: "ayar" },
      { anahtar: "app_secret", etiket: "App Secret (webhook imzası)", depo: "gizli" },
      { anahtar: "sistem_kullanici_token", etiket: "Sistem kullanıcısı access token", depo: "gizli" },
      { anahtar: "dogrulama_tokeni", etiket: "Webhook doğrulama tokeni", depo: "gizli" },
    ],
  },
  {
    slug: "eposta",
    ad: "E-posta",
    ikon: "mail",
    ozet: "Resend (EU). Domain doğrulaması merkezde; varsayılan gönderen bildirim@asistanmerkezi.com.",
    varsayilanSaglayici: "Resend",
    varsayilanUrl: "https://api.resend.com",
    webhookYolu: "/api/webhooks/resend",
    alanlar: [
      { anahtar: "varsayilan_gonderen", etiket: "Varsayılan gönderen adresi", depo: "ayar" },
      { anahtar: "api_anahtari", etiket: "API anahtarı", depo: "gizli" },
      { anahtar: "webhook_imza_sirri", etiket: "Webhook imza sırrı", depo: "gizli" },
    ],
  },
  {
    slug: "telegram",
    ad: "Telegram",
    ikon: "send",
    ozet: "Ortak system bot (deep link eşleştirme); kiracı isterse kendi bot token'ını bağlar.",
    varsayilanSaglayici: "Telegram Bot API",
    varsayilanUrl: "https://api.telegram.org",
    webhookYolu: "/api/webhooks/telegram",
    alanlar: [
      { anahtar: "bot_kullanici_adi", etiket: "Bot kullanıcı adı", depo: "ayar", ipucu: "@ olmadan" },
      { anahtar: "bot_token", etiket: "Bot token", depo: "gizli" },
      { anahtar: "webhook_sirri", etiket: "Webhook gizli anahtarı", depo: "gizli" },
    ],
  },
  {
    slug: "odeme",
    ad: "Ödeme",
    ikon: "credit_card",
    ozet: "Kredi paketi tahsilatı. Sağlayıcı henüz seçilmedi (CLAUDE.md §9) — seçilince buradan bağlanır.",
    varsayilanSaglayici: "",
    varsayilanUrl: "",
    webhookYolu: "/api/webhooks/odeme",
    alanlar: [
      { anahtar: "isyeri_kodu", etiket: "Üye işyeri / mağaza kodu", depo: "ayar" },
      { anahtar: "api_anahtari", etiket: "API anahtarı", depo: "gizli" },
      { anahtar: "gizli_anahtar", etiket: "Gizli anahtar (secret key)", depo: "gizli" },
      { anahtar: "webhook_imza_sirri", etiket: "Callback imza sırrı", depo: "gizli" },
    ],
  },
];

export function kanalBul(slug: string): KanalTanimi | undefined {
  return KANALLAR.find((k) => k.slug === slug);
}

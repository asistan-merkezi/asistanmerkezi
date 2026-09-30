import Link from "next/link";

const BOLUMLER = [
  {
    yol: "/yonetim/mesaj/sistem/baglanti-ayarlari",
    ad: "Bağlantı Ayarları",
    ikon: "cable",
    aciklama: "SMS, WhatsApp, E-posta, Telegram ve ödeme sağlayıcı bağlantıları: API adresi, kimlik bilgileri, webhook.",
    hazir: true,
  },
  {
    yol: "/yonetim/mesaj/sistem/acil-durdurma",
    ad: "Acil Durdurma",
    ikon: "emergency_home",
    aciklama: "Proje, kanal veya tüm gönderimi tek adımda durdur / yeniden başlat (kill switch). Audit'li.",
    hazir: true,
  },
  {
    yol: "/yonetim/mesaj/sistem/sablonlar",
    ad: "Şablonlar",
    ikon: "drafts",
    aciklama: "WhatsApp HSM şablon durumları (Meta webhook'uyla senkron).",
    hazir: false,
  },
  {
    yol: "/yonetim/mesaj/sistem/zamanlayici",
    ad: "Zamanlayıcı",
    ikon: "schedule",
    aciklama: "Planlı görevler defteri, son çalışmalar ve elle tetikleme.",
    hazir: false,
  },
];

export default function SistemSayfasi() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Sistem</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">Sistem</h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          Bağlantı ayarları, şablonlar ve zamanlayıcı. Webhook olayları ve audit log sonra eklenecek.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BOLUMLER.map((b) => (
          <Link
            key={b.yol}
            href={b.yol}
            className="flex flex-col gap-2 rounded-lg border border-panel-border bg-panel-surface p-5 shadow-sm transition-colors hover:bg-panel-canvas"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-panel-text">
                <span className="material-symbols-outlined text-[20px] text-panel-primary">{b.ikon}</span>
                <span className="text-sm font-semibold">{b.ad}</span>
              </div>
              {!b.hazir && (
                <span className="rounded-full bg-panel-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-panel-warning">
                  Yakında
                </span>
              )}
            </div>
            <p className="text-xs text-panel-text-secondary">{b.aciklama}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

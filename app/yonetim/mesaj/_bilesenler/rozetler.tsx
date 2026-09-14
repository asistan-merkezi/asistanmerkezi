type Kanal = "whatsapp" | "sms" | "eposta" | "telegram";

const KANAL_STIL: Record<Kanal, { etiket: string; sinif: string }> = {
  whatsapp: {
    etiket: "WhatsApp",
    sinif: "bg-panel-whatsapp-bg text-panel-whatsapp border-panel-whatsapp-border",
  },
  sms: {
    etiket: "SMS",
    sinif: "bg-panel-sms-bg text-panel-sms border-panel-sms-border",
  },
  eposta: {
    etiket: "E-posta",
    sinif: "bg-panel-eposta-bg text-panel-eposta border-panel-eposta-border",
  },
  telegram: {
    etiket: "Telegram",
    sinif: "bg-panel-telegram-bg text-panel-telegram border-panel-telegram-border",
  },
};

export function KanalRozeti({ kanal }: { kanal: Kanal }) {
  const stil = KANAL_STIL[kanal];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${stil.sinif}`}
    >
      {stil.etiket}
    </span>
  );
}

type DurumTonu = "success" | "warning" | "danger" | "info" | "notr";

const TON_SINIFI: Record<DurumTonu, string> = {
  success: "bg-panel-success-bg text-panel-success border-panel-success-border",
  warning: "bg-panel-warning-bg text-panel-warning border-panel-warning-border",
  danger: "bg-panel-danger-bg text-panel-danger border-panel-danger-border",
  info: "bg-panel-info-bg text-panel-info border-panel-info-border",
  notr: "bg-panel-canvas text-panel-text-secondary border-panel-border",
};

export function DurumRozeti({ etiket, ton }: { etiket: string; ton: DurumTonu }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TON_SINIFI[ton]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {etiket}
    </span>
  );
}

export function mesajDurumRozeti(durum: string) {
  switch (durum) {
    case "sent":
      return <DurumRozeti etiket="İletildi" ton="success" />;
    case "queued":
      return <DurumRozeti etiket="Kuyrukta" ton="info" />;
    case "pending":
      return <DurumRozeti etiket="Beklemede" ton="notr" />;
    case "failed":
      return <DurumRozeti etiket="Başarısız" ton="danger" />;
    case "iys_rejected":
      return <DurumRozeti etiket="İYS Red" ton="warning" />;
    default:
      return <DurumRozeti etiket={durum} ton="notr" />;
  }
}

export function baglantiDurumuRozeti(durum: string) {
  switch (durum) {
    case "connected":
      return <DurumRozeti etiket="Bağlı" ton="success" />;
    case "pending":
      return <DurumRozeti etiket="Beklemede" ton="warning" />;
    case "revoked":
      return <DurumRozeti etiket="Bağlantı Kesildi" ton="danger" />;
    default:
      return <DurumRozeti etiket={durum} ton="notr" />;
  }
}

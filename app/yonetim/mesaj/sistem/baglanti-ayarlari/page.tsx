import Link from "next/link";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { KANALLAR } from "@/lib/mesaj/kanal-tanimlari";

export default async function BaglantiAyarlariSayfasi() {
  const supabase = await createMesajClient();
  const { data: kayitlar } = await supabase
    .from("saglayici_ayarlari")
    .select("kanal, saglayici, aktif, gizli_referanslari");
  const durum = new Map((kayitlar ?? []).map((k) => [k.kanal, k]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <Link href="/yonetim/mesaj/sistem" className="hover:text-panel-primary">
            Sistem
          </Link>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Bağlantı Ayarları</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">Bağlantı Ayarları</h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          SMS, WhatsApp, E-posta, Telegram ve ödeme sağlayıcı bağlantıları buradan yönetilir.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KANALLAR.map((k) => {
          const d = durum.get(k.slug);
          const gizliSayisi = Object.keys((d?.gizli_referanslari ?? {}) as object).length;
          return (
            <Link
              key={k.slug}
              href={`/yonetim/mesaj/sistem/baglanti-ayarlari/${k.slug}`}
              className="flex flex-col gap-3 rounded-lg border border-panel-border bg-panel-surface p-5 shadow-sm transition-colors hover:bg-panel-canvas"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-panel-text">
                  <span className="material-symbols-outlined text-[20px] text-panel-primary">{k.ikon}</span>
                  <span className="text-sm font-semibold">{k.slug === "odeme" ? "Ödeme Bağlantısı" : k.ad}</span>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    (d?.aktif ? "bg-emerald-500/10 text-emerald-700" : "bg-panel-canvas text-panel-text-secondary")
                  }
                >
                  {d?.aktif ? "Aktif" : d ? "Pasif" : "Kurulmadı"}
                </span>
              </div>
              <p className="text-xs text-panel-text-secondary">
                {d?.saglayici ?? k.varsayilanSaglayici ?? "Sağlayıcı seçilmedi"} · {gizliSayisi} sır kayıtlı
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

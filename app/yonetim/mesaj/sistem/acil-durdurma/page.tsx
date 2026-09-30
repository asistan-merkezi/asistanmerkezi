import Link from "next/link";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { gonderimiBaslat, gonderimiDurdur } from "./actions";

const girdi =
  "w-full rounded-md border border-panel-border bg-panel-canvas px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-primary";

const KANAL_ADLARI: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  eposta: "E-posta",
  telegram: "Telegram",
};

const DURUM_MESAJLARI: Record<string, string> = {
  durduruldu: "Gönderim durduruldu.",
  baslatildi: "Gönderim yeniden başlatıldı.",
  yetkisiz: "Bu işlem için super_admin yetkisi gerekir.",
  hata: "İşlem başarısız.",
};

export default async function AcilDurdurmaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; mesaj?: string }>;
}) {
  const { durum, mesaj } = await searchParams;
  const personel = await requirePersonel();
  const duzenleyebilir = personel.rol === "super_admin";

  const supabase = await createMesajClient();
  const [{ data: aktifler }, { data: projeler }, { count: bekleyen }] = await Promise.all([
    supabase
      .from("gonderim_durdurmalari")
      .select("id, kapsam, kanal, proje_id, sebep, created_at")
      .eq("aktif", true)
      .order("created_at", { ascending: false }),
    supabase.from("projeler").select("id, ad").order("ad"),
    supabase.from("mesaj_istekleri").select("*", { count: "exact", head: true }).eq("durum", "queued"),
  ]);

  const projeAdi = new Map((projeler ?? []).map((p) => [p.id, p.ad]));
  const bilgi = durum ? (mesaj ?? DURUM_MESAJLARI[durum]) : null;

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
          <span className="font-semibold text-panel-primary">Acil Durdurma</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">Acil Durdurma</h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          Sızan API anahtarı, hatalı döngü veya sağlayıcı kesintisinde gönderimi tek adımda durdurur. Durdurulan
          kapsamda yeni istekler <code>503</code> ile reddedilir (alt proje kendi kuyruğunda tutup yeniden dener);
          kuyruktaki mesajlar kaybolmaz, kredileri rezerve kalır ve durdurma kalkınca gönderilir. Her işlem audit&apos;e
          yazılır.
        </p>
      </div>

      {bilgi && (
        <div
          role="status"
          className={
            "rounded-md border px-4 py-3 text-sm " +
            (durum === "hata" || durum === "yetkisiz"
              ? "border-panel-danger bg-panel-danger-bg text-panel-danger"
              : "border-panel-success-border bg-panel-success-bg text-panel-success")
          }
        >
          {bilgi}
        </div>
      )}

      <div className="rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-panel-text">Aktif durdurmalar</h2>
          <span className="text-xs text-panel-text-secondary">
            Kuyrukta bekleyen: {(bekleyen ?? 0).toLocaleString("tr-TR")} mesaj
          </span>
        </div>
        {(aktifler ?? []).length === 0 ? (
          <p className="text-sm text-panel-text-secondary">Aktif durdurma yok — gönderim normal çalışıyor.</p>
        ) : (
          <ul className="divide-y divide-panel-border rounded border border-panel-border text-sm">
            {(aktifler ?? []).map((d) => {
              const baslat = gonderimiBaslat.bind(null, d.id);
              const kapsamMetni =
                d.kapsam === "genel"
                  ? "Tüm gönderim"
                  : d.kapsam === "kanal"
                    ? `Kanal: ${KANAL_ADLARI[d.kanal ?? ""] ?? d.kanal}`
                    : `Proje: ${projeAdi.get(d.proje_id ?? "") ?? "—"}${d.kanal ? ` · ${KANAL_ADLARI[d.kanal] ?? d.kanal}` : ""}`;
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="rounded-full bg-panel-danger-bg px-2 py-0.5 text-[11px] font-semibold text-panel-danger">
                    DURDURULDU
                  </span>
                  <span className="font-medium text-panel-text">{kapsamMetni}</span>
                  <span className="text-panel-text-secondary">— {d.sebep}</span>
                  <span className="text-xs text-panel-text-secondary">
                    {new Date(d.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                  </span>
                  {duzenleyebilir && (
                    <form action={baslat} className="ml-auto">
                      <button
                        type="submit"
                        className="rounded-md border border-panel-border px-3 py-1.5 text-xs font-semibold text-panel-text hover:bg-panel-canvas"
                      >
                        Yeniden başlat
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {duzenleyebilir && (
        <form
          action={gonderimiDurdur}
          className="flex flex-col gap-4 rounded-lg border border-panel-danger bg-panel-surface p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-panel-danger">Gönderimi durdur</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              Kapsam
              <select name="kapsam" className={girdi} defaultValue="proje">
                <option value="proje">Bir proje</option>
                <option value="kanal">Bir kanal (tüm projeler)</option>
                <option value="genel">Her şey</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              Proje (kapsam &quot;Bir proje&quot; ise)
              <select name="proje_id" className={girdi} defaultValue="">
                <option value="">—</option>
                {(projeler ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ad}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              Kanal (&quot;Bir kanal&quot; için zorunlu; proje için isteğe bağlı)
              <select name="kanal" className={girdi} defaultValue="">
                <option value="">—</option>
                {Object.entries(KANAL_ADLARI).map(([k, ad]) => (
                  <option key={k} value={k}>
                    {ad}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
            Sebep (audit&apos;e yazılır)
            <input name="sebep" required minLength={3} maxLength={300} className={girdi} placeholder="ör. API anahtarı sızdı" />
          </label>
          <button
            type="submit"
            className="self-start rounded-md bg-panel-danger px-4 py-2 text-sm font-semibold text-white"
          >
            Durdur
          </button>
        </form>
      )}
    </div>
  );
}

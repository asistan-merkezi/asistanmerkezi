import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { KANALLAR, kanalBul } from "@/lib/mesaj/kanal-tanimlari";
import { kanalAyariKaydet } from "./actions";

const girdi =
  "w-full rounded-md border border-panel-border bg-panel-canvas px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-primary disabled:opacity-60";

export default async function KanalSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ kanal: string }>;
  searchParams: Promise<{ durum?: string; mesaj?: string }>;
}) {
  const { kanal: slug } = await params;
  const { durum, mesaj } = await searchParams;
  const kanal = kanalBul(slug);
  if (!kanal) notFound();

  const personel = await requirePersonel();
  const duzenleyebilir = personel.rol === "super_admin";

  const supabase = await createMesajClient();
  const { data: kayit } = await supabase
    .from("saglayici_ayarlari")
    .select("saglayici, aktif, api_url, api_versiyonu, ayarlar, gizli_referanslari, updated_at")
    .eq("kanal", kanal.slug)
    .maybeSingle();

  const ayarlar = (kayit?.ayarlar ?? {}) as Record<string, string>;
  const gizliVar = (kayit?.gizli_referanslari ?? {}) as Record<string, string>;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const webhookAdresi = kanal.webhookYolu && host ? `${proto}://${host}${kanal.webhookYolu}` : null;

  const kaydet = kanalAyariKaydet.bind(null, kanal.slug);

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
          <span className="font-semibold text-panel-primary">{kanal.ad}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">
          {kanal.ad} Bağlantısı
        </h1>
        <p className="mt-1 text-sm text-panel-text-secondary">{kanal.ozet}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KANALLAR.map((k) => (
          <Link
            key={k.slug}
            href={`/yonetim/mesaj/sistem/${k.slug}`}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (k.slug === kanal.slug
                ? "border-panel-primary bg-panel-primary/5 font-semibold text-panel-primary"
                : "border-panel-border text-panel-text-secondary hover:bg-panel-canvas")
            }
          >
            {k.ad}
          </Link>
        ))}
      </div>

      {durum === "ok" && (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">Ayarlar kaydedildi.</p>
      )}
      {durum === "hata" && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">{mesaj ?? "Hata oluştu."}</p>
      )}
      {durum === "yetkisiz" && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">Yalnız super_admin değiştirebilir.</p>
      )}
      {!duzenleyebilir && (
        <p className="rounded-md bg-panel-warning-bg px-3 py-2 text-sm text-panel-warning">
          Destek rolü bu ekranı yalnız görüntüleyebilir.
        </p>
      )}

      <form
        action={kaydet}
        className="flex flex-col gap-5 rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm"
      >
        <fieldset disabled={!duzenleyebilir} className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-panel-text">Nereye bağlanılacak</h2>
            <label className="flex items-center gap-2 text-sm text-panel-text">
              <input type="checkbox" name="aktif" defaultChecked={kayit?.aktif ?? false} />
              Aktif
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              Sağlayıcı
              <input name="saglayici" className={girdi} defaultValue={kayit?.saglayici ?? kanal.varsayilanSaglayici} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              API versiyonu
              <input
                name="api_versiyonu"
                className={girdi}
                defaultValue={kayit?.api_versiyonu ?? kanal.varsayilanVersiyon ?? ""}
                placeholder="Sabit versiyon; 'latest' kullanma"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary md:col-span-2">
              API adresi (base URL)
              <input
                name="api_url"
                className={girdi + " font-mono"}
                defaultValue={kayit?.api_url ?? kanal.varsayilanUrl}
                placeholder="https://..."
              />
            </label>
          </div>

          <h2 className="border-t border-panel-border pt-4 text-sm font-semibold text-panel-text">
            Kimlik bilgileri
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {kanal.alanlar.map((a) =>
              a.depo === "gizli" ? (
                <label key={a.anahtar} className="flex flex-col gap-1 text-xs text-panel-text-secondary">
                  <span className="flex items-center justify-between">
                    {a.etiket}
                    <span className={gizliVar[a.anahtar] ? "text-emerald-600" : "text-panel-text-disabled"}>
                      {gizliVar[a.anahtar] ? "Kayıtlı (Vault)" : "Girilmedi"}
                    </span>
                  </span>
                  <input
                    name={a.anahtar}
                    type="password"
                    autoComplete="new-password"
                    className={girdi + " font-mono"}
                    placeholder={gizliVar[a.anahtar] ? "Değiştirmek için yeni değer gir" : ""}
                  />
                </label>
              ) : (
                <label key={a.anahtar} className="flex flex-col gap-1 text-xs text-panel-text-secondary">
                  {a.etiket}
                  <input name={a.anahtar} className={girdi} defaultValue={ayarlar[a.anahtar] ?? ""} placeholder={a.ipucu} />
                </label>
              ),
            )}
          </div>

          {duzenleyebilir && (
            <div className="flex items-center justify-between gap-4 border-t border-panel-border pt-4">
              <span className="text-xs text-panel-text-secondary">
                Sırlar Supabase Vault&apos;ta saklanır ve bu ekrandan geri okunamaz. Boş bırakılan sır alanı mevcut
                değeri korur. Değişiklikler audit log&apos;a yazılır.
              </span>
              <button
                type="submit"
                className="rounded-md bg-panel-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Kaydet
              </button>
            </div>
          )}
        </fieldset>
      </form>

      {webhookAdresi && (
        <div className="rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-panel-text">Sağlayıcıdan bize dönüş adresi (webhook)</h2>
          <code className="mt-2 block break-all rounded bg-panel-canvas px-3 py-2 text-xs text-panel-text">
            {webhookAdresi}
          </code>
          <p className="mt-2 text-xs text-panel-text-secondary">
            Bu adresi sağlayıcı panelindeki webhook/callback alanına gireceksin. Uç nokta henüz yazılmadı — sağlayıcı
            webhook&apos;ları Faz 2 kapsamında (CLAUDE.md §8).
          </p>
        </div>
      )}
    </div>
  );
}

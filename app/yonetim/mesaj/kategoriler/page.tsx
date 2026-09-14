import Link from "next/link";
import { createMesajClient } from "@/lib/supabase/mesaj-server";

export default async function KategorilerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const { kategori: secilenSlug } = await searchParams;
  const supabase = await createMesajClient();

  const [{ data: kategoriler }, { data: tumProjeler }] = await Promise.all([
    supabase
      .from("kategoriler")
      .select("id, ad, slug, sira")
      .eq("aktif", true)
      .order("sira"),
    supabase.from("projeler").select("id, ad, kategori_id, aktif"),
  ]);

  const projeSayisi = new Map<string, number>();
  for (const p of tumProjeler ?? []) {
    projeSayisi.set(p.kategori_id, (projeSayisi.get(p.kategori_id) ?? 0) + 1);
  }

  const secili =
    kategoriler?.find((k) => k.slug === secilenSlug) ?? kategoriler?.[0] ?? null;
  const seciliProjeler = secili
    ? (tumProjeler ?? []).filter((p) => p.kategori_id === secili.id)
    : [];
  const toplamProje = tumProjeler?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Kategoriler</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">
          Kategori &amp; Servis Grupları
        </h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          Toplam {kategoriler?.length ?? 0} kategori · {toplamProje} proje
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col divide-y divide-panel-border overflow-hidden rounded-lg border border-panel-border bg-panel-surface shadow-sm">
          {(kategoriler ?? []).map((k) => {
            const aktifMi = secili?.id === k.id;
            const adet = projeSayisi.get(k.id) ?? 0;
            return (
              <Link
                key={k.id}
                href={`/yonetim/mesaj/kategoriler?kategori=${k.slug}`}
                className={
                  "flex items-center justify-between px-4 py-3 text-sm transition-colors " +
                  (aktifMi
                    ? "bg-panel-primary/5 border-l-2 border-l-panel-primary font-semibold text-panel-primary"
                    : "text-panel-text hover:bg-panel-canvas")
                }
              >
                <span>{k.ad}</span>
                <span className="text-xs text-panel-text-secondary">
                  {adet} proje
                </span>
              </Link>
            );
          })}
        </div>

        <div className="rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
          {!secili ? (
            <p className="text-sm text-panel-text-secondary">Kategori bulunamadı.</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wide text-panel-text-secondary">
                    Kategori Detayı
                  </span>
                  <h2 className="text-lg font-semibold text-panel-text">{secili.ad}</h2>
                </div>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 rounded-lg bg-panel-primary/40 px-3 py-2 text-sm font-medium text-white cursor-not-allowed"
                  title="Proje ekleme akışı henüz uygulanmadı"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Proje Ekle
                </button>
              </div>

              <div className="mb-6 flex items-center gap-6 text-sm">
                <div>
                  <span className="block text-xs text-panel-text-secondary">Proje</span>
                  <span className="font-semibold text-panel-text">
                    {seciliProjeler.length}
                  </span>
                </div>
              </div>

              {seciliProjeler.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-panel-border py-16 text-center">
                  <span className="material-symbols-outlined mb-2 text-[28px] text-panel-text-disabled">
                    folder_off
                  </span>
                  <p className="text-sm font-medium text-panel-text">
                    Bu kategoride henüz proje yok
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-panel-text-secondary">
                    Bu kategoriye bağlı aktif bir proje veya son 30 günde
                    gerçekleşen mesaj akışı bulunmuyor.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-panel-border text-xs uppercase text-panel-text-secondary">
                      <th className="pb-2 font-medium">Proje</th>
                      <th className="pb-2 font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-border">
                    {seciliProjeler.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 text-panel-text">{p.ad}</td>
                        <td className="py-2 text-panel-text-secondary">
                          {p.aktif ? "Aktif" : "Pasif"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

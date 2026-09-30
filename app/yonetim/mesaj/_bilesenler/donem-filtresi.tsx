import Link from "next/link";
import type { DonemSonucu, DonemTipi } from "@/lib/donem";

const SEKMELER: { tip: DonemTipi; ad: string }[] = [
  { tip: "ay", ad: "Aylık" },
  { tip: "yil", ad: "Yıllık" },
  { tip: "gun", ad: "Günlük" },
];

// Ortak gün/ay/yıl süzgeci. Durum URL'de; `diger` mevcut diğer parametreleri
// (ör. kategori) korur. Tüm panel ekranları aynı bileşeni kullanır.
export function DonemFiltresi({
  donem,
  yol,
  diger = {},
}: {
  donem: DonemSonucu;
  yol: string;
  diger?: Record<string, string | undefined>;
}) {
  const href = (tip: DonemTipi, t: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(diger)) if (v) p.set(k, v);
    p.set("donem", tip);
    p.set("t", t);
    return `${yol}?${p.toString()}`;
  };
  const dugme =
    "rounded-lg border border-panel-border px-3 py-1.5 text-sm transition-colors";
  const aktifDugme = dugme + " text-panel-text hover:bg-panel-canvas";
  const pasifDugme = dugme + " cursor-not-allowed text-panel-text-disabled";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-panel-border bg-panel-canvas p-1">
        {SEKMELER.map((s) => (
          <Link
            key={s.tip}
            href={href(s.tip, donem.t)}
            aria-current={donem.tip === s.tip ? "true" : undefined}
            className={
              "rounded-lg px-4 py-1.5 text-sm transition-colors " +
              (donem.tip === s.tip
                ? "bg-panel-primary font-semibold text-white"
                : "text-panel-text-secondary hover:text-panel-text")
            }
          >
            {s.ad}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link href={href(donem.tip, donem.onceki.t)} className={aktifDugme}>
          ‹ {donem.tip === "yil" ? donem.onceki.etiket : "Önceki"}
        </Link>
        <span className="min-w-24 text-center text-sm font-semibold text-panel-text">
          {donem.etiket}
        </span>
        {donem.sonraki.devreDisi ? (
          <span aria-disabled="true" className={pasifDugme}>
            {donem.tip === "yil" ? donem.sonraki.etiket : "Sonraki"} ›
          </span>
        ) : (
          <Link href={href(donem.tip, donem.sonraki.t)} className={aktifDugme}>
            {donem.tip === "yil" ? donem.sonraki.etiket : "Sonraki"} ›
          </Link>
        )}
      </div>
    </div>
  );
}

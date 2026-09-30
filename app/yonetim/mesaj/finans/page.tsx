import Link from "next/link";
import { FINANS_BOLUMLERI, FINANS_YOLU } from "@/lib/mesaj/finans-bolumleri";

export default function FinansSayfasi() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Finans</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">Finans</h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          Ödemeler, personel, gelen faturalar, giderler ve raporlar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FINANS_BOLUMLERI.map((b) => (
          <Link
            key={b.slug}
            href={`${FINANS_YOLU}/${b.slug}`}
            className="flex flex-col gap-2 rounded-lg border border-panel-border bg-panel-surface p-5 shadow-sm transition-colors hover:bg-panel-canvas"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-panel-text">
                <span className="material-symbols-outlined text-[20px] text-panel-primary">{b.ikon}</span>
                <span className="text-sm font-semibold">{b.ad}</span>
              </div>
              <span className="rounded-full bg-panel-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-panel-warning">
                Yakında
              </span>
            </div>
            <p className="text-xs text-panel-text-secondary">{b.aciklama}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

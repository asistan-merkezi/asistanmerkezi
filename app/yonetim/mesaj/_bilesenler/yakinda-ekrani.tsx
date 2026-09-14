export function YakindaEkrani({
  baslik,
  aciklama,
}: {
  baslik: string;
  aciklama: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-panel-border bg-panel-surface px-6 py-24 text-center shadow-sm">
      <span className="material-symbols-outlined mb-3 text-[32px] text-panel-text-disabled">
        hourglass_top
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-panel-text">
        {baslik}
      </h2>
      <p className="mt-2 max-w-md text-sm text-panel-text-secondary">
        {aciklama}
      </p>
      <span className="mt-4 inline-flex items-center rounded-full bg-panel-warning-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-panel-warning">
        Yakında
      </span>
    </div>
  );
}

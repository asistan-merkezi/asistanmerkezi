import Link from "next/link";

// Mobil breakpoint (<768px) üst bar — Stitch tasarımı (§ mobil konsol referansı).
// Masaüstü header'dan (layout.tsx) bağımsız; yalnız md altında görünür.
export function MobilUstBar({
  operatorBasHarfleri,
  dikkatVar,
}: {
  operatorBasHarfleri: string;
  dikkatVar: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-panel-border bg-panel-surface px-4 md:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel-sidebar text-white">
          <span className="material-symbols-outlined text-[20px]">hub</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-panel-text">Asistan</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-panel-primary">
            Merkezi
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="Hızlı Mesaj Gönder (yakında)"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-panel-border bg-panel-canvas text-panel-text-disabled"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
        <Link
          href="/yonetim/mesaj"
          aria-label="Bildirimler"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-panel-border bg-panel-surface text-panel-text-secondary"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          {dikkatVar && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-panel-amber ring-2 ring-panel-surface" />
          )}
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-panel-border bg-panel-warning-bg text-xs font-bold tracking-tight text-panel-warning">
          {operatorBasHarfleri}
        </div>
      </div>
    </header>
  );
}

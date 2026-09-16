"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_OGELERI } from "./nav-ogeleri";

export function PanelSidebar() {
  const yol = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-60 flex-col justify-between border-r border-panel-sidebar-border bg-panel-sidebar md:flex">
      <div className="flex flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-panel-sidebar-border px-4">
          <span className="material-symbols-outlined text-panel-primary-hover text-[22px]" style={{ color: "#2DD4BF" }}>
            hub
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-white">
              Asistan Merkezi
            </span>
            <span className="text-[10px] uppercase tracking-wider text-panel-text-sidebar">
              Mesaj Merkezi
            </span>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-panel-text-sidebar">
            Operasyon Paneli
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_OGELERI.map((oge) => {
            const aktif = oge.hazir && (oge.yol === "/yonetim/mesaj" ? yol === oge.yol : yol.startsWith(oge.yol));
            return (
              <Link
                key={oge.yol}
                href={oge.hazir ? oge.yol : "#"}
                aria-disabled={!oge.hazir}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " +
                  (aktif
                    ? "bg-panel-primary font-semibold text-white"
                    : oge.hazir
                      ? "text-panel-text-sidebar hover:bg-white/5 hover:text-white"
                      : "cursor-default text-panel-text-sidebar/50")
                }
              >
                <span className="material-symbols-outlined text-[18px]">{oge.ikon}</span>
                <span className="flex-1">{oge.etiket}</span>
                {!oge.hazir && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-panel-text-sidebar">
                    Yakında
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-panel-sidebar-border p-3">
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider text-panel-text-sidebar">
              Ağ Durumu
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400">Aktif</span>
        </div>
      </div>
    </aside>
  );
}

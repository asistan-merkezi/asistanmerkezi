"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_OGELERI } from "./nav-ogeleri";

const ALT_NAV_YOLLARI = [
  "/yonetim/mesaj",
  "/yonetim/mesaj/kategoriler",
  "/yonetim/mesaj/kullanicilar",
] as const;

const ALT_NAV_ETIKETLERI: Record<(typeof ALT_NAV_YOLLARI)[number], string> = {
  "/yonetim/mesaj": "Panel",
  "/yonetim/mesaj/kategoriler": "Kategoriler",
  "/yonetim/mesaj/kullanicilar": "Kullanıcılar",
};

// Menü çekmecesindeki geri kalan öğeler — alt nav'daki 3 sekme dışındakiler.
const CEKMECE_OGELERI = NAV_OGELERI.filter(
  (oge) => !(ALT_NAV_YOLLARI as readonly string[]).includes(oge.yol),
);

export function MobilAltNav() {
  const yol = usePathname();
  const [menuAcik, setMenuAcik] = useState(false);

  useEffect(() => {
    if (!menuAcik) return;

    document.body.style.overflow = "hidden";
    const kapat = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAcik(false);
    };
    window.addEventListener("keydown", kapat);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", kapat);
    };
  }, [menuAcik]);

  const altNavOgeleri = NAV_OGELERI.filter((oge) =>
    (ALT_NAV_YOLLARI as readonly string[]).includes(oge.yol),
  );

  return (
    <>
      <div
        className={
          "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 md:hidden " +
          (menuAcik ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setMenuAcik(false)}
        aria-hidden={!menuAcik}
      >
        <div
          className={
            "w-full max-w-[440px] transform rounded-t-3xl border-t border-panel-border bg-panel-surface p-5 pb-8 shadow-2xl transition-transform duration-300 ease-out " +
            (menuAcik ? "translate-y-0" : "translate-y-full")
          }
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Tüm modüller ve menü"
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-panel-border-strong" />
          <div className="mb-3 flex items-center justify-between border-b border-panel-border pb-3">
            <div>
              <h3 className="text-base font-bold text-panel-text">Tüm Modüller &amp; Menü</h3>
              <p className="text-xs text-panel-text-secondary">Hızlı erişim ve planlanan servisler</p>
            </div>
            <button
              type="button"
              onClick={() => setMenuAcik(false)}
              aria-label="Menüyü kapat"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-canvas text-panel-text-secondary"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="space-y-1">
            {CEKMECE_OGELERI.map((oge) => (
              <Link
                key={oge.yol}
                href={oge.hazir ? oge.yol : "#"}
                aria-disabled={!oge.hazir}
                onClick={(e) => {
                  if (!oge.hazir) {
                    e.preventDefault();
                    return;
                  }
                  setMenuAcik(false);
                }}
                className={
                  "flex items-center justify-between rounded-xl p-3 transition " +
                  (oge.hazir ? "hover:bg-panel-canvas active:bg-panel-primary/5" : "cursor-default")
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      "flex h-9 w-9 items-center justify-center rounded-xl border " +
                      (oge.hazir
                        ? "border-panel-primary/20 bg-panel-primary/10 text-panel-primary"
                        : "border-panel-border bg-panel-canvas text-panel-text-disabled")
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">{oge.ikon}</span>
                  </div>
                  <div>
                    <span
                      className={
                        "block text-sm font-semibold " +
                        (oge.hazir ? "text-panel-text" : "text-panel-text-secondary")
                      }
                    >
                      {oge.etiket}
                    </span>
                  </div>
                </div>
                {oge.hazir ? (
                  <span className="material-symbols-outlined text-[18px] text-panel-text-disabled">
                    chevron_right
                  </span>
                ) : (
                  <span className="rounded-full bg-panel-canvas px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-panel-text-secondary">
                    Yakında
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-panel-border bg-panel-surface px-3 pb-1 pt-2 md:hidden">
        <div className="grid grid-cols-4 items-center justify-around text-center">
          {altNavOgeleri.map((oge) => {
            const aktif = oge.yol === "/yonetim/mesaj" ? yol === oge.yol : yol.startsWith(oge.yol);
            return (
              <Link
                key={oge.yol}
                href={oge.yol}
                className={
                  "flex flex-col items-center justify-center py-1 transition active:scale-95 " +
                  (aktif ? "text-panel-primary" : "text-panel-text-secondary")
                }
              >
                <span className="material-symbols-outlined text-[22px]">{oge.ikon}</span>
                <span className={"mt-0.5 text-[11px] tracking-tight " + (aktif ? "font-bold" : "font-medium")}>
                  {ALT_NAV_ETIKETLERI[oge.yol as (typeof ALT_NAV_YOLLARI)[number]]}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuAcik((a) => !a)}
            className="flex flex-col items-center justify-center py-1 text-panel-text-secondary transition active:scale-95"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
            <span className="mt-0.5 text-[11px] font-medium tracking-tight">Menü</span>
          </button>
        </div>
      </nav>
    </>
  );
}

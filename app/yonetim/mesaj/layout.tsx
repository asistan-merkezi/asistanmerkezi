import { Inter } from "next/font/google";
import { requirePersonel } from "@/lib/yetki";
import { PanelSidebar } from "./_bilesenler/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-panel" });

export default async function MesajPaneliLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, rol } = await requirePersonel();

  return (
    <div className={`${inter.variable} font-sans`}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Material Symbols değişken font ailesi next/font tarafından desteklenmiyor, App Router'da nested layout'a link eklemek standart yöntem. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <div className="min-h-screen bg-panel-canvas text-panel-text">
        <PanelSidebar />
        <div className="pl-60">
          <header className="fixed left-60 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-panel-border bg-panel-surface px-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-panel-text-secondary">
                hub
              </span>
              <span className="text-base font-semibold tracking-tight text-panel-text">
                Mesaj Yönetim Konsolu
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:flex items-center">
                <span className="material-symbols-outlined pointer-events-none absolute left-2.5 text-[18px] text-panel-text-disabled">
                  search
                </span>
                <input
                  type="search"
                  placeholder="Mesaj, kullanıcı veya ID ara..."
                  disabled
                  className="h-9 w-64 rounded-lg border border-panel-border bg-panel-canvas pl-9 pr-3 text-sm text-panel-text placeholder:text-panel-text-disabled"
                />
              </div>
              <div className="hidden lg:flex items-center gap-2 rounded-lg border border-panel-border bg-panel-canvas px-3 h-9 text-sm text-panel-text-secondary">
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                Son 30 gün
              </div>
              <div className="flex items-center gap-2 border-l border-panel-border pl-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-primary text-white">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
                <div className="hidden xl:flex flex-col leading-tight">
                  <span className="text-sm font-medium text-panel-text">{email}</span>
                  <span className="text-[10px] text-panel-text-secondary">
                    {rol === "super_admin" ? "Süpervizör" : "Destek"}
                  </span>
                </div>
              </div>
            </div>
          </header>
          <main className="pt-14">
            <div className="mx-auto max-w-[1400px] p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

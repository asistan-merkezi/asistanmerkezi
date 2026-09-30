"use client";

import { useState } from "react";

// Yeni/yenilenen API anahtarı yalnız bu yanıtta görünür; sayfa yenilenince kaybolur.
export function AnahtarKutusu({ anahtar }: { anahtar: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-semibold text-panel-text">API anahtarı — şimdi kopyala, bir daha gösterilmez</p>
      <code className="mt-2 block break-all rounded bg-panel-canvas px-3 py-2 font-mono text-xs text-panel-text">
        {anahtar}
      </code>
      <button
        type="button"
        className="mt-2 rounded-md border border-panel-border px-3 py-1 text-xs text-panel-text hover:bg-panel-canvas"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(anahtar);
            setKopyalandi(true);
          } catch {
            setKopyalandi(false);
          }
        }}
      >
        {kopyalandi ? "Kopyalandı" : "Kopyala"}
      </button>
    </div>
  );
}

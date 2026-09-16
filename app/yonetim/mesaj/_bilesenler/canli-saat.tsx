"use client";

import { useEffect, useState } from "react";

// Sunucu render'ında sabit bir saat basmak yanıltıcı olur (§ mobil konsol:
// "gerçek zamanlı saat"); bu yüzden yalnız client mount sonrası dolduruluyor,
// hydration uyuşmazlığı olmadan.
export function CanliSaat() {
  const [saat, setSaat] = useState<string | null>(null);

  useEffect(() => {
    const guncelle = () => {
      setSaat(
        new Date().toLocaleTimeString("tr-TR", {
          timeZone: "Europe/Istanbul",
          hour12: false,
        }),
      );
    };
    guncelle();
    const id = setInterval(guncelle, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-sm font-semibold tracking-wider text-panel-text-secondary [font-variant-numeric:tabular-nums]">
      {saat ?? "--:--:--"}
    </span>
  );
}

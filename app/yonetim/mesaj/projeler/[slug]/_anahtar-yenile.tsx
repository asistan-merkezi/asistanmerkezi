"use client";

import { useActionState } from "react";
import { anahtarYenile, type AnahtarSonucu } from "../actions";
import { AnahtarKutusu } from "../_anahtar-kutusu";

const baslangic: AnahtarSonucu = { durum: "bos" };

export function AnahtarYenile({ projeId, slug, tanimli }: { projeId: string; slug: string; tanimli: boolean }) {
  const [sonuc, eylem, bekliyor] = useActionState(anahtarYenile.bind(null, projeId, slug), baslangic);
  return (
    <div className="flex flex-col gap-3">
      {sonuc.durum === "ok" && <AnahtarKutusu anahtar={sonuc.anahtar} />}
      {sonuc.durum === "hata" && <p className="text-sm text-red-700">{sonuc.mesaj}</p>}
      <form action={eylem} className="flex items-center gap-3">
        <button
          type="submit"
          disabled={bekliyor}
          className="rounded-md border border-panel-border px-3 py-1.5 text-xs font-semibold text-panel-text hover:bg-panel-canvas disabled:opacity-60"
        >
          {tanimli ? "Anahtarı yenile" : "Anahtar üret"}
        </button>
        {tanimli && (
          <span className="text-xs text-panel-text-secondary">
            Yenileyince eski anahtar hemen geçersiz olur; alt projenin env&apos;i güncellenmeli.
          </span>
        )}
      </form>
    </div>
  );
}

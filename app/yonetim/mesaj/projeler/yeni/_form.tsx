"use client";

import Link from "next/link";
import { useActionState } from "react";
import { projeOlustur, type AnahtarSonucu } from "../actions";
import { AnahtarKutusu } from "../_anahtar-kutusu";

const girdi =
  "w-full rounded-md border border-panel-border bg-panel-canvas px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-primary";
const baslangic: AnahtarSonucu = { durum: "bos" };

export function YeniProjeFormu({
  kategoriler,
  varsayilanKategoriId,
}: {
  kategoriler: { id: string; ad: string }[];
  varsayilanKategoriId?: string;
}) {
  const [sonuc, eylem, bekliyor] = useActionState(projeOlustur, baslangic);

  if (sonuc.durum === "ok") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
        <p className="text-sm text-panel-text">Proje oluşturuldu.</p>
        <AnahtarKutusu anahtar={sonuc.anahtar} />
        <Link
          href={`/yonetim/mesaj/projeler/${sonuc.slug}`}
          className="self-start rounded-md bg-panel-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Bağlantı bilgilerine git
        </Link>
      </div>
    );
  }

  return (
    <form
      action={eylem}
      className="flex flex-col gap-4 rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm"
    >
      {sonuc.durum === "hata" && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">{sonuc.mesaj}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
          Kategori
          <select name="kategori_id" className={girdi} defaultValue={varsayilanKategoriId} required>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
          Proje adı
          <input name="ad" className={girdi} required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
          Slug
          <input name="slug" className={girdi + " font-mono"} placeholder="klinik-asistani" required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
          Domain
          <input name="domain" className={girdi} placeholder="ornek.com" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-panel-text-secondary md:col-span-2">
          Webhook adresi (mesaj.teslim, kredi.esik_alti vb. buraya gelir)
          <input name="webhook_url" className={girdi + " font-mono"} placeholder="https://..." />
        </label>
      </div>
      <button
        type="submit"
        disabled={bekliyor}
        className="self-start rounded-md bg-panel-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {bekliyor ? "Oluşturuluyor…" : "Proje oluştur ve API anahtarı üret"}
      </button>
    </form>
  );
}

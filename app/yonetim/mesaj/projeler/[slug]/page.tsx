import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { MERKEZ_CLIENT_ORNEGI, UC_NOKTALAR, envBlogu } from "@/lib/mesaj/baglanti-kodu";
import { projeGuncelle } from "../actions";
import { AnahtarYenile } from "./_anahtar-yenile";

const girdi =
  "w-full rounded-md border border-panel-border bg-panel-canvas px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-primary disabled:opacity-60";

function Kod({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded bg-panel-canvas px-3 py-2 text-xs text-panel-text">{children}</pre>
  );
}

export default async function ProjeDetaySayfasi({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const personel = await requirePersonel();
  const duzenleyebilir = personel.rol === "super_admin";

  const supabase = await createMesajClient();
  const { data: proje } = await supabase
    .from("projeler")
    .select("id, ad, slug, kategori_id, domain, webhook_url, aktif, api_key_hash")
    .eq("slug", slug)
    .maybeSingle();
  if (!proje) notFound();

  const { data: kategori } = await supabase
    .from("kategoriler")
    .select("ad, slug")
    .eq("id", proje.kategori_id)
    .single();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "asistanmerkezi.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}/api/v1`;

  const guncelle = projeGuncelle.bind(null, proje.id, proje.slug);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <Link href="/yonetim/mesaj/projeler" className="hover:text-panel-primary">
            Projeler
          </Link>
          <span>/</span>
          <span className="font-semibold text-panel-primary">{proje.ad}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">{proje.ad}</h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          Kategori: {kategori?.ad ?? "—"} · <span className="font-mono">{proje.slug}</span>
        </p>
      </div>

      <form action={guncelle} className="rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
        <fieldset disabled={!duzenleyebilir} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-panel-text">Proje ayarları</h2>
            <label className="flex items-center gap-2 text-sm text-panel-text">
              <input type="checkbox" name="aktif" defaultChecked={proje.aktif} />
              Aktif
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              Domain
              <input name="domain" className={girdi} defaultValue={proje.domain ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-panel-text-secondary">
              Webhook adresi (merkez → alt proje)
              <input name="webhook_url" className={girdi + " font-mono"} defaultValue={proje.webhook_url ?? ""} />
            </label>
          </div>
          {duzenleyebilir && (
            <button
              type="submit"
              className="self-start rounded-md bg-panel-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Kaydet
            </button>
          )}
        </fieldset>
      </form>

      <div className="flex flex-col gap-3 rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-panel-text">API anahtarı</h2>
        <p className="text-xs text-panel-text-secondary">
          Durum: {proje.api_key_hash ? "Tanımlı" : "Yok"} — anahtar yalnız oluşturulurken/yenilenirken bir kez
          gösterilir; merkezde yalnız SHA-256 hash&apos;i saklanır.
        </p>
        {duzenleyebilir && (
          <AnahtarYenile projeId={proje.id} slug={proje.slug} tanimli={Boolean(proje.api_key_hash)} />
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-panel-border bg-panel-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-panel-text">Sisteme bağlantı</h2>
        <div>
          <p className="mb-1 text-xs text-panel-text-secondary">1) Alt projenin ortam değişkenleri</p>
          <Kod>{envBlogu(baseUrl)}</Kod>
        </div>
        <div>
          <p className="mb-1 text-xs text-panel-text-secondary">
            2) Her istekte başlıklar: <code>X-Api-Key</code>, <code>X-Imza</code> (t=unix,v1=hmac; taban
            &quot;t.hamGövde&quot;, anahtar = API anahtarı, ±300 sn), yazma isteklerinde <code>Idempotency-Key</code>
          </p>
          <Kod>{MERKEZ_CLIENT_ORNEGI}</Kod>
        </div>
        <div>
          <p className="mb-1 text-xs text-panel-text-secondary">3) Uç noktalar ({baseUrl})</p>
          <ul className="divide-y divide-panel-border rounded border border-panel-border text-xs">
            {UC_NOKTALAR.map((u) => (
              <li key={u.yol} className="flex items-center gap-3 px-3 py-2 text-panel-text">
                <span className="w-12 font-mono font-semibold">{u.yontem}</span>
                <span className="font-mono">{u.yol}</span>
                <span className="text-panel-text-secondary">{u.not}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

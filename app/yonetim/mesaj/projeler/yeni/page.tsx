import Link from "next/link";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { YeniProjeFormu } from "./_form";

export default async function YeniProjeSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const { kategori } = await searchParams;
  const personel = await requirePersonel();
  const supabase = await createMesajClient();
  const { data: kategoriler } = await supabase
    .from("kategoriler")
    .select("id, ad, slug")
    .eq("aktif", true)
    .order("sira");

  const varsayilan = (kategoriler ?? []).find((k) => k.slug === kategori)?.id;

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
          <span className="font-semibold text-panel-primary">Yeni Proje</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">Yeni Proje</h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          Projeyi bir kategoriye bağla; oluşturunca API anahtarı bir kez gösterilir.
        </p>
      </div>
      {personel.rol === "super_admin" ? (
        <YeniProjeFormu kategoriler={kategoriler ?? []} varsayilanKategoriId={varsayilan} />
      ) : (
        <p className="rounded-md bg-panel-warning-bg px-3 py-2 text-sm text-panel-warning">
          Yalnız super_admin proje oluşturabilir.
        </p>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { YakindaEkrani } from "../../_bilesenler/yakinda-ekrani";
import { FINANS_BOLUMLERI, FINANS_YOLU, finansBolumuBul } from "@/lib/mesaj/finans-bolumleri";

export default async function FinansBolumSayfasi({ params }: { params: Promise<{ bolum: string }> }) {
  const { bolum: slug } = await params;
  const bolum = finansBolumuBul(slug);
  if (!bolum) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
        <span>Operasyon Konsolu</span>
        <span>/</span>
        <Link href={FINANS_YOLU} className="hover:text-panel-primary">
          Finans
        </Link>
        <span>/</span>
        <span className="font-semibold text-panel-primary">{bolum.ad}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {FINANS_BOLUMLERI.map((b) => (
          <Link
            key={b.slug}
            href={`${FINANS_YOLU}/${b.slug}`}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (b.slug === bolum.slug
                ? "border-panel-primary bg-panel-primary/5 font-semibold text-panel-primary"
                : "border-panel-border text-panel-text-secondary hover:bg-panel-canvas")
            }
          >
            {b.ad}
          </Link>
        ))}
      </div>

      <YakindaEkrani baslik={bolum.ad} aciklama={bolum.aciklama} />
    </div>
  );
}

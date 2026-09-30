import { redirect } from "next/navigation";

// Kategori yönetimi Projeler ekranına taşındı; eski bağlantılar buraya düşer.
export default async function KategorilerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const { kategori } = await searchParams;
  redirect(
    kategori
      ? `/yonetim/mesaj/projeler?kategori=${encodeURIComponent(kategori)}`
      : "/yonetim/mesaj/projeler",
  );
}

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";

// CLAUDE.md §6.5: GET /api/v1/kredi/bakiye — alt projenin kendi kullanıcısının
// kanal bazlı kredi bakiyesini okuması için. GET olduğundan gövde yok; imza
// tabanı (${t}.${rawBody}) boş metinle hesaplanır (lib/mesaj/kimlik-dogrula.ts).
export async function GET(req: NextRequest) {
  const admin = createAdminClient();

  const dogrulama = await apiKimlikDogrula(req, admin);
  if (!dogrulama.basarili) return dogrulama.yanit;
  const { proje } = dogrulama;

  const disKullaniciId = req.nextUrl.searchParams.get("disKullaniciId");
  if (!disKullaniciId) {
    return NextResponse.json(
      { hata: "disKullaniciId sorgu parametresi zorunlu." },
      { status: 400 },
    );
  }
  const kanalFiltresi = req.nextUrl.searchParams.get("kanal");

  const { data: projeKullanicisi } = await admin
    .from("proje_kullanicilari")
    .select("id")
    .eq("proje_id", proje.id)
    .eq("dis_kullanici_id", disKullaniciId)
    .maybeSingle();

  if (!projeKullanicisi) {
    return NextResponse.json({ hata: "Proje kullanıcısı bulunamadı." }, { status: 404 });
  }

  let sorgu = admin
    .from("kredi_cuzdanlari")
    .select("kanal, bakiye, bakiye_versiyonu, esik")
    .eq("proje_kullanici_id", projeKullanicisi.id);

  if (kanalFiltresi) sorgu = sorgu.eq("kanal", kanalFiltresi);

  const { data: cuzdanlar, error } = await sorgu;

  if (error) {
    return NextResponse.json({ hata: "Bakiye okunamadı." }, { status: 500 });
  }

  return NextResponse.json({
    disKullaniciId,
    bakiyeler: (cuzdanlar ?? []).map((c) => ({
      kanal: c.kanal,
      bakiye: c.bakiye,
      bakiyeVersiyonu: c.bakiye_versiyonu,
      esik: c.esik,
    })),
  });
}

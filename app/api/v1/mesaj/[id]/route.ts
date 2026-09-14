import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";

// CLAUDE.md §6.5: GET /api/v1/mesaj/:id — alt projenin kendi gönderdiği bir
// mesajın durumunu sorgulaması için.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createAdminClient();

  const dogrulama = await apiKimlikDogrula(req, admin);
  if (!dogrulama.basarili) return dogrulama.yanit;
  const { proje } = dogrulama;

  // proje_kullanicilari!inner ile mesajın gerçekten bu projeye ait olduğu
  // doğrulanır — service_role RLS'i bypass ettiği için sahiplik kontrolü
  // burada elle yapılıyor.
  const { data: istek } = await admin
    .from("mesaj_istekleri")
    .select(
      "id, kanal, mesaj_tipi, alici_maskeli, durum, hata_kodu, planlanan_zaman, created_at, updated_at, proje_kullanicilari!inner(proje_id)",
    )
    .eq("id", id)
    .eq("proje_kullanicilari.proje_id", proje.id)
    .maybeSingle();

  if (!istek) {
    return NextResponse.json({ hata: "Mesaj isteği bulunamadı." }, { status: 404 });
  }

  const { data: log } = await admin
    .from("mesaj_loglari")
    .select("sonuc, teslim_zamani, dusen_kredi")
    .eq("istek_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    mesajIstekId: istek.id,
    kanal: istek.kanal,
    mesajTipi: istek.mesaj_tipi,
    aliciMaskeli: istek.alici_maskeli,
    durum: istek.durum,
    hataKodu: istek.hata_kodu,
    planlananZaman: istek.planlanan_zaman,
    olusturulma: istek.created_at,
    guncellenme: istek.updated_at,
    ...(log && {
      sonuc: log.sonuc,
      teslimZamani: log.teslim_zamani,
      dusenKredi: log.dusen_kredi,
    }),
  });
}

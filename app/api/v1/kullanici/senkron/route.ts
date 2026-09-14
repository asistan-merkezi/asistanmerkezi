import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";

// CLAUDE.md §6.3: "İsim/numara alt projenin 'şirket bilgileri' ayarından
// senkronize edilir (POST /api/v1/kullanici/senkron), ayrıca sorulmaz;
// merkez alt projenin veritabanını okumaz." Upsert doğası gereği idempotent
// olduğu için Idempotency-Key zorunlu tutulmuyor (yalnız /mesaj/gonder ve
// /mesaj/toplu için zorunlu, §6.5).

const govdeSemasi = z.object({
  disKullaniciId: z.string().min(1),
  ad: z.string().min(1).optional(),
  eposta: z.email().optional(),
  telefon: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  const dogrulama = await apiKimlikDogrula(req, admin);
  if (!dogrulama.basarili) return dogrulama.yanit;
  const { proje, hamGovde } = dogrulama;

  let govde: z.infer<typeof govdeSemasi>;
  try {
    govde = govdeSemasi.parse(JSON.parse(hamGovde));
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  // Yalnızca gönderilen alanlar upsert edilir — kısmi bir senkron çağrısı
  // (örn. yalnızca telefon güncellemesi) daha önce kaydedilmiş diğer
  // alanları null'a düşürmesin diye.
  const { data: kullanici, error } = await admin
    .from("proje_kullanicilari")
    .upsert(
      {
        proje_id: proje.id,
        dis_kullanici_id: govde.disKullaniciId,
        ...(govde.ad !== undefined && { ad: govde.ad }),
        ...(govde.eposta !== undefined && { eposta: govde.eposta }),
        ...(govde.telefon !== undefined && { telefon: govde.telefon }),
      },
      { onConflict: "proje_id,dis_kullanici_id" },
    )
    .select("id")
    .single();

  if (error || !kullanici) {
    return NextResponse.json({ hata: "Kullanıcı senkronize edilemedi." }, { status: 500 });
  }

  return NextResponse.json({
    id: kullanici.id,
    disKullaniciId: govde.disKullaniciId,
  });
}

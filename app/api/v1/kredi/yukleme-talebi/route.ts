import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";

// CLAUDE.md §6.5 + §9: "kredi yükleme şimdilik yalnız super_admin tarafından
// elle yapılıyor, alt projeden gelen istek 'talep' kaydı oluşturuyor." Bu uç
// gerçek bir ödeme işlemi YAPMAZ — yalnızca `odemeler` tablosunda durum
// 'beklemede' bir talep satırı oluşturur; onay/kredi ekleme süper yönetici
// panelinden (henüz uygulanmadı) elle yapılır. Ödeme sağlayıcısı henüz
// seçilmediği için (§9 "Açık sorunlar") bu uç bilinçli olarak sınırlı: tutar,
// alt projenin göndermesi değil, önceden tanımlı bir `kredi_paketleri`
// satırından okunuyor — "serbest metin ödeme referansı = bedava kredi kapısı"
// riskini burada da tekrarlamamak için.

const govdeSemasi = z.object({
  disKullaniciId: z.string().min(1),
  paketId: z.string().min(1),
  aciklama: z.string().max(500).optional(),
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

  const { data: projeKullanicisi } = await admin
    .from("proje_kullanicilari")
    .select("id")
    .eq("proje_id", proje.id)
    .eq("dis_kullanici_id", govde.disKullaniciId)
    .maybeSingle();

  if (!projeKullanicisi) {
    return NextResponse.json({ hata: "Proje kullanıcısı bulunamadı." }, { status: 404 });
  }

  const { data: paket } = await admin
    .from("kredi_paketleri")
    .select("id, kanal, adet, fiyat, aktif")
    .eq("id", govde.paketId)
    .maybeSingle();

  if (!paket || !paket.aktif) {
    return NextResponse.json({ hata: "Kredi paketi bulunamadı." }, { status: 404 });
  }

  const { data: odeme, error } = await admin
    .from("odemeler")
    .insert({
      proje_kullanici_id: projeKullanicisi.id,
      paket_id: paket.id,
      tutar: paket.fiyat,
      durum: "beklemede",
    })
    .select("id, durum, tutar")
    .single();

  if (error || !odeme) {
    return NextResponse.json({ hata: "Talep oluşturulamadı." }, { status: 500 });
  }

  return NextResponse.json(
    {
      odemeId: odeme.id,
      durum: odeme.durum,
      tutar: odeme.tutar,
      kanal: paket.kanal,
      adet: paket.adet,
      not: "Bu bir ödeme talebidir; kredi, süper yönetici onayından sonra hesabınıza yansır.",
    },
    { status: 201 },
  );
}

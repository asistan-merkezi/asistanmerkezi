import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";

// CLAUDE.md §9 "Açık sorunlar": alt proje "şirket bilgileri" senkronizasyonu
// — gönderen kimliğinin görünen adı/adresi (gonderen_kimlikleri.gonderen_ad,
// gonderen_adres, sms_basligi), tetikleyici kullanıcının kendi bilgisinden
// AYRI: "İsim/numara alt projenin 'şirket bilgileri' ayarından senkronize
// edilir... ayrıca sorulmaz; merkez alt projenin veritabanını okumaz" (§6.3).
// kullanici/senkron ile aynı push deseni; "cache pull fallback" (merkez'in
// alt projeye dönüp güncel veriyi çekmesi) bu turda kapsam dışı — alt
// projenin kendi tarafında imzalı bir /api/internal/* uç noktası gerektirir,
// henüz hiçbir alt proje merkeze bu şekilde bağlı değil.
//
// Bağlantı durumuna dair alanlar (baglanti_durumu, waba_id, phone_number_id,
// bot_token_sifreli) burada KASITLI OLARAK dokunulmuyor — onlar ayrı bir akışın
// (whatsapp/baglanti, henüz uygulanmadı) sorumluluğunda.

const govdeSemasi = z.object({
  disKullaniciId: z.string().min(1),
  kanal: z.enum(["sms", "whatsapp", "eposta", "telegram"]),
  gonderenAd: z.string().min(1).optional(),
  gonderenAdres: z.string().min(1).optional(),
  smsBasligi: z.string().min(1).optional(),
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

  // Yalnızca gönderilen alanlar upsert edilir — kullanici/senkron'daki aynı
  // kural: kısmi bir çağrı, daha önce kaydedilmiş diğer alanları veya
  // bağlantı durumunu null'a düşürmesin.
  const { data: kimlik, error } = await admin
    .from("gonderen_kimlikleri")
    .upsert(
      {
        proje_kullanici_id: projeKullanicisi.id,
        kanal: govde.kanal,
        ...(govde.gonderenAd !== undefined && { gonderen_ad: govde.gonderenAd }),
        ...(govde.gonderenAdres !== undefined && { gonderen_adres: govde.gonderenAdres }),
        ...(govde.smsBasligi !== undefined && { sms_basligi: govde.smsBasligi }),
      },
      { onConflict: "proje_kullanici_id,kanal" },
    )
    .select("id, kanal, baglanti_durumu")
    .single();

  if (error || !kimlik) {
    return NextResponse.json({ hata: "Gönderen kimliği senkronize edilemedi." }, { status: 500 });
  }

  return NextResponse.json({
    id: kimlik.id,
    kanal: kimlik.kanal,
    baglantiDurumu: kimlik.baglanti_durumu,
  });
}

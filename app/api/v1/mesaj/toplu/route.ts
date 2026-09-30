import "server-only";

import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";
import { tekMesajiIsle, yeniOnbellek } from "@/lib/mesaj/mesaj-isle";
import { sinirliParalel } from "@/lib/paralel";
import { krediBildirimleriniIsle } from "@/lib/mesaj/kredi-bildirim";

const TOPLU_ESZAMANLILIK = 10;

// CLAUDE.md §6.5: POST /api/v1/mesaj/toplu (≤1000 alıcı). Idempotency-Key
// burada zorunlu değil (yalnız /mesaj/gonder için, §6.5) — her kalem
// lib/mesaj/mesaj-isle.ts'teki aynı akıştan (kimlik/kanal doğrulama → İYS →
// kredi rezervasyonu → kuyruk) sırayla geçer; bir kalemin başarısız olması
// diğerlerini durdurmaz (kısmi başarı modeli).

const tekMesajSemasi = z
  .object({
    disKullaniciId: z.string().min(1),
    kanal: z.enum(["sms", "whatsapp", "eposta", "telegram"]),
    alici: z.string().min(3),
    mesajTipi: z.enum(["hizmet", "ticari"]),
    icerik: z.string().min(1).optional(),
    sablonAdi: z.string().min(1).optional(),
    degiskenler: z.record(z.string(), z.unknown()).optional(),
    planlananZaman: z.string().datetime().optional(),
    kaynakBolum: z.string().min(1).optional(),
    konu: z.string().min(1).max(200).optional(),
  })
  .refine((v) => Boolean(v.icerik || v.sablonAdi), {
    message: "icerik veya sablonAdi gerekli",
  });

const govdeSemasi = z.object({
  mesajlar: z.array(tekMesajSemasi).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  const dogrulama = await apiKimlikDogrula(req, admin);
  if (!dogrulama.basarili) return dogrulama.yanit;
  const { proje, hamGovde } = dogrulama;

  let govde: z.infer<typeof govdeSemasi>;
  try {
    govde = govdeSemasi.parse(JSON.parse(hamGovde));
  } catch (hata) {
    const mesaj = hata instanceof z.ZodError ? hata.issues[0]?.message : "Geçersiz istek gövdesi.";
    return NextResponse.json({ hata: mesaj ?? "Geçersiz istek gövdesi." }, { status: 400 });
  }

  // 1000 kalemi sırayla işlemek (~5 DB gidiş-dönüşü × 1000) fonksiyon süre sınırını
  // aşabiliyordu. Kalemler sınırlı eşzamanlılıkla işlenir; kredi rezervasyonu satır
  // kilidiyle atomik olduğu için aynı cüzdana eşzamanlı düşüm güvenlidir. Aynı
  // kullanıcı/kanal okumaları istek boyunca bir kez yapılır (önbellek).
  const onbellek = yeniOnbellek();
  const sonuclar = await sinirliParalel(govde.mesajlar, TOPLU_ESZAMANLILIK, async (tekGovde) => {
    try {
      const { httpStatus, yanit } = await tekMesajiIsle(admin, proje, tekGovde, null, onbellek);
      return { disKullaniciId: tekGovde.disKullaniciId, httpStatus, yanit };
    } catch {
      // Kısmi başarı modeli: beklenmeyen hata yalnız bu kalemi düşürür.
      return {
        disKullaniciId: tekGovde.disKullaniciId,
        httpStatus: 500,
        yanit: { hata: "İstek işlenemedi." } as Record<string, unknown>,
      };
    }
  });

  const basariliSayisi = sonuclar.filter((s) => s.httpStatus === 200).length;
  // 202 = kredi yetersiz, askıda (kredi yüklenince kendiliğinden gönderilir).
  const askidaSayisi = sonuclar.filter((s) => s.httpStatus === 202).length;

  if (!proje.sandbox && basariliSayisi + askidaSayisi > 0) {
    after(() => krediBildirimleriniIsle(admin).catch(() => console.error("[kredi-bildirim] gönderilemedi")));
  }

  return NextResponse.json({
    toplam: sonuclar.length,
    basarili: basariliSayisi,
    askida: askidaSayisi,
    basarisiz: sonuclar.length - basariliSayisi - askidaSayisi,
    sonuclar,
  });
}

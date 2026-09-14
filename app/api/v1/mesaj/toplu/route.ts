import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";
import { tekMesajiIsle } from "@/lib/mesaj/mesaj-isle";

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

  const sonuclar: Array<{ disKullaniciId: string; httpStatus: number; yanit: Record<string, unknown> }> = [];

  for (const tekGovde of govde.mesajlar) {
    const { httpStatus, yanit } = await tekMesajiIsle(admin, proje.id, tekGovde, null);
    sonuclar.push({ disKullaniciId: tekGovde.disKullaniciId, httpStatus, yanit });
  }

  const basariliSayisi = sonuclar.filter((s) => s.httpStatus === 200).length;

  return NextResponse.json({
    toplam: sonuclar.length,
    basarili: basariliSayisi,
    basarisiz: sonuclar.length - basariliSayisi,
    sonuclar,
  });
}

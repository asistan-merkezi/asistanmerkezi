import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";
import {
  idempotencyKontrolEt,
  idempotencySonucunuKaydet,
  istekHashla,
} from "@/lib/mesaj/idempotency";
import { tekMesajiIsle } from "@/lib/mesaj/mesaj-isle";

// CLAUDE.md §6.5: POST /api/v1/mesaj/gonder (Idempotency-Key zorunlu).
// Akış (§6.3): [İstek] → [İdempotency] → [Kimlik/kanal doğrulama] →
// [İYS izni (ticari ise)] → [Kredi rezervasyonu] → [Kuyruk] → [yanıt].
// İkinci yarı (kimlik/kanal doğrulama'dan itibaren) lib/mesaj/mesaj-isle.ts'te
// — /mesaj/toplu ile paylaşılıyor.

const govdeSemasi = z
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

export async function POST(req: NextRequest) {
  const idempotencyAnahtari = req.headers.get("idempotency-key");
  if (!idempotencyAnahtari) {
    return NextResponse.json(
      { hata: "Idempotency-Key başlığı zorunlu." },
      { status: 400 },
    );
  }

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

  const istekHash = istekHashla(hamGovde);
  const idempotencySonuc = await idempotencyKontrolEt(
    admin,
    projeKullanicisi.id,
    idempotencyAnahtari,
    istekHash,
  );

  if (idempotencySonuc.durum === "celiski") {
    return NextResponse.json(
      { hata: "Aynı Idempotency-Key farklı bir istekle daha önce kullanılmış." },
      { status: 422 },
    );
  }
  if (idempotencySonuc.durum === "devam_ediyor") {
    return NextResponse.json({ hata: "İstek hâlâ işleniyor." }, { status: 409 });
  }
  if (idempotencySonuc.durum === "tekrar") {
    return NextResponse.json(idempotencySonuc.yanit as Record<string, unknown>, {
      status: idempotencySonuc.httpStatus,
      headers: { "X-Idempotent-Replay": "true" },
    });
  }

  // durum === "yeni"
  const { httpStatus, yanit } = await tekMesajiIsle(admin, proje.id, govde, idempotencyAnahtari);
  await idempotencySonucunuKaydet(admin, projeKullanicisi.id, idempotencyAnahtari, yanit, httpStatus);
  return NextResponse.json(yanit, { status: httpStatus });
}

import "server-only";

import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiKimlikDogrula } from "@/lib/mesaj/kimlik-dogrula";
import {
  gecicimiSonuc,
  idempotencyAnahtariniSerbestBirak,
  idempotencyKontrolEt,
  idempotencySonucunuKaydet,
  istekHashla,
} from "@/lib/mesaj/idempotency";
import { projeKullanicisiBul, tekMesajiIsle, yeniOnbellek } from "@/lib/mesaj/mesaj-isle";
import { krediBildirimleriniIsle } from "@/lib/mesaj/kredi-bildirim";

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
    kaynakBolum: z.string().min(1).optional(),
    konu: z.string().min(1).max(200).optional(),
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

  // Önbellek tekMesajiIsle'ye de verilir: proje kullanıcısı ikinci kez aranmaz.
  const onbellek = yeniOnbellek();
  const projeKullanicisi = await projeKullanicisiBul(admin, proje.id, govde.disKullaniciId, onbellek);

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
  let sonuc: Awaited<ReturnType<typeof tekMesajiIsle>>;
  try {
    sonuc = await tekMesajiIsle(admin, proje, govde, idempotencyAnahtari, onbellek);
  } catch (hata) {
    // Beklenmeyen hata: bu anahtarla henüz istek satırı açılmadıysa (kredi de
    // rezerve edilmemiştir) anahtarı serbest bırak. Satır varsa kredi düşmüş
    // olabilir; çifte düşmeyi önlemek için anahtar zaman aşımına kadar kilitli kalır.
    const { data: acilmisIstek } = await admin
      .from("mesaj_istekleri")
      .select("id")
      .eq("proje_kullanici_id", projeKullanicisi.id)
      .eq("idempotency_anahtari", idempotencyAnahtari)
      .limit(1)
      .maybeSingle();
    if (!acilmisIstek) {
      await idempotencyAnahtariniSerbestBirak(admin, projeKullanicisi.id, idempotencyAnahtari);
    }
    throw hata;
  }

  const { httpStatus, yanit } = sonuc;
  if (gecicimiSonuc(httpStatus)) {
    await idempotencyAnahtariniSerbestBirak(admin, projeKullanicisi.id, idempotencyAnahtari);
  } else {
    await idempotencySonucunuKaydet(admin, projeKullanicisi.id, idempotencyAnahtari, yanit, httpStatus);
  }
  // Kredi düştüyse eşik/tükendi bildirimi DB'de açılmış olabilir: yanıt gittikten sonra
  // gönder (kullanıcı günlük zamanlayıcı turunu beklemesin). Hata yanıtı etkilemez.
  if (!proje.sandbox && (httpStatus === 200 || httpStatus === 202)) {
    after(() => krediBildirimleriniIsle(admin).catch(() => console.error("[kredi-bildirim] gönderilemedi")));
  }
  return NextResponse.json(yanit, { status: httpStatus });
}

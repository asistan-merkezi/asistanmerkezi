import "server-only";

import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { gizliOku } from "@/lib/saglayicilar/ayar";
import { svixDogrula } from "@/lib/saglayicilar/svix";
import { webhookOlayiniIsle } from "@/lib/mesaj/webhook-isle";

// Resend teslim olayları (delivered / bounced / complained / delivery_delayed).
// İmza doğrulanmadan hiçbir şey işlenmez (CLAUDE.md §6.3): ham olay kaydedilir, hızlı 200
// döner, teslim durumuna çevirme yanıttan sonra yapılır (başarısızsa worker turu yeniden dener).
// İmza sırrı: Sistem › Bağlantı Ayarları › E-posta › "Webhook imza sırrı" (Vault).
export const dynamic = "force-dynamic";

const UNIQUE_VIOLATION = "23505";
const olaySemasi = z.object({ type: z.string() }).passthrough();

export async function POST(req: NextRequest) {
  const hamGovde = await req.text();
  const admin = createAdminClient();

  const sir = await gizliOku(admin, "eposta", "webhook_imza_sirri");
  if (!sir) {
    return NextResponse.json({ hata: "Webhook imza sırrı tanımlı değil." }, { status: 503 });
  }

  const svixId = req.headers.get("svix-id");
  const gecerli = svixDogrula(
    sir,
    hamGovde,
    svixId,
    req.headers.get("svix-timestamp"),
    req.headers.get("svix-signature"),
  );
  if (!gecerli || !svixId) {
    return NextResponse.json({ hata: "Geçersiz imza." }, { status: 401 });
  }

  let govde: z.infer<typeof olaySemasi>;
  try {
    govde = olaySemasi.parse(JSON.parse(hamGovde));
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { error } = await admin
    .from("webhook_olaylari")
    .insert({ saglayici: "resend", dis_olay_id: svixId, govde });

  if (error) {
    // Aynı olay tekrar gelmiş (Resend/Svix yeniden deneme): zaten kayıtlı, 200.
    if (error.code === UNIQUE_VIOLATION) return NextResponse.json({ durum: "tekrar" });
    return NextResponse.json({ hata: "Olay kaydedilemedi." }, { status: 500 });
  }

  after(async () => {
    try {
      await webhookOlayiniIsle(admin, "resend", svixId, govde);
    } catch {
      console.error(`[webhook] resend olayı işlenemedi: ${svixId}`);
    }
  });

  return NextResponse.json({ durum: "alindi" });
}

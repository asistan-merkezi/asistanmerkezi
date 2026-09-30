import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { imzaDogrula } from "@/lib/mesaj/imza";
import { kuyruguIsle } from "@/lib/mesaj/gonderim-motoru";
import { bekleyenWebhooklariIsle } from "@/lib/mesaj/webhook-isle";

// Merkezi zamanlayıcının (Vodafone sunucusunda cron → deploy/kuyruk-isle.sh; şimdilik günde bir)
// çağırdığı uç: kuyruğu işler, bekleyen webhook olaylarını yeniden dener.
// Kimlik: X-Imza: t=<unix>,v1=<hmac> — MERKEZ_INTERNAL_SECRET ile (CLAUDE.md §6.3 Güvenlik).
// Eşzamanlı iki çağrı güvenlidir: satırlar lease + skip locked ile alınır.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const govdeSemasi = z.object({ adet: z.number().int().min(1).max(100).optional() });

export async function POST(req: NextRequest) {
  const sir = process.env.MERKEZ_INTERNAL_SECRET;
  if (!sir) {
    return NextResponse.json({ hata: "MERKEZ_INTERNAL_SECRET tanımlı değil." }, { status: 503 });
  }

  const hamGovde = await req.text();
  if (!imzaDogrula(sir, hamGovde, req.headers.get("x-imza"))) {
    return NextResponse.json({ hata: "Geçersiz imza." }, { status: 401 });
  }

  let adet = 20;
  if (hamGovde.trim() !== "") {
    try {
      adet = govdeSemasi.parse(JSON.parse(hamGovde)).adet ?? adet;
    } catch {
      return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  try {
    const kuyruk = await kuyruguIsle(admin, adet);
    const webhook = await bekleyenWebhooklariIsle(admin);
    return NextResponse.json({ kuyruk, webhookIslenen: webhook });
  } catch {
    return NextResponse.json({ hata: "Kuyruk işlenemedi." }, { status: 500 });
  }
}

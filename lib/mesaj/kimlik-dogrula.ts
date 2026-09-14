import "server-only";

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { imzaDogrula } from "@/lib/mesaj/imza";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// /api/v1 uçlarının ortak kimlik doğrulama adımı (CLAUDE.md §6.3 "Güvenlik"):
// X-Api-Key (hash karşılaştırması) + X-İmza (burada X-Imza, bkz. mesaj/gonder
// route'undaki not). mesaj/gonder, kullanici/senkron ve kredi/bakiye arasında
// tekrarlanan mantığı burada topluyoruz.
export async function apiKimlikDogrula(
  req: NextRequest,
  admin: AdminClient,
): Promise<
  | { basarili: true; proje: { id: string }; hamGovde: string }
  | { basarili: false; yanit: NextResponse }
> {
  const hamGovde = await req.text();
  const apiKey = req.headers.get("x-api-key");
  const imzaBasligi = req.headers.get("x-imza");

  if (!apiKey || !imzaBasligi) {
    return {
      basarili: false,
      yanit: NextResponse.json(
        { hata: "X-Api-Key ve X-Imza başlıkları zorunlu." },
        { status: 400 },
      ),
    };
  }

  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
  const { data: proje } = await admin
    .from("projeler")
    .select("id, aktif")
    .eq("api_key_hash", apiKeyHash)
    .maybeSingle();

  if (!proje || !proje.aktif) {
    return {
      basarili: false,
      yanit: NextResponse.json({ hata: "Geçersiz API anahtarı." }, { status: 401 }),
    };
  }

  if (!imzaDogrula(apiKey, hamGovde, imzaBasligi)) {
    return {
      basarili: false,
      yanit: NextResponse.json({ hata: "Geçersiz imza." }, { status: 401 }),
    };
  }

  return { basarili: true, proje, hamGovde };
}

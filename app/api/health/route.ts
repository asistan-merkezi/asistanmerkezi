import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Sağlık kontrolü (Docker HEALTHCHECK, Caddy/izleme, taşıma sonrası doğrulama).
// Yalnız ok/hata döner — sürüm, adres, hata metni gibi iç bilgi sızdırmaz.
// Vault kontrolü ayrı: kanal_gizli_oku service_role'e açık ama sır döndürür,
// bu yüzden burada çağrılmaz; vault varlığı taşıma checklist'inde elle doğrulanır.
export const dynamic = "force-dynamic";

export async function GET() {
  let veritabani = false;
  try {
    const { error } = await createAdminClient()
      .from("kategoriler")
      .select("id", { head: true, count: "exact" });
    veritabani = !error;
  } catch {
    veritabani = false;
  }

  return NextResponse.json(
    { durum: veritabani ? "ok" : "hata", veritabani },
    { status: veritabani ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

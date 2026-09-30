import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type KanalAyari = {
  saglayici: string | null;
  aktif: boolean;
  apiUrl: string | null;
  apiVersiyonu: string | null;
  ayarlar: Record<string, unknown>;
};

// Panelde (Sistem › Bağlantı Ayarları) saklanan kanal ayarı; gizli olmayan alanlar.
export async function kanalAyariOku(admin: AdminClient, kanal: string): Promise<KanalAyari | null> {
  const { data } = await admin
    .from("saglayici_ayarlari")
    .select("saglayici, aktif, api_url, api_versiyonu, ayarlar")
    .eq("kanal", kanal)
    .maybeSingle();
  if (!data) return null;
  return {
    saglayici: data.saglayici,
    aktif: data.aktif,
    apiUrl: data.api_url,
    apiVersiyonu: data.api_versiyonu,
    ayarlar: (data.ayarlar ?? {}) as Record<string, unknown>,
  };
}

// Sır Vault'ta; yalnız service_role okuyabilir (kanal_gizli_oku). Log'lara asla yazılmaz.
export async function gizliOku(admin: AdminClient, kanal: string, anahtar: string): Promise<string | null> {
  const { data, error } = await admin.rpc("kanal_gizli_oku", { p_kanal: kanal, p_anahtar: anahtar });
  if (error || typeof data !== "string" || data === "") return null;
  return data;
}

export function metinAyar(ayarlar: Record<string, unknown>, anahtar: string): string | null {
  const deger = ayarlar[anahtar];
  return typeof deger === "string" && deger.trim() !== "" ? deger.trim() : null;
}

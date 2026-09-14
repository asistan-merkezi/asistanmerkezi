import "server-only";

import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// CLAUDE.md §6.3 "İdempotency sözleşmesi (alt projelere verilen taahhüt)":
// (1) çakışma yoksa işi yap, yanıtı kaydet.
// (2) çakışma var + yanıt dolu → kredi düşme, kayıtlı yanıtı X-Idempotent-Replay: true ile dön.
// (3) çakışma var + yanıt boş → 409 (eşzamanlı ikinci istek, hâlâ işleniyor).
// (4) aynı anahtar farklı istek_hash → 422.

export function istekHashla(hamGovde: string): string {
  return createHash("sha256").update(hamGovde).digest("hex");
}

export type IdempotencySonucu =
  | { durum: "yeni" }
  | { durum: "tekrar"; yanit: unknown; httpStatus: number }
  | { durum: "devam_ediyor" }
  | { durum: "celiski" };

const UNIQUE_VIOLATION = "23505";

export async function idempotencyKontrolEt(
  supabase: AdminClient,
  projeKullaniciId: string,
  anahtar: string,
  istekHash: string,
): Promise<IdempotencySonucu> {
  // Placeholder satırı atomik oluşturmayı dene — eşzamanlı iki istek aynı
  // anahtarla gelirse yalnız biri bu insert'i kazanır.
  const { error: insertError } = await supabase
    .from("idempotency_kayitlari")
    .insert({ proje_kullanici_id: projeKullaniciId, anahtar, istek_hash: istekHash });

  if (!insertError) {
    return { durum: "yeni" };
  }

  if (insertError.code !== UNIQUE_VIOLATION) {
    throw insertError;
  }

  const { data: kayit, error: selectError } = await supabase
    .from("idempotency_kayitlari")
    .select("istek_hash, yanit, http_status")
    .eq("proje_kullanici_id", projeKullaniciId)
    .eq("anahtar", anahtar)
    .single();

  if (selectError || !kayit) {
    throw selectError ?? new Error("idempotency kaydı bulunamadı");
  }

  if (kayit.istek_hash !== istekHash) {
    return { durum: "celiski" };
  }

  if (kayit.yanit === null) {
    return { durum: "devam_ediyor" };
  }

  return { durum: "tekrar", yanit: kayit.yanit, httpStatus: kayit.http_status ?? 200 };
}

export async function idempotencySonucunuKaydet(
  supabase: AdminClient,
  projeKullaniciId: string,
  anahtar: string,
  yanit: unknown,
  httpStatus: number,
): Promise<void> {
  const { error } = await supabase
    .from("idempotency_kayitlari")
    .update({ yanit, http_status: httpStatus })
    .eq("proje_kullanici_id", projeKullaniciId)
    .eq("anahtar", anahtar);

  if (error) throw error;
}

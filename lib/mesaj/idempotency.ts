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

// Vercel fonksiyon süresinin (300 sn) üstü: bundan eski yanıtsız kayıt çökmüş sayılır.
const YANITSIZ_KAYIT_ZAMAN_ASIMI_MS = 5 * 60 * 1000;

// Geçici sonuçlar (5xx, 402 yetersiz kredi) kalıcı yanıt olarak saklanmaz: anahtar
// serbest bırakılır, alt proje aynı anahtarla yeniden deneyebilir. Yalnız hâlâ
// yanıtsız olan kayıt silinir.
export function gecicimiSonuc(httpStatus: number): boolean {
  return httpStatus >= 500 || httpStatus === 402;
}

export async function idempotencyAnahtariniSerbestBirak(
  supabase: AdminClient,
  projeKullaniciId: string,
  anahtar: string,
): Promise<void> {
  const { error } = await supabase
    .from("idempotency_kayitlari")
    .delete()
    .eq("proje_kullanici_id", projeKullaniciId)
    .eq("anahtar", anahtar)
    .is("yanit", null);

  if (error) throw error;
}

export async function idempotencyKontrolEt(
  supabase: AdminClient,
  projeKullaniciId: string,
  anahtar: string,
  istekHash: string,
): Promise<IdempotencySonucu> {
  // Placeholder satırı atomik oluşturmayı dene — eşzamanlı iki istek aynı
  // anahtarla gelirse yalnız biri bu insert'i kazanır.
  const yerlestir = () =>
    supabase
      .from("idempotency_kayitlari")
      .insert({ proje_kullanici_id: projeKullaniciId, anahtar, istek_hash: istekHash });

  const { error: insertError } = await yerlestir();

  if (!insertError) {
    return { durum: "yeni" };
  }

  if (insertError.code !== UNIQUE_VIOLATION) {
    throw insertError;
  }

  // Süreç istek ortasında çöktüyse yanıtsız kayıt sonsuza dek 409 döndürürdü.
  // Zaman aşımını geçmiş yanıtsız kaydı sil ve bir kez daha yerleştirmeyi dene
  // (eşzamanlı iki devralma denemesinden yalnız biri insert'i kazanır).
  const esik = new Date(Date.now() - YANITSIZ_KAYIT_ZAMAN_ASIMI_MS).toISOString();
  const { data: silinen } = await supabase
    .from("idempotency_kayitlari")
    .delete()
    .eq("proje_kullanici_id", projeKullaniciId)
    .eq("anahtar", anahtar)
    .is("yanit", null)
    .lt("created_at", esik)
    .select("id");

  if (silinen && silinen.length > 0) {
    const { error: tekrarHatasi } = await yerlestir();
    if (!tekrarHatasi) return { durum: "yeni" };
    if (tekrarHatasi.code !== UNIQUE_VIOLATION) throw tekrarHatasi;
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

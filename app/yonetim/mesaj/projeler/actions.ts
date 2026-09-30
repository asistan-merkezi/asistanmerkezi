"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";

export type AnahtarSonucu =
  | { durum: "bos" }
  | { durum: "hata"; mesaj: string }
  | { durum: "ok"; anahtar: string; slug: string };

// Anahtar yalnız burada üretilir; DB'ye hash'i gider, düz hâli bir kez kullanıcıya döner.
function yeniAnahtar() {
  const anahtar = `amk_${randomBytes(32).toString("base64url")}`;
  return { anahtar, hash: createHash("sha256").update(anahtar).digest("hex") };
}

const httpsAdres = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Adres https:// ile başlamalı");

const yeniProje = z.object({
  kategori_id: z.uuid("Kategori seç"),
  ad: z.string().trim().min(2, "Ad en az 2 karakter").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: küçük harf, rakam ve tire")
    .max(60)
    .refine((v) => v !== "yeni", "Bu slug ayrılmış"),
  domain: z.string().trim().max(200),
  webhook_url: httpsAdres,
});

async function superAdminMi() {
  const p = await requirePersonel();
  return p.rol === "super_admin";
}

export async function projeOlustur(_onceki: AnahtarSonucu, formData: FormData): Promise<AnahtarSonucu> {
  if (!(await superAdminMi())) return { durum: "hata", mesaj: "Yalnız super_admin proje oluşturabilir." };

  const ayrisan = yeniProje.safeParse({
    kategori_id: formData.get("kategori_id"),
    ad: formData.get("ad") ?? "",
    slug: formData.get("slug") ?? "",
    domain: formData.get("domain") ?? "",
    webhook_url: formData.get("webhook_url") ?? "",
  });
  if (!ayrisan.success) return { durum: "hata", mesaj: ayrisan.error.issues[0].message };

  const { anahtar, hash } = yeniAnahtar();
  const supabase = await createMesajClient();
  const { error } = await supabase.rpc("proje_olustur", {
    p_kategori_id: ayrisan.data.kategori_id,
    p_ad: ayrisan.data.ad,
    p_slug: ayrisan.data.slug,
    p_domain: ayrisan.data.domain,
    p_webhook_url: ayrisan.data.webhook_url,
    p_api_key_hash: hash,
  });
  if (error) {
    return {
      durum: "hata",
      mesaj: error.code === "23505" ? "Bu slug zaten kullanımda." : "Proje oluşturulamadı.",
    };
  }

  revalidatePath("/yonetim/mesaj/projeler");
  return { durum: "ok", anahtar, slug: ayrisan.data.slug };
}

export async function anahtarYenile(
  projeId: string,
  slug: string,
  _onceki: AnahtarSonucu,
): Promise<AnahtarSonucu> {
  if (!(await superAdminMi())) return { durum: "hata", mesaj: "Yalnız super_admin anahtar yenileyebilir." };

  const { anahtar, hash } = yeniAnahtar();
  const supabase = await createMesajClient();
  const { error } = await supabase.rpc("proje_anahtar_yenile", { p_proje_id: projeId, p_api_key_hash: hash });
  if (error) return { durum: "hata", mesaj: "Anahtar yenilenemedi." };

  revalidatePath(`/yonetim/mesaj/projeler/${slug}`);
  return { durum: "ok", anahtar, slug };
}

export async function projeGuncelle(projeId: string, slug: string, formData: FormData) {
  if (!(await superAdminMi())) return;
  const webhook = httpsAdres.safeParse(formData.get("webhook_url") ?? "");
  if (!webhook.success) return;

  const supabase = await createMesajClient();
  await supabase.rpc("proje_guncelle", {
    p_proje_id: projeId,
    p_domain: String(formData.get("domain") ?? "").trim().slice(0, 200),
    p_webhook_url: webhook.data,
    p_aktif: formData.get("aktif") === "on",
  });
  revalidatePath(`/yonetim/mesaj/projeler/${slug}`);
  revalidatePath("/yonetim/mesaj/projeler");
}

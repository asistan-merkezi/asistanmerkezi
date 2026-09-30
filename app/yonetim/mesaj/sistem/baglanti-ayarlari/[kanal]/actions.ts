"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { kanalBul } from "@/lib/mesaj/kanal-tanimlari";

const ortak = z.object({
  saglayici: z.string().trim().max(80),
  api_url: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "API adresi https:// ile başlamalı"),
  api_versiyonu: z.string().trim().max(20),
});

export async function kanalAyariKaydet(slug: string, formData: FormData) {
  const personel = await requirePersonel();
  const yol = `/yonetim/mesaj/sistem/baglanti-ayarlari/${slug}`;
  const kanal = kanalBul(slug);
  if (!kanal || personel.rol !== "super_admin") redirect(`${yol}?durum=yetkisiz`);

  const ayrisan = ortak.safeParse({
    saglayici: formData.get("saglayici") ?? "",
    api_url: formData.get("api_url") ?? "",
    api_versiyonu: formData.get("api_versiyonu") ?? "",
  });
  if (!ayrisan.success) {
    redirect(`${yol}?durum=hata&mesaj=${encodeURIComponent(ayrisan.error.issues[0].message)}`);
  }

  const ayarlar: Record<string, string> = {};
  const gizliler: Record<string, string> = {};
  for (const alan of kanal.alanlar) {
    const deger = String(formData.get(alan.anahtar) ?? "").trim().slice(0, 2000);
    if (alan.depo === "gizli") gizliler[alan.anahtar] = deger;
    else ayarlar[alan.anahtar] = deger;
  }

  const supabase = await createMesajClient();
  const { error } = await supabase.rpc("kanal_ayari_kaydet", {
    p_kanal: kanal.slug,
    p_saglayici: ayrisan.data.saglayici || null,
    p_aktif: formData.get("aktif") === "on",
    p_api_url: ayrisan.data.api_url || null,
    p_api_versiyonu: ayrisan.data.api_versiyonu || null,
    p_ayarlar: ayarlar,
    p_gizliler: gizliler,
  });

  // Ham DB hatası kullanıcıya basılmaz.
  if (error) redirect(`${yol}?durum=hata&mesaj=${encodeURIComponent("Kaydedilemedi")}`);
  redirect(`${yol}?durum=ok`);
}

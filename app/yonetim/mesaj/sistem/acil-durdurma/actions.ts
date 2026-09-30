"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePersonel } from "@/lib/yetki";
import { createMesajClient } from "@/lib/supabase/mesaj-server";

const YOL = "/yonetim/mesaj/sistem/acil-durdurma";

const durdurSemasi = z
  .object({
    kapsam: z.enum(["genel", "kanal", "proje"]),
    kanal: z.enum(["", "sms", "whatsapp", "eposta", "telegram"]),
    proje_id: z.union([z.literal(""), z.uuid()]),
    sebep: z.string().trim().min(3, "Sebep en az 3 karakter olmalı").max(300),
  })
  .refine((v) => v.kapsam !== "kanal" || v.kanal !== "", { message: "Kanal seçin" })
  .refine((v) => v.kapsam !== "proje" || v.proje_id !== "", { message: "Proje seçin" });

// Yalnız super_admin; işlem RPC'de de kontrol edilir ve audit'e yazılır.
export async function gonderimiDurdur(formData: FormData) {
  const personel = await requirePersonel();
  if (personel.rol !== "super_admin") redirect(`${YOL}?durum=yetkisiz`);

  const ayrisan = durdurSemasi.safeParse({
    kapsam: formData.get("kapsam"),
    kanal: formData.get("kanal") ?? "",
    proje_id: formData.get("proje_id") ?? "",
    sebep: formData.get("sebep") ?? "",
  });
  if (!ayrisan.success) {
    redirect(`${YOL}?durum=hata&mesaj=${encodeURIComponent(ayrisan.error.issues[0].message)}`);
  }
  const { kapsam, kanal, proje_id, sebep } = ayrisan.data;

  const supabase = await createMesajClient();
  const { error } = await supabase.rpc("gonderim_durdur", {
    p_kapsam: kapsam,
    // Kapsama uymayan alan gönderilmez (RPC/DB kısıtı: genel'de kanal/proje boş olmalı).
    p_kanal: kapsam === "genel" || (kapsam === "proje" && kanal === "") ? null : kanal || null,
    p_proje_id: kapsam === "proje" ? proje_id : null,
    p_sebep: sebep,
  });

  if (error) {
    const mesaj = error.message.includes("zaten aktif") ? "Bu kapsamda zaten aktif bir durdurma var" : "Durdurulamadı";
    redirect(`${YOL}?durum=hata&mesaj=${encodeURIComponent(mesaj)}`);
  }
  revalidatePath(YOL);
  revalidatePath("/yonetim/mesaj");
  redirect(`${YOL}?durum=durduruldu`);
}

export async function gonderimiBaslat(durdurmaId: string) {
  const personel = await requirePersonel();
  if (personel.rol !== "super_admin") redirect(`${YOL}?durum=yetkisiz`);
  if (!z.uuid().safeParse(durdurmaId).success) redirect(`${YOL}?durum=hata`);

  const supabase = await createMesajClient();
  const { error } = await supabase.rpc("gonderim_baslat", { p_id: durdurmaId });
  if (error) redirect(`${YOL}?durum=hata&mesaj=${encodeURIComponent("Yeniden başlatılamadı")}`);

  revalidatePath(YOL);
  revalidatePath("/yonetim/mesaj");
  redirect(`${YOL}?durum=baslatildi`);
}

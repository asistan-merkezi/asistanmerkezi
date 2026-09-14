"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminCoreClient } from "@/lib/supabase/admin-core";
import { getOrigin } from "@/app/login/actions";

// CLAUDE.md §5.1: "kayıt formu: kişisel bilgiler, işletme bilgileri, vergi
// dairesi/no, görev, tam yetkili değilse tam yetkilinin bilgisi, sözleşme
// onayı."
const kayitSemasi = z
  .object({
    email: z.email(),
    password: z.string().min(6),
    adSoyad: z.string().min(1, "Ad soyad zorunlu"),
    gorev: z.string().min(1, "Görev zorunlu"),
    sirketAdi: z.string().min(1, "Şirket adı zorunlu"),
    vergiDairesi: z.string().min(1, "Vergi dairesi zorunlu"),
    vergiNo: z
      .string()
      .regex(/^\d{10,11}$/, "Vergi/TC kimlik numarası 10 veya 11 haneli olmalı"),
    tamYetkiliMi: z.boolean(),
    tamYetkiliAd: z.string().optional(),
    tamYetkiliEposta: z.string().optional(),
    tamYetkiliTelefon: z.string().optional(),
    sozlesmeOnay: z.literal(true, {
      error: "Kullanım sözleşmesini onaylamanız gerekiyor",
    }),
  })
  .refine(
    (v) => v.tamYetkiliMi || (v.tamYetkiliAd && v.tamYetkiliEposta),
    {
      message: "Tam yetkili siz değilseniz tam yetkilinin adı ve e-postası zorunlu",
      path: ["tamYetkiliAd"],
    },
  );

export async function register(formData: FormData) {
  const tamYetkiliMi = formData.get("tamYetkiliMi") === "on";

  const ayristirma = kayitSemasi.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    adSoyad: formData.get("adSoyad"),
    gorev: formData.get("gorev"),
    sirketAdi: formData.get("sirketAdi"),
    vergiDairesi: formData.get("vergiDairesi"),
    vergiNo: formData.get("vergiNo"),
    tamYetkiliMi,
    tamYetkiliAd: formData.get("tamYetkiliAd") || undefined,
    tamYetkiliEposta: formData.get("tamYetkiliEposta") || undefined,
    tamYetkiliTelefon: formData.get("tamYetkiliTelefon") || undefined,
    sozlesmeOnay: formData.get("sozlesmeOnay") === "on" ? true : false,
  });

  if (!ayristirma.success) {
    const ilkHata = ayristirma.error.issues[0]?.message ?? "Form geçersiz.";
    redirect(`/register?hata=${encodeURIComponent(ilkHata)}`);
  }

  const govde = ayristirma.data;
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: govde.email,
    password: govde.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { ad_soyad: govde.adSoyad },
    },
  });

  if (error) {
    redirect(`/register?hata=${encodeURIComponent(error.message)}`);
  }

  if (!data.user) {
    redirect(`/register?hata=${encodeURIComponent("Kayıt oluşturulamadı.")}`);
  }

  // core.tenants satırı service_role ile oluşturulur — bkz.
  // lib/supabase/admin-core.ts'teki not (oturum e-posta onayı bekleniyorsa
  // henüz hazır olmayabilir).
  const admin = createAdminCoreClient();
  const { error: tenantHatasi } = await admin.from("tenants").insert({
    profile_id: data.user.id,
    sirket_adi: govde.sirketAdi,
    vergi_dairesi: govde.vergiDairesi,
    vergi_no: govde.vergiNo,
    kayit_yapan_gorev: govde.gorev,
    tam_yetkili_mi: govde.tamYetkiliMi,
    tam_yetkili_ad: govde.tamYetkiliMi ? null : (govde.tamYetkiliAd ?? null),
    tam_yetkili_eposta: govde.tamYetkiliMi ? null : (govde.tamYetkiliEposta ?? null),
    tam_yetkili_telefon: govde.tamYetkiliMi ? null : (govde.tamYetkiliTelefon ?? null),
    sozlesme_onaylandi: true,
  });

  if (tenantHatasi) {
    redirect(
      `/register?hata=${encodeURIComponent("İşletme bilgileri kaydedilemedi: " + tenantHatasi.message)}`,
    );
  }

  // TODO: tam_yetkili_mi=false ise tam yetkiliye bilgilendirme + onay linkli
  // mail gönderilmeli (CLAUDE.md §5.2). Resend entegrasyonu (lib/saglayicilar)
  // henüz kurulmadığı için bu adım bilinçli olarak eklenmedi.

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    "/login?mesaj=" +
      encodeURIComponent("Hesabını onaylamak için e-postana gönderilen bağlantıya tıkla."),
  );
}

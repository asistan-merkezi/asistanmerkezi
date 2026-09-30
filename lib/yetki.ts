import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Mesaj Merkezi paneli yalnız Asistan Merkezi ekibine açık (CLAUDE.md §6.4).
// proxy.ts yalnız oturum var mı diye bakıyor; burada ince yetki kontrolü var.
// cache(): layout + sayfa aynı istekte çağırdığında Auth/profil sorgusu bir kez yapılır.
export const requirePersonel = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("rol, email, ad_soyad")
    .eq("id", user.id)
    .single();

  if (!profil || (profil.rol !== "super_admin" && profil.rol !== "destek")) {
    redirect("/dashboard");
  }

  return {
    userId: user.id,
    rol: profil.rol as "super_admin" | "destek",
    email: profil.email as string,
    adSoyad: profil.ad_soyad as string | null,
  };
});

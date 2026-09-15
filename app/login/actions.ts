"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?hata=${encodeURIComponent(error.message)}`);
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", data.user.id)
    .single();

  // Ekip rolleri (super_admin/destek) Mesaj Merkezi paneline açık
  // (CLAUDE.md §6.4); kiracı kullanıcıları kendi panellerine gider.
  if (profil?.rol === "super_admin" || profil?.rol === "destek") {
    redirect("/yonetim/mesaj");
  }

  redirect("/dashboard");
}

export async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

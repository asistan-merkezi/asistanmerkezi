import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profil, error } = await supabase
    .from("profiles")
    .select("email, rol")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Panel
        </h1>

        {error ? (
          <p className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Profil bilgisi okunamadı: {error.message}
          </p>
        ) : (
          <dl className="mb-6 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-600 dark:text-zinc-400">E-posta</dt>
              <dd className="text-black dark:text-zinc-50">{profil?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600 dark:text-zinc-400">Rol</dt>
              <dd className="text-black dark:text-zinc-50">{profil?.rol}</dd>
            </div>
          </dl>
        )}

        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-full border border-black/[.08] px-5 py-2.5 font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Çıkış Yap
          </button>
        </form>
      </div>
    </div>
  );
}

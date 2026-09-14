import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// lib/supabase/server.ts'nin asistan_mesaj şemasına bağlanan karşılığı.
// anon key + kullanıcı oturum çerezleriyle çalışır (service_role DEĞİL) —
// CLAUDE.md §6.2: "service_role yalnızca worker/webhook/scheduler'da".
// Panel erişimi bilerek RLS'e (is_personel()/is_super_admin()) bağımlı
// tutuluyor ki auth.uid() gerçek oturumdan gelsin.
export async function createMesajClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "asistan_mesaj" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component'ten çağrıldığında set edilemez; middleware
            // oturum yenilemesini zaten yürütüyorsa yok sayılabilir.
          }
        },
      },
    },
  );
}

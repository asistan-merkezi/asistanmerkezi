import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// core şemasına service_role ile bağlanan istemci. Yalnız kayıt akışında
// (app/register/actions.ts) core.tenants satırını oluşturmak için kullanılır:
// auth.signUp() sonrası e-posta onayı bekleniyorsa henüz aktif bir oturum
// olmayabilir, RLS'e bağımlı bir insert bu durumda başarısız olur — tıpkı
// core.profiles'ın tetikleyiciyle (security definer) oluşturulması gibi, bu
// da bilinçli bir service_role kullanım noktası.
export function createAdminCoreClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "core" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role ile asistan_mesaj şemasına bağlanan sunucu-taraf istemci.
// lib/supabase/server.ts / client.ts şema "core"'a sabit olduğu için ayrı —
// yalnız worker/webhook/scheduler ve /api/v1 route'larında kullanılır
// (CLAUDE.md §6.2: "service_role yalnızca worker/webhook/scheduler'da").
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "asistan_mesaj" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

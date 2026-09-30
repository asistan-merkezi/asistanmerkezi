import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export async function kur() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema vault;
    create table vault.decrypted_secrets (id uuid primary key, decrypted_secret text);
    create function vault.create_secret(s text, n text) returns uuid language sql as $$ select gen_random_uuid() $$;
    create function vault.update_secret(i uuid, s text) returns void language sql as $$ select 1 $$;
  `);
  const dizin = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));
  for (const d of readdirSync(dizin).filter((x) => x.endsWith(".sql")).sort()) {
    let sql = readFileSync(join(dizin, d), "utf8").replace(/create extension if not exists supabase_vault;/g, "");
    try { await db.exec(sql); console.log("✔", d); }
    catch (e) { console.log("✘", d, "→", e.message); throw e; }
  }
  return db;
}


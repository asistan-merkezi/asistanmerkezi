// RLS tarama testi (CLAUDE.md §4: tenant izolasyonu RLS ile zorunlu).
// Sistem dışı tüm şemalarda RLS'i kapalı tablo varsa çıkış kodu 1 ile biter.
// Kullanım: npm run rls:kontrol   (SUPABASE_DB_PASSWORD .env.local'dan ya da ortamdan)
import pg from "pg";

const sifre = process.env.SUPABASE_DB_PASSWORD;
if (!sifre) {
  console.error("SUPABASE_DB_PASSWORD tanımlı değil.");
  process.exit(2);
}

// Bilinçli istisnalar: "şema.tablo" — her biri için gerekçe yazılmalı.
const ISTISNALAR = new Set([]);

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-central-1.pooler.supabase.com",
  port: 5432, // session mode
  user: "postgres.epzpbfgvekfdbzierrss",
  password: sifre,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows } = await client.query(`
    select n.nspname as sema, c.relname as tablo, c.relrowsecurity as rls,
           (select count(*) from pg_policy p where p.polrelid = c.oid)::int as politika
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
      and n.nspname not like 'pg_temp%'
      -- Supabase'in yönettiği şemalar
      and n.nspname not in ('auth', 'storage', 'realtime', 'vault', 'extensions',
                            'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks',
                            'supabase_migrations', 'supabase_functions', 'net', 'cron', '_realtime')
    order by 1, 2`);

  const kapali = rows.filter((r) => !r.rls && !ISTISNALAR.has(`${r.sema}.${r.tablo}`));
  const politikasiz = rows.filter((r) => r.rls && r.politika === 0);

  console.log(`${rows.length} tablo tarandı.`);
  for (const r of politikasiz) {
    console.warn(`UYARI  ${r.sema}.${r.tablo}: RLS açık ama politika yok (yalnız service_role erişir).`);
  }
  for (const r of kapali) console.error(`HATA   ${r.sema}.${r.tablo}: RLS KAPALI`);

  if (kapali.length) process.exitCode = 1;
  else console.log("Tüm tablolarda RLS açık.");
} finally {
  await client.end();
}

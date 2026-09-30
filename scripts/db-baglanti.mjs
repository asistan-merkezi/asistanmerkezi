// Scriptlerin ortak DB bağlantısı. Varsayılanlar bugünkü Supabase pooler (Frankfurt);
// Vodafone Cloud'a geçince yalnız ortam değişkenleri değişir (kod değişmez):
//   SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_NAME, SUPABASE_DB_SSL=false
import pg from "pg";

export function baglantiAyari() {
  const sifre = process.env.SUPABASE_DB_PASSWORD;
  if (!sifre) {
    console.error("SUPABASE_DB_PASSWORD tanımlı değil.");
    process.exit(2);
  }
  const host = process.env.SUPABASE_DB_HOST ?? "aws-0-eu-central-1.pooler.supabase.com";
  return {
    host,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432), // session mode (CLAUDE.md §2)
    user: process.env.SUPABASE_DB_USER ?? "postgres.epzpbfgvekfdbzierrss",
    password: sifre,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false },
  };
}

export function istemciOlustur() {
  return new pg.Client(baglantiAyari());
}

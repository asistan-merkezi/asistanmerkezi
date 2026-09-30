// Boş bir veritabanına supabase/migrations/*.sql dosyalarını sırayla uygular
// (Vodafone Cloud'daki yeni self-hosted Supabase kurulumu için).
// Kayıt tablosu Supabase CLI ile uyumlu: supabase_migrations.schema_migrations.
//
//   npm run db:kur                 → yalnız plan (hangi dosyalar uygulanacak) yazdırır
//   npm run db:kur -- --uygula     → uygular (her dosya kendi transaction'ında)
//
// Hedef: SUPABASE_DB_* ortam değişkenleri (scripts/db-baglanti.mjs).
// Yanlışlıkla mevcut Frankfurt projesine uygulamamak için, hedef host bilinen
// Supabase bulut adreslerinden biriyse --frankfurt-onayliyorum olmadan durur.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { baglantiAyari, istemciOlustur } from "./db-baglanti.mjs";

const uygula = process.argv.includes("--uygula");
const ayar = baglantiAyari();
const bulutMu = /supabase\.(co|com)$/.test(ayar.host);

console.log(`Hedef: ${ayar.host}:${ayar.port} / ${ayar.database} (kullanıcı ${ayar.user})`);
if (bulutMu && !process.argv.includes("--frankfurt-onayliyorum")) {
  console.error("Hedef Supabase bulutu görünüyor. Vodafone sunucusunun SUPABASE_DB_HOST'unu ayarlayın.");
  process.exit(2);
}

const dizin = join(process.cwd(), "supabase", "migrations");
const dosyalar = readdirSync(dizin).filter((d) => d.endsWith(".sql")).sort();

const client = istemciOlustur();
await client.connect();
try {
  if (uygula) {
    await client.query(`create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key, name text, statements text[]
      );`);
  }
  // Plan modu hedefe hiçbir şey yazmaz.
  const kayitVar = (await client.query("select to_regclass('supabase_migrations.schema_migrations') as t")).rows[0].t;
  const { rows } = kayitVar
    ? await client.query("select version from supabase_migrations.schema_migrations")
    : { rows: [] };
  const uygulanmis = new Set(rows.map((r) => r.version));

  const bekleyen = dosyalar.filter((d) => !uygulanmis.has(d.split("_")[0]));
  console.log(`${dosyalar.length} migration, ${uygulanmis.size} uygulanmış, ${bekleyen.length} bekliyor.`);
  bekleyen.forEach((d) => console.log("  •", d));

  if (!uygula) {
    console.log("\nPlan modu. Uygulamak için: npm run db:kur -- --uygula");
  } else {
    for (const dosya of bekleyen) {
      const sql = readFileSync(join(dizin, dosya), "utf8");
      const [version] = basename(dosya, ".sql").split(/_(.*)/s);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)",
          [version, dosya.replace(/^\d+_/, "").replace(/\.sql$/, "")],
        );
        await client.query("commit");
        console.log("✔", dosya);
      } catch (hata) {
        await client.query("rollback");
        console.error(`✘ ${dosya}: ${hata.message}`);
        process.exitCode = 1;
        break;
      }
    }
  }
} finally {
  await client.end();
}

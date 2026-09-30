// Bir alt projenin merkeze bağlanması için gösterilen kopyala-yapıştır içerik (CLAUDE.md §6.1, §6.3, §6.5).
// İmza sırrı ayrı değil: X-Imza, projenin API anahtarıyla üretilir (bkz. lib/mesaj/kimlik-dogrula.ts).

export function envBlogu(baseUrl: string): string {
  return [
    `MERKEZ_BASE_URL=${baseUrl}`,
    "MERKEZ_API_KEY=<oluşturulurken bir kez gösterilen anahtar>",
    "# Merkez → alt proje (/api/internal/*) imzası; Faz 2'de kullanılacak",
    "MERKEZ_INTERNAL_SECRET=<ayrıca paylaşılır>",
  ].join("\n");
}

export const MERKEZ_CLIENT_ORNEGI = `// lib/mesaj/merkez-client.ts — alt projenin merkeze tek çıkış noktası
import { createHmac } from "node:crypto";

const BASE = process.env.MERKEZ_BASE_URL!;
const KEY = process.env.MERKEZ_API_KEY!;

export async function merkezeIstek(yol: string, govde: unknown, idempotencyKey: string) {
  const ham = JSON.stringify(govde);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", KEY).update(\`\${t}.\${ham}\`).digest("hex");

  return fetch(\`\${BASE}\${yol}\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": KEY,
      "X-Imza": \`t=\${t},v1=\${v1}\`,
      "Idempotency-Key": idempotencyKey, // deterministik: {proje}:{kuyruk_id}
    },
    body: ham,
  });
}`;

export const UC_NOKTALAR = [
  { yontem: "POST", yol: "/mesaj/gonder", not: "Idempotency-Key zorunlu" },
  { yontem: "POST", yol: "/mesaj/toplu", not: "≤ 1000 alıcı" },
  { yontem: "GET", yol: "/mesaj/:id", not: "" },
  { yontem: "GET", yol: "/kredi/bakiye", not: "" },
  { yontem: "POST", yol: "/kredi/yukleme-talebi", not: "" },
  { yontem: "POST", yol: "/kullanici/senkron", not: "" },
  { yontem: "POST", yol: "/gonderen/senkron", not: "" },
] as const;

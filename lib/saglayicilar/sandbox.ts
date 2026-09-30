import "server-only";

import type { GonderimIstegi, GonderimSonucu } from "@/lib/saglayicilar/tipler";

// Sandbox: dışarı hiçbir şey çıkmaz, kredi düşmez (proje.sandbox = true).
// Alt projenin hata yollarını denemesi için alıcı sonekiyle davranış seçilir:
//   …000 → kalıcı hata (sandbox_simule_hata)
//   …500 → geçici hata (3 denemeden sonra başarısız olur)
//   diğer → başarılı (dis_mesaj_id = sandbox-<istek id>)
export function sandboxGonder(istek: GonderimIstegi): GonderimSonucu {
  if (istek.alici.endsWith("000")) return { tur: "kalici_hata", kod: "sandbox_simule_hata" };
  if (istek.alici.endsWith("500")) return { tur: "gecici_hata", kod: "sandbox_simule_gecici", beklemeSn: 5 };
  return { tur: "basarili", disMesajId: `sandbox-${istek.istekId}` };
}

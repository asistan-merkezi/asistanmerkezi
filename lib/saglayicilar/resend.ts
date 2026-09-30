import "server-only";

import { z } from "zod";
import {
  beklemeSaniyesi,
  ISTEK_ZAMAN_ASIMI_MS,
  type GonderimIstegi,
  type GonderimSonucu,
} from "@/lib/saglayicilar/tipler";

// Resend (EU) e-posta gönderimi: POST {api_url}/emails. Idempotency-Key olarak istek id'si
// gönderilir → worker yeniden denemesinde aynı e-posta iki kez gitmez.

export type ResendAyari = {
  apiUrl: string;
  apiAnahtari: string;
  varsayilanGonderen: string;
};

const basariSemasi = z.object({ id: z.string().min(1) });
const hataSemasi = z.object({ name: z.string().optional() });

const EPOSTA = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function resendGonder(ayar: ResendAyari, istek: GonderimIstegi): Promise<GonderimSonucu> {
  if (!EPOSTA.test(istek.alici)) return { tur: "kalici_hata", kod: "gecersiz_alici" };
  if (!istek.icerik) return { tur: "kalici_hata", kod: "icerik_yok" };

  const adres = istek.gonderen.adres ?? ayar.varsayilanGonderen;
  const gonderen = istek.gonderen.ad ? `${istek.gonderen.ad.replace(/[<>"]/g, "")} <${adres}>` : adres;

  let yanit: Response;
  try {
    yanit = await fetch(`${ayar.apiUrl.replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ayar.apiAnahtari}`,
        "Idempotency-Key": istek.istekId,
      },
      body: JSON.stringify({
        from: gonderen,
        to: [istek.alici],
        subject: istek.konu ?? "Bildirim",
        text: istek.icerik,
      }),
      signal: AbortSignal.timeout(ISTEK_ZAMAN_ASIMI_MS),
    });
  } catch {
    return { tur: "gecici_hata", kod: "ag_hatasi" };
  }

  if (yanit.status === 429 || yanit.status >= 500) {
    return { tur: "gecici_hata", kod: `http_${yanit.status}`, beklemeSn: beklemeSaniyesi(yanit.headers) };
  }

  if (yanit.ok) {
    try {
      return { tur: "basarili", disMesajId: basariSemasi.parse(await yanit.json()).id };
    } catch {
      // Idempotency-Key sayesinde aynı istekle tekrar denemek güvenli.
      return { tur: "gecici_hata", kod: "resend_yanit_okunamadi" };
    }
  }

  // 4xx: Resend hata adını (validation_error, invalid_from_address …) kod olarak sakla; ham mesaj/alıcı değil.
  let ad = "";
  try {
    ad = hataSemasi.parse(await yanit.json()).name ?? "";
  } catch {
    /* gövde okunamadı */
  }
  return { tur: "kalici_hata", kod: `resend_${ad || yanit.status}`.slice(0, 60) };
}

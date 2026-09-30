import "server-only";

import { z } from "zod";
import {
  beklemeSaniyesi,
  ISTEK_ZAMAN_ASIMI_MS,
  type GonderimIstegi,
  type GonderimSonucu,
} from "@/lib/saglayicilar/tipler";

// Netgsm REST v2 SMS gönderimi. Uç nokta: POST {api_url}/send (api_url ön-değeri
// https://api.netgsm.com.tr/sms/rest/v2 — versiyon URL'de sabit, "latest" yok).
// Yanıt kodları (Netgsm dokümanı): 00/01/02 başarı; 20 metin hatası; 30 yetki;
// 40 başlık tanımsız; 50/51 İYS; 80 gönderim sınırı; 85 aynı numaraya mükerrer sınırı.
// NOT: canlı Netgsm hesabıyla henüz uçtan uca doğrulanmadı.

export type NetgsmAyari = {
  apiUrl: string;
  kullaniciKodu: string;
  sifre: string;
  baslik: string;
};

const yanitSemasi = z.object({
  code: z.union([z.string(), z.number()]),
  jobid: z.union([z.string(), z.number()]).optional(),
});

const BASARI_KODLARI = new Set(["00", "01", "02"]);
const GECICI_KODLAR = new Set(["80", "85"]);

// Netgsm 10 haneli (5xxxxxxxxx) numara bekler; +90 / 90 / 0 önekini ayıkla.
export function netgsmNumara(alici: string): string | null {
  let rakamlar = alici.replace(/\D/g, "");
  if (rakamlar.startsWith("90") && rakamlar.length === 12) rakamlar = rakamlar.slice(2);
  else if (rakamlar.startsWith("0") && rakamlar.length === 11) rakamlar = rakamlar.slice(1);
  return /^5\d{9}$/.test(rakamlar) ? rakamlar : null;
}

export async function netgsmGonder(ayar: NetgsmAyari, istek: GonderimIstegi): Promise<GonderimSonucu> {
  const numara = netgsmNumara(istek.alici);
  if (!numara) return { tur: "kalici_hata", kod: "gecersiz_alici" };
  if (!istek.icerik) return { tur: "kalici_hata", kod: "icerik_yok" };

  let yanit: Response;
  try {
    yanit = await fetch(`${ayar.apiUrl.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${ayar.kullaniciKodu}:${ayar.sifre}`).toString("base64")}`,
      },
      body: JSON.stringify({
        msgheader: ayar.baslik,
        messages: [{ msg: istek.icerik, no: numara }],
        encoding: "TR",
        appname: "asistanmerkezi",
      }),
      signal: AbortSignal.timeout(ISTEK_ZAMAN_ASIMI_MS),
    });
  } catch {
    return { tur: "gecici_hata", kod: "ag_hatasi" };
  }

  if (yanit.status === 429 || yanit.status >= 500) {
    return { tur: "gecici_hata", kod: `http_${yanit.status}`, beklemeSn: beklemeSaniyesi(yanit.headers) };
  }

  let govde: z.infer<typeof yanitSemasi>;
  try {
    govde = yanitSemasi.parse(await yanit.json());
  } catch {
    // Gönderilip gönderilmediği belirsiz: tekrar denemek çift SMS riski taşır → kalıcı say.
    return { tur: "kalici_hata", kod: "netgsm_yanit_okunamadi" };
  }

  const kod = String(govde.code);
  if (BASARI_KODLARI.has(kod)) {
    return { tur: "basarili", disMesajId: String(govde.jobid ?? "") };
  }
  if (GECICI_KODLAR.has(kod)) {
    return { tur: "gecici_hata", kod: `netgsm_${kod}`, beklemeSn: 60 };
  }
  return { tur: "kalici_hata", kod: `netgsm_${kod}` };
}

import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { imzaOlustur } from "@/lib/mesaj/imza";
import { gizliOku, kanalAyariOku, metinAyar } from "@/lib/saglayicilar/ayar";
import { resendGonder } from "@/lib/saglayicilar/resend";
import { ISTEK_ZAMAN_ASIMI_MS } from "@/lib/saglayicilar/tipler";

type AdminClient = ReturnType<typeof createAdminClient>;

// Kredi azalma / bitme bildirimlerinin teslimi (CLAUDE.md §6.3 "Kredi", §6.5 giden webhook).
// Bildirim satırı DB'de cüzdan tetikleyicisiyle açılır (kredi_bildirimleri); burada iki
// hedefe gönderilir:
//  - Alt projenin webhook_url'i: { olay: "kredi.esik_alti" | "kredi.tukendi", ... },
//    X-Imza: t=<unix>,v1=<hmac> — MERKEZ_INTERNAL_SECRET ile (merkez → alt proje deseni).
//  - Kullanıcının e-postası: sistem bildirimi, merkezin Resend ayarıyla gider; kullanıcının
//    kredisinden DÜŞMEZ (kredisi bitmiş kullanıcıya "kredin bitti" diyebilmek için).
// Her hedef ayrı izlenir: biri başarılıysa yeniden denemede tekrar gönderilmez.

const MAKS_DENEME = 5;
const TEMEL_BEKLEME_SN = 60;
const ASKIDA_SAKLAMA_GUN = 30;

type Durum = "bekliyor" | "gonderildi" | "yok" | "hata";

type BildirimSatiri = {
  id: string;
  olay: "kredi.esik_alti" | "kredi.tukendi";
  kanal: string;
  bakiye: number;
  esik: number;
  deneme_sayisi: number;
  webhook_durumu: Durum;
  eposta_durumu: Durum;
  created_at: string;
  dis_kullanici_id: string;
  kullanici_ad: string | null;
  kullanici_eposta: string | null;
  webhook_url: string | null;
};

const KANAL_ADI: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  eposta: "E-posta",
  telegram: "Telegram",
};

export function bildirimMetni(b: Pick<BildirimSatiri, "olay" | "kanal" | "bakiye" | "esik" | "kullanici_ad">) {
  const kanal = KANAL_ADI[b.kanal] ?? b.kanal;
  const hitap = b.kullanici_ad ? `Merhaba ${b.kullanici_ad},` : "Merhaba,";
  const askida =
    "Kredi bittiğinde mesajlarınız silinmez: askıda bekler ve kredi yüklediğiniz anda " +
    `kaldığı yerden, sırasıyla gönderilir. Askıdaki mesajlar ${ASKIDA_SAKLAMA_GUN} gün saklanır.`;

  if (b.olay === "kredi.tukendi") {
    return {
      konu: `${kanal} mesaj krediniz bitti`,
      icerik: [
        hitap,
        "",
        `${kanal} mesaj krediniz bitti. Bundan sonraki mesajlarınız kredi yüklenene kadar askıya alınacak.`,
        "",
        askida,
        "",
        "Asistan Merkezi",
      ].join("\n"),
    };
  }
  return {
    konu: `${kanal} mesaj krediniz azalıyor`,
    icerik: [
      hitap,
      "",
      `${kanal} mesaj krediniz ${b.bakiye} adede düştü (uyarı eşiği: ${b.esik}).`,
      "Gönderimlerin aksamaması için kredi yüklemenizi öneririz.",
      "",
      askida,
      "",
      "Asistan Merkezi",
    ].join("\n"),
  };
}

async function webhookGonder(b: BildirimSatiri, sir: string | undefined): Promise<Durum | "gecici"> {
  if (!b.webhook_url || !sir) return "yok";
  const govde = JSON.stringify({
    olay: b.olay,
    bildirimId: b.id,
    disKullaniciId: b.dis_kullanici_id,
    kanal: b.kanal,
    bakiye: b.bakiye,
    esik: b.esik,
    zaman: b.created_at,
  });
  try {
    const yanit = await fetch(b.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Imza": imzaOlustur(sir, govde) },
      body: govde,
      signal: AbortSignal.timeout(ISTEK_ZAMAN_ASIMI_MS),
    });
    return yanit.ok ? "gonderildi" : "gecici";
  } catch {
    return "gecici";
  }
}

type EpostaBaglami = { apiUrl: string; apiAnahtari: string; gonderen: string } | null;

async function epostaGonder(b: BildirimSatiri, baglam: EpostaBaglami): Promise<Durum | "gecici"> {
  if (!b.kullanici_eposta || !baglam) return "yok";
  const { konu, icerik } = bildirimMetni(b);
  const sonuc = await resendGonder(
    { apiUrl: baglam.apiUrl, apiAnahtari: baglam.apiAnahtari, varsayilanGonderen: baglam.gonderen },
    {
      istekId: `kredi-bildirim-${b.id}`, // Resend Idempotency-Key: yeniden denemede çift mail yok
      alici: b.kullanici_eposta,
      icerik,
      konu,
      gonderen: { ad: "Asistan Merkezi", adres: null, smsBasligi: null },
    },
  );
  if (sonuc.tur === "basarili") return "gonderildi";
  return sonuc.tur === "gecici_hata" ? "gecici" : "hata";
}

async function epostaBaglamiOku(admin: AdminClient): Promise<EpostaBaglami> {
  const ayar = await kanalAyariOku(admin, "eposta");
  if (!ayar?.aktif || !ayar.apiUrl) return null;
  const apiAnahtari = await gizliOku(admin, "eposta", "api_anahtari");
  if (!apiAnahtari) return null;
  return {
    apiUrl: ayar.apiUrl,
    apiAnahtari,
    gonderen: metinAyar(ayar.ayarlar, "varsayilan_gonderen") ?? "bildirim@asistanmerkezi.com",
  };
}

// Bekleyen bildirimleri lease'le alıp gönderir. API yanıtından sonra (after) ve
// kuyruk-isle turunda çağrılır; eşzamanlı iki çağrı güvenlidir (skip locked).
export async function krediBildirimleriniIsle(admin: AdminClient, adet = 20): Promise<number> {
  const { data, error } = await admin.rpc("kredi_bildirimi_al", { p_adet: adet });
  if (error) throw new Error("kredi bildirimleri alınamadı");
  const satirlar = (data ?? []) as BildirimSatiri[];
  if (satirlar.length === 0) return 0;

  const sir = process.env.MERKEZ_INTERNAL_SECRET;
  const epostaBaglami = satirlar.some((b) => b.eposta_durumu === "bekliyor" && b.kullanici_eposta)
    ? await epostaBaglamiOku(admin)
    : null;

  await Promise.all(
    satirlar.map(async (b) => {
      const [webhook, eposta] = await Promise.all([
        b.webhook_durumu === "bekliyor" ? webhookGonder(b, sir) : b.webhook_durumu,
        b.eposta_durumu === "bekliyor" ? epostaGonder(b, epostaBaglami) : b.eposta_durumu,
      ]);

      const deneme = b.deneme_sayisi + 1;
      const tukendi = deneme >= MAKS_DENEME;
      const son = (d: Durum | "gecici"): Durum => (d === "gecici" ? (tukendi ? "hata" : "bekliyor") : d);
      const webhookSon = son(webhook);
      const epostaSon = son(eposta);
      const bitti = webhookSon !== "bekliyor" && epostaSon !== "bekliyor";

      await admin
        .from("kredi_bildirimleri")
        .update({
          webhook_durumu: webhookSon,
          eposta_durumu: epostaSon,
          deneme_sayisi: deneme,
          kilit_zamani: null,
          son_hata: bitti && webhookSon !== "hata" && epostaSon !== "hata" ? null : "gonderilemedi",
          islendi_at: bitti ? new Date().toISOString() : null,
          sonraki_deneme: bitti
            ? null
            : new Date(Date.now() + TEMEL_BEKLEME_SN * 2 ** b.deneme_sayisi * 1000).toISOString(),
        })
        .eq("id", b.id);
    }),
  );
  return satirlar.length;
}

// Zamanlayıcı turu: bakiyesi gelmiş askıdakileri devam ettir (güvenlik ağı), süresi
// dolan askıdakileri kapat, bekleyen bildirimleri gönder.
export async function krediBakimTuru(admin: AdminClient) {
  const [{ data: devamEden }, { data: zamanAsimi }] = await Promise.all([
    admin.rpc("askidakileri_tara"),
    admin.rpc("askidaki_zaman_asimi", { p_gun: ASKIDA_SAKLAMA_GUN }),
  ]);
  const bildirim = await krediBildirimleriniIsle(admin, 100);
  return {
    askidanDevam: (devamEden as number | null) ?? 0,
    askidaZamanAsimi: (zamanAsimi as number | null) ?? 0,
    bildirim,
  };
}

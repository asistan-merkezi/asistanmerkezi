import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { gizliOku, kanalAyariOku, metinAyar, type KanalAyari } from "@/lib/saglayicilar/ayar";
import { netgsmGonder } from "@/lib/saglayicilar/netgsm";
import { resendGonder } from "@/lib/saglayicilar/resend";
import { sandboxGonder } from "@/lib/saglayicilar/sandbox";
import type { GonderimIstegi, GonderimSonucu } from "@/lib/saglayicilar/tipler";
import { sinirliParalel } from "@/lib/paralel";

type AdminClient = ReturnType<typeof createAdminClient>;

// CLAUDE.md §6.3 akışının [Kuyruk] → [Sağlayıcı] → [Kesinleşme/İade] adımları.
// Kuyruk = mesaj_istekleri (durum 'queued'); satırlar mesaj_kuyruktan_al ile 5 dk'lık
// lease'le alınır (skip locked), durdurulmuş proje/kanal atlanır. Sonuç tek atomik
// RPC'de yazılır (mesaj_sonuclandir): durum + kredi kesinleşme/iade + log + ham alıcının silinmesi.

const MAKS_DENEME = 3;
const TEMEL_BEKLEME_SN = 30;
const ESZAMANLILIK = 5;

type KuyrukSatiri = {
  istek_id: string;
  kanal: "sms" | "whatsapp" | "eposta" | "telegram";
  icerik: string | null;
  konu: string | null;
  sandbox: boolean;
  deneme_sayisi: number;
  gonderen_kimlik_id: string | null;
  alici: string | null;
};

export type KuyrukOzeti = {
  alinan: number;
  gonderilen: number;
  ertelenen: number;
  basarisiz: number;
};

type KanalBaglami = { ayar: KanalAyari | null };

// Bir kuyruk turu boyunca paylaşılan okumalar: kanal ayarı, Vault sırları ve gönderen
// kimlikleri her satırda yeniden okunmaz (önceden her SMS için ayrı Vault RPC'si vardı).
// Promise saklanır ki eşzamanlı satırlar aynı okumayı beklesin.
type TurOnbellegi = {
  kanal: Map<string, Promise<KanalBaglami>>;
  gizli: Map<string, Promise<string | null>>;
  gonderen: Map<string, Promise<GonderimIstegi["gonderen"]>>;
};

function bellekte<T>(harita: Map<string, Promise<T>>, anahtar: string, getir: () => Promise<T>): Promise<T> {
  let deger = harita.get(anahtar);
  if (!deger) {
    deger = getir();
    harita.set(anahtar, deger);
    deger.catch(() => harita.delete(anahtar));
  }
  return deger;
}

// Üstel bekleme + jitter (%25): 30 sn, 60 sn, 120 sn …
function beklemeHesapla(oncekiDeneme: number, saglayiciBeklemesi?: number): number {
  const ustel = TEMEL_BEKLEME_SN * 2 ** oncekiDeneme;
  const taban = Math.max(ustel, saglayiciBeklemesi ?? 0);
  return Math.round(taban * (1 + Math.random() * 0.25));
}

async function gonderenKimligi(admin: AdminClient, kimlikId: string | null): Promise<GonderimIstegi["gonderen"]> {
  if (!kimlikId) return { ad: null, adres: null, smsBasligi: null };
  const { data } = await admin
    .from("gonderen_kimlikleri")
    .select("gonderen_ad, gonderen_adres, sms_basligi")
    .eq("id", kimlikId)
    .maybeSingle();
  return {
    ad: data?.gonderen_ad ?? null,
    adres: data?.gonderen_adres ?? null,
    smsBasligi: data?.sms_basligi ?? null,
  };
}

// Kanal ayarı + sır yoksa ya da kanal aktif değilse kalıcı hata: "yapılandırılmamış".
// (Kredi iade edilir; sonsuza dek bekleyen mesaj bırakmak yerine hızlı ve görünür başarısızlık.)
async function saglayiciyaGonder(
  admin: AdminClient,
  satir: KuyrukSatiri,
  istek: GonderimIstegi,
  baglam: KanalBaglami,
  onbellek: TurOnbellegi,
): Promise<GonderimSonucu> {
  const gizli = (kanal: string, anahtar: string) =>
    bellekte(onbellek.gizli, `${kanal}:${anahtar}`, () => gizliOku(admin, kanal, anahtar));

  const ayar = baglam.ayar;
  if (!ayar || !ayar.aktif || !ayar.apiUrl) {
    return { tur: "kalici_hata", kod: "saglayici_yapilandirilmamis" };
  }

  if (satir.kanal === "sms") {
    const kullaniciKodu = metinAyar(ayar.ayarlar, "kullanici_kodu");
    const baslik = istek.gonderen.smsBasligi ?? metinAyar(ayar.ayarlar, "ortak_baslik");
    const sifre = await gizli("sms", "sifre");
    if (!kullaniciKodu || !sifre) return { tur: "kalici_hata", kod: "saglayici_yapilandirilmamis" };
    if (!baslik) return { tur: "kalici_hata", kod: "sms_basligi_yok" };
    return netgsmGonder({ apiUrl: ayar.apiUrl, kullaniciKodu, sifre, baslik }, istek);
  }

  if (satir.kanal === "eposta") {
    const apiAnahtari = await gizli("eposta", "api_anahtari");
    if (!apiAnahtari) return { tur: "kalici_hata", kod: "saglayici_yapilandirilmamis" };
    return resendGonder(
      {
        apiUrl: ayar.apiUrl,
        apiAnahtari,
        varsayilanGonderen: metinAyar(ayar.ayarlar, "varsayilan_gonderen") ?? "bildirim@asistanmerkezi.com",
      },
      istek,
    );
  }

  // WhatsApp: Meta Tech Provider önkoşulu bekliyor; Telegram: henüz yazılmadı (CLAUDE.md §9).
  return { tur: "kalici_hata", kod: "kanal_desteklenmiyor" };
}

async function satiriIsle(
  admin: AdminClient,
  satir: KuyrukSatiri,
  onbellek: TurOnbellegi,
): Promise<"gonderilen" | "ertelenen" | "basarisiz"> {
  let sonuc: GonderimSonucu;

  if (!satir.alici) {
    // Ham alıcı yok (kayıt tutarsızlığı): göndermek imkânsız.
    sonuc = { tur: "kalici_hata", kod: "alici_yok" };
  } else {
    const istek: GonderimIstegi = {
      istekId: satir.istek_id,
      alici: satir.alici,
      icerik: satir.icerik,
      konu: satir.konu,
      gonderen: await bellekte(onbellek.gonderen, satir.gonderen_kimlik_id ?? "", () =>
        gonderenKimligi(admin, satir.gonderen_kimlik_id),
      ),
    };

    if (satir.sandbox) {
      sonuc = sandboxGonder(istek);
    } else {
      const baglam = await bellekte(onbellek.kanal, satir.kanal, () =>
        kanalAyariOku(admin, satir.kanal).then((ayar) => ({ ayar })),
      );
      sonuc = await saglayiciyaGonder(admin, satir, istek, baglam, onbellek);
    }
  }

  if (sonuc.tur === "basarili") {
    await admin.rpc("mesaj_sonuclandir", {
      p_istek_id: satir.istek_id,
      p_basarili: true,
      p_dis_mesaj_id: sonuc.disMesajId,
      p_hata_kodu: null,
    });
    return "gonderilen";
  }

  const denemeNo = satir.deneme_sayisi + 1;
  if (sonuc.tur === "gecici_hata" && denemeNo < MAKS_DENEME) {
    await admin.rpc("mesaj_ertele", {
      p_istek_id: satir.istek_id,
      p_saniye: beklemeHesapla(satir.deneme_sayisi, sonuc.beklemeSn),
      p_hata_kodu: sonuc.kod,
    });
    return "ertelenen";
  }

  // Kalıcı hata ya da geçici hatada deneme hakkı bitti → başarısız + kredi iadesi.
  await admin.rpc("mesaj_sonuclandir", {
    p_istek_id: satir.istek_id,
    p_basarili: false,
    p_dis_mesaj_id: null,
    p_hata_kodu: sonuc.tur === "gecici_hata" ? `${sonuc.kod}_denemeler_tukendi` : sonuc.kod,
  });
  return "basarisiz";
}

export async function kuyruguIsle(admin: AdminClient, adet = 20): Promise<KuyrukOzeti> {
  const { data, error } = await admin.rpc("mesaj_kuyruktan_al", { p_adet: adet });
  if (error) throw new Error("kuyruk alınamadı");

  const satirlar = (data ?? []) as KuyrukSatiri[];
  const ozet: KuyrukOzeti = { alinan: satirlar.length, gonderilen: 0, ertelenen: 0, basarisiz: 0 };
  const onbellek: TurOnbellegi = { kanal: new Map(), gizli: new Map(), gonderen: new Map() };

  await sinirliParalel(satirlar, ESZAMANLILIK, async (satir) => {
    try {
      ozet[await satiriIsle(admin, satir, onbellek)]++;
    } catch {
      // Log'a yalnız istek id'si: ham alıcı/içerik/token asla basılmaz. Lease 5 dk sonra düşer, satır yeniden alınır.
      console.error(`[gonderim] satır işlenemedi: ${satir.istek_id}`);
    }
  });
  return ozet;
}

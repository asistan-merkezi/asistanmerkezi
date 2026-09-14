import "server-only";

import { aliciHashle, aliciMaskele } from "@/lib/mesaj/maskeleme";
import { sessizSaatteMi, sonrakiSessizSaatBitisi } from "@/lib/zaman";
import { kuyrukAdapter } from "@/lib/mesaj/kuyruk";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type TekMesajGovde = {
  disKullaniciId: string;
  kanal: "sms" | "whatsapp" | "eposta" | "telegram";
  alici: string;
  mesajTipi: "hizmet" | "ticari";
  icerik?: string;
  sablonAdi?: string;
  degiskenler?: Record<string, unknown>;
  planlananZaman?: string;
};

// /mesaj/gonder ve /mesaj/toplu arasında paylaşılan tek-mesaj işleme mantığı
// (CLAUDE.md §6.3 akışı): [Kimlik/kanal doğrulama] → [İYS izni (ticari ise)]
// → [Kredi rezervasyonu] → [Kuyruk]. İdempotency adımı çağıran route'un
// sorumluluğunda (yalnız /mesaj/gonder'de zorunlu, §6.5).
export async function tekMesajiIsle(
  admin: AdminClient,
  projeId: string,
  govde: TekMesajGovde,
  idempotencyAnahtari: string | null,
): Promise<{ httpStatus: number; yanit: Record<string, unknown> }> {
  const { data: projeKullanicisi } = await admin
    .from("proje_kullanicilari")
    .select("id")
    .eq("proje_id", projeId)
    .eq("dis_kullanici_id", govde.disKullaniciId)
    .maybeSingle();

  if (!projeKullanicisi) {
    return { httpStatus: 404, yanit: { hata: "Proje kullanıcısı bulunamadı." } };
  }

  const { data: gonderenKimligi } = await admin
    .from("gonderen_kimlikleri")
    .select("id, baglanti_durumu")
    .eq("proje_kullanici_id", projeKullanicisi.id)
    .eq("kanal", govde.kanal)
    .maybeSingle();

  if (govde.kanal === "whatsapp" && gonderenKimligi?.baglanti_durumu !== "connected") {
    return { httpStatus: 422, yanit: { hata: "WhatsApp gönderen kimliği bağlı değil." } };
  }

  const aliciHash = aliciHashle(govde.alici);
  const aliciMaskeli = aliciMaskele(govde.alici);

  // İYS izni: yalnızca ticari mesajda kontrol edilir. Cache kaydı yoksa
  // fail-open (CLAUDE.md §6.3) — dış İYS API'sine bağlanma bugünkü kapsamda değil.
  if (govde.mesajTipi === "ticari") {
    const { data: izin } = await admin
      .from("iys_izinleri")
      .select("durum")
      .eq("alici_hash", aliciHash)
      .eq("kanal", govde.kanal)
      .maybeSingle();

    if (izin?.durum === "REFUSE") {
      const { data: reddedilenIstek, error: insertHatasi } = await admin
        .from("mesaj_istekleri")
        .insert({
          proje_kullanici_id: projeKullanicisi.id,
          gonderen_kimlik_id: gonderenKimligi?.id ?? null,
          kanal: govde.kanal,
          mesaj_tipi: govde.mesajTipi,
          alici_hash: aliciHash,
          alici_maskeli: aliciMaskeli,
          icerik: govde.icerik ?? null,
          sablon_adi: govde.sablonAdi ?? null,
          degiskenler: govde.degiskenler ?? null,
          durum: "iys_rejected",
          idempotency_anahtari: idempotencyAnahtari,
        })
        .select("id")
        .single();

      if (insertHatasi || !reddedilenIstek) {
        return { httpStatus: 500, yanit: { hata: "İstek kaydedilemedi." } };
      }

      return {
        httpStatus: 200,
        yanit: { mesajIstekId: reddedilenIstek.id, durum: "iys_rejected" },
      };
    }
  }

  // Sessiz saat: gönderimi iptal etmez, 08:00 TRT'ye erteler.
  let planlananZaman = govde.planlananZaman ? new Date(govde.planlananZaman) : new Date();
  if (sessizSaatteMi(planlananZaman)) {
    const ertelenmis = sonrakiSessizSaatBitisi(planlananZaman);
    if (ertelenmis > planlananZaman) planlananZaman = ertelenmis;
  }

  const { data: yeniIstek, error: istekEklemeHatasi } = await admin
    .from("mesaj_istekleri")
    .insert({
      proje_kullanici_id: projeKullanicisi.id,
      gonderen_kimlik_id: gonderenKimligi?.id ?? null,
      kanal: govde.kanal,
      mesaj_tipi: govde.mesajTipi,
      alici_hash: aliciHash,
      alici_maskeli: aliciMaskeli,
      icerik: govde.icerik ?? null,
      sablon_adi: govde.sablonAdi ?? null,
      degiskenler: govde.degiskenler ?? null,
      durum: "pending",
      planlanan_zaman: planlananZaman.toISOString(),
      idempotency_anahtari: idempotencyAnahtari,
    })
    .select("id")
    .single();

  if (istekEklemeHatasi || !yeniIstek) {
    return { httpStatus: 500, yanit: { hata: "İstek kaydedilemedi." } };
  }

  const { data: rezervasyon, error: rezervasyonHatasi } = await admin.rpc("kredi_rezerve_et", {
    p_proje_kullanici_id: projeKullanicisi.id,
    p_kanal: govde.kanal,
    p_adet: 1,
    p_istek_id: yeniIstek.id,
  });

  if (rezervasyonHatasi) {
    await admin
      .from("mesaj_istekleri")
      .update({ durum: "failed", hata_kodu: "rezervasyon_hatasi" })
      .eq("id", yeniIstek.id);
    return { httpStatus: 500, yanit: { hata: "Kredi rezervasyonu başarısız." } };
  }

  const rezervasyonSonucu = Array.isArray(rezervasyon) ? rezervasyon[0] : rezervasyon;
  if (!rezervasyonSonucu) {
    await admin
      .from("mesaj_istekleri")
      .update({ durum: "failed", hata_kodu: "yetersiz_kredi" })
      .eq("id", yeniIstek.id);
    return { httpStatus: 402, yanit: { hata: "Yetersiz kredi." } };
  }

  await admin.from("mesaj_istekleri").update({ durum: "queued" }).eq("id", yeniIstek.id);
  await kuyrukAdapter.enqueue(yeniIstek.id);

  return {
    httpStatus: 200,
    yanit: {
      mesajIstekId: yeniIstek.id,
      durum: "queued",
      kalanBakiye: rezervasyonSonucu.bakiye,
      bakiyeVersiyonu: rezervasyonSonucu.versiyon,
    },
  };
}

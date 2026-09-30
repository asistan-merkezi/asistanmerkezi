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
  kaynakBolum?: string;
  konu?: string; // e-posta konusu
};

export type MesajProjesi = { id: string; sandbox: boolean };

// Bir API isteği boyunca tekrar eden okumaların paylaşılan sonucu. /mesaj/toplu'da
// aynı kullanıcı/kanal için yüzlerce kalem aynı satırları okuyordu; /mesaj/gonder'de
// proje kullanıcısı hem idempotency adımında hem burada aranıyordu. Promise saklanır
// (eşzamanlı kalemler aynı sorguyu bekler); reddedilen promise önbellekten düşer.
export type IstekOnbellegi = Map<string, Promise<unknown>>;

export function yeniOnbellek(): IstekOnbellegi {
  return new Map();
}

function onbellekte<T>(onbellek: IstekOnbellegi, anahtar: string, getir: () => Promise<T>): Promise<T> {
  const mevcut = onbellek.get(anahtar) as Promise<T> | undefined;
  if (mevcut) return mevcut;
  const yeni = getir();
  onbellek.set(anahtar, yeni);
  yeni.catch(() => onbellek.delete(anahtar));
  return yeni;
}

export function projeKullanicisiBul(
  admin: AdminClient,
  projeId: string,
  disKullaniciId: string,
  onbellek: IstekOnbellegi,
): Promise<{ id: string } | null> {
  return onbellekte(onbellek, `pk:${disKullaniciId}`, async () => {
    const { data } = await admin
      .from("proje_kullanicilari")
      .select("id")
      .eq("proje_id", projeId)
      .eq("dis_kullanici_id", disKullaniciId)
      .maybeSingle();
    return data;
  });
}

// /mesaj/gonder ve /mesaj/toplu arasında paylaşılan tek-mesaj işleme mantığı
// (CLAUDE.md §6.3 akışı): [Kimlik/kanal doğrulama] → [İYS izni (ticari ise)]
// → [Kredi rezervasyonu] → [Kuyruk]. İdempotency adımı çağıran route'un
// sorumluluğunda (yalnız /mesaj/gonder'de zorunlu, §6.5).
// Hız: birbirinden bağımsız okumalar (gönderen kimliği, kill switch, İYS) ve
// istek satırından sonraki iki yazma (kredi rezervasyonu, ham alıcı) paralel
// çalışır; başarılı yol ~9 yerine 5 ardışık DB gidiş-dönüşü.
export async function tekMesajiIsle(
  admin: AdminClient,
  proje: MesajProjesi,
  govde: TekMesajGovde,
  idempotencyAnahtari: string | null,
  onbellek: IstekOnbellegi = yeniOnbellek(),
): Promise<{ httpStatus: number; yanit: Record<string, unknown> }> {
  const projeKullanicisi = await projeKullanicisiBul(admin, proje.id, govde.disKullaniciId, onbellek);

  if (!projeKullanicisi) {
    return { httpStatus: 404, yanit: { hata: "Proje kullanıcısı bulunamadı." } };
  }

  const aliciHash = aliciHashle(govde.alici);
  const aliciMaskeli = aliciMaskele(govde.alici);
  const sandbox = proje.sandbox;

  const [gonderenKimligi, engelSebebi, iysIzni] = await Promise.all([
    onbellekte(onbellek, `gk:${projeKullanicisi.id}:${govde.kanal}`, async () => {
      const { data } = await admin
        .from("gonderen_kimlikleri")
        .select("id, baglanti_durumu")
        .eq("proje_kullanici_id", projeKullanicisi.id)
        .eq("kanal", govde.kanal)
        .maybeSingle();
      return data;
    }),
    // Kill switch (gonderim_durdurmalari).
    onbellekte(onbellek, `engel:${govde.kanal}`, async () => {
      const { data } = await admin.rpc("gonderim_engeli", {
        p_proje_id: proje.id,
        p_kanal: govde.kanal,
      });
      return data as unknown;
    }),
    // İYS izni: yalnızca ticari mesajda kontrol edilir. Cache kaydı yoksa
    // fail-open (CLAUDE.md §6.3) — dış İYS API'sine bağlanma bugünkü kapsamda değil.
    govde.mesajTipi === "ticari"
      ? admin
          .from("iys_izinleri")
          .select("durum")
          .eq("alici_hash", aliciHash)
          .eq("kanal", govde.kanal)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);

  if (govde.kanal === "whatsapp" && gonderenKimligi?.baglanti_durumu !== "connected") {
    return { httpStatus: 422, yanit: { hata: "WhatsApp gönderen kimliği bağlı değil." } };
  }

  // Kill switch: 503 geçici sonuçtur — alt proje kendi yerel kuyruğunda tutup
  // üstel geri çekilmeyle yeniden dener, mesaj kaybolmaz; anahtar serbest kalır.
  if (engelSebebi) {
    return {
      httpStatus: 503,
      yanit: { hata: "Gönderim geçici olarak durduruldu.", kod: "gonderim_durduruldu" },
    };
  }

  if (iysIzni?.durum === "REFUSE") {
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
        kaynak_bolum: govde.kaynakBolum ?? null,
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
      kaynak_bolum: govde.kaynakBolum ?? null,
      konu: govde.konu ?? null,
      sandbox,
      durum: "pending",
      planlanan_zaman: planlananZaman.toISOString(),
      idempotency_anahtari: idempotencyAnahtari,
    })
    .select("id")
    .single();

  if (istekEklemeHatasi || !yeniIstek) {
    return { httpStatus: 500, yanit: { hata: "İstek kaydedilemedi." } };
  }

  // Kredi rezervasyonu ve ham alıcı kaydı birbirinden bağımsız: paralel yazılır.
  // Satır hâlâ "pending" — worker yalnız "queued" alır, yani ikisi de bitmeden
  // gönderime çıkmaz. Ham alıcı yalnız gönderim tamamlanana kadar tutulur
  // (mesaj_sonuclandir siler; KVKK) — başarısız yolda burada elle silinir.
  // Sandbox: gerçek kredi düşmez, sağlayıcıya gidilmez (motor sandbox adapter'ı kullanır).
  const [kredi, { error: aliciHatasi }] = await Promise.all([
    sandbox
      ? admin
          .from("kredi_cuzdanlari")
          .select("bakiye, bakiye_versiyonu")
          .eq("proje_kullanici_id", projeKullanicisi.id)
          .eq("kanal", govde.kanal)
          .maybeSingle()
          .then(({ data }) => ({
            hata: false,
            sonuc: { bakiye: data?.bakiye ?? 0, versiyon: data?.bakiye_versiyonu ?? 0 },
          }))
      : admin
          .rpc("kredi_rezerve_et", {
            p_proje_kullanici_id: projeKullanicisi.id,
            p_kanal: govde.kanal,
            p_adet: 1,
            p_istek_id: yeniIstek.id,
          })
          .then(({ data, error }) => ({
            hata: Boolean(error),
            sonuc: (Array.isArray(data) ? data[0] : data) as
              | { bakiye: number; versiyon: number }
              | null
              | undefined,
          })),
    admin.from("mesaj_alicilari").insert({ istek_id: yeniIstek.id, alici: govde.alici }),
  ]);

  // Yetersiz kredi: mesaj reddedilmez, askıya alınır (durum 'pending' + askiya_alinma,
  // ham alıcı bekler). Kredi yüklenince cüzdan tetikleyicisi geliş sırasıyla kuyruğa alır
  // (20260930170000_kredi_askida_bildirim.sql). 202 kalıcı yanıttır: alt proje yeniden
  // denemez, durumu GET /mesaj/:id ile izler. RPC başarısızsa eski davranışa (402) düşülür.
  if (!kredi.hata && !kredi.sonuc && !aliciHatasi) {
    const { data: askiSonucu } = await admin.rpc("mesaj_askiya_al", { p_istek_id: yeniIstek.id });
    const aski = (Array.isArray(askiSonucu) ? askiSonucu[0] : askiSonucu) as
      | { durum: "askida" | "queued"; bakiye: number; versiyon: number }
      | null
      | undefined;

    if (aski?.durum === "askida") {
      return {
        httpStatus: 202,
        yanit: {
          mesajIstekId: yeniIstek.id,
          durum: "askida",
          sebep: "yetersiz_kredi",
          kalanBakiye: aski.bakiye,
          bakiyeVersiyonu: aski.versiyon,
        },
      };
    }
    if (aski?.durum === "queued") {
      // Askıya alınırken kredi gelmiş: tetikleyici rezerve edip kuyruğa aldı.
      return {
        httpStatus: 200,
        yanit: {
          mesajIstekId: yeniIstek.id,
          durum: "queued",
          kalanBakiye: aski.bakiye,
          bakiyeVersiyonu: aski.versiyon,
        },
      };
    }
  }

  if (kredi.hata || !kredi.sonuc) {
    const yetersiz = !kredi.hata;
    await Promise.all([
      aliciHatasi ? null : admin.from("mesaj_alicilari").delete().eq("istek_id", yeniIstek.id),
      admin
        .from("mesaj_istekleri")
        .update({ durum: "failed", hata_kodu: yetersiz ? "yetersiz_kredi" : "rezervasyon_hatasi" })
        .eq("id", yeniIstek.id),
    ]);
    return yetersiz
      ? { httpStatus: 402, yanit: { hata: "Yetersiz kredi." } }
      : { httpStatus: 500, yanit: { hata: "Kredi rezervasyonu başarısız." } };
  }

  if (aliciHatasi) {
    await Promise.all([
      sandbox ? null : admin.rpc("kredi_iade_et", { p_istek_id: yeniIstek.id }),
      admin
        .from("mesaj_istekleri")
        .update({ durum: "failed", hata_kodu: "alici_kaydedilemedi" })
        .eq("id", yeniIstek.id),
    ]);
    return { httpStatus: 500, yanit: { hata: "İstek kaydedilemedi." } };
  }

  await admin.from("mesaj_istekleri").update({ durum: "queued" }).eq("id", yeniIstek.id);
  // Satır zaten "queued" ve kredi rezerve: dispatch hatası isteği başarısız saymaz
  // (yeniden denemede çifte rezervasyon olurdu); tarayıcı/worker queued satırı alır.
  try {
    await kuyrukAdapter.enqueue(yeniIstek.id);
  } catch {
    console.error(`[kuyruk] enqueue başarısız: ${yeniIstek.id}`);
  }

  return {
    httpStatus: 200,
    yanit: {
      mesajIstekId: yeniIstek.id,
      durum: "queued",
      kalanBakiye: kredi.sonuc.bakiye,
      bakiyeVersiyonu: kredi.sonuc.versiyon,
      ...(sandbox ? { sandbox: true } : {}),
    },
  };
}

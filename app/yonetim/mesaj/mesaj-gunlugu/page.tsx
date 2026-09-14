import Link from "next/link";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { KanalRozeti, mesajDurumRozeti } from "../_bilesenler/rozetler";

const SAYFA_BOYU = 20;

type AramaParametreleri = {
  kanal?: string;
  durum?: string;
  sayfa?: string;
  secili?: string;
};

export default async function MesajGunluguSayfasi({
  searchParams,
}: {
  searchParams: Promise<AramaParametreleri>;
}) {
  const params = await searchParams;
  const supabase = await createMesajClient();

  const sayfa = Math.max(1, Number(params.sayfa) || 1);
  const baslangic = (sayfa - 1) * SAYFA_BOYU;

  let sorgu = supabase
    .from("mesaj_istekleri")
    .select(
      "id, kanal, mesaj_tipi, alici_maskeli, durum, hata_kodu, idempotency_anahtari, planlanan_zaman, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(baslangic, baslangic + SAYFA_BOYU - 1);

  if (params.kanal) sorgu = sorgu.eq("kanal", params.kanal);
  if (params.durum) sorgu = sorgu.eq("durum", params.durum);

  const { data: istekler, count } = await sorgu;

  const seciliIstek = params.secili
    ? (istekler ?? []).find((i) => i.id === params.secili) ??
      (
        await supabase
          .from("mesaj_istekleri")
          .select(
            "id, kanal, mesaj_tipi, alici_maskeli, durum, hata_kodu, idempotency_anahtari, planlanan_zaman, created_at, updated_at",
          )
          .eq("id", params.secili)
          .maybeSingle()
      ).data
    : null;

  const seciliLog = seciliIstek
    ? (
        await supabase
          .from("mesaj_loglari")
          .select("sonuc, teslim_zamani, dusen_kredi")
          .eq("istek_id", seciliIstek.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data
    : null;

  const toplamSayfa = Math.max(1, Math.ceil((count ?? 0) / SAYFA_BOYU));

  const paramliYol = (ek: Record<string, string | undefined>) => {
    const yeni = new URLSearchParams();
    const birlesik = { ...params, ...ek };
    for (const [anahtar, deger] of Object.entries(birlesik)) {
      if (deger) yeni.set(anahtar, deger);
    }
    const sorguMetni = yeni.toString();
    return `/yonetim/mesaj/mesaj-gunlugu${sorguMetni ? `?${sorguMetni}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Mesaj Günlüğü</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">
          Mesaj Günlüğü
        </h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          {count ?? 0} kayıt listelendi
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-panel-border bg-panel-surface p-3 shadow-sm"
      >
        <select
          name="kanal"
          defaultValue={params.kanal ?? ""}
          className="h-9 rounded-lg border border-panel-border bg-panel-canvas px-3 text-sm text-panel-text"
        >
          <option value="">Tüm Kanallar</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="eposta">E-posta</option>
          <option value="telegram">Telegram</option>
        </select>
        <select
          name="durum"
          defaultValue={params.durum ?? ""}
          className="h-9 rounded-lg border border-panel-border bg-panel-canvas px-3 text-sm text-panel-text"
        >
          <option value="">Tüm Durumlar</option>
          <option value="pending">Beklemede</option>
          <option value="queued">Kuyrukta</option>
          <option value="sent">İletildi</option>
          <option value="failed">Başarısız</option>
          <option value="iys_rejected">İYS Red</option>
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg bg-panel-primary px-4 text-sm font-medium text-white hover:bg-panel-primary-hover"
        >
          Sorgula
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface shadow-sm">
          {!istekler || istekler.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined mb-2 text-[28px] text-panel-text-disabled">
                forum
              </span>
              <p className="text-sm font-medium text-panel-text">Kayıt bulunamadı</p>
              <p className="mt-1 text-xs text-panel-text-secondary">
                Filtrelere uyan mesaj isteği yok.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-panel-border bg-panel-canvas text-xs uppercase text-panel-text-secondary">
                  <th className="px-4 py-2 font-medium">Zaman</th>
                  <th className="px-4 py-2 font-medium">Kanal</th>
                  <th className="px-4 py-2 font-medium">Alıcı</th>
                  <th className="px-4 py-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {istekler.map((i) => (
                  <tr
                    key={i.id}
                    className={
                      "cursor-pointer hover:bg-panel-canvas " +
                      (i.id === seciliIstek?.id ? "bg-panel-primary/5" : "")
                    }
                  >
                    <td className="px-4 py-2.5">
                      <Link href={paramliYol({ secili: i.id })} className="block text-panel-text-secondary">
                        {new Date(i.created_at).toLocaleString("tr-TR")}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={paramliYol({ secili: i.id })} className="block">
                        <KanalRozeti kanal={i.kanal} />
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-panel-text">
                      <Link href={paramliYol({ secili: i.id })} className="block">
                        {i.alici_maskeli}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={paramliYol({ secili: i.id })} className="block">
                        {mesajDurumRozeti(i.durum)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {toplamSayfa > 1 && (
            <div className="flex items-center justify-between border-t border-panel-border px-4 py-3 text-xs text-panel-text-secondary">
              <span>
                Sayfa {sayfa} / {toplamSayfa}
              </span>
              <div className="flex gap-2">
                {sayfa > 1 && (
                  <Link
                    href={paramliYol({ sayfa: String(sayfa - 1) })}
                    className="rounded-lg border border-panel-border px-2 py-1 hover:bg-panel-canvas"
                  >
                    Önceki
                  </Link>
                )}
                {sayfa < toplamSayfa && (
                  <Link
                    href={paramliYol({ sayfa: String(sayfa + 1) })}
                    className="rounded-lg border border-panel-border px-2 py-1 hover:bg-panel-canvas"
                  >
                    Sonraki
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-panel-text">Mesaj Detayı</h2>
          {!seciliIstek ? (
            <p className="text-sm text-panel-text-secondary">
              Detayları görmek için soldaki listeden bir satır seçin.
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <KanalRozeti kanal={seciliIstek.kanal} />
                {mesajDurumRozeti(seciliIstek.durum)}
              </div>
              <DetayAlani etiket="Alıcı (maskeli)" deger={seciliIstek.alici_maskeli} />
              <DetayAlani etiket="Mesaj Tipi" deger={seciliIstek.mesaj_tipi} />
              <DetayAlani
                etiket="Oluşturulma"
                deger={new Date(seciliIstek.created_at).toLocaleString("tr-TR")}
              />
              {seciliIstek.planlanan_zaman && (
                <DetayAlani
                  etiket="Planlanan Zaman"
                  deger={new Date(seciliIstek.planlanan_zaman).toLocaleString("tr-TR")}
                />
              )}
              {seciliIstek.hata_kodu && (
                <DetayAlani etiket="Hata Kodu" deger={seciliIstek.hata_kodu} />
              )}
              {seciliIstek.idempotency_anahtari && (
                <DetayAlani
                  etiket="Idempotency Anahtarı"
                  deger={seciliIstek.idempotency_anahtari}
                  mono
                />
              )}
              {seciliLog && (
                <>
                  <hr className="border-panel-border" />
                  <DetayAlani etiket="Sağlayıcı Sonucu" deger={seciliLog.sonuc ?? "—"} />
                  {seciliLog.teslim_zamani && (
                    <DetayAlani
                      etiket="Teslim Zamanı"
                      deger={new Date(seciliLog.teslim_zamani).toLocaleString("tr-TR")}
                    />
                  )}
                  {seciliLog.dusen_kredi != null && (
                    <DetayAlani etiket="Düşen Kredi" deger={`${seciliLog.dusen_kredi} adet`} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetayAlani({
  etiket,
  deger,
  mono,
}: {
  etiket: string;
  deger: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="block text-xs text-panel-text-secondary">{etiket}</span>
      <span className={`text-panel-text ${mono ? "font-mono text-xs" : ""}`}>{deger}</span>
    </div>
  );
}

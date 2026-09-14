import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { istanbulGunBaslangici, istanbulAyBaslangici } from "@/lib/zaman";
import { KanalRozeti } from "./_bilesenler/rozetler";

const KANALLAR = ["whatsapp", "sms", "eposta", "telegram"] as const;

export default async function GenelBakisSayfasi() {
  const supabase = await createMesajClient();

  const gunBaslangici = istanbulGunBaslangici().toISOString();
  const ayBaslangici = istanbulAyBaslangici().toISOString();

  const [
    { count: bugun },
    { count: buAy },
    { count: hatali },
    kanalSayimlari,
    { data: bagliDegilKimlikler },
    { data: tumCuzdanlar },
  ] = await Promise.all([
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .gte("created_at", gunBaslangici),
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .gte("created_at", ayBaslangici),
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .eq("durum", "failed")
      .gte("created_at", ayBaslangici),
    Promise.all(
      KANALLAR.map(async (kanal) => {
        const { count } = await supabase
          .from("mesaj_istekleri")
          .select("*", { count: "exact", head: true })
          .eq("kanal", kanal)
          .gte("created_at", ayBaslangici);
        return { kanal, adet: count ?? 0 };
      }),
    ),
    supabase
      .from("gonderen_kimlikleri")
      .select("id, kanal, baglanti_durumu, proje_kullanici_id")
      .eq("kanal", "whatsapp")
      .neq("baglanti_durumu", "connected")
      .limit(5),
    supabase
      .from("kredi_cuzdanlari")
      .select("id, kanal, bakiye, esik, proje_kullanici_id")
      .limit(200),
  ]);

  const dusukBakiyeler = (tumCuzdanlar ?? [])
    .filter((c) => c.bakiye < c.esik)
    .slice(0, 5);

  const toplamKanalMesaji = kanalSayimlari.reduce((t, k) => t + k.adet, 0);
  const hataOrani = buAy && buAy > 0 ? ((hatali ?? 0) / buAy) * 100 : 0;
  const dikkatSayisi = (bagliDegilKimlikler?.length ?? 0) + (dusukBakiyeler?.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Genel Bakış</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">
          Canlı Operasyon Konsolu — Genel Bakış
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiKarti baslik="Bugün Gönderilen" deger={bugun ?? 0} />
          <KpiKarti baslik="Bu Ay Gönderilen" deger={buAy ?? 0} />
          <KpiKarti
            baslik="Hata Oranı"
            deger={`%${hataOrani.toFixed(1)}`}
            altYazi={`${hatali ?? 0} başarısız istek`}
          />
        </div>

        <div className="rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-panel-warning">
              warning
            </span>
            <h2 className="text-sm font-semibold text-panel-text">
              Dikkat Gerektirenler
            </h2>
            {dikkatSayisi > 0 && (
              <span className="ml-auto rounded-full bg-panel-warning-bg px-2 py-0.5 text-[11px] font-semibold text-panel-warning">
                {dikkatSayisi}
              </span>
            )}
          </div>
          {dikkatSayisi === 0 ? (
            <p className="text-sm text-panel-text-secondary">
              Dikkat gerektiren bir durum yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {bagliDegilKimlikler?.map((k) => (
                <li key={k.id} className="flex items-center gap-2 text-panel-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-panel-danger" />
                  WhatsApp bağlantısı eksik (kimlik #{k.id.slice(0, 8)})
                </li>
              ))}
              {dusukBakiyeler?.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-panel-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-panel-warning" />
                  Düşük bakiye — {c.kanal}: {c.bakiye} adet (eşik {c.esik})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-panel-text">
          Kanal Kırılımı — Bu Ay
        </h2>
        <p className="mb-4 text-xs text-panel-text-secondary">
          Günlük toplam dağılım ve iletim hacimleri
        </p>
        {toplamKanalMesaji === 0 ? (
          <p className="py-8 text-center text-sm text-panel-text-secondary">
            Henüz gönderim yok — ilk mesaj gönderildiğinde burada kanal
            dağılımı görünecek.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {kanalSayimlari.map(({ kanal, adet }) => (
              <div key={kanal} className="flex items-center gap-2">
                <KanalRozeti kanal={kanal} />
                <span className="text-sm font-medium text-panel-text">
                  {adet.toLocaleString("tr-TR")}
                </span>
                <span className="text-xs text-panel-text-secondary">
                  %{toplamKanalMesaji > 0 ? ((adet / toplamKanalMesaji) * 100).toFixed(1) : "0,0"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiKarti({
  baslik,
  deger,
  altYazi,
}: {
  baslik: string;
  deger: string | number;
  altYazi?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm">
      <span className="text-xs text-panel-text-secondary">{baslik}</span>
      <span className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-panel-text">
        {typeof deger === "number" ? deger.toLocaleString("tr-TR") : deger}
      </span>
      {altYazi && (
        <span className="mt-2 text-[11px] text-panel-text-secondary">{altYazi}</span>
      )}
    </div>
  );
}

import Link from "next/link";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { istanbulGunBaslangici, istanbulAyBaslangici, saatOncesi } from "@/lib/zaman";
import { requirePersonel } from "@/lib/yetki";
import { KanalRozeti, DurumRozeti } from "./_bilesenler/rozetler";
import { operatorGoruntuAdi } from "./_bilesenler/operator";
import { CanliSaat } from "./_bilesenler/canli-saat";

const KANALLAR = ["whatsapp", "sms", "eposta", "telegram"] as const;

const KANAL_SAGLIK_ETIKETI: Record<(typeof KANALLAR)[number], string> = {
  whatsapp: "WhatsApp API",
  sms: "Netgsm SMS",
  eposta: "Resend",
  telegram: "Telegram",
};

export default async function GenelBakisSayfasi() {
  const supabase = await createMesajClient();
  const { email, adSoyad } = await requirePersonel();

  const gunBaslangici = istanbulGunBaslangici().toISOString();
  const ayBaslangici = istanbulAyBaslangici().toISOString();
  const yirmiDortSaatOnce = saatOncesi(24).toISOString();

  const [
    { count: bugun },
    { count: bugunIletilen },
    { count: buAy },
    { count: hatali },
    kanalSayimlari,
    { data: bagliDegilKimlikler },
    { data: tumCuzdanlar },
    { count: bekleyenKuyruk },
    { count: acilBekleyen },
    kanalSagligi,
  ] = await Promise.all([
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .gte("created_at", gunBaslangici),
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .eq("durum", "sent")
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
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .in("durum", ["pending", "queued"]),
    supabase
      .from("mesaj_istekleri")
      .select("*", { count: "exact", head: true })
      .in("durum", ["pending", "queued"])
      .gt("oncelik", 0),
    // Kanal & Gateway Sağlığı (mobil): CLAUDE.md §6.2'de sağlayıcı uptime/gecikme
    // telemetrisi tutulmuyor — bu yüzden "durum" ve "gecikme" son 24 saatteki
    // gerçek mesaj_istekleri/mesaj_loglari kayıtlarından türetiliyor (mock değil):
    // başarı oranı sent/(sent+failed), gecikme ise teslim_zamani - created_at ortalaması.
    Promise.all(
      KANALLAR.map(async (kanal) => {
        const { data: rows } = await supabase
          .from("mesaj_istekleri")
          .select("durum, created_at, mesaj_loglari(teslim_zamani)")
          .eq("kanal", kanal)
          .in("durum", ["sent", "failed"])
          .gte("created_at", yirmiDortSaatOnce)
          .limit(500);

        const toplam = rows?.length ?? 0;
        const basarili = rows?.filter((r) => r.durum === "sent").length ?? 0;
        const basariOrani = toplam > 0 ? (basarili / toplam) * 100 : null;

        const gecikmelerMs = (rows ?? [])
          .map((r) => {
            const loglar = Array.isArray(r.mesaj_loglari)
              ? r.mesaj_loglari
              : r.mesaj_loglari
                ? [r.mesaj_loglari]
                : [];
            const log = loglar.find((l) => l?.teslim_zamani);
            return log
              ? new Date(log.teslim_zamani as string).getTime() - new Date(r.created_at).getTime()
              : null;
          })
          .filter((ms): ms is number => ms !== null && ms >= 0);

        const ortalamaGecikmeSn =
          gecikmelerMs.length > 0
            ? Math.round(gecikmelerMs.reduce((a, b) => a + b, 0) / gecikmelerMs.length / 1000)
            : null;

        const durum: "aktif" | "sorunlu" | "veri_yok" =
          toplam === 0 ? "veri_yok" : basariOrani !== null && basariOrani >= 95 ? "aktif" : "sorunlu";

        return { kanal, basariOrani, ortalamaGecikmeSn, durum };
      }),
    ),
  ]);

  const dusukBakiyeler = (tumCuzdanlar ?? [])
    .filter((c) => c.bakiye < c.esik)
    .slice(0, 5);

  const toplamKanalMesaji = kanalSayimlari.reduce((t, k) => t + k.adet, 0);
  const hataOrani = buAy && buAy > 0 ? ((hatali ?? 0) / buAy) * 100 : 0;
  const dikkatSayisi = (bagliDegilKimlikler?.length ?? 0) + (dusukBakiyeler?.length ?? 0);

  const teslimYuzdesi = bugun && bugun > 0 ? ((bugunIletilen ?? 0) / bugun) * 100 : null;
  const bugununTarihi = new Date().toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
    <div className="hidden flex-col gap-6 md:flex">
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

    {/* Mobil breakpoint (<768px) — Stitch "Mesaj Merkezi" mobil konsol referansı */}
    <div className="flex flex-col gap-5 md:hidden">
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight text-panel-text">
          İyi çalışmalar, {operatorGoruntuAdi(adSoyad, email)}
        </h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          {bugununTarihi} · Mesaj Yönetim Konsolu · Bugün{" "}
          {(bugunIletilen ?? 0).toLocaleString("tr-TR")} mesaj iletildi.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex h-[126px] flex-col justify-between rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-panel-text-secondary">
              Bugünkü İletimler
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-panel-success-border bg-panel-success-bg text-panel-success">
              <span className="material-symbols-outlined text-[18px]">mark_chat_read</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black tracking-tight text-panel-text [font-variant-numeric:tabular-nums]">
              {(bugunIletilen ?? 0).toLocaleString("tr-TR")}
              <span className="ml-1 text-xl font-normal text-panel-text-disabled">
                / {(bugun ?? 0).toLocaleString("tr-TR")}
              </span>
            </span>
            <span className="rounded-full border border-panel-success-border bg-panel-success-bg px-2 py-0.5 text-xs font-semibold text-panel-success">
              {teslimYuzdesi !== null ? `%${teslimYuzdesi.toFixed(1)} Teslim` : "Veri Yok"}
            </span>
          </div>
        </div>

        <div className="flex h-[126px] flex-col justify-between rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-panel-text-secondary">
              Bekleyen Kuyruk
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-panel-warning-border bg-panel-warning-bg text-panel-warning">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-panel-text [font-variant-numeric:tabular-nums]">
              {(bekleyenKuyruk ?? 0).toLocaleString("tr-TR")}
            </span>
            {(acilBekleyen ?? 0) > 0 && (
              <span className="rounded-full border border-panel-warning-border bg-panel-warning-bg px-2 py-0.5 text-xs font-semibold text-panel-warning">
                Acil Bekliyor
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2 text-panel-text">
            <span className="material-symbols-outlined text-[20px] text-panel-primary">hub</span>
            <h2 className="text-base font-bold text-panel-text">Kanal &amp; Gateway Sağlığı</h2>
          </div>
          <Link
            href="/yonetim/mesaj/mesaj-gunlugu"
            className="flex items-center gap-1 rounded-lg bg-panel-primary/10 px-3 py-1.5 text-xs font-semibold text-panel-primary"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            Loglar
          </Link>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-panel-primary/20 bg-panel-primary/10 px-2.5 py-0.5 text-xs font-bold text-panel-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-panel-primary" />
            CANLI
          </span>
          <CanliSaat />
        </div>
        <div className="overflow-x-auto rounded-lg border border-panel-border">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="border-b border-panel-border bg-panel-canvas text-panel-text-secondary">
                <th className="border-r border-panel-border px-3 py-2.5 text-left font-semibold">Kanal</th>
                <th className="border-r border-panel-border px-2 py-2.5 font-semibold">Başarı</th>
                <th className="border-r border-panel-border px-2 py-2.5 font-semibold">Gecikme</th>
                <th className="px-2 py-2.5 font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border text-panel-text-secondary">
              {kanalSagligi.map((k) => (
                <tr key={k.kanal} className="h-11">
                  <td className="border-r border-panel-border px-3 py-2 text-left font-medium text-panel-text">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={
                          "h-2 w-2 rounded-full " +
                          (k.durum === "aktif"
                            ? "bg-panel-success"
                            : k.durum === "sorunlu"
                              ? "bg-panel-danger"
                              : "bg-panel-text-disabled")
                        }
                      />
                      {KANAL_SAGLIK_ETIKETI[k.kanal]}
                    </span>
                  </td>
                  <td className="border-r border-panel-border px-2 py-2 [font-variant-numeric:tabular-nums]">
                    {k.basariOrani !== null ? `%${k.basariOrani.toFixed(1)}` : "—"}
                  </td>
                  <td className="border-r border-panel-border px-2 py-2 [font-variant-numeric:tabular-nums]">
                    {k.ortalamaGecikmeSn !== null ? `${k.ortalamaGecikmeSn} sn` : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {k.durum === "aktif" && <DurumRozeti etiket="Aktif" ton="success" />}
                    {k.durum === "sorunlu" && <DurumRozeti etiket="Sorunlu" ton="danger" />}
                    {k.durum === "veri_yok" && <DurumRozeti etiket="Veri Yok" ton="notr" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </>
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

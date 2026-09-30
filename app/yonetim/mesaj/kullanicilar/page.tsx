import Link from "next/link";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { baglantiDurumuRozeti } from "../_bilesenler/rozetler";
import { DonemFiltresi } from "../_bilesenler/donem-filtresi";
import { donemCoz } from "@/lib/donem";

const MESAJ_KANALLARI = [
  { kanal: "sms", ad: "SMS" },
  { kanal: "whatsapp", ad: "WhatsApp" },
  { kanal: "telegram", ad: "Telegram" },
  { kanal: "eposta", ad: "E-posta" },
] as const;

type MesajSayaci = {
  gerceklesen: Record<string, number>;
  sirada: number;
  hata: number;
};

export default async function KullanicilarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; donem?: string; t?: string }>;
}) {
  const { kategori: secilenSlug, donem: donemParam, t: tParam } = await searchParams;
  const donem = donemCoz(donemParam, tParam);
  const supabase = await createMesajClient();

  const [{ data: projeler }, { data: kategoriler }] = await Promise.all([
    supabase.from("projeler").select("id, ad, kategori_id"),
    supabase.from("kategoriler").select("id, ad, slug").eq("aktif", true).order("sira"),
  ]);

  const seciliKategori = (kategoriler ?? []).find((k) => k.slug === secilenSlug) ?? null;
  const filtreProjeIdleri = seciliKategori
    ? (projeler ?? []).filter((p) => p.kategori_id === seciliKategori.id).map((p) => p.id)
    : null;
  const kategoriAdi = new Map((kategoriler ?? []).map((k) => [k.id, k.ad]));
  const projeKategorisi = new Map((projeler ?? []).map((p) => [p.id, kategoriAdi.get(p.kategori_id)]));

  const [{ data: kullanicilar }, { data: cuzdanlar }, { data: kimlikler }] =
    await Promise.all([
      (() => {
        const sorgu = supabase
          .from("proje_kullanicilari_maskeli")
          .select("id, proje_id, dis_kullanici_id, ad, eposta, telefon_maskeli, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        return filtreProjeIdleri ? sorgu.in("proje_id", filtreProjeIdleri) : sorgu;
      })(),
      supabase.from("kredi_cuzdanlari").select("proje_kullanici_id, kanal, bakiye"),
      supabase
        .from("gonderen_kimlikleri")
        .select("proje_kullanici_id, kanal, baglanti_durumu")
        .eq("kanal", "whatsapp"),
    ]);

  const [{ count: kullaniciSayisi }, { count: kimlikSayisi }] = await Promise.all([
    supabase.from("proje_kullanicilari").select("id", { count: "exact", head: true }),
    supabase.from("gonderen_kimlikleri").select("id", { count: "exact", head: true }),
  ]);
  const semaAdimlari = [
    { ikon: "category", ad: "Kategori", sayi: kategoriler?.length ?? 0, not: "Modül grubu" },
    { ikon: "folder_open", ad: "Proje", sayi: projeler?.length ?? 0, not: "Alt proje / domain" },
    { ikon: "group", ad: "Proje Kullanıcısı", sayi: kullaniciSayisi ?? 0, not: "Mesajı tetikleyen kiracı" },
    { ikon: "badge", ad: "Gönderen Kimliği", sayi: kimlikSayisi ?? 0, not: "Kanal başına teknik kimlik" },
  ];

  // Seçili dönemdeki mesajlar; PostgREST satır sınırı yüzünden sayfa sayfa okunur.
  const SAYFA = 1000;
  const MAKS_SAYFA = 20;
  const sayaclar = new Map<string, MesajSayaci>();
  for (let s = 0; s < MAKS_SAYFA; s++) {
    const { data: sayfa } = await supabase
      .from("mesaj_istekleri")
      .select("proje_kullanici_id, kanal, durum")
      .gte("created_at", donem.baslangic)
      .lt("created_at", donem.bitis)
      .order("created_at")
      .range(s * SAYFA, (s + 1) * SAYFA - 1);
    for (const m of sayfa ?? []) {
      const c = sayaclar.get(m.proje_kullanici_id) ?? { gerceklesen: {}, sirada: 0, hata: 0 };
      if (m.durum === "sent") c.gerceklesen[m.kanal] = (c.gerceklesen[m.kanal] ?? 0) + 1;
      else if (m.durum === "pending" || m.durum === "queued") c.sirada += 1;
      else if (m.durum === "failed") c.hata += 1;
      sayaclar.set(m.proje_kullanici_id, c);
    }
    if ((sayfa?.length ?? 0) < SAYFA) break;
  }

  const projeAdi = new Map((projeler ?? []).map((p) => [p.id, p.ad]));
  const bakiyeToplami = new Map<string, number>();
  for (const c of cuzdanlar ?? []) {
    bakiyeToplami.set(
      c.proje_kullanici_id,
      (bakiyeToplami.get(c.proje_kullanici_id) ?? 0) + c.bakiye,
    );
  }
  const whatsappDurumu = new Map((kimlikler ?? []).map((k) => [k.proje_kullanici_id, k.baglanti_durumu]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Kullanıcılar</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">
          Kullanıcı &amp; Kiracı Yönetimi
        </h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          {kullanicilar?.length ?? 0} kayıtlı hesap · telefon numaraları
          maskeli gösterilir
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ slug: "", ad: "Tümü" }, ...(kategoriler ?? [])].map((k) => {
          const aktifMi = (seciliKategori?.slug ?? "") === k.slug;
          return (
            <Link
              key={k.slug || "tumu"}
              href={k.slug ? `/yonetim/mesaj/kullanicilar?kategori=${k.slug}` : "/yonetim/mesaj/kullanicilar"}
              className={
                "rounded-full border px-3 py-1 text-xs transition-colors " +
                (aktifMi
                  ? "border-panel-primary bg-panel-primary/5 font-semibold text-panel-primary"
                  : "border-panel-border text-panel-text-secondary hover:bg-panel-canvas")
              }
            >
              {k.ad}
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase text-panel-text-secondary">
          Takip Şeması
        </h2>
        <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          {semaAdimlari.map((adim, i) => (
            <li key={adim.ad} className="flex flex-1 flex-col items-stretch gap-2 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-lg border border-panel-border bg-panel-canvas px-3 py-2.5">
                <span className="material-symbols-outlined text-[22px] text-panel-primary">
                  {adim.ikon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-panel-text">
                    {adim.ad}{" "}
                    <span className="font-normal text-panel-text-secondary">
                      · {adim.sayi.toLocaleString("tr-TR")}
                    </span>
                  </p>
                  <p className="truncate text-xs text-panel-text-secondary">{adim.not}</p>
                </div>
              </div>
              {i < semaAdimlari.length - 1 && (
                <span className="material-symbols-outlined self-center text-[20px] text-panel-text-disabled max-md:rotate-90">
                  arrow_forward
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface shadow-sm">
        {!kullanicilar || kullanicilar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined mb-2 text-[28px] text-panel-text-disabled">
              group_off
            </span>
            <p className="text-sm font-medium text-panel-text">
              Henüz kayıtlı kullanıcı yok
            </p>
            <p className="mt-1 max-w-sm text-xs text-panel-text-secondary">
              Bir alt proje ilk kez{" "}
              <code className="rounded bg-panel-canvas px-1">
                /api/v1/kullanici/senkron
              </code>{" "}
              çağırdığında kullanıcılar burada görünecek.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-canvas text-xs uppercase text-panel-text-secondary">
                <th className="px-4 py-2 font-medium">Kullanıcı</th>
                <th className="px-4 py-2 font-medium">Kategori</th>
                <th className="px-4 py-2 font-medium">Proje</th>
                <th className="px-4 py-2 font-medium">Telefon (maskeli)</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">Toplam Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {kullanicilar.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-2.5 text-panel-text">
                    {k.ad ?? k.dis_kullanici_id}
                    {k.eposta && (
                      <span className="block text-xs text-panel-text-secondary">
                        {k.eposta}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-panel-text-secondary">
                    {projeKategorisi.get(k.proje_id) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-panel-text-secondary">
                    {projeAdi.get(k.proje_id) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-panel-text">
                    {k.telefon_maskeli ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {baglantiDurumuRozeti(whatsappDurumu.get(k.id) ?? "pending")}
                  </td>
                  <td className="px-4 py-2.5 text-panel-text">
                    {(bakiyeToplami.get(k.id) ?? 0).toLocaleString("tr-TR")} adet
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase text-panel-text-secondary">
          Mesaj Şeması
        </h2>
        <DonemFiltresi
          donem={donem}
          yol="/yonetim/mesaj/kullanicilar"
          diger={{ kategori: seciliKategori?.slug }}
        />
        <div className="overflow-x-auto rounded-lg border border-panel-border bg-panel-surface shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-canvas text-xs uppercase text-panel-text-secondary">
                <th rowSpan={2} className="px-4 py-2 align-bottom font-medium">Kullanıcı</th>
                <th colSpan={MESAJ_KANALLARI.length} className="px-4 pt-2 text-center font-medium">
                  Gerçekleşen
                </th>
                <th rowSpan={2} className="px-4 py-2 text-right align-bottom font-medium">Sırada</th>
                <th rowSpan={2} className="px-4 py-2 text-right align-bottom font-medium">Hata</th>
              </tr>
              <tr className="border-b border-panel-border bg-panel-canvas text-xs uppercase text-panel-text-secondary">
                {MESAJ_KANALLARI.map((k) => (
                  <th key={k.kanal} className="px-4 pb-2 text-right font-medium">{k.ad}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {!kullanicilar || kullanicilar.length === 0 ? (
                <tr>
                  <td
                    colSpan={MESAJ_KANALLARI.length + 3}
                    className="px-4 py-6 text-center text-xs text-panel-text-secondary"
                  >
                    Gösterilecek kullanıcı yok.
                  </td>
                </tr>
              ) : (
                kullanicilar.map((k) => {
                  const c = sayaclar.get(k.id);
                  return (
                    <tr key={k.id}>
                      <td className="px-4 py-2.5 text-panel-text">{k.ad ?? k.dis_kullanici_id}</td>
                      {MESAJ_KANALLARI.map((kn) => (
                        <td key={kn.kanal} className="px-4 py-2.5 text-right tabular-nums text-panel-text">
                          {(c?.gerceklesen[kn.kanal] ?? 0).toLocaleString("tr-TR")}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right tabular-nums text-panel-text">
                        {(c?.sirada ?? 0).toLocaleString("tr-TR")}
                      </td>
                      <td
                        className={
                          "px-4 py-2.5 text-right tabular-nums " +
                          (c?.hata ? "font-semibold text-red-600" : "text-panel-text")
                        }
                      >
                        {(c?.hata ?? 0).toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

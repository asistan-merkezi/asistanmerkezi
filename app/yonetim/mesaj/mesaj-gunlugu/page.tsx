import Link from "next/link";
import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { KanalRozeti, baglantiDurumuRozeti, mesajDurumRozeti } from "../_bilesenler/rozetler";

const SAYFA_BOYU = 20;
const BOLUM_DAGILIMI_ORNEKLEM = 500;

type Kanal = "sms" | "whatsapp" | "eposta" | "telegram";
const KANALLAR: Kanal[] = ["sms", "whatsapp", "eposta", "telegram"];

type AramaParametreleri = {
  gorunum?: string;
  kanal?: string;
  kategori?: string;
  proje?: string;
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
  const gorunum = params.gorunum === "baglantilar" ? "baglantilar" : "projeler";

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
      </div>

      <div className="flex gap-1 border-b border-panel-border">
        <SekmeLinki
          href={paramliYol({ gorunum: "baglantilar", kategori: undefined, proje: undefined, kanal: undefined, secili: undefined, sayfa: undefined })}
          aktif={gorunum === "baglantilar"}
          etiket="Bağlantılar"
          ikon="hub"
        />
        <SekmeLinki
          href={paramliYol({ gorunum: "projeler", kanal: undefined, secili: undefined, sayfa: undefined })}
          aktif={gorunum === "projeler"}
          etiket="Projeler"
          ikon="folder_open"
        />
      </div>

      {gorunum === "baglantilar" ? (
        <BaglantilarSekmesi supabase={supabase} params={params} paramliYol={paramliYol} />
      ) : (
        <ProjelerSekmesi supabase={supabase} params={params} paramliYol={paramliYol} />
      )}
    </div>
  );
}

function SekmeLinki({
  href,
  aktif,
  etiket,
  ikon,
}: {
  href: string;
  aktif: boolean;
  etiket: string;
  ikon: string;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors " +
        (aktif
          ? "border-panel-primary text-panel-primary"
          : "border-transparent text-panel-text-secondary hover:text-panel-text")
      }
    >
      <span className="material-symbols-outlined text-[18px]">{ikon}</span>
      {etiket}
    </Link>
  );
}

const KANAL_ETIKET: Record<Kanal, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  eposta: "E-posta",
  telegram: "Telegram",
};

// ---------------------------------------------------------------------------
// Bağlantılar sekmesi: kanal başına (SMS/WhatsApp/E-posta/Telegram) tüm
// projelerdeki gönderen kimliklerinin bağlantı durumu.
// ---------------------------------------------------------------------------

async function BaglantilarSekmesi({
  supabase,
  params,
  paramliYol,
}: {
  supabase: Awaited<ReturnType<typeof createMesajClient>>;
  params: AramaParametreleri;
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  const seciliKanal: Kanal = KANALLAR.includes(params.kanal as Kanal)
    ? (params.kanal as Kanal)
    : "sms";

  const [{ data: tumKimlikler }, { data: projeKullanicilari }, { data: projeler }] =
    await Promise.all([
      supabase
        .from("gonderen_kimlikleri")
        .select(
          "id, proje_kullanici_id, kanal, baglanti_durumu, gonderen_ad, gonderen_adres, sms_basligi, phone_number_id, updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase.from("proje_kullanicilari_maskeli").select("id, proje_id, ad, dis_kullanici_id"),
      supabase.from("projeler").select("id, ad"),
    ]);

  const kullaniciMap = new Map((projeKullanicilari ?? []).map((k) => [k.id, k]));
  const projeAdi = new Map((projeler ?? []).map((p) => [p.id, p.ad]));
  const kanalSayisi = new Map<Kanal, number>();
  for (const k of tumKimlikler ?? []) {
    kanalSayisi.set(k.kanal as Kanal, (kanalSayisi.get(k.kanal as Kanal) ?? 0) + 1);
  }
  const kimlikler = (tumKimlikler ?? []).filter((k) => k.kanal === seciliKanal);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KANALLAR.map((k) => (
          <Link
            key={k}
            href={paramliYol({ kanal: k })}
            className={
              "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center shadow-sm transition-colors " +
              (seciliKanal === k
                ? "border-panel-primary bg-panel-primary/5"
                : "border-panel-border bg-panel-surface hover:bg-panel-canvas")
            }
          >
            <KanalRozeti kanal={k} />
            <span className="text-xs text-panel-text-secondary">
              {kanalSayisi.get(k) ?? 0} bağlantı
            </span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface shadow-sm">
        {!kimlikler || kimlikler.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined mb-2 text-[28px] text-panel-text-disabled">
              link_off
            </span>
            <p className="text-sm font-medium text-panel-text">
              {KANAL_ETIKET[seciliKanal]} için henüz bağlantı yok
            </p>
            <p className="mt-1 max-w-sm text-xs text-panel-text-secondary">
              Bir alt proje bu kanal için gönderen kimliği oluşturduğunda burada
              listelenecek.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-canvas text-xs uppercase text-panel-text-secondary">
                <th className="px-4 py-2 font-medium">Proje</th>
                <th className="px-4 py-2 font-medium">Kullanıcı</th>
                <th className="px-4 py-2 font-medium">Gönderen Bilgisi</th>
                <th className="px-4 py-2 font-medium">Durum</th>
                <th className="px-4 py-2 font-medium">Güncellenme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {kimlikler.map((kimlik) => {
                const kullanici = kullaniciMap.get(kimlik.proje_kullanici_id);
                const gonderenBilgisi =
                  seciliKanal === "eposta"
                    ? kimlik.gonderen_adres ?? kimlik.gonderen_ad ?? "—"
                    : seciliKanal === "sms"
                      ? kimlik.sms_basligi ?? "—"
                      : seciliKanal === "whatsapp"
                        ? kimlik.phone_number_id ?? "—"
                        : "Ortak sistem botu";
                return (
                  <tr key={kimlik.id}>
                    <td className="px-4 py-2.5 text-panel-text">
                      {kullanici ? projeAdi.get(kullanici.proje_id) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-panel-text-secondary">
                      {kullanici?.ad ?? kullanici?.dis_kullanici_id ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-panel-text">
                      {gonderenBilgisi}
                    </td>
                    <td className="px-4 py-2.5">
                      {baglantiDurumuRozeti(kimlik.baglanti_durumu)}
                    </td>
                    <td className="px-4 py-2.5 text-panel-text-secondary">
                      {new Date(kimlik.updated_at).toLocaleString("tr-TR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Projeler sekmesi: kategori kutucukları → proje kutucukları → kanal
// kutucukları → seçili proje + kanal için mesaj dökümü.
// ---------------------------------------------------------------------------

async function ProjelerSekmesi({
  supabase,
  params,
  paramliYol,
}: {
  supabase: Awaited<ReturnType<typeof createMesajClient>>;
  params: AramaParametreleri;
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  const [{ data: kategoriler }, { data: projeler }] = await Promise.all([
    supabase.from("kategoriler").select("id, ad, slug, sira").eq("aktif", true).order("sira"),
    supabase.from("projeler").select("id, ad, kategori_id, aktif"),
  ]);

  const projeSayisi = new Map<string, number>();
  for (const p of projeler ?? []) {
    projeSayisi.set(p.kategori_id, (projeSayisi.get(p.kategori_id) ?? 0) + 1);
  }

  const seciliProje = params.proje
    ? (projeler ?? []).find((p) => p.id === params.proje) ?? null
    : null;
  const seciliKategori =
    (params.kategori ? (kategoriler ?? []).find((k) => k.slug === params.kategori) : null) ??
    (seciliProje ? (kategoriler ?? []).find((k) => k.id === seciliProje.kategori_id) : null) ??
    null;

  const seciliKanal: Kanal | null =
    seciliProje && KANALLAR.includes(params.kanal as Kanal) ? (params.kanal as Kanal) : null;

  // mesaj_istekleri'ni projeye göre süzmek için proje_kullanici_id listesi
  // gerekiyor. Ham `proje_kullanicilari` tablosunun RLS'i yalnız super_admin'e
  // açık (§6.2) — bu yüzden diğer panel sayfalarıyla aynı şekilde maskeli
  // view üzerinden okunuyor, ki destek rolü de bu ekranı kullanabilsin.
  const projeKullaniciIdleri = seciliProje
    ? (
        await supabase
          .from("proje_kullanicilari_maskeli")
          .select("id")
          .eq("proje_id", seciliProje.id)
      ).data?.map((k) => k.id) ?? []
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Kirintilar
        seciliKategori={seciliKategori}
        seciliProje={seciliProje}
        seciliKanal={seciliKanal}
        paramliYol={paramliYol}
      />

      {!seciliKategori ? (
        <KategoriKutulari kategoriler={kategoriler ?? []} projeSayisi={projeSayisi} paramliYol={paramliYol} />
      ) : !seciliProje ? (
        <ProjeKutulari
          kategori={seciliKategori}
          projeler={(projeler ?? []).filter((p) => p.kategori_id === seciliKategori.id)}
          paramliYol={paramliYol}
        />
      ) : !seciliKanal ? (
        <KanalKutulari
          supabase={supabase}
          projeKullaniciIdleri={projeKullaniciIdleri}
          paramliYol={paramliYol}
        />
      ) : (
        <MesajDokumu
          supabase={supabase}
          proje={seciliProje}
          kanal={seciliKanal}
          projeKullaniciIdleri={projeKullaniciIdleri}
          params={params}
          paramliYol={paramliYol}
        />
      )}
    </div>
  );
}

function Kirintilar({
  seciliKategori,
  seciliProje,
  seciliKanal,
  paramliYol,
}: {
  seciliKategori: { ad: string; slug: string } | null;
  seciliProje: { id: string; ad: string } | null;
  seciliKanal: Kanal | null;
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-panel-text-secondary">
      <Link
        href={paramliYol({ kategori: undefined, proje: undefined, kanal: undefined })}
        className={seciliKategori ? "hover:text-panel-primary" : "font-semibold text-panel-text"}
      >
        Kategoriler
      </Link>
      {seciliKategori && (
        <>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <Link
            href={paramliYol({ kategori: seciliKategori.slug, proje: undefined, kanal: undefined })}
            className={seciliProje ? "hover:text-panel-primary" : "font-semibold text-panel-text"}
          >
            {seciliKategori.ad}
          </Link>
        </>
      )}
      {seciliProje && (
        <>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <Link
            href={paramliYol({ proje: seciliProje.id, kanal: undefined })}
            className={seciliKanal ? "hover:text-panel-primary" : "font-semibold text-panel-text"}
          >
            {seciliProje.ad}
          </Link>
        </>
      )}
      {seciliKanal && (
        <>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="font-semibold text-panel-text">{KANAL_ETIKET[seciliKanal]}</span>
        </>
      )}
    </div>
  );
}

function KategoriKutulari({
  kategoriler,
  projeSayisi,
  paramliYol,
}: {
  kategoriler: { id: string; ad: string; slug: string }[];
  projeSayisi: Map<string, number>;
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  if (kategoriler.length === 0) {
    return <BosDurum ikon="category" baslik="Kategori bulunamadı" />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {kategoriler.map((k) => (
        <Link
          key={k.id}
          href={paramliYol({ kategori: k.slug, proje: undefined, kanal: undefined })}
          className="flex flex-col gap-1 rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm transition-colors hover:border-panel-primary hover:bg-panel-primary/5"
        >
          <span className="text-sm font-semibold text-panel-text">{k.ad}</span>
          <span className="text-xs text-panel-text-secondary">
            {projeSayisi.get(k.id) ?? 0} proje
          </span>
        </Link>
      ))}
    </div>
  );
}

function ProjeKutulari({
  kategori,
  projeler,
  paramliYol,
}: {
  kategori: { ad: string; slug: string };
  projeler: { id: string; ad: string; aktif: boolean }[];
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  if (projeler.length === 0) {
    return (
      <BosDurum
        ikon="folder_off"
        baslik={`${kategori.ad} kategorisinde henüz proje yok`}
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {projeler.map((p) => (
        <Link
          key={p.id}
          href={paramliYol({ proje: p.id, kanal: undefined })}
          className="flex flex-col gap-1 rounded-lg border border-panel-border bg-panel-surface p-4 shadow-sm transition-colors hover:border-panel-primary hover:bg-panel-primary/5"
        >
          <span className="text-sm font-semibold text-panel-text">{p.ad}</span>
          <span className="text-xs text-panel-text-secondary">
            {p.aktif ? "Aktif" : "Pasif"}
          </span>
        </Link>
      ))}
    </div>
  );
}

async function KanalKutulari({
  supabase,
  projeKullaniciIdleri,
  paramliYol,
}: {
  supabase: Awaited<ReturnType<typeof createMesajClient>>;
  projeKullaniciIdleri: string[];
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  const sayimlar =
    projeKullaniciIdleri.length === 0
      ? KANALLAR.map(() => ({ count: 0 }))
      : await Promise.all(
          KANALLAR.map((k) =>
            supabase
              .from("mesaj_istekleri")
              .select("id", { count: "exact", head: true })
              .eq("kanal", k)
              .in("proje_kullanici_id", projeKullaniciIdleri),
          ),
        );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {KANALLAR.map((k, i) => (
        <Link
          key={k}
          href={paramliYol({ kanal: k, secili: undefined, sayfa: undefined })}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-panel-border bg-panel-surface p-4 text-center shadow-sm transition-colors hover:border-panel-primary hover:bg-panel-primary/5"
        >
          <KanalRozeti kanal={k} />
          <span className="text-xs text-panel-text-secondary">
            {sayimlar[i].count ?? 0} mesaj
          </span>
        </Link>
      ))}
    </div>
  );
}

async function MesajDokumu({
  supabase,
  proje,
  kanal,
  projeKullaniciIdleri,
  params,
  paramliYol,
}: {
  supabase: Awaited<ReturnType<typeof createMesajClient>>;
  proje: { id: string; ad: string };
  kanal: Kanal;
  projeKullaniciIdleri: string[];
  params: AramaParametreleri;
  paramliYol: (ek: Record<string, string | undefined>) => string;
}) {
  const sayfa = Math.max(1, Number(params.sayfa) || 1);
  const baslangic = (sayfa - 1) * SAYFA_BOYU;

  if (projeKullaniciIdleri.length === 0) {
    return (
      <BosDurum
        ikon="forum"
        baslik={`${proje.ad} için henüz kullanıcı/mesaj kaydı yok`}
      />
    );
  }

  let sorgu = supabase
    .from("mesaj_istekleri")
    .select(
      "id, kanal, mesaj_tipi, alici_maskeli, durum, hata_kodu, idempotency_anahtari, kaynak_bolum, planlanan_zaman, created_at, updated_at",
      { count: "exact" },
    )
    .in("proje_kullanici_id", projeKullaniciIdleri)
    .eq("kanal", kanal)
    .order("created_at", { ascending: false })
    .range(baslangic, baslangic + SAYFA_BOYU - 1);

  if (params.durum) sorgu = sorgu.eq("durum", params.durum);

  const [{ data: istekler, count }, { data: dagilimOrneklemi }] = await Promise.all([
    sorgu,
    supabase
      .from("mesaj_istekleri")
      .select("kaynak_bolum")
      .in("proje_kullanici_id", projeKullaniciIdleri)
      .eq("kanal", kanal)
      .order("created_at", { ascending: false })
      .limit(BOLUM_DAGILIMI_ORNEKLEM),
  ]);

  const seciliIstek = params.secili
    ? (istekler ?? []).find((i) => i.id === params.secili) ??
      (
        await supabase
          .from("mesaj_istekleri")
          .select(
            "id, kanal, mesaj_tipi, alici_maskeli, durum, hata_kodu, idempotency_anahtari, kaynak_bolum, planlanan_zaman, created_at, updated_at",
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

  const bolumDagilimi = new Map<string, number>();
  for (const kayit of dagilimOrneklemi ?? []) {
    const etiket = kayit.kaynak_bolum ?? "Belirtilmemiş";
    bolumDagilimi.set(etiket, (bolumDagilimi.get(etiket) ?? 0) + 1);
  }
  const bolumDagilimiSirali = [...bolumDagilimi.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-panel-text-secondary">
          {proje.ad} · {KANAL_ETIKET[kanal]} · {count ?? 0} kayıt
        </p>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="gorunum" value="projeler" />
          <input type="hidden" name="kategori" value={params.kategori ?? ""} />
          <input type="hidden" name="proje" value={proje.id} />
          <input type="hidden" name="kanal" value={kanal} />
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
      </div>

      {bolumDagilimiSirali.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-panel-border bg-panel-surface p-3 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-panel-text-secondary">
            Bölüm dağılımı
          </span>
          {bolumDagilimiSirali.map(([bolum, adet]) => (
            <span
              key={bolum}
              className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-panel-canvas px-2 py-0.5 text-xs text-panel-text"
            >
              {bolum}
              <span className="font-semibold text-panel-primary">{adet}</span>
            </span>
          ))}
        </div>
      )}

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
                  <th className="px-4 py-2 font-medium">Saat</th>
                  <th className="px-4 py-2 font-medium">Bölüm</th>
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
                      <Link href={paramliYol({ secili: i.id })} className="block text-panel-text">
                        {i.kaynak_bolum ?? "—"}
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
              <DetayAlani etiket="Bölüm" deger={seciliIstek.kaynak_bolum ?? "—"} />
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

function BosDurum({ ikon, baslik }: { ikon: string; baslik: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-panel-border py-16 text-center">
      <span className="material-symbols-outlined mb-2 text-[28px] text-panel-text-disabled">
        {ikon}
      </span>
      <p className="text-sm font-medium text-panel-text">{baslik}</p>
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

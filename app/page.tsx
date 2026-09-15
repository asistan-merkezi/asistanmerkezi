import Link from "next/link";
import type { SVGProps } from "react";
import { createClient } from "@/lib/supabase/server";

type Durum = "Öncelikli" | "Geliştirmede" | "Planlandı";

const DURUM_ROZET: Record<Durum, string> = {
  Öncelikli: "bg-brand-primary-tint text-brand-primary",
  Geliştirmede: "bg-brand-dev-bg text-brand-dev-text",
  Planlandı: "bg-brand-planned-bg text-brand-planned-text",
};

const ONE_CIKAN_MODULLER: {
  ad: string;
  aciklama: string;
  durum: Durum;
  ikon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  ozellikler?: string[];
  not: string;
}[] = [
  {
    ad: "Muayene & Sağlık — Klinik Asistanı",
    aciklama:
      "Randevu, hasta takibi ve oda yönetimini yapay zekâ destekli tek panelde toplayın. Kliniğiniz için özel olarak geliştiriliyor.",
    durum: "Öncelikli",
    ikon: IkonKlinik,
    ozellikler: [
      "Randevu ve oda takibi",
      "WhatsApp & SMS ile hasta iletişimi",
      "Otomatik randevu hatırlatmaları",
    ],
    not: "Önceliğimiz",
  },
  {
    ad: "Okul & Kreş Yönetim",
    aciklama:
      "Kayıttan devam takibine, veli iletişiminden tahsilata kadar eğitim kurumunuzun tüm idari akışını otomatize edin.",
    durum: "Geliştirmede",
    ikon: IkonOkul,
    not: "okulcrm.net",
  },
];

const DIGER_MODULLER: {
  ad: string;
  aciklama: string;
  durum: Durum;
  ikon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  not: string;
}[] = [
  {
    ad: "Catering & Yeme-İçme",
    aciklama:
      "Davet ve etkinlik teklifleri, menü maliyeti ve tedarik sürecini tek ekrandan yönetin.",
    durum: "Geliştirmede",
    ikon: IkonCatering,
    not: "villavillaasistan.com",
  },
  {
    ad: "Borsa & Ev Ekonomisi",
    aciklama:
      "Portföyünüzü ve hane bütçenizi tek yerden izleyin, yapay zekâ yorumuyla değerlendirin.",
    durum: "Geliştirmede",
    ikon: IkonBorsa,
    not: "borsaasistan.com",
  },
  {
    ad: "Sosyal Medya & Dijital Pazarlama",
    aciklama:
      "İçerik takvimi ve paylaşımlarınızı asistan desteğiyle planlayın.",
    durum: "Geliştirmede",
    ikon: IkonSosyalMedya,
    not: "medyaasistan.com",
  },
];

const PLANLANAN_MODULLER: { ad: string; ikon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element }[] = [
  { ad: "Otel & Konaklama", ikon: IkonOtel },
  { ad: "Market / Tekel / Mağaza", ikon: IkonMarket },
  { ad: "Sekreterya / Arama / Randevu Takip", ikon: IkonSekreterya },
];

const ADIMLAR = [
  {
    baslik: "Sektörünüzü Seçin, Kayıt Olun",
    aciklama: "İşletme bilgilerinizi girin; kredi kartı istemeden 30 günlük deneme hesabınız hemen açılır.",
  },
  {
    baslik: "30 Gün Ücretsiz Deneyin",
    aciklama: "Modülü gerçek verilerinizle test edin. Abonelik başlamadan hiçbir ücret alınmaz.",
  },
  {
    baslik: "İletişim Kanallarınızı Bağlayın",
    aciklama: "WhatsApp, SMS, e-posta ve Telegram bildirimlerini tek kimlikle etkinleştirin.",
  },
];

const OZELLIKLER = [
  {
    baslik: "30 Gün Ücretsiz Deneme",
    aciklama: "Kart bilgisi istemeden başlar; abonelik başlayınca kaldığınız yerden devam eder.",
    ikon: IkonCheck,
  },
  {
    baslik: "Tek Panelden Yönetim",
    aciklama: "Hangi modülü kullanırsanız kullanın, kayıt ve abonelik tek merkezden yönetilir.",
    ikon: IkonKalkan,
  },
  {
    baslik: "SMS · WhatsApp · E-posta · Telegram",
    aciklama: "Tüm modüllerin müşteri bildirimleri ortak mesaj merkezinden, tek kimlikle gönderilir.",
    ikon: IkonSosyalMedya,
  },
  {
    baslik: "Kiracı Bazlı Veri İzolasyonu",
    aciklama: "Her işletmenin verisi veritabanı düzeyinde ayrıştırılır, birbirine karışmaz.",
    ikon: IkonSekreterya,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <div className="flex flex-1 flex-col bg-brand-surface text-brand-text">
      <header className="sticky top-0 z-20 border-b border-brand-border bg-brand-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white">
              A
            </span>
            <span className="text-lg font-bold tracking-tight text-brand-primary">
              Asistan Merkezi
            </span>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            <a href="#moduller" className="text-sm font-medium text-brand-text-secondary transition-colors hover:text-brand-text">
              Sektörel Çözümler
            </a>
            <a href="#nasil-calisir" className="text-sm font-medium text-brand-text-secondary transition-colors hover:text-brand-text">
              Nasıl Çalışır?
            </a>
            <a href="#neden" className="text-sm font-medium text-brand-text-secondary transition-colors hover:text-brand-text">
              Özellikler
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
              >
                Panele Git
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-text-secondary transition-colors hover:text-brand-text"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
                >
                  Ücretsiz Deneyin
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 lg:py-24">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(#115e59 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-12 lg:gap-8 lg:px-8">
            <div className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-primary-tint px-3.5 py-1.5 text-brand-primary">
                <span className="h-2 w-2 rounded-full bg-brand-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Sektörel Yapay Zekâ Asistanları
                </span>
              </div>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-brand-text sm:text-5xl">
                İşletmenizi yöneten yapay zekâ,{" "}
                <span className="text-brand-primary">sektörünüze özel.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-text-secondary">
                8 farklı sektör için tasarlanan, 30 gün ücretsiz denemeli
                asistan modülleriyle operasyonunuzu tek merkezden yürütün.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={session ? "/dashboard" : "/register"}
                  className="rounded-2xl bg-brand-primary px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-brand-primary-hover hover:shadow-md active:scale-[0.98]"
                >
                  {session ? "Panele Git" : "Ücretsiz Deneyin"}
                </Link>
                <a
                  href="#moduller"
                  className="rounded-2xl border border-brand-border bg-brand-surface px-7 py-3.5 text-base font-semibold text-brand-text shadow-sm transition-colors hover:bg-brand-surface-alt"
                >
                  Modülleri İncele
                </a>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm text-brand-text-secondary">
                <IkonKalkan className="h-[18px] w-[18px] text-brand-primary" />
                <span>Kredi kartı gerekmez · KVKK uyumlu veri izolasyonu</span>
              </div>
            </div>

            {/* Illustrative örnek konuşma mockup'ı */}
            <div className="relative lg:col-span-5">
              <div className="absolute -top-10 -right-10 h-72 w-72 rounded-full bg-brand-primary-tint/40 blur-3xl" />
              <div className="absolute -bottom-8 -left-8 h-60 w-60 rounded-full bg-brand-secondary-bg/60 blur-3xl" />
              <div className="relative w-full max-w-[440px] rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-xl lg:ml-auto">
                <div className="mb-4 flex items-center justify-between border-b border-brand-surface-alt pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="rounded-full bg-brand-surface-alt px-3 py-1 text-[11px] text-brand-text-secondary">
                    Klinik Asistanı · örnek görüşme
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-brand-surface-alt px-3.5 py-2.5 text-sm text-brand-text">
                    Yarın saat 14:00 için Dr. Selin Hanım&apos;a randevu alabilir miyim?
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-primary px-3.5 py-2.5 text-sm text-white">
                    Merhaba, yarın 14:00 için müsaitlik var. Randevunuzu oluşturayım mı?
                  </div>
                  <div className="flex gap-2 pl-1">
                    <span className="rounded-full bg-brand-primary-tint px-3 py-1 text-xs font-medium text-brand-primary">
                      ✓ Onayla
                    </span>
                    <span className="rounded-full bg-brand-surface-alt px-3 py-1 text-xs font-medium text-brand-text-secondary">
                      Farklı saat seç
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Modüller */}
        <section id="moduller" className="bg-brand-surface-alt py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-primary">
                  Özelleştirilmiş Sistemler
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">
                  Sektörünüzü Seçin
                </h2>
                <p className="mt-2 max-w-xl text-brand-text-secondary">
                  Her modül, kendi sektörünün iş akışına ve terminolojisine
                  göre bağımsız olarak geliştirilir.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {/* Öne çıkan bento satırı */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {ONE_CIKAN_MODULLER.map((modul, i) => (
                  <div
                    key={modul.ad}
                    className={`relative flex flex-col justify-between overflow-hidden rounded-2xl bg-brand-surface p-8 shadow-sm transition-shadow hover:shadow-md lg:p-10 ${
                      i === 0 ? "lg:col-span-8" : "lg:col-span-4"
                    }`}
                  >
                    <div>
                      <div className="mb-6 flex items-center justify-between">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full ${
                            modul.durum === "Öncelikli" ? "bg-brand-primary-tint text-brand-primary" : "bg-brand-surface-alt text-brand-text-secondary"
                          }`}
                        >
                          <modul.ikon className="h-6 w-6" />
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${DURUM_ROZET[modul.durum]}`}
                        >
                          {modul.durum}
                        </span>
                      </div>
                      <h3 className="mb-3 text-xl font-bold text-brand-text lg:text-2xl">
                        {modul.ad}
                      </h3>
                      <p className="mb-6 max-w-2xl leading-relaxed text-brand-text-secondary">
                        {modul.aciklama}
                      </p>
                      {modul.ozellikler && (
                        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {modul.ozellikler.map((oz) => (
                            <div key={oz} className="flex items-start gap-2.5 rounded-xl bg-brand-surface-alt p-3">
                              <IkonCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                              <span className="text-sm text-brand-text">{oz}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-medium text-brand-text-secondary">{modul.not}</span>
                      {i === 0 && (
                        <span className="text-sm font-medium text-brand-text-secondary">
                          30 Gün Ücretsiz Deneme
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Orta satır: eşit 3 kart */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {DIGER_MODULLER.map((modul) => (
                  <div
                    key={modul.ad}
                    className="flex flex-col justify-between rounded-2xl bg-brand-surface p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div>
                      <div className="mb-5 flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface-alt text-brand-primary">
                          <modul.ikon className="h-[22px] w-[22px]" />
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${DURUM_ROZET[modul.durum]}`}>
                          {modul.durum}
                        </span>
                      </div>
                      <h4 className="mb-2 text-lg font-bold text-brand-text">{modul.ad}</h4>
                      <p className="text-sm leading-relaxed text-brand-text-secondary">
                        {modul.aciklama}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-brand-surface-alt pt-4 text-sm text-brand-text-secondary">
                      <span className="font-mono text-xs">{modul.not}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Planlanan modüller şeridi */}
              <div className="rounded-2xl bg-brand-surface p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  {PLANLANAN_MODULLER.map((modul) => (
                    <div key={modul.ad} className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-surface-alt text-brand-text-secondary">
                        <modul.ikon className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-brand-text">{modul.ad}</h5>
                        <span className="text-[11px] uppercase tracking-wider text-brand-planned-text">
                          Planlandı
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Nasıl Çalışır */}
        <section id="nasil-calisir" className="py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mb-12 text-center">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-primary">
                Kolay Kurulum
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">
                Nasıl Başlarsınız?
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {ADIMLAR.map((adim, i) => (
                <div key={adim.baslik} className="rounded-2xl border border-brand-border bg-brand-surface p-6">
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mb-2 text-base font-semibold text-brand-text">{adim.baslik}</h3>
                  <p className="text-sm leading-relaxed text-brand-text-secondary">{adim.aciklama}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Neden Asistan Merkezi */}
        <section id="neden" className="bg-brand-surface-alt py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <h2 className="mb-10 text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">
              Neden Asistan Merkezi
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {OZELLIKLER.map((ozellik) => (
                <div key={ozellik.baslik} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-primary shadow-sm">
                    <ozellik.ikon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-brand-text">{ozellik.baslik}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-brand-text-secondary">{ozellik.aciklama}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-brand-primary px-8 py-10 text-center sm:flex-row sm:text-left">
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-primary-tint">
                  14 Günlük Deneme Değil, 30 Gün
                </span>
                <h2 className="text-2xl font-bold text-white">
                  İşletmeniz İçin Doğru Asistanı Birlikte Seçelim
                </h2>
              </div>
              <Link
                href={session ? "/dashboard" : "/register"}
                className="shrink-0 rounded-2xl bg-white px-7 py-3.5 text-base font-semibold text-brand-primary shadow-sm transition-transform hover:scale-[1.02]"
              >
                {session ? "Panele Git" : "Hemen Başlayın"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-border bg-brand-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary text-xs font-bold text-white">
                  A
                </span>
                <span className="text-base font-bold text-brand-primary">Asistan Merkezi</span>
              </div>
              <p className="mt-3 text-sm text-brand-text-secondary">
                Sektörel yapay zekâ destekli mikro-asistan modüllerini tek
                hesap ve tek mesaj altyapısı altında sunan hub platformu.
              </p>
            </div>
            <div className="flex gap-12">
              <div className="flex flex-col gap-2">
                <h4 className="mb-1 text-sm font-semibold text-brand-text">Platform</h4>
                <a href="#moduller" className="text-sm text-brand-text-secondary transition-colors hover:text-brand-primary">
                  Modüller
                </a>
                <Link href="/register" className="text-sm text-brand-text-secondary transition-colors hover:text-brand-primary">
                  Ücretsiz Deneyin
                </Link>
                <Link href="/login" className="text-sm text-brand-text-secondary transition-colors hover:text-brand-primary">
                  Giriş Yap
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-brand-border pt-6 text-sm text-brand-text-secondary sm:flex-row">
            <span>© {new Date().getFullYear()} Asistan Merkezi</span>
            <span className="flex items-center gap-1.5">
              <IkonKalkan className="h-4 w-4 text-brand-primary" />
              KVKK uyumlu, kiracı bazlı veri izolasyonu
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function IkonKlinik(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IkonOkul(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4 L21 8.5 L12 13 L3 8.5 Z" />
      <path d="M7 10.5 V15 C7 16.5 9.2 18 12 18 C14.8 18 17 16.5 17 15 V10.5" />
    </svg>
  );
}

function IkonCatering(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12 a8 6 0 0 0 16 0 Z" />
      <line x1="12" y1="4" x2="12" y2="7" />
      <line x1="8.5" y1="5" x2="8.5" y2="8" />
      <line x1="15.5" y1="5" x2="15.5" y2="8" />
    </svg>
  );
}

function IkonBorsa(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3,17 9,11 13,15 21,6" />
      <polyline points="15,6 21,6 21,12" />
    </svg>
  );
}

function IkonSosyalMedya(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5 h13 a2 2 0 0 1 2 2 v6 a2 2 0 0 1 -2 2 h-8 l-4 4 v-4 h-1 a2 2 0 0 1 -2 -2 v-6 a2 2 0 0 1 2 -2 Z" />
    </svg>
  );
}

function IkonOtel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <rect x="7" y="6" width="2" height="2" />
      <rect x="11" y="6" width="2" height="2" />
      <rect x="15" y="6" width="2" height="2" />
      <rect x="7" y="10" width="2" height="2" />
      <rect x="11" y="10" width="2" height="2" />
      <rect x="15" y="10" width="2" height="2" />
      <rect x="9" y="15" width="6" height="6" />
    </svg>
  );
}

function IkonMarket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8 h12 l-1 12 h-10 Z" />
      <path d="M9 8 v-2 a3 3 0 0 1 6 0 v2" />
    </svg>
  );
}

function IkonSekreterya(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

function IkonCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8,12.5 11,15.5 16,9" />
    </svg>
  );
}

function IkonKalkan(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z" />
      <polyline points="8.5,12 11,14.5 15.5,9.5" />
    </svg>
  );
}

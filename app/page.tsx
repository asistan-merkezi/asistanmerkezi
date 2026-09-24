import Link from "next/link";
import type { SVGProps } from "react";
import { MODULLER, IkonSosyalMedya, IkonSekreterya } from "@/lib/data/moduller";

const ADIMLAR = [
  {
    baslik: "Sektörünüzü Seçin, Kayıt Olun",
    aciklama: "İşletme bilgilerinizi girin; kredi kartı istemeden 21 günlük deneme hesabınız hemen açılır.",
  },
  {
    baslik: "21 Gün Ücretsiz Deneyin",
    aciklama: "Modülü gerçek verilerinizle test edin. Abonelik başlamadan hiçbir ücret alınmaz.",
  },
  {
    baslik: "İletişim Kanallarınızı Bağlayın",
    aciklama: "WhatsApp, SMS, e-posta ve Telegram bildirimlerini kendi işletme kimliğinizle etkinleştirin.",
  },
];

const OZELLIKLER = [
  {
    baslik: "21 Gün Ücretsiz Deneme",
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
    aciklama: "Tüm mesajlar, ortak mesaj merkezi üzerinden işletmenizin kendi gönderen kimliği ve adıyla iletilir.",
    ikon: IkonSosyalMedya,
  },
  {
    baslik: "Kiracı Bazlı Veri İzolasyonu",
    aciklama: "Her işletmenin verisi veritabanı düzeyinde ayrıştırılır, birbirine karışmaz.",
    ikon: IkonSekreterya,
  },
];

// Panel girişini (/yonetim/mesaj) yalnız 3-5 kişilik ekip kullanıyor —
// ana sayfanın birincil CTA'ları (header/hero/alt banner) bu yüzden
// oturuma bakmaksızın her zaman genel "Ücretsiz Deneyin" akışına gider;
// panel erişimi yalnız footer'daki küçük "Panel" linkinden.
const DENEME_HREF = "/sektor-secimi";

export default function Home() {
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
            <Link
              href="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-text-secondary transition-colors hover:text-brand-text"
            >
              Giriş Yap
            </Link>
            <Link
              href={DENEME_HREF}
              className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
            >
              Ücretsiz Deneyin
            </Link>
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
                {MODULLER.length} farklı sektör için tasarlanan, 21 gün
                ücretsiz denemeli asistan modülleriyle operasyonunuzu tek
                merkezden yürütün.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={DENEME_HREF}
                  className="rounded-2xl bg-brand-primary px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-brand-primary-hover hover:shadow-md active:scale-[0.98]"
                >
                  Ücretsiz Deneyin
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
                  göre bağımsız olarak geliştiriliyor.
                </p>
              </div>
              <span className="rounded-full bg-brand-dev-bg px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-dev-text">
                Tüm modüller geliştirme aşamasında
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {MODULLER.map((modul) => (
                <div
                  key={modul.ad}
                  className="flex flex-col justify-between rounded-2xl bg-brand-surface p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div>
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface-alt text-brand-primary">
                        <modul.ikon className="h-[22px] w-[22px]" />
                      </div>
                      <span className="rounded-full bg-brand-dev-bg px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-dev-text">
                        Geliştirmede
                      </span>
                    </div>
                    <h4 className="mb-2 text-lg font-bold text-brand-text">{modul.ad}</h4>
                    <p className="text-sm leading-relaxed text-brand-text-secondary">
                      {modul.aciklama}
                    </p>
                  </div>
                </div>
              ))}
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
            <div className="mt-10 flex items-start gap-4 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary-tint text-brand-primary">
                <IkonKalkan className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-brand-text">Verileriniz Türkiye&apos;de</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-text-secondary">
                  Tüm veriler yurt içindeki yerel sunucularda, KVKK&apos;ya uygun şekilde güvenle saklanmaktadır.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-brand-primary px-8 py-10 text-center sm:flex-row sm:text-left">
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-primary-tint">
                  14 Günlük Deneme Değil, 21 Gün
                </span>
                <h2 className="text-2xl font-bold text-white">
                  İşletmeniz İçin Doğru Asistanı Birlikte Seçelim
                </h2>
              </div>
              <Link
                href={DENEME_HREF}
                className="shrink-0 rounded-2xl bg-white px-7 py-3.5 text-base font-semibold text-brand-primary shadow-sm transition-transform hover:scale-[1.02]"
              >
                Hemen Başlayın
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
                <Link href={DENEME_HREF} className="text-sm text-brand-text-secondary transition-colors hover:text-brand-primary">
                  Ücretsiz Deneyin
                </Link>
                <Link href="/login" className="text-sm text-brand-text-secondary transition-colors hover:text-brand-primary">
                  Giriş Yap
                </Link>
                <Link href="/yonetim/mesaj" className="text-sm text-brand-text-secondary transition-colors hover:text-brand-primary">
                  Panel
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-brand-border pt-6 text-sm text-brand-text-secondary sm:flex-row">
            <span>© {new Date().getFullYear()} Asistan Merkezi</span>
            <span className="flex items-center gap-1.5">
              <IkonKalkan className="h-4 w-4 text-brand-primary" />
              KVKK uyumlu · Veriler yurt içinde saklanır
            </span>
          </div>
        </div>
      </footer>
    </div>
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

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MODULLER = [
  {
    ad: "Catering & Yeme-İçme",
    aciklama: "Davet ve etkinlik yemek operasyonunu uçtan uca yönetin.",
    domain: "villavillaasistan.com",
    durum: "Geliştirmede",
  },
  {
    ad: "Okul & Kreş Yönetim",
    aciklama: "Kayıt, veli iletişimi ve devam takibini tek panelde toplayın.",
    domain: "okulcrm.net",
    durum: "Geliştirmede",
  },
  {
    ad: "Muayene & Sağlık",
    aciklama: "Klinik randevu, hatırlatma ve hasta iletişimini otomatikleştirin.",
    domain: null,
    durum: "Öncelikli",
  },
  {
    ad: "Otel & Konaklama",
    aciklama: "Rezervasyon ve misafir iletişimini merkezi asistanla yürütün.",
    domain: null,
    durum: "Planlandı",
  },
  {
    ad: "Market / Tekel / Mağaza",
    aciklama: "Stok ve müşteri bildirimlerini tek yerden yönetin.",
    domain: null,
    durum: "Planlandı",
  },
  {
    ad: "Sekreterya / Arama / Randevu Takip",
    aciklama: "Gelen aramaları ve randevuları asistan desteğiyle takip edin.",
    domain: null,
    durum: "Planlandı",
  },
  {
    ad: "Borsa & Ev Ekonomisi",
    aciklama: "Portföy ve hane bütçesini yapay zekâ yorumuyla izleyin.",
    domain: "borsaasistan.com",
    durum: "Geliştirmede",
  },
  {
    ad: "Sosyal Medya & Dijital Pazarlama",
    aciklama: "İçerik takvimi ve paylaşımlarını asistan desteğiyle planlayın.",
    domain: "medyaasistan.com",
    durum: "Geliştirmede",
  },
] as const;

const DURUM_STIL: Record<string, string> = {
  Öncelikli:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Geliştirmede:
    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Planlandı:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

const OZELLIKLER = [
  {
    baslik: "30 Gün Ücretsiz Deneme",
    aciklama: "Kart bilgisi istemeden başlar; abonelik başlayınca kaldığınız yerden devam eder.",
  },
  {
    baslik: "Tek Panelden Yönetim",
    aciklama: "Hangi modülü kullanırsanız kullanın, kayıt ve abonelik tek merkezden yönetilir.",
  },
  {
    baslik: "SMS · WhatsApp · E-posta · Telegram",
    aciklama: "Tüm modüllerin müşteri bildirimleri ortak mesaj merkezinden, tek kimlikle gönderilir.",
  },
  {
    baslik: "Kiracı Bazlı Veri İzolasyonu",
    aciklama: "Her işletmenin verisi veritabanı düzeyinde ayrıştırılır, birbirine karışmaz.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-black/[.08] bg-zinc-50/80 backdrop-blur dark:border-white/[.145] dark:bg-black/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Asistan Merkezi
          </span>
          <nav className="flex items-center gap-3">
            {session ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Panele Git
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.06] dark:text-zinc-50 dark:hover:bg-white/[.08]"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                >
                  Ücretsiz Dene
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
            Sektörünüze özel, yapay zekâ destekli mikro-asistanlar
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Asistan Merkezi; catering, klinik, okul, otel, market, borsa ve
            dijital pazarlama işletmeleri için hazırlanmış bağımsız asistan
            modüllerini tek bir hesap ve tek bir mesaj altyapısı altında
            birleştirir.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={session ? "/dashboard" : "/register"}
              className="w-full rounded-full bg-foreground px-6 py-3 text-base font-medium text-background transition-colors hover:bg-[#383838] sm:w-auto dark:hover:bg-[#ccc]"
            >
              {session ? "Panele Git" : "30 Gün Ücretsiz Dene"}
            </Link>
            <a
              href="#moduller"
              className="w-full rounded-full border border-black/[.08] px-6 py-3 text-base font-medium text-black transition-colors hover:bg-black/[.04] sm:w-auto dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
            >
              Modülleri İncele
            </a>
          </div>
        </section>

        <section id="moduller" className="border-t border-black/[.08] bg-white py-20 dark:border-white/[.145] dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Modüller
            </h2>
            <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
              Her modül kendi bağımsız domaininde çalışır; kiracı yaşam
              döngüsü ve mesajlaşma altyapısı Asistan Merkezi&apos;nden
              yönetilir.
            </p>
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULLER.map((modul) => (
                <li
                  key={modul.ad}
                  className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]"
                >
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${DURUM_STIL[modul.durum]}`}
                  >
                    {modul.durum}
                  </span>
                  <h3 className="text-base font-semibold text-black dark:text-zinc-50">
                    {modul.ad}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {modul.aciklama}
                  </p>
                  {modul.domain && (
                    <span className="mt-auto font-mono text-xs text-zinc-400 dark:text-zinc-600">
                      {modul.domain}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Neden Asistan Merkezi
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {OZELLIKLER.map((ozellik) => (
                <li key={ozellik.baslik}>
                  <h3 className="text-base font-semibold text-black dark:text-zinc-50">
                    {ozellik.baslik}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {ozellik.aciklama}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[.08] py-10 dark:border-white/[.145]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-zinc-500 sm:flex-row dark:text-zinc-500">
          <span>© {new Date().getFullYear()} Asistan Merkezi</span>
          <div className="flex items-center gap-6">
            <span className="text-zinc-400 dark:text-zinc-600">
              Kullanım Kılavuzu (yakında)
            </span>
            <Link href="/login" className="hover:text-black dark:hover:text-zinc-50">
              Giriş Yap
            </Link>
            <Link href="/register" className="hover:text-black dark:hover:text-zinc-50">
              Kayıt Ol
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

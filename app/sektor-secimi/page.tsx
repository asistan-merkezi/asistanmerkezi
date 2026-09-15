import Link from "next/link";
import { MODULLER } from "@/lib/data/moduller";

export const metadata = {
  title: "Sektörünüzü Seçin — Asistan Merkezi",
};

export default function SektorSecimiPage() {
  return (
    <div className="flex flex-1 flex-col bg-brand-surface text-brand-text">
      <header className="border-b border-brand-border bg-brand-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white">
              A
            </span>
            <span className="text-lg font-bold tracking-tight text-brand-primary">
              Asistan Merkezi
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">
            Sektörünüzü Seçin
          </h1>
          <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-brand-dev-bg px-6 py-4 text-sm font-medium text-brand-dev-text">
            Bütün projeler geliştirme aşamasındadır. Şu anda hiçbir modül
            için canlı kayıt almıyoruz; aşağıdan ilgilendiğiniz sektörü
            görebilirsiniz.
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULLER.map((modul) => (
              <div
                key={modul.ad}
                className="flex flex-col justify-between rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-sm"
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
                  <h2 className="mb-2 text-lg font-bold text-brand-text">{modul.ad}</h2>
                  <p className="text-sm leading-relaxed text-brand-text-secondary">
                    {modul.aciklama}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center text-sm text-brand-text-secondary">
            <p>
              Yine de bir deneme hesabı oluşturmak isterseniz{" "}
              <Link href="/register" className="font-semibold text-brand-primary hover:underline">
                kayıt formuna
              </Link>{" "}
              gidebilirsiniz.
            </p>
            <p className="mt-2">
              <Link href="/" className="font-semibold text-brand-primary hover:underline">
                ← Ana sayfaya dön
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

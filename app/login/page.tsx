import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; mesaj?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-brand-surface-alt">
      <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white">
            A
          </span>
          <span className="text-lg font-bold tracking-tight text-brand-primary">
            Asistan Merkezi
          </span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-brand-surface p-8 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-brand-text">Giriş Yap</h1>
          <p className="mb-6 text-sm text-brand-text-secondary">
            Hesabınıza erişmek için bilgilerinizi girin.
          </p>

          {params.mesaj && (
            <p className="mb-4 rounded-xl bg-brand-primary-tint px-3 py-2 text-sm text-brand-primary">
              {params.mesaj}
            </p>
          )}
          {params.hata && (
            <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {params.hata}
            </p>
          )}

          <form action={login} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-brand-text-secondary">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-brand-text outline-none transition-colors focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-brand-text-secondary">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-brand-text outline-none transition-colors focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              Giriş Yap
            </button>
          </form>

          <p className="mt-6 text-sm text-brand-text-secondary">
            Hesabın yok mu?{" "}
            <Link href="/register" className="font-semibold text-brand-primary hover:underline">
              Kayıt ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

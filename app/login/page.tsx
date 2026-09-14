import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; mesaj?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Giriş Yap
        </h1>

        {params.mesaj && (
          <p className="mb-4 rounded bg-black/[.06] px-3 py-2 text-sm text-black dark:bg-white/[.08] dark:text-zinc-50">
            {params.mesaj}
          </p>
        )}
        {params.hata && (
          <p className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {params.hata}
          </p>
        )}

        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-zinc-600 dark:text-zinc-400">
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-zinc-600 dark:text-zinc-400">
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50"
            />
          </div>
          <button
            type="submit"
            className="mt-2 rounded-full bg-foreground px-5 py-2.5 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Giriş Yap
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Hesabın yok mu?{" "}
          <Link href="/register" className="font-medium text-black underline dark:text-zinc-50">
            Kayıt ol
          </Link>
        </p>
      </div>
    </div>
  );
}

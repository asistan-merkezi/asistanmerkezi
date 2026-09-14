import Link from "next/link";
import { register } from "./actions";
import { TamYetkiliAlani } from "./tam-yetkili-alani";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-lg rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Kayıt Ol
        </h1>

        {params.hata && (
          <p className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {params.hata}
          </p>
        )}

        <form action={register} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm font-semibold text-black dark:text-zinc-50">
              Kişisel Bilgiler
            </legend>
            <Alan id="adSoyad" etiket="Ad Soyad" />
            <Alan id="gorev" etiket="Görev / Unvan" />
            <Alan id="email" etiket="E-posta" tip="email" />
            <Alan id="password" etiket="Şifre" tip="password" minLength={6} />
          </fieldset>

          <fieldset className="flex flex-col gap-4 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
            <legend className="mb-1 text-sm font-semibold text-black dark:text-zinc-50">
              İşletme Bilgileri
            </legend>
            <Alan id="sirketAdi" etiket="Şirket Adı" />
            <Alan id="vergiDairesi" etiket="Vergi Dairesi" />
            <Alan
              id="vergiNo"
              etiket="Vergi No / TC Kimlik No"
              inputMode="numeric"
              pattern="\d{10,11}"
            />
          </fieldset>

          <TamYetkiliAlani />

          <label className="flex items-start gap-2 text-sm text-black dark:text-zinc-50">
            <input type="checkbox" name="sozlesmeOnay" required className="mt-0.5 h-4 w-4" />
            <span>Kullanım Sözleşmesi&apos;ni okudum, kabul ediyorum.</span>
          </label>

          <button
            type="submit"
            className="mt-2 rounded-full bg-foreground px-5 py-2.5 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Kayıt Ol
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-medium text-black underline dark:text-zinc-50">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}

function Alan({
  id,
  etiket,
  tip = "text",
  minLength,
  inputMode,
  pattern,
}: {
  id: string;
  etiket: string;
  tip?: string;
  minLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-zinc-600 dark:text-zinc-400">
        {etiket}
      </label>
      <input
        id={id}
        name={id}
        type={tip}
        required
        minLength={minLength}
        inputMode={inputMode}
        pattern={pattern}
        className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50"
      />
    </div>
  );
}

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
        <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-surface p-8 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-brand-text">Kayıt Ol</h1>
          <p className="mb-6 text-sm text-brand-text-secondary">
            30 gün ücretsiz deneme hesabınızı oluşturun, kredi kartı gerekmez.
          </p>

          {params.hata && (
            <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {params.hata}
            </p>
          )}

          <form action={register} className="flex flex-col gap-6">
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-1 text-sm font-semibold text-brand-text">
                Kişisel Bilgiler
              </legend>
              <Alan id="adSoyad" etiket="Ad Soyad" />
              <Alan id="gorev" etiket="Görev / Unvan" />
              <Alan id="email" etiket="E-posta" tip="email" />
              <Alan id="password" etiket="Şifre" tip="password" minLength={6} />
            </fieldset>

            <fieldset className="flex flex-col gap-4 border-t border-brand-border pt-6">
              <legend className="mb-1 text-sm font-semibold text-brand-text">
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

            <label className="flex items-start gap-2 text-sm text-brand-text">
              <input type="checkbox" name="sozlesmeOnay" required className="mt-0.5 h-4 w-4 accent-brand-primary" />
              <span>Kullanım Sözleşmesi&apos;ni okudum, kabul ediyorum.</span>
            </label>

            <button
              type="submit"
              className="mt-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              Kayıt Ol
            </button>
          </form>

          <p className="mt-6 text-sm text-brand-text-secondary">
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="font-semibold text-brand-primary hover:underline">
              Giriş yap
            </Link>
          </p>
        </div>
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
      <label htmlFor={id} className="text-sm font-medium text-brand-text-secondary">
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
        className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-brand-text outline-none transition-colors focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
      />
    </div>
  );
}

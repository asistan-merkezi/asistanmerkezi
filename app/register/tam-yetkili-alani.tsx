"use client";

import { useState } from "react";

const girdiSinifi =
  "rounded border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50";

export function TamYetkiliAlani() {
  const [tamYetkiliMi, setTamYetkiliMi] = useState(true);

  return (
    <fieldset className="flex flex-col gap-4 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
      <label className="flex items-center gap-2 text-sm text-black dark:text-zinc-50">
        <input
          type="checkbox"
          name="tamYetkiliMi"
          checked={tamYetkiliMi}
          onChange={(e) => setTamYetkiliMi(e.target.checked)}
          className="h-4 w-4"
        />
        Kayıt yapan kişi (ben) tam yetkiliyim
      </label>

      {!tamYetkiliMi && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Tam yetkili siz değilseniz bilgilerini girin — onay linkli bir
            bilgilendirme e-postası gönderilecek (CLAUDE.md §5.2).
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamYetkiliAd" className="text-sm text-zinc-600 dark:text-zinc-400">
              Tam Yetkilinin Adı Soyadı
            </label>
            <input id="tamYetkiliAd" name="tamYetkiliAd" type="text" required className={girdiSinifi} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamYetkiliEposta" className="text-sm text-zinc-600 dark:text-zinc-400">
              Tam Yetkilinin E-postası
            </label>
            <input id="tamYetkiliEposta" name="tamYetkiliEposta" type="email" required className={girdiSinifi} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamYetkiliTelefon" className="text-sm text-zinc-600 dark:text-zinc-400">
              Tam Yetkilinin Telefonu
            </label>
            <input id="tamYetkiliTelefon" name="tamYetkiliTelefon" type="tel" className={girdiSinifi} />
          </div>
        </div>
      )}
    </fieldset>
  );
}

"use client";

import { useState } from "react";

const girdiSinifi =
  "rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-brand-text outline-none transition-colors focus:border-brand-primary focus:ring-1 focus:ring-brand-primary";

export function TamYetkiliAlani() {
  const [tamYetkiliMi, setTamYetkiliMi] = useState(true);

  return (
    <fieldset className="flex flex-col gap-4 border-t border-brand-border pt-6">
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input
          type="checkbox"
          name="tamYetkiliMi"
          checked={tamYetkiliMi}
          onChange={(e) => setTamYetkiliMi(e.target.checked)}
          className="h-4 w-4 accent-brand-primary"
        />
        Kayıt yapan kişi (ben) tam yetkiliyim
      </label>

      {!tamYetkiliMi && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-brand-text-secondary">
            Tam yetkili siz değilseniz bilgilerini girin — onay linkli bir
            bilgilendirme e-postası gönderilecek (CLAUDE.md §5.2).
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamYetkiliAd" className="text-sm font-medium text-brand-text-secondary">
              Tam Yetkilinin Adı Soyadı
            </label>
            <input id="tamYetkiliAd" name="tamYetkiliAd" type="text" required className={girdiSinifi} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamYetkiliEposta" className="text-sm font-medium text-brand-text-secondary">
              Tam Yetkilinin E-postası
            </label>
            <input id="tamYetkiliEposta" name="tamYetkiliEposta" type="email" required className={girdiSinifi} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamYetkiliTelefon" className="text-sm font-medium text-brand-text-secondary">
              Tam Yetkilinin Telefonu
            </label>
            <input id="tamYetkiliTelefon" name="tamYetkiliTelefon" type="tel" className={girdiSinifi} />
          </div>
        </div>
      )}
    </fieldset>
  );
}

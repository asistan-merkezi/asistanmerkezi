-- §5.3: deneme süresi 21 gün (tanıtım metinleriyle eşitlendi). Yalnız yeni kiracıları etkiler;
-- mevcut kiracıların trial_bitis değeri değişmez.
alter table core.tenants
  alter column trial_bitis set default (now() + interval '21 days');

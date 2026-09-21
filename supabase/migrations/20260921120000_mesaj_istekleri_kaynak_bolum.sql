-- mesaj_istekleri.kaynak_bolum: alt projenin hangi iç modülünün/ekranının
-- gönderimi tetiklediğini taşır (ör. "randevu_hatirlatma", "fatura_bildirimi").
-- Opsiyonel — alt proje göndermezse null kalır, mevcut satırlar etkilenmez.
-- Mesaj Günlüğü panelinde proje → kanal drill-down'unda saat bazlı bölüm
-- kırılımını göstermek için eklendi (CLAUDE.md §6.2/§6.5).
alter table asistan_mesaj.mesaj_istekleri
  add column if not exists kaynak_bolum text;

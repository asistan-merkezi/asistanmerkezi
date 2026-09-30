-- Mesaj Merkezi'ne "Özel Proje" kategorisi: modül listesinde olmayan, müşteriye özel projeler için.
insert into asistan_mesaj.kategoriler (ad, slug, sira, aktif)
values ('Özel Proje', 'ozel-proje', 9, true)
on conflict (slug) do nothing;

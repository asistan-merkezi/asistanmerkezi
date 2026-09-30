-- "Borsa & Ev Ekonomisi" kategorisi yalnızca "Ev Ekonomisi" olur (Borsa modülü iptal edildi).
-- slug ('borsa') değişmez: dış referansları bozmamak için.
update asistan_mesaj.kategoriler
set ad = 'Ev Ekonomisi'
where slug = 'borsa';

// Sınırlı eşzamanlılıkla eşleme: en fazla `limit` iş aynı anda koşar, biten işin
// yerine hemen yenisi başlar (sabit gruplar gibi en yavaşı beklemez). Sonuç sırası
// girdi sırasıyla aynıdır. `fn` reddederse sonuç da reddeder — çağıran yakalamalı.
export async function sinirliParalel<T, R>(
  ogeler: readonly T[],
  limit: number,
  fn: (oge: T, sira: number) => Promise<R>,
): Promise<R[]> {
  const sonuclar = new Array<R>(ogeler.length);
  let siradaki = 0;
  const isci = async () => {
    while (siradaki < ogeler.length) {
      const i = siradaki++;
      sonuclar[i] = await fn(ogeler[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ogeler.length) }, isci));
  return sonuclar;
}

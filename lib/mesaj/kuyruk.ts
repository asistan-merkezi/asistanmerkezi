import "server-only";

// CLAUDE.md §2: "Kuyruk / Zamanlayıcı: Upstash QStash; yalnız mesaj
// merkezinde; QueueAdapter arkasında". Upstash hesabı/token'ı henüz
// provizyonlanmadı (§9 "Açık sorunlar") — bu yüzden gerçek QStash adapter'ı
// yerine no-op bir uygulama var. mesaj_istekleri satırı zaten "queued"
// durumunda DB'ye yazıldığı için mesaj kaybolmaz; gerçek dispatch, QStash
// token'ı sağlandığında bu arayüzün arkasına eklenecek.
export interface QueueAdapter {
  enqueue(mesajIstekId: string): Promise<void>;
}

class NoopQueueAdapter implements QueueAdapter {
  async enqueue(mesajIstekId: string): Promise<void> {
    console.log(`[kuyruk] no-op enqueue — QStash henüz bağlı değil: ${mesajIstekId}`);
  }
}

export const kuyrukAdapter: QueueAdapter = new NoopQueueAdapter();

# Karar Kayıtları (ADR, kısa)

| Karar | Neden |
|---|---|
| Tek Supabase projesi, çoklu şema | Tenant izolasyonu RLS ile tek yerde; maliyet ve operasyon tek proje |
| Doğrudan uygulama katmanı, n8n yok | İş kuralı denetlenebilir ve testlenebilir olmalı; LLM karar vermez |
| Mesaj Merkezi ayrı proje değil, aynı uygulama | Aynı DB ve auth; ekip küçük, ikinci deploy hattı gereksiz |
| QStash (Vercel cron değil) | Yalnız taşıma/zamanlama; `QueueAdapter` arkasında, değiştirilebilir. Vercel cron kullanılmaz |
| Kuyruk alt projede yerel | Merkez kesintisi mesaj kaybettirmez, hiçbir modülün girişini kilitlemez |
| Tek Meta Tech Provider app, BSP yok | Aracı marjı yok; kiracılar Embedded Signup ile kendi WABA'sını bağlar |
| Pooler session mode (5432) | Transaction mode'da "prepared statement already exists" riski (Villavilla) |
| Kredi kanal bazlı cüzdan | Kanal maliyetleri farklı; çarpan matrisine gerek kalmadan paket fiyatı kanala göre |
| Kredi rezervasyonu atomik `UPDATE … WHERE bakiye >= :adet` | `if (bakiye > 0)` yarışa açık |
| Sessiz saat 21:00–08:00, erteler | Bitiş 09:00 olursa sabah tetikleyicileri kendi kuralına takılır |
| Deneme 21 gün | Tanıtım metinleriyle eşit (2026-09-30'da 30'dan çekildi) |

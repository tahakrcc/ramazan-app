# By Ramazan - Randevu Sistemi

React web arayüzü ve WhatsApp Bot otomasyonuna sahip kapsamlı bir randevu yönetim sistemi.

## 🏗 Proje Mimarisi
Bu proje tek bir servis olarak çalışır (API + WhatsApp Bot + Cron aynı process'te):

-   Giriş noktası: `src/server.js`
-   Başlatma komutu: `npm start`
-   WhatsApp kütüphanesi: **Baileys** (`@whiskeysockets/baileys`)
-   Görevleri: Randevu mantığı, Yönetim Paneli, Veritabanı işlemleri, WhatsApp otomasyonu

## 🚀 Kurulum ve Yayınlama (Deployment)

### Ortam Değişkenleri (Environment Variables)
- `MONGO_URI`: MongoDB bağlantı adresiniz.
- `JWT_SECRET`: Yönetici girişi için gizli anahtar.
- `FRONTEND_URL`: Yayınladığınız web sitesinin adresi (CORS hatası almamak için).
- `NODE_ENV`: Yayınlarken `production` olarak ayarlayın.
- `BOT_HOOK_KEY`: (Opsiyonel) Bot hook endpoint'i için API anahtarı.

### Yerel Geliştirme (Localhost)
```bash
npm start
# src/server.js dosyasını çalıştırır — hem API hem Bot aynı anda başlatır.
```

### Yönetici Erişimi
**Güvenlik Uyarısı**: Yönetici giriş adresi güvenlik nedeniyle gizlenmiştir.
-   Giriş yolu kaynak koddaki `App.jsx` dosyasında tanımlanmıştır.
-   Bu adresi kimseyle paylaşmayın!

## 🛡 Güvenlik Özellikleri
-   **OTP Doğrulama**: Web üzerinden randevu alırken WhatsApp ile telefon doğrulaması.
-   **Hız Sınırlaması (Rate Limiting)**: Kaba kuvvet (brute-force) ve spam saldırılarına karşı koruma.
-   **Veri Doğrulama**: Joi ile input validation, NoSQL injection koruması.
-   **JWT Authentication**: Yönetici paneli için token tabanlı kimlik doğrulama.

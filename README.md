# By Ramazan - Randevu Sistemi

React web arayüzü ve WhatsApp Bot otomasyonuna sahip kapsamlı bir randevu yönetim sistemi.

## 🏗 Proje Mimarisi
Bu proje, kaynak kullanımını optimize etmek (özellikle Render Ücretsiz Paketi için) amacıyla iki ayrı servise bölünmüştür:

1.  **API Servisi (`ramazan-app-api`)**:
    -   React Frontend (Web Sitesi) ve Backend API'yi barındırır.
    -   Başlatma komutu: `npm run start:api` (`src/server-api.js` dosyasını çalıştırır).
    -   Görevleri: Randevu mantığı, Yönetim Paneli, Veritabanı işlemleri.

2.  **Bot Servisi (`ramazan-app-bot`)**:
    -   WhatsApp İstemcisini (Puppeteer) barındırır.
    -   Başlatma komutu: `npm run start:bot` (`src/server-bot.js` dosyasını çalıştırır).
    -   Görevleri: WhatsApp otomasyonu, QR Kod oluşturma (loglar üzerinden).

## 🚀 Kurulum ve Yayınlama (Deployment)

### Ortam Değişkenleri (Environment Variables)
Her iki servis de aşağıdaki değişkenlere ihtiyaç duyar:
- `MONGODB_URI`: MongoDB bağlantı adresiniz.
- `JWT_SECRET`: Yönetici girişi için gizli anahtar.
- `FRONTEND_URL`: Yayınladığınız web sitesinin adresi (CORS hatası almamak için).
- `NODE_ENV`: Yayınlarken `production` olarak ayarlayın.

### Yerel Geliştirme (Localhost)
Hepsini tek seferde yerel bilgisayarınızda çalıştırmak için:
```bash
npm start
# src/server.js dosyasını çalıştırır, bu da hem API hem Botu aynı anda başlatır.
```

### Yönetici Erişimi
**Güvenlik Uyarısı**: Yönetici giriş adresi güvenlik nedeniyle gizlenmiştir.
-   Giriş Yolu: `/gizli-yonetici-girisi` (Bu adresi kimseyle paylaşmayın!)

## 🛡 Güvenlik Özellikleri
-   **Ayrıştırılmış Mimari**: Çok RAM tüketen Bot işlemi ana sunucudan ayrıldı.
-   **Gizli Rotalar**: Yönetici giriş sayfası gizlendi.
-   **Hız Sınırlaması (Rate Limiting)**: Kaba kuvvet (brute-force) ve spam saldırılarına karşı koruma.
-   **Veri Temizliği**: NoSQL injection ve XSS saldırılarına karşı koruma modülleri aktif.

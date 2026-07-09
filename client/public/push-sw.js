self.addEventListener('push', function(event) {
    if (event.data) {
        let data = {};
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Yeni Bildirim', body: event.data.text() };
        }
        
        const options = {
            body: data.body,
            icon: '/pwa-192x192.png',
            badge: '/masked-icon.svg',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2'
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'By Ramazan', options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

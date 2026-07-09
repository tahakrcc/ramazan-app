import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import API from '../utils/api';

const PWAPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

    useEffect(() => {
        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        // Detect Standalone (already installed)
        const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setIsStandalone(standalone);

        // Listen for beforeinstallprompt (Android/Chrome)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e; // Save globally for Nav button
            // Dispatch custom event for Nav
            window.dispatchEvent(new Event('deferredPromptReady'));
            setDeferredPrompt(e);
            if (!standalone) {
                setShowInstallPrompt(true);
            }
        });

        // If iOS and not installed, show hint
        if (ios && !standalone) {
            setShowInstallPrompt(true);
        }

        // Check Notification Permission
        if ('Notification' in window && 'serviceWorker' in navigator && standalone) {
            if (Notification.permission === 'default') {
                setShowNotificationPrompt(true);
            } else if (Notification.permission === 'granted') {
                // Ensure subscription exists if granted
                subscribeToPush();
            }
        }
    }, []);

    const handleInstallClick = async () => {
        const promptEvent = deferredPrompt || window.deferredPrompt;
        if (promptEvent) {
            promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                window.deferredPrompt = null;
                setShowInstallPrompt(false);
            }
        }
    };

    const subscribeToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Check existing subscription
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                await sendSubscriptionToBackend(existingSubscription);
                return;
            }

            // Subscribe
            const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            await sendSubscriptionToBackend(subscription);
            toast.success("Bildirimler başarıyla açıldı!");
            setShowNotificationPrompt(false);
        } catch (error) {
            console.error("Push subscription failed:", error);
            if (!sessionStorage.getItem('pushFailed')) {
                toast.error("Bildirimlere abone olunamadı.");
                sessionStorage.setItem('pushFailed', 'true');
            }
        }
    };

    const requestNotificationPermission = async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await subscribeToPush();
        } else {
            setShowNotificationPrompt(false);
        }
    };

    const sendSubscriptionToBackend = async (subscription) => {
        const phone = localStorage.getItem('byramazan_phone');
        if (!phone) return; // Wait until they book an appointment to attach phone

        try {
            await API.post('/notifications/subscribe', {
                subscription,
                phone
            });
        } catch (error) {
            console.error("Failed to send subscription", error);
        }
    };

    // Helper for VAPID key
    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    if (isStandalone && !showNotificationPrompt) return null;

    return (
        <AnimatePresence>
            {/* INSTALL PROMPT */}
            {showInstallPrompt && !isStandalone && (
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm"
                >
                    <div className="bg-dark-900 border border-gold-500/30 rounded-lg p-6 md:p-8 max-w-sm w-full text-center relative shadow-[0_0_40px_rgba(212,175,55,0.1)]">
                        <button 
                            onClick={() => setShowInstallPrompt(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl"
                        >
                            ✕
                        </button>
                        <img src="/pwa-192x192.png" alt="App Icon" className="w-20 h-20 rounded-2xl mx-auto mb-6 shadow-lg object-cover" />
                        <h4 className="text-white text-xl font-serif font-bold mb-2">Uygulamamızı İndirin</h4>
                        <p className="text-gray-400 text-sm mb-8">Daha hızlı randevu almak ve hatırlatıcı bildirimleri kaçırmamak için kurun.</p>
                        
                        {isIOS ? (
                            <div className="text-xs text-gray-300 bg-white/5 p-4 rounded border border-white/10 text-center leading-relaxed">
                                Safari'de <span className="text-blue-400 font-bold">Paylaş</span> ikonuna tıklayıp <br/> 
                                <span className="text-white font-bold">"Ana Ekrana Ekle"</span> seçeneğini kullanın.
                            </div>
                        ) : (
                            <button 
                                onClick={handleInstallClick}
                                className="w-full bg-gold-500 text-dark-950 font-bold uppercase tracking-wider text-sm px-6 py-4 rounded-sm hover:bg-white transition-colors"
                            >
                                Hemen Yükle
                            </button>
                        )}
                        <button onClick={() => setShowInstallPrompt(false)} className="mt-4 text-xs text-gray-500 hover:text-white underline">Daha Sonra</button>
                    </div>
                </motion.div>
            )}

            {/* NOTIFICATION PROMPT */}
            {showNotificationPrompt && isStandalone && (
                <motion.div 
                    initial={{ y: 100, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-0 left-0 w-full bg-dark-900 border-t border-gold-500/30 p-4 z-50 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                    <div className="text-left">
                        <h4 className="text-white font-serif font-bold">Bildirimleri Açın</h4>
                        <p className="text-gray-400 text-xs md:text-sm">Randevu hatırlatıcılarınızı kaçırmamak için bildirimlere izin verin.</p>
                    </div>
                    <button 
                        onClick={requestNotificationPermission}
                        className="bg-gold-500 text-dark-950 font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-sm hover:bg-white transition-colors"
                    >
                        İzin Ver
                    </button>
                    <button 
                        onClick={() => setShowNotificationPrompt(false)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-white"
                    >
                        ✕
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PWAPrompt;

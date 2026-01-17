import React, { useState, useEffect } from 'react';
import API from '../utils/api';

// WhatsApp servisi URL'i (harici servis için)
const WP_SERVICE_URL = import.meta.env.VITE_WP_SERVICE_URL;
const WP_API_KEY = import.meta.env.VITE_WP_API_KEY;

// Harici servise istek at
const wpFetch = async (endpoint, options = {}) => {
    // Eğer harici servis tanımlıysa onu kullan, yoksa ana API'yi kullan
    if (WP_SERVICE_URL) {
        const res = await fetch(`${WP_SERVICE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': WP_API_KEY,
                ...options.headers
            }
        });
        return res.json();
    } else {
        // Fallback: Ana API üzerinden
        if (options.method === 'POST') {
            const res = await API.post(`/admin${endpoint}`, options.body ? JSON.parse(options.body) : {});
            return res.data;
        }
        const res = await API.get(`/admin${endpoint}`);
        return res.data;
    }
};

const WhatsAppConnection = () => {
    const [status, setStatus] = useState('INITIALIZING');
    const [qr, setQr] = useState(null);
    const [phone, setPhone] = useState('');
    const [pairingCode, setPairingCode] = useState(null);
    const [pairingLoading, setPairingLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const data = await wpFetch('/status');
            // Harici servis 'ready' döner, ana API 'CONNECTED' döner - normalize et
            const normalizedStatus = data.status === 'ready' ? 'CONNECTED' :
                data.status === 'qr' ? 'QR_READY' :
                    data.status || 'INITIALIZING';
            setStatus(normalizedStatus);
            setQr(data.qr);
        } catch (error) {
            console.error('Failed to fetch WhatsApp status', error);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col items-center justify-center border border-gray-100">
            <h3 className="text-gray-900 font-bold mb-2">WhatsApp Bağlantısı</h3>
            {status === 'CONNECTED' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg">
                        <span>✅</span> Bot Aktif ve Çalışıyor
                    </div>
                    <button
                        onClick={async () => {
                            if (!window.confirm('WhatsApp bağlantısını kesmek istediğinize emin misiniz?')) return;
                            try {
                                await wpFetch('/logout', { method: 'POST' });
                                setStatus('INITIALIZING');
                            } catch (e) {
                                alert('Çıkış yapılamadı');
                            }
                        }}
                        className="text-red-600 text-sm hover:underline border border-red-200 px-3 py-1 rounded hover:bg-red-50"
                    >
                        Bağlantıyı Kes
                    </button>
                </div>
            )}
            {status === 'CONNECTING' && (
                <div className="text-orange-500 font-medium animate-pulse">
                    ⏳ Bağlanıyor...
                </div>
            )}
            {status === 'QR_READY' && qr && (
                <div className="text-center w-full max-w-sm mx-auto flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <p className="text-sm font-bold text-gray-900 mb-4">WhatsApp ile Bağla (QR Kod)</p>
                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qr)}`}
                            alt="WhatsApp QR Code"
                            className="w-52 h-52 object-contain"
                        />
                    </div>
                    <p className="text-xs text-gray-600 mt-4 font-medium max-w-xs">
                        Telefonunuzdan WhatsApp &gt; Bağlı Cihazlar &gt; Cihaz Bağla diyerek bu kodu okutunuz.
                    </p>
                    <div className="mt-4 text-[10px] text-gray-400">
                        Kod yenileniyor... (Her 15-20 saniyede bir değişebilir)
                    </div>
                </div>
            )}

            {status === 'INITIALIZING' && (
                <div className="text-gray-400 text-sm">
                    Durum kontrol ediliyor...
                </div>
            )}
        </div>
    );
};

export default WhatsAppConnection;

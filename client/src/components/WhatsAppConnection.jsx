import React, { useState, useEffect } from 'react';
import API from '../utils/api';

// WhatsApp servisi URL'i (harici servis için)
const WP_SERVICE_URL = import.meta.env.VITE_WP_SERVICE_URL;
const WP_API_KEY = import.meta.env.VITE_WP_API_KEY;

const wpFetch = async (endpoint, options = {}) => {
    // Force usage of internal API logic only
    const targetUrl = `/admin${endpoint}`;
    console.log(`[WhatsAppConnection] Using Internal API: ${targetUrl}`);

    try {
        if (options.method === 'POST') {
            const res = await API.post(targetUrl, options.body ? JSON.parse(options.body) : {});
            return res.data;
        }
        const res = await API.get(targetUrl);
        return res.data;
    } catch (error) {
        console.error('[WhatsAppConnection] API Error:', error);
        throw error;
    }
};

const WhatsAppConnection = () => {
    const [status, setStatus] = useState('INITIALIZING');
    const [qr, setQr] = useState(null);
    const [pairingCode, setPairingCode] = useState(null);
    const [phone, setPhone] = useState('');
    const [lastError, setLastError] = useState(null);

    const fetchStatus = async () => {
        try {
            const data = await wpFetch('/whatsapp/status');
            // Harici servis 'ready' döner, ana API 'CONNECTED' döner - normalize et
            const normalizedStatus = data.status === 'ready' ? 'CONNECTED' :
                data.status === 'qr' ? 'QR_READY' :
                    data.status || 'INITIALIZING';
            setStatus(normalizedStatus);
            setQr(data.qr);
            setPairingCode(data.pairingCode);
        } catch (error) {
            const errMsg = error.response?.data?.message || error.message || 'Bilinmeyen Hata';
            const statusErr = error.response?.status;
            console.error('[WhatsAppConnection] Failed:', errMsg);
            setLastError(`${statusErr ? `(${statusErr}) ` : ''}${errMsg}`);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (status === 'INITIALIZING') {
            // If stuck in initializing for too long, maybe show warning?
        }
    }, [status]);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col items-center justify-center border border-gray-100">
            <h3 className="text-gray-900 font-bold mb-2">WhatsApp Bağlantısı</h3>

            {/* DEBUG ERROR DISPLAY */}
            {lastError && (
                <div className="bg-red-100 text-red-700 p-2 rounded text-xs w-full text-center mb-2">
                    <strong>HATA:</strong> {lastError}
                </div>
            )}

            {status === 'CONNECTED' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg">
                        <span>✅</span> Bot Aktif ve Çalışıyor
                    </div>
                    <button
                        onClick={async () => {
                            if (!window.confirm('WhatsApp bağlantısını kesmek istediğinize emin misiniz?')) return;
                            try {
                                await wpFetch('/whatsapp/logout', { method: 'POST' });
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
            {status === 'PAIRING_CODE_READY' && pairingCode && (
                <div className="text-center w-full max-w-md mx-auto flex flex-col items-center animate-in fade-in zoom-in duration-300 px-4">
                    <p className="text-sm font-bold text-gray-900 mb-4">WhatsApp ile Bağla (Pairing Code)</p>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 md:p-8 rounded-2xl border-2 border-green-200 shadow-lg w-full overflow-hidden">
                        <div className="text-3xl md:text-6xl font-bold text-green-600 tracking-widest md:tracking-[0.5em] font-mono whitespace-nowrap overflow-x-auto text-center">
                            {pairingCode}
                        </div>
                    </div>
                    <div className="mt-6 space-y-2 text-left bg-blue-50 p-4 rounded-xl border border-blue-200 w-full">
                        <p className="text-xs font-bold text-gray-900">📱 Nasıl Bağlanılır:</p>
                        <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                            <li>WhatsApp'ı aç</li>
                            <li>Ayarlar → Bağlı Cihazlar</li>
                            <li>"Cihaz Bağla" → "Telefon numarasıyla bağla"</li>
                            <li>Yukarıdaki 8 haneli kodu gir</li>
                        </ol>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3">
                        Kod 1 dakika içinde geçersiz olacak
                    </p>
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

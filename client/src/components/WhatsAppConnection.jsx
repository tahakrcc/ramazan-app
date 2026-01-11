import React, { useState, useEffect } from 'react';
import API from '../utils/api';

const WhatsAppConnection = () => {
    const [status, setStatus] = useState('INITIALIZING');
    const [qr, setQr] = useState(null);
    const [phone, setPhone] = useState('');
    const [pairingCode, setPairingCode] = useState(null);
    const [pairingLoading, setPairingLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await API.get('/admin/whatsapp-status');
            setStatus(res.data.status);
            setQr(res.data.qr);
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
                                await API.post('/admin/whatsapp-logout');
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
            {status === 'QR_READY' && !pairingCode && (
                <div className="text-center w-full">
                    {qr && (
                        <div className="mb-6">
                            <p className="text-sm text-gray-500 mb-2">Seçenek 1: QR Kodu Okutun</p>
                            <div className="p-2 bg-white border border-gray-200 rounded-lg inline-block">
                                <img src={qr} alt="WhatsApp QR" className="w-48 h-48" />
                            </div>
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-6 mt-6 w-full max-w-sm mx-auto">
                        <p className="text-sm font-bold text-gray-900 mb-4">Seçenek 2: Telefon Numarası ile Bağla (Kodla)</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="905xxxxxxxxx"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 font-medium"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                            <button
                                onClick={async () => {
                                    if (!phone) return;
                                    setPairingLoading(true);
                                    try {
                                        const res = await API.post('/admin/whatsapp-pair', { phone });
                                        setPairingCode(res.data.code);
                                    } catch (err) {
                                        console.error('Pairing error full:', err);
                                        const errorMsg = err.response?.data?.error || err.message || JSON.stringify(err);
                                        alert('Kod alınamadı: ' + errorMsg);
                                    } finally {
                                        setPairingLoading(false);
                                    }
                                }}
                                disabled={pairingLoading}
                                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-800"
                            >
                                {pairingLoading ? '...' : 'Kod Al'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 text-left font-medium">Başında + olmadan yazınız (Örn: 905321234567)</p>
                    </div>
                </div>
            )}

            {status === 'QR_READY' && pairingCode && (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                    <p className="text-gray-600 mb-4">WhatsApp &gt; Bağlı Cihazlar &gt; Cihaz Bağla &gt; Telefon Numarası ile Bağla</p>
                    <div className="text-4xl font-bold tracking-widest text-gray-900 bg-gray-100 p-4 rounded-xl border border-dashed border-gray-300 select-all">
                        {pairingCode}
                    </div>
                    <p className="text-xs text-orange-600 mt-4 font-medium">Bu kodu telefonunuza giriniz.</p>
                    <button onClick={() => setPairingCode(null)} className="mt-4 text-sm text-gray-500 underline">Geri Dön</button>
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

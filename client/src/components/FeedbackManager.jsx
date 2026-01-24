import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { Check, X, Trash2 } from 'lucide-react';

const FeedbackManager = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const res = await API.get('/feedbacks');
            setFeedbacks(res.data);
        } catch (error) {
            toast.error('Yorumlar yüklenemedi: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id, currentStatus) => {
        try {
            await API.put(`/feedbacks/${id}`, { isApproved: !currentStatus });
            toast.success(currentStatus ? 'Onay kaldırıldı' : 'Yorum onaylandı');
            fetchFeedbacks();
        } catch (error) {
            toast.error('İşlem başarısız');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
        try {
            await API.delete(`/feedbacks/${id}`);
            toast.success('Yorum silindi');
            fetchFeedbacks();
        } catch (error) {
            toast.error('Silinemedi');
        }
    };

    if (loading) return <div className="text-white">Yükleniyor...</div>;

    return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/5">
                <h3 className="text-xl font-serif text-white">Müşteri Yorumları</h3>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-4 p-4">
                {feedbacks.length === 0 && (
                    <div className="text-center text-gray-400 py-8">Henüz yorum yok.</div>
                )}
                {feedbacks.map(f => (
                    <div key={f._id} className="bg-dark-950/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-white font-bold">{f.customerName}</h3>
                                <span className="text-xs text-gray-500">{new Date(f.createdAt).toLocaleDateString('tr-TR')}</span>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${f.isApproved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {f.isApproved ? 'Yayında' : 'Bekliyor'}
                            </span>
                        </div>

                        <div className="flex text-gold-500">
                            {'★'.repeat(f.rating)}
                            <span className="text-gray-600 ml-1 opacity-50">{'★'.repeat(5 - f.rating)}</span>
                        </div>

                        <p className="text-gray-300 text-sm bg-white/5 p-3 rounded-lg italic">
                            "{f.comment}"
                        </p>

                        <div className="flex gap-2 pt-2 border-t border-white/5">
                            <button
                                onClick={() => handleApprove(f._id, f.isApproved)}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${f.isApproved ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-400'}`}
                            >
                                {f.isApproved ? <><X size={16} /> Yayından Kaldır</> : <><Check size={16} /> Onayla</>}
                            </button>
                            <button
                                onClick={() => handleDelete(f._id)}
                                className="p-2 bg-red-500/10 text-red-400 rounded-lg"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-4">Tarih</th>
                            <th className="p-4">Müşteri</th>
                            <th className="p-4">Puan</th>
                            <th className="p-4">Yorum</th>
                            <th className="p-4 text-center">Durum</th>
                            <th className="p-4 text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {feedbacks.length === 0 && (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">Henüz yorum yok.</td></tr>
                        )}
                        {feedbacks.map(f => (
                            <tr key={f._id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-gray-400 font-mono text-xs">
                                    {new Date(f.createdAt).toLocaleDateString('tr-TR')}
                                </td>
                                <td className="p-4 font-bold text-white">{f.customerName}</td>
                                <td className="p-4 text-gold-500 text-lg">{'★'.repeat(f.rating)}</td>
                                <td className="p-4 text-gray-300 max-w-xs truncate" title={f.comment}>{f.comment}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${f.isApproved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {f.isApproved ? 'Yayında' : 'Bekliyor'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleApprove(f._id, f.isApproved)}
                                            className={`p-2 rounded transition-colors ${f.isApproved ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-white' : 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white'}`}
                                            title={f.isApproved ? 'Yayından Kaldır' : 'Onayla'}
                                        >
                                            {f.isApproved ? <X size={18} /> : <Check size={18} />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(f._id)}
                                            className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
                                            title="Sil"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FeedbackManager;

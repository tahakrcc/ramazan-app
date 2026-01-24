import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, X, Search, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ServicesManager = () => {
    const [services, setServices] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [formData, setFormData] = useState({ id: '', name: '', price: '', duration: '' });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const res = await API.get('/admin/services');
            setServices(res.data);
        } catch (error) {
            toast.error('Hizmetler yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setFormData({
            id: service.id,
            name: service.name,
            price: service.price,
            duration: service.duration
        });
        setShowModal(true);
    };

    const handleNew = () => {
        setEditingService(null);
        setFormData({ id: '', name: '', price: '', duration: '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingService) {
                await API.put(`/admin/services/${editingService._id}`, formData);
                toast.success('Hizmet başarıyla güncellendi ✨');
            } else {
                await API.post('/admin/services', formData);
                toast.success('Yeni hizmet eklendi 🚀');
            }
            setShowModal(false);
            fetchServices();
        } catch (error) {
            toast.error('İşlem başarısız: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu hizmeti silmek istediğinize emin misiniz?')) return;
        try {
            await API.delete(`/admin/services/${id}`);
            toast.success('Hizmet silindi');
            fetchServices();
        } catch (error) {
            toast.error('Silinemedi');
        }
    };

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                <div>
                    <h2 className="text-2xl font-serif text-white flex items-center gap-3">
                        <span className="p-2 bg-gold-500/20 rounded-lg text-gold-500"><Scissors size={24} /></span>
                        Hizmet Yönetimi
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Fiyatları ve hizmet sürelerini buradan düzenleyebilirsiniz.</p>
                </div>
                <button
                    onClick={handleNew}
                    className="flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 px-6 py-3 rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all hover:scale-[1.02]"
                >
                    <Plus size={18} /> Yeni Hizmet Ekle
                </button>
            </div>

            {/* Content Section */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-white/5">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Hizmet ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-dark-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Mobile View (Cards) - No Horizontal Scroll */}
                <div className="md:hidden space-y-3 p-4">
                    {loading ? (
                        <div className="text-center text-gray-400 py-8">Yükleniyor...</div>
                    ) : filteredServices.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">Hizmet bulunamadı.</div>
                    ) : (
                        filteredServices.map(s => (
                            <div key={s.id} className="bg-dark-950/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{s.name}</h3>
                                        <span className="text-xs text-gray-500 font-mono">{s.id}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(s)} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(s._id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="px-3 py-1 bg-gold-500/10 text-gold-500 rounded-lg text-sm font-bold border border-gold-500/20">{s.price}₺</span>
                                    <span className="text-gray-400 text-sm flex items-center gap-1"><span className="w-1 h-1 bg-gray-500 rounded-full"></span> {s.duration} dk</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-[10px] md:text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 md:p-6 font-bold">Hizmet ID</th>
                                <th className="p-4 md:p-6 font-bold">Hizmet Adı</th>
                                <th className="p-4 md:p-6 font-bold text-center">Fiyat</th>
                                <th className="p-4 md:p-6 font-bold text-center">Süre</th>
                                <th className="p-4 md:p-6 font-bold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Yükleniyor...</td></tr>
                            ) : filteredServices.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Hizmet bulunamadı.</td></tr>
                            ) : (
                                filteredServices.map(s => (
                                    <tr key={s.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="p-4 md:p-6 text-gray-500 font-mono text-xs">{s.id}</td>
                                        <td className="p-4 md:p-6">
                                            <span className="font-bold text-white text-base">{s.name}</span>
                                        </td>
                                        <td className="p-4 md:p-6 text-center">
                                            <span className="px-3 py-1 rounded-lg bg-gold-500/10 text-gold-500 font-bold border border-gold-500/20">
                                                {s.price}₺
                                            </span>
                                        </td>
                                        <td className="p-4 md:p-6 text-center text-gray-300">
                                            {s.duration} dk
                                        </td>
                                        <td className="p-4 md:p-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(s)}
                                                    className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s._id)}
                                                    className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-dark-900 border border-white/10 p-6 md:p-8 rounded-2xl w-full max-w-lg relative shadow-2xl z-10"
                        >
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h3 className="text-2xl font-serif text-white mb-6 pr-8">
                                {editingService ? 'Hizmeti Düzenle' : 'Yeni Hizmet Ekle'}
                            </h3>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Benzersiz ID (örn: sac_kesim)</label>
                                    <input
                                        required
                                        disabled={!!editingService}
                                        placeholder="Benzersiz bir kod girin"
                                        className="w-full bg-dark-950 border border-white/10 p-4 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all font-mono text-sm"
                                        value={formData.id}
                                        onChange={e => setFormData({ ...formData, id: e.target.value })}
                                    />
                                    {!editingService && <p className="text-[10px] text-gray-500">Bu alan daha sonra değiştirilemez.</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Hizmet Adı</label>
                                    <input
                                        required
                                        placeholder="Örn: Saç Kesimi"
                                        className="w-full bg-dark-950 border border-white/10 p-4 rounded-xl text-white focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Fiyat (TL)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                placeholder="0"
                                                className="w-full bg-dark-950 border border-white/10 p-4 rounded-xl text-white focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all pl-4"
                                                value={formData.price}
                                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₺</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Süre (Dk)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                placeholder="30"
                                                className="w-full bg-dark-950 border border-white/10 p-4 rounded-xl text-white focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                                value={formData.duration}
                                                onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">DK</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        className="w-full bg-gold-500 text-dark-950 font-bold py-4 rounded-xl hover:bg-white transition-all hover:scale-[1.02] shadow-lg text-sm uppercase tracking-widest"
                                    >
                                        {editingService ? 'Değişiklikleri Kaydet' : 'Hizmeti Oluştur'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ServicesManager;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { format, subDays, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import WhatsAppConnection from '../components/WhatsAppConnection'; // Added status panel

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('appointments');
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [weekStart, setWeekStart] = useState(new Date()); // For grid view
    const [appointments, setAppointments] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // New states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [closedDates, setClosedDates] = useState([]);
    const [services, setServices] = useState([]);
    const [showModal, setShowModal] = useState(null);
    const [modalData, setModalData] = useState({});

    const token = localStorage.getItem('adminToken');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        if (!token) {
            navigate('/admin/login');
            return;
        }
        if (activeTab === 'appointments') {
            if (viewMode === 'list') {
                fetchAppointments();
            } else {
                fetchWeekAppointments();
            }
        }
        if (activeTab === 'stats') fetchStats();
        if (activeTab === 'closed') fetchClosedDates();
        if (activeTab === 'services') fetchServices();
    }, [selectedDate, activeTab, viewMode, weekStart]);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const res = await API.get(`/admin/appointments?date=${selectedDate}`, { headers });
            setAppointments(res.data);
        } catch (error) {
            if (error.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchWeekAppointments = async () => {
        setLoading(true);
        try {
            const start = format(weekStart, 'yyyy-MM-dd');
            const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
            const res = await API.get('/admin/appointments', {
                params: { startDate: start, endDate: end },
                headers
            });
            setAppointments(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await API.get('/admin/stats', { headers });
            setStats(res.data);
        } catch (error) {
            console.error('Stats error:', error);
        }
    };

    const fetchClosedDates = async () => {
        try {
            const res = await API.get('/admin/closed-dates', { headers });
            setClosedDates(res.data);
        } catch (error) {
            console.error('Closed dates error:', error);
        }
    };

    const fetchServices = async () => {
        try {
            const res = await API.get('/admin/services', { headers });
            setServices(res.data);
        } catch (error) {
            console.error('Services error:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await API.get('/admin/settings', { headers });
            setModalData(res.data); // Reuse modalData for settings form
        } catch (error) {
            console.error('Settings error:', error);
        }
    };

    useEffect(() => {
        if (activeTab === 'settings') fetchSettings();
    }, [activeTab]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await API.get(`/admin/appointments/search?q=${searchQuery}`, { headers });
            setSearchResults(res.data);
        } catch (error) {
            toast.error('Arama hatası');
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?')) return;
        try {
            await API.delete(`/admin/appointments/${id}`, { headers });
            toast.success('Randevu iptal edildi');
            fetchAppointments();
            fetchStats();
        } catch (error) {
            toast.error('İptal işlemi başarısız');
        }
    };

    const handleCreateAppointment = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/appointments', { ...modalData, createdFrom: 'admin' }, { headers });
            toast.success('Randevu oluşturuldu');
            setShowModal(null);
            setModalData({});
            fetchAppointments();
            fetchStats();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Randevu oluşturulamadı');
        }
    };

    const handleAddClosedDate = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/closed-dates', modalData, { headers });
            toast.success('Kapalı gün eklendi');
            setShowModal(null);
            setModalData({});
            fetchClosedDates();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Eklenemedi');
        }
    };

    const handleDeleteClosedDate = async (id) => {
        try {
            await API.delete(`/admin/closed-dates/${id}`, { headers });
            toast.success('Kapalı gün silindi');
            fetchClosedDates();
        } catch (error) {
            toast.error('Silinemedi');
        }
    };

    const handleSaveService = async (e) => {
        e.preventDefault();
        try {
            if (modalData._id) {
                await API.put(`/admin/services/${modalData._id}`, modalData, { headers });
                toast.success('Hizmet güncellendi');
            } else {
                await API.post('/admin/services', modalData, { headers });
                toast.success('Hizmet eklendi');
            }
            setShowModal(null);
            setModalData({});
            fetchServices();
        } catch (error) {
            toast.error(error.response?.data?.error || 'İşlem başarısız');
        }
    };

    const handleDeleteService = async (id) => {
        if (!window.confirm('Bu hizmeti silmek istediğinize emin misiniz?')) return;
        try {
            await API.delete(`/admin/services/${id}`, { headers });
            toast.success('Hizmet silindi');
            fetchServices();
        } catch (error) {
            toast.error('Silinemedi');
        }
    };

    const handleUpdateNotes = async (id, notes) => {
        try {
            await API.patch(`/admin/appointments/${id}/notes`, { notes }, { headers });
            toast.success('Not güncellendi');
            fetchAppointments();
        } catch (error) {
            toast.error('Not güncellenemedi');
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            await API.put('/admin/settings', {
                appointmentStartHour: Number(modalData.appointmentStartHour),
                appointmentEndHour: Number(modalData.appointmentEndHour),
                bookingRangeDays: Number(modalData.bookingRangeDays)
            }, { headers });
            toast.success('Ayarlar güncellendi');
        } catch (error) {
            toast.error('Ayarlar güncellenemedi');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSidebarOpen(false);
    };

    const getServiceName = (serviceId) => {
        const s = services.find(s => s.id === serviceId);
        if (s) return s.name;
        const defaults = { sac: 'Saç', sakal: 'Sakal', sac_sakal: 'Komple' };
        return defaults[serviceId] || serviceId || '-';
    };

    const menuItems = [
        { id: 'appointments', icon: '📅', label: 'Randevular' },
        { id: 'create', icon: '➕', label: 'Randevu Ekle' },
        { id: 'search', icon: '🔍', label: 'Müşteri Ara' },
        { id: 'stats', icon: '📊', label: 'İstatistikler' },
        { id: 'closed', icon: '🚫', label: 'Kapalı Günler' },
        { id: 'services', icon: '💇', label: 'Hizmetler' },
        { id: 'broadcast', icon: '📢', label: 'Toplu Mesaj' },
        { id: 'settings', icon: '⚙️', label: 'Ayarlar' }, // Added tab
        { id: 'whatsapp', icon: '📱', label: 'WhatsApp Bağlantı' },
    ];

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Mobile Menu Button */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg">
                {sidebarOpen ? '✕' : '☰'}
            </button>

            {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-xl font-bold text-white">By Ramazan</h1>
                    <p className="text-gray-400 text-sm">Yönetim Paneli</p>
                </div>

                <nav className="flex-1 p-4 overflow-y-auto">
                    <ul className="space-y-1">
                        {menuItems.map(item => (
                            <li key={item.id}>
                                <button
                                    onClick={() => handleTabChange(item.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === item.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                                >
                                    <span>{item.icon}</span>
                                    <span className="text-sm">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all flex items-center gap-3">
                        <span>🚪</span>
                        <span className="text-sm">Çıkış Yap</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            {/* Main Content */}
            <main className="flex-1 p-4 lg:p-6 pt-16 lg:pt-6 overflow-auto">
                {/* WhatsApp Connection Component removed from header */}

                {/* RANDEVULAR */}
                {activeTab === 'appointments' && (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Randevular</h2>
                                <p className="text-gray-500 text-sm">Günlük ve haftalık randevu takibi</p>
                            </div>
                            <div className="flex bg-gray-200 rounded-lg p-1">
                                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>Günlük Liste</button>
                                <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>Haftalık Takvim</button>
                            </div>
                            {viewMode === 'list' ? (
                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setWeekStart(subDays(weekStart, 7))} className="px-3 py-1 bg-gray-200 rounded text-gray-700">{'<'}</button>
                                    <span className="text-gray-900 font-medium text-sm">{format(weekStart, 'd MMM', { locale: tr })} - {format(addDays(weekStart, 6), 'd MMM', { locale: tr })}</span>
                                    <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-1 bg-gray-200 rounded text-gray-700">{'>'}</button>
                                </div>
                            )}
                        </div>

                        {stats && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-gray-500 text-xs">Bugün</p><p className="text-2xl font-bold text-gray-900">{stats.appointments.today}</p></div>
                                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-gray-500 text-xs">Bu Hafta</p><p className="text-2xl font-bold text-gray-900">{stats.appointments.week}</p></div>
                                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-gray-500 text-xs">Bugün Gelir</p><p className="text-2xl font-bold text-green-600">{stats.revenue.today}₺</p></div>
                                <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-gray-500 text-xs">Haftalık Gelir</p><p className="text-2xl font-bold text-green-600">{stats.revenue.week}₺</p></div>
                            </div>
                        )}

                        {viewMode === 'list' ? (
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-900">{format(new Date(selectedDate), 'd MMMM yyyy', { locale: tr })}</h3>
                                </div>

                                {loading ? (
                                    <div className="p-12 text-center text-gray-400">Yükleniyor...</div>
                                ) : appointments.length === 0 ? (
                                    <div className="p-12 text-center text-gray-400">Bu tarihte randevu yok</div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {appointments.map(apt => (
                                            <div key={apt._id} className="p-4 hover:bg-gray-50">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg font-bold text-gray-900 min-w-[3rem]">{apt.hour}</span>
                                                            <span className="text-gray-900 font-medium">{apt.customerName}</span>
                                                        </div>
                                                        <span className="text-gray-500 text-sm">{apt.phone}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{getServiceName(apt.service)}</span>
                                                        <span className={`px-2 py-1 text-xs rounded ${apt.createdFrom === 'whatsapp' ? 'bg-green-100 text-green-800' : apt.createdFrom === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                                            {apt.createdFrom === 'whatsapp' ? 'WA' : apt.createdFrom === 'admin' ? 'Admin' : 'Web'}
                                                        </span>
                                                        {apt.status === 'confirmed' && (
                                                            <button onClick={() => handleCancel(apt._id)} className="text-red-600 text-sm hover:underline">İptal</button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Not ekle..."
                                                        defaultValue={apt.notes}
                                                        onBlur={(e) => e.target.value !== apt.notes && handleUpdateNotes(apt._id, e.target.value)}
                                                        className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                                <div className="min-w-[800px]">
                                    <div className="grid grid-cols-8 border-b border-gray-200">
                                        <div className="p-2 border-r border-gray-200 bg-gray-50 text-center font-bold text-gray-700">Saat</div>
                                        {Array.from({ length: 7 }).map((_, i) => {
                                            const day = addDays(weekStart, i);
                                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                            return (
                                                <div key={i} className={`p-2 border-r border-gray-200 text-center ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
                                                    <div className="font-bold text-gray-800">{format(day, 'EEE', { locale: tr })}</div>
                                                    <div className="text-xs text-gray-500">{format(day, 'd MMM')}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="divide-y divide-gray-200">
                                        {Array.from({ length: 14 }).map((_, h) => { // 08:00 - 21:00 roughly
                                            const hour = `${String(h + 8).padStart(2, '0')}:00`;
                                            return (
                                                <div key={hour} className="grid grid-cols-8 h-20">
                                                    <div className="p-2 border-r border-gray-200 bg-gray-50 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
                                                        {hour}
                                                    </div>
                                                    {Array.from({ length: 7 }).map((_, d) => {
                                                        const currentDate = format(addDays(weekStart, d), 'yyyy-MM-dd');
                                                        // Find appointment for this slot
                                                        const appt = appointments.find(a => a.date === currentDate && a.hour === hour);

                                                        return (
                                                            <div key={d} className="border-r border-gray-200 p-1 relative hover:bg-gray-50">
                                                                {appt ? (
                                                                    <div className={`h-full rounded p-1 text-xs cursor-pointer overflow-hidden ${appt.createdFrom === 'whatsapp' ? 'bg-green-100 border-l-2 border-green-500' : 'bg-blue-100 border-l-2 border-blue-500'}`}
                                                                        title={`${appt.customerName} - ${appt.phone}`}
                                                                        onClick={() => {
                                                                            if (window.confirm(`${appt.customerName}\n${appt.phone}\n${getServiceName(appt.service)}\n\nİptal edilsin mi?`)) handleCancel(appt._id);
                                                                        }}
                                                                    >
                                                                        <div className="font-bold truncate">{appt.customerName}</div>
                                                                        <div className="truncate text-gray-600">{getServiceName(appt.service)}</div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-full group flex items-center justify-center opacity-0 hover:opacity-100">
                                                                        <button onClick={() => { setShowModal('create'); setModalData({ date: currentDate, hour: hour }); }}
                                                                            className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs">+</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* RANDEVU EKLE */}
                {activeTab === 'create' && (
                    <div className="max-w-lg">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Yeni Randevu Oluştur</h2>
                        <form onSubmit={handleCreateAppointment} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Müşteri Adı</label>
                                <input type="text" required value={modalData.customerName || ''} onChange={e => setModalData({ ...modalData, customerName: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Telefon</label>
                                <input type="tel" required value={modalData.phone || ''} onChange={e => setModalData({ ...modalData, phone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="05XX XXX XX XX" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Tarih</label>
                                <input type="date" required value={modalData.date || ''} onChange={e => setModalData({ ...modalData, date: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Saat</label>
                                <select required value={modalData.hour || ''} onChange={e => setModalData({ ...modalData, hour: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900">
                                    <option value="">Seçin</option>
                                    {Array.from({ length: 13 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`).map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Hizmet</label>
                                <select required value={modalData.service || ''} onChange={e => setModalData({ ...modalData, service: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900">
                                    <option value="">Seçin</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} - {s.price}₺</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Not (Opsiyonel)</label>
                                <input type="text" value={modalData.notes || ''} onChange={e => setModalData({ ...modalData, notes: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                            </div>
                            <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800">
                                Randevu Oluştur
                            </button>
                        </form>
                    </div>
                )}

                {/* MÜŞTERİ ARA */}
                {activeTab === 'search' && (
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Müşteri Arama</h2>
                        <div className="flex gap-2 mb-6">
                            <input type="text" placeholder="İsim veya telefon..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                            <button onClick={handleSearch} className="px-6 py-2 bg-gray-900 text-white rounded-lg">Ara</button>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="divide-y divide-gray-100">
                                    {searchResults.map(apt => (
                                        <div key={apt._id} className="p-4">
                                            <div className="flex justify-between">
                                                <div>
                                                    <span className="font-bold text-gray-900">{apt.customerName}</span>
                                                    <span className="text-gray-500 ml-2">{apt.phone}</span>
                                                </div>
                                                <span className={`px-2 py-1 text-xs rounded ${apt.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {apt.status === 'confirmed' ? 'Onaylı' : 'İptal'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {apt.date} • {apt.hour} • {getServiceName(apt.service)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* İSTATİSTİKLER */}
                {activeTab === 'stats' && stats && (
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Detaylı İstatistikler</h2>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <p className="text-gray-500 text-sm">Bugün</p>
                                <p className="text-3xl font-bold text-gray-900">{stats.appointments.today}</p>
                                <p className="text-green-600 font-medium">{stats.revenue.today}₺</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <p className="text-gray-500 text-sm">Bu Hafta</p>
                                <p className="text-3xl font-bold text-gray-900">{stats.appointments.week}</p>
                                <p className="text-green-600 font-medium">{stats.revenue.week}₺</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <p className="text-gray-500 text-sm">Bu Ay</p>
                                <p className="text-3xl font-bold text-gray-900">{stats.appointments.month}</p>
                                <p className="text-green-600 font-medium">{stats.revenue.month}₺</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <p className="text-gray-500 text-sm">Toplam</p>
                                <p className="text-3xl font-bold text-gray-900">{stats.appointments.total}</p>
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h3 className="font-semibold text-gray-900 mb-4">En Popüler Hizmet</h3>
                                {stats.popularService ? (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-700">{getServiceName(stats.popularService.name)}</span>
                                        <span className="text-2xl font-bold text-gray-900">{stats.popularService.count} randevu</span>
                                    </div>
                                ) : <p className="text-gray-400">Henüz veri yok</p>}
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h3 className="font-semibold text-gray-900 mb-4">En Yoğun Saatler</h3>
                                {stats.busiestHours.length > 0 ? (
                                    <div className="space-y-2">
                                        {stats.busiestHours.map((h, i) => (
                                            <div key={h.hour} className="flex justify-between items-center">
                                                <span className="text-gray-700">{h.hour}</span>
                                                <span className="font-medium text-gray-900">{h.count} randevu</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-gray-400">Henüz veri yok</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* KAPALI GÜNLER */}
                {activeTab === 'closed' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Kapalı Günler</h2>
                            <button onClick={() => { setShowModal('closed'); setModalData({ date: format(addDays(new Date(), 1), 'yyyy-MM-dd') }); }}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">+ Kapalı Gün Ekle</button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            {closedDates.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">Kapalı gün yok</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {closedDates.map(cd => (
                                        <div key={cd._id} className="p-4 flex justify-between items-center">
                                            <div>
                                                <span className="font-medium text-gray-900">{format(new Date(cd.date), 'd MMMM yyyy, EEEE', { locale: tr })}</span>
                                                <span className="text-gray-500 ml-2">({cd.reason})</span>
                                            </div>
                                            <button onClick={() => handleDeleteClosedDate(cd._id)} className="text-red-600 text-sm">Sil</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* HİZMETLER */}
                {activeTab === 'services' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Hizmet Yönetimi</h2>
                            <button onClick={() => { setShowModal('service'); setModalData({}); }}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">+ Hizmet Ekle</button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-100">
                                {/* Custom services */}
                                {/* Custom services */}
                                {services.map(s => (
                                    <div key={s._id} className="p-4 flex justify-between items-center">
                                        <div>
                                            <span className="font-medium text-gray-900">{s.name}</span>
                                            {!s.isActive && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded ml-2">Pasif</span>}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-gray-900">{s.price}₺</span>
                                            <button onClick={() => { setShowModal('service'); setModalData(s); }} className="text-blue-600 text-sm">Düzenle</button>
                                            <button onClick={() => handleDeleteService(s._id)} className="text-red-600 text-sm">Sil</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* BROADCAST (Toplu Mesaj) */}
                {activeTab === 'broadcast' && (
                    <div className="max-w-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Toplu Mesaj Gönder</h2>
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <div className="mb-4">
                                <label className="block text-sm text-gray-600 mb-1">Kime Gönderilecek?</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
                                    value={modalData.filter || 'all'}
                                    onChange={e => setModalData({ ...modalData, filter: e.target.value })}
                                >
                                    <option value="all">Tüm Müşteriler (Geçmiş Randevusu Olanlar)</option>
                                    <option value="today">Sadece Bugün Randevusu Olanlar</option>
                                    <option value="future">Gelecek/Aktif Randevusu Olanlar</option>
                                </select>
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm text-gray-600 mb-1">Mesajınız</label>
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 h-32"
                                    placeholder="Merhaba, Ramazan Bayramınız kutlu olsun!..."
                                    value={modalData.message || ''}
                                    onChange={e => setModalData({ ...modalData, message: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Not: Mesajlar spam sayılmamak için 2-5 saniye aralıklarla gönderilecektir.</p>
                            </div>

                            <button
                                onClick={async () => {
                                    if (!modalData.message) return toast.error('Lütfen mesaj yazınız');
                                    if (!window.confirm('Bu mesajı tüm seçili müşterilere göndermek istediğinize emin misiniz?')) return;

                                    try {
                                        await API.post('/admin/broadcast', { message: modalData.message, filter: modalData.filter || 'all' }, { headers });
                                        toast.success('Toplu mesaj işlemi başlatıldı.');
                                        setModalData({});
                                    } catch (err) {
                                        toast.error('Gönderim hatası');
                                    }
                                }}
                                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold"
                            >
                                🚀 Mesajı Gönder
                            </button>
                        </div>
                    </div>
                )}

                {/* AYARLAR */}
                {activeTab === 'settings' && (
                    <div className="max-w-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Genel Ayarlar</h2>
                        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Randevu Başlangıç Saati</label>
                                <input type="number" min="0" max="23" required value={modalData.appointmentStartHour || ''} onChange={e => setModalData({ ...modalData, appointmentStartHour: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                                <p className="text-xs text-gray-500 mt-1">Örn: 8 (08:00)</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Randevu Bitiş Saati</label>
                                <input type="number" min="0" max="24" required value={modalData.appointmentEndHour || ''} onChange={e => setModalData({ ...modalData, appointmentEndHour: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                                <p className="text-xs text-gray-500 mt-1">Örn: 20 (20:00). Bu saat son randevu saatini belirler.</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Randevu Alınabilir Gün Aralığı</label>
                                <input type="number" min="1" required value={modalData.bookingRangeDays || ''} onChange={e => setModalData({ ...modalData, bookingRangeDays: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                                <p className="text-xs text-gray-500 mt-1">Müşteriler bugünden itibaren kaç gün sonrasına randevu alabilir? Örn: 14</p>
                            </div>
                            <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800">
                                Kaydet
                            </button>
                        </form>
                    </div>
                )}

                {/* WHATSAPP CONNECTION TAB */}
                {activeTab === 'whatsapp' && (
                    <div className="max-w-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">WhatsApp Bağlantısı ve Durumu</h2>
                        <p className="text-gray-600 mb-6">
                            Botun çalışması için buradan WhatsApp'ı bağlamanız gerekmektedir.
                            Bağlantı bir kez yapıldığında sunucu kapanıp açılsa bile genellikle korunur.
                        </p>
                        <WhatsAppConnection />
                    </div>
                )}
            </main>

            {/* MODAL */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
                        <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            {showModal === 'closed' && (
                                <form onSubmit={handleAddClosedDate}>
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Kapalı Gün Ekle</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Tarih</label>
                                            <input type="date" required value={modalData.date || ''} onChange={e => setModalData({ ...modalData, date: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Sebep</label>
                                            <input type="text" value={modalData.reason || ''} onChange={e => setModalData({ ...modalData, reason: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Tatil" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700">İptal</button>
                                        <button type="submit" className="flex-1 py-2 bg-gray-900 text-white rounded-lg">Ekle</button>
                                    </div>
                                </form>
                            )}
                            {showModal === 'service' && (
                                <form onSubmit={handleSaveService}>
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">{modalData._id ? 'Hizmeti Düzenle' : 'Yeni Hizmet'}</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Hizmet ID</label>
                                            <input type="text" required disabled={!!modalData._id} value={modalData.id || ''} onChange={e => setModalData({ ...modalData, id: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="ornek_hizmet" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Hizmet Adı</label>
                                            <input type="text" required value={modalData.name || ''} onChange={e => setModalData({ ...modalData, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Fiyat (₺)</label>
                                            <input type="number" required value={modalData.price || ''} onChange={e => setModalData({ ...modalData, price: Number(e.target.value) })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700">İptal</button>
                                        <button type="submit" className="flex-1 py-2 bg-gray-900 text-white rounded-lg">Kaydet</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AdminDashboard;

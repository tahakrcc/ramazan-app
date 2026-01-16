import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import WhatsAppConnection from '../components/WhatsAppConnection';
import { motion, AnimatePresence } from 'framer-motion';
import GrainOverlay from '../components/GrainOverlay';
import { Menu, X, MessageSquare, Plus, QrCode } from 'lucide-react'; // Assumes lucide-react or similar icons

// Simplified Icon components if lucide-react is not installed
const IconMenu = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Security: Check token on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS';
            return;
        }

        // Verify token is valid by making a test API call
        API.get('/admin/appointments')
            .then(() => {
                setIsAuthenticated(true);
                setIsLoading(false);
            })
            .catch(() => {
                localStorage.removeItem('token');
                window.location.href = '/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS';
            });
    }, []);

    // Close sidebar on tab change (mobile)
    useEffect(() => {
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    }, [activeTab]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="flex h-screen bg-dark-950 items-center justify-center">
                <div className="text-white text-xl">Yükleniyor...</div>
            </div>
        );
    }

    // Don't render if not authenticated
    if (!isAuthenticated) {
        return null;
    }


    return (
        <div className="flex h-screen bg-dark-950 font-sans text-white overflow-hidden relative">
            <GrainOverlay />

            {/* Ambient Background Glow */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-gold-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-dark-950/90 backdrop-blur-lg border-b border-white/10 z-50 px-6 py-4 flex justify-between items-center">
                <h1 className="text-lg font-serif tracking-widest text-gold-500">BY RAMAZAN</h1>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white">
                    {isSidebarOpen ? <IconX /> : <IconMenu />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
                fixed md:relative top-0 left-0 bottom-0 w-72 bg-dark-950/95 md:bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col z-40 transition-transform duration-300 transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                pt-20 md:pt-0
            `}>
                <div className="p-8 border-b border-white/5 hidden md:block">
                    <h1 className="text-2xl font-serif text-white tracking-wider flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gold-500 text-dark-950 flex items-center justify-center text-sm font-bold">R</span>
                        BY RAMAZAN
                    </h1>
                    <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mt-3 ml-1">Admin Console</p>
                </div>

                <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-2">
                    <SidebarItem icon="📊" label="Genel Bakış" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <SidebarItem icon="📅" label="Randevular" active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} />
                    <SidebarItem icon="📢" label="Toplu Mesaj" active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} />
                    <SidebarItem icon="⚙️" label="Ayarlar" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </nav>

                <div className="p-6 border-t border-white/5 bg-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-dark-950 font-bold">TR</div>
                        <div>
                            <p className="text-sm font-medium text-white">Ramazan</p>
                            <p className="text-xs text-green-400">● Çevrimiçi</p>
                        </div>
                    </div>
                    <button onClick={() => {
                        localStorage.removeItem('token');
                        window.location.href = '/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS';
                    }} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-semibold uppercase tracking-wider">
                        Güvenli Çıkış
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative z-10 flex flex-col pt-16 md:pt-0">
                <header className="hidden md:flex px-8 py-6 justify-between items-center border-b border-white/5 bg-dark-950/50 backdrop-blur-sm sticky top-0 z-20">
                    <div>
                        <h2 className="text-2xl font-serif text-white">
                            {activeTab === 'dashboard' && 'Genel Bakış'}
                            {activeTab === 'appointments' && 'Randevu Yönetimi'}
                            {activeTab === 'broadcast' && 'Mesaj Merkezi'}
                            {activeTab === 'settings' && 'Sistem Ayarları'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-300">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Sistem Aktif
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-8 flex-1">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full"
                        >
                            {activeTab === 'dashboard' && <DashboardOverview setActiveTab={setActiveTab} />}
                            {activeTab === 'appointments' && <AppointmentsManager />}
                            {activeTab === 'broadcast' && <BroadcastManager />}
                            {activeTab === 'settings' && <SettingsManager />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

// --- Components ---

const SidebarItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${active
            ? 'bg-gradient-to-r from-gold-500/20 to-transparent border border-gold-500/20 text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
    >
        {active && <motion.div layoutId="sidebar-active" className="absolute left-0 top-0 bottom-0 w-1 bg-gold-500" />}
        <span className={`text-xl transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
        <span className="text-sm font-medium tracking-wide">{label}</span>
    </button>
);

const DashboardOverview = ({ setActiveTab }) => {
    const [stats, setStats] = useState({ todayCount: 0, tomorrowCount: 0, weekCount: 0 });
    const [upcomingAppointments, setUpcomingAppointments] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await API.get('/admin/appointments');
                const all = res.data || [];
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const dayAfter = new Date(today);
                dayAfter.setDate(dayAfter.getDate() + 2);

                // Stats
                const todayAppts = all.filter(a => {
                    const apptDate = new Date(a.date);
                    return apptDate >= today && apptDate < tomorrow && a.status !== 'cancelled';
                });
                const tomorrowAppts = all.filter(a => {
                    const apptDate = new Date(a.date);
                    return apptDate >= tomorrow && apptDate < dayAfter && a.status !== 'cancelled';
                });

                setStats({
                    todayCount: todayAppts.length,
                    tomorrowCount: tomorrowAppts.length,
                    weekCount: all.filter(a => a.status !== 'cancelled').length
                });

                // Upcoming Appointments (today + tomorrow, max 5)
                const upcoming = all
                    .filter(a => {
                        const apptDate = new Date(a.date);
                        return apptDate >= today && apptDate < dayAfter && a.status !== 'cancelled';
                    })
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .slice(0, 5);
                setUpcomingAppointments(upcoming);

                // Recent Activities (last 5 created/cancelled, sorted by updatedAt)
                const activities = all
                    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
                    .slice(0, 5)
                    .map(a => ({
                        id: a._id,
                        type: a.status === 'cancelled' ? 'cancelled' : 'created',
                        name: a.customerName,
                        phone: a.customerPhone,
                        date: a.date,
                        time: a.time,
                        updatedAt: a.updatedAt || a.createdAt
                    }));
                setRecentActivities(activities);

            } catch (e) { console.error(e); }
        };
        fetchData();
    }, []);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return 'Bugün';
        if (date.toDateString() === tomorrow.toDateString()) return 'Yarın';
        return format(date, 'd MMM', { locale: tr });
    };

    const formatTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Az önce';
        if (diffMins < 60) return `${diffMins} dk önce`;
        if (diffHours < 24) return `${diffHours} saat önce`;
        return `${diffDays} gün önce`;
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon="📅" label="Bugün" value={stats.todayCount} trend="Randevu" color="from-gold-600 to-gold-400" onClick={() => setActiveTab('appointments')} />
                <StatCard icon="📆" label="Yarın" value={stats.tomorrowCount} trend="Randevu" color="from-purple-600 to-purple-400" onClick={() => setActiveTab('appointments')} />
                <StatCard icon="📈" label="Toplam" value={stats.weekCount} trend="Kayıt" color="from-blue-600 to-blue-400" onClick={() => setActiveTab('appointments')} />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Appointments */}
                <div className="glass-panel p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span>🗓️</span> Yaklaşan Randevular
                        </h3>
                        <button
                            onClick={() => setActiveTab('appointments')}
                            className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                        >
                            Tümünü Gör →
                        </button>
                    </div>

                    {upcomingAppointments.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-8">Yaklaşan randevu yok</p>
                    ) : (
                        <div className="space-y-3">
                            {upcomingAppointments.map((apt) => (
                                <div key={apt._id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center text-sm font-bold text-gold-400">
                                            {apt.customerName?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">{apt.customerName}</p>
                                            <p className="text-gray-500 text-xs">{apt.serviceName || 'Hizmet'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gold-400 text-sm font-medium">{apt.time}</p>
                                        <p className="text-gray-500 text-xs">{formatDate(apt.date)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activities */}
                <div className="glass-panel p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span>📋</span> Son Aktiviteler
                        </h3>
                    </div>

                    {recentActivities.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-8">Henüz aktivite yok</p>
                    ) : (
                        <div className="space-y-3">
                            {recentActivities.map((activity) => (
                                <div key={activity.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                                    <div className={`w-2 h-2 rounded-full ${activity.type === 'cancelled' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm truncate">
                                            <span className="font-medium">{activity.name}</span>
                                            {activity.type === 'cancelled' ? (
                                                <span className="text-red-400"> randevusunu iptal etti</span>
                                            ) : (
                                                <span className="text-green-400"> randevu oluşturdu</span>
                                            )}
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            {formatDate(activity.date)} - {activity.time}
                                        </p>
                                    </div>
                                    <span className="text-gray-600 text-xs whitespace-nowrap">
                                        {formatTimeAgo(activity.updatedAt)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color, trend, warning, onClick }) => (
    <div className="glass-panel p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10`}></div>
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/5 rounded-xl text-2xl backdrop-blur-sm border border-white/5">{icon}</div>
        </div>
        <div className="relative z-10">
            <span className="text-4xl md:text-5xl font-serif font-medium text-white block mb-1">{value}</span>
            <div className="flex justify-between items-end">
                <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">{label}</p>
                <button
                    onClick={onClick}
                    className={`text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer ${warning ? 'text-orange-400' : 'text-green-400'}`}
                >
                    {trend}
                </button>
            </div>
        </div>
    </div>
);

const AppointmentsManager = () => {
    const [viewMode, setViewMode] = useState('list');
    const [subTab, setSubTab] = useState('active'); // active, archive
    const [appointments, setAppointments] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // Manual Booking State
    const [manualForm, setManualForm] = useState({ customerName: '', phone: '', date: '', hour: '' });

    const fetchAppointments = async () => {
        try {
            let url = '/admin/appointments';
            if (subTab === 'archive') {
                url += '?view=archive';
            }
            const res = await API.get(url);
            setAppointments(res.data);
        } catch (error) { toast.error('Yüklenemedi: ' + (error.response?.data?.error || error.message)); }
    };

    useEffect(() => { fetchAppointments(); }, [subTab]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/appointments', manualForm);
            toast.success('Randevu oluşturuldu');
            setShowModal(false);
            setManualForm({ customerName: '', phone: '', date: '', hour: '' });
            fetchAppointments();
        } catch (error) { toast.error('Hata oluştu'); }
    };

    const handleStatusUpdate = async (id, status) => {
        if (!window.confirm(`Durum "${status}" olarak güncellensin mi?`)) return;
        try {
            // Note: Update status endpoint might differ. Assuming PUT /admin/appointments/:id with {status}
            await API.put(`/admin/appointments/${id}`, { status }); // Using general update for status now? Or specific route?
            // Revert: The old code used /appointments/${id}/status. Let's assume the update endpoint handles it or use updateAppointment
            // Previous code: router.put('/appointments/:id', adminController.updateAppointment);
            // This handles body updates.
            toast.success('Güncellendi');
            fetchAppointments();
        } catch (e) { toast.error('Hata'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Silmek istiyor musunuz?')) return;
        try {
            await API.delete(`/admin/appointments/${id}`); // Assumes DELETE route exists or use status update
            toast.success('Silindi');
            fetchAppointments();
        } catch (e) { toast.error('Hata'); }
    };

    return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 md:p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex bg-dark-950/50 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setSubTab('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'active' ? 'bg-gold-500 text-dark-950 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Aktif Randevular
                    </button>
                    <button
                        onClick={() => setSubTab('archive')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'archive' ? 'bg-gold-500 text-dark-950 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Geçmiş / İptal
                    </button>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold uppercase tracking-wide ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400 bg-white/5'}`}>Liste</button>
                    <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold uppercase tracking-wide ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-400 bg-white/5'}`}>Takvim</button>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all">
                    <IconPlus /> Randevu Ekle
                </button>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-[10px] md:text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 md:p-6">Tarih</th>
                                <th className="p-4 md:p-6">Müşteri</th>
                                <th className="p-4 md:p-6 hidden md:table-cell">Hizmet</th>
                                <th className="p-4 md:p-6">Durum</th>
                                <th className="p-4 md:p-6 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {appointments.map(app => (
                                <tr key={app._id || app.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 md:p-6">
                                        <div className="font-bold text-white">{format(parseISO(app.date), 'dd MMM', { locale: tr })}</div>
                                        <div className="text-gold-500 text-xs">{app.hour}</div>
                                    </td>
                                    <td className="p-4 md:p-6">
                                        <div className="text-white">{app.customerName}</div>
                                        <div className="text-gray-500 text-xs">{app.phone}</div>
                                    </td>
                                    <td className="p-4 md:p-6 hidden md:table-cell text-gray-400">{app.serviceId || 'Standart'}</td>
                                    <td className="p-4 md:p-6">
                                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${app.status === 'confirmed' ? 'bg-green-500/10 text-green-400' :
                                            app.status === 'pending' ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {app.status === 'confirmed' ? 'Onaylı' : app.status === 'pending' ? 'Bekliyor' : 'İptal'}
                                        </span>
                                    </td>
                                    <td className="p-4 md:p-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            {app.status === 'pending' && (
                                                <button onClick={() => handleStatusUpdate(app._id || app.id, 'confirmed')} className="p-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500 hover:text-dark-950">✓</button>
                                            )}
                                            <button onClick={() => handleDelete(app._id || app.id)} className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white">✕</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Simple Calendar Placeholder if needed, or reuse previous logic */}
            {viewMode === 'calendar' && (
                <div className="p-8 text-center text-gray-500">Takvim görünümü şu an bakımda.</div>
            )}

            {/* Manual Booking Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-white/10 p-6 md:p-8 rounded-2xl w-full max-w-md relative">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><IconX /></button>
                        <h3 className="text-xl font-serif text-white mb-6">Yeni Randevu Oluştur</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input required placeholder="Ad Soyad" className="w-full bg-white/5 border border-white/10 p-3 rounded text-white" value={manualForm.customerName} onChange={e => setManualForm({ ...manualForm, customerName: e.target.value })} />
                            <input required placeholder="Telefon" className="w-full bg-white/5 border border-white/10 p-3 rounded text-white" value={manualForm.phone} onChange={e => setManualForm({ ...manualForm, phone: e.target.value })} />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" required className="bg-white/5 border border-white/10 p-3 rounded text-white" value={manualForm.date} onChange={e => setManualForm({ ...manualForm, date: e.target.value })} />
                                <input type="time" required className="bg-white/5 border border-white/10 p-3 rounded text-white" value={manualForm.hour} onChange={e => setManualForm({ ...manualForm, hour: e.target.value })} />
                            </div>
                            <button type="submit" className="w-full bg-gold-500 text-dark-950 font-bold py-3 rounded hover:bg-white transition-colors">Oluştur</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const BroadcastManager = () => {
    const [message, setMessage] = useState('');
    const [filter, setFilter] = useState('all'); // all, active
    const [sending, setSending] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            await API.post('/admin/broadcast', { message, filter });
            toast.success('Mesajlar gönderiliyor...');
            setMessage('');
        } catch (error) { toast.error('Gönderim hatası'); }
        finally { setSending(false); }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="text-xl font-serif text-white mb-6 flex items-center gap-2">
                    <span className="p-2 bg-gold-500/20 rounded-lg text-gold-500"><IconPlus /></span>
                    Toplu Mesaj Gönder
                </h3>
                <form onSubmit={handleSend} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Hedef Kitle</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="filter" value="all" checked={filter === 'all'} onChange={() => setFilter('all')} className="text-gold-500 focus:ring-gold-500 bg-white/10 border-white/20" />
                                <span className="text-white">Tüm Kayıtlı Müşteriler</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="filter" value="active" checked={filter === 'active'} onChange={() => setFilter('active')} className="text-gold-500 focus:ring-gold-500 bg-white/10 border-white/20" />
                                <span className="text-white">Sadece Aktif Randevusu Olanlar</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Mesaj İçeriği</label>
                        <textarea
                            required
                            rows="5"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-4 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
                            placeholder="Kampanya, duyuru veya bilgilendirme mesajınızı buraya yazın..."
                        />
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-blue-200 text-sm">
                        ℹ️ Bu işlem seçilen kriterdeki tüm kullanıcılara WhatsApp üzerinden mesaj gönderecektir. Lütfen spam yapmaktan kaçının.
                    </div>

                    <button disabled={sending} type="submit" className="w-full _bg-gold-500 bg-gold-500 text-dark-950 py-4 rounded-xl font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform disabled:opacity-50">
                        {sending ? 'Gönderiliyor...' : 'Mesajı Yayınla 🚀'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const SettingsManager = () => {
    const [showQr, setShowQr] = useState(false);
    const [settings, setSettings] = useState({
        appointmentStartHour: 8,
        appointmentEndHour: 20,
        bookingRangeDays: 14,
        businessAddress: '',
        businessMapsLink: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await API.get('/admin/settings');
            setSettings(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await API.put('/admin/settings', settings);
            toast.success('Ayarlar kaydedildi! ✅');
        } catch (error) {
            toast.error('Kaydedilemedi: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* WhatsApp Settings */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">
                <div className="flex justify-between items-center bg-white/5 p-6 rounded-xl border border-white/5">
                    <div>
                        <h3 className="text-xl font-serif text-white mb-2">WhatsApp Bağlantısı</h3>
                        <p className="text-gray-400 text-sm">Bot bağlantısını kontrol etmek veya yeni cihaz bağlamak için.</p>
                    </div>
                    <button
                        onClick={() => setShowQr(!showQr)}
                        className="bg-gold-500 text-dark-950 px-6 py-3 rounded-lg font-bold uppercase tracking-wide hover:bg-white transition-colors flex items-center gap-2"
                    >
                        <QrCode size={18} />
                        {showQr ? 'QR Kodu Gizle' : 'Bağlantı Ekranını Aç'}
                    </button>
                </div>

                {showQr && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 bg-dark-950/50 p-6 rounded-xl border border-white/5 flex flex-col items-center justify-center"
                    >
                        <WhatsAppConnection />
                    </motion.div>
                )}
            </div>

            {/* General Settings */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="text-xl font-serif text-white mb-6 flex items-center gap-2">
                    <span className="p-2 bg-purple-500/20 rounded-lg text-purple-400">⚙️</span>
                    Genel Ayarlar
                </h3>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Mesai Başlangıç (Saat)</label>
                            <input
                                type="number"
                                name="appointmentStartHour"
                                value={settings.appointmentStartHour}
                                onChange={handleChange}
                                className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-4 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Mesai Bitiş (Saat)</label>
                            <input
                                type="number"
                                name="appointmentEndHour"
                                value={settings.appointmentEndHour}
                                onChange={handleChange}
                                className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-4 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Randevu Açık Gün Sayısı</label>
                        <input
                            type="number"
                            name="bookingRangeDays"
                            value={settings.bookingRangeDays}
                            onChange={handleChange}
                            className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-4 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
                        />
                        <p className="text-xs text-gray-500">Müşteriler bugünden itibaren kaç gün sonrasına kadar randevu alabilir.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">İşletme Adresi</label>
                        <textarea
                            rows="2"
                            name="businessAddress"
                            value={settings.businessAddress}
                            onChange={handleChange}
                            className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-4 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold">Google Maps Linki</label>
                        <input
                            type="text"
                            name="businessMapsLink"
                            value={settings.businessMapsLink}
                            onChange={handleChange}
                            className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-4 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
                        />
                    </div>

                    <button disabled={loading} type="submit" className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {loading ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminDashboard;

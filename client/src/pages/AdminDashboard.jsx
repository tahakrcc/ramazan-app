import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import WhatsAppConnection from '../components/WhatsAppConnection';
import FeedbackManager from '../components/FeedbackManager';
import ServicesManager from '../components/ServicesManager';
import { motion, AnimatePresence } from 'framer-motion';
import GrainOverlay from '../components/GrainOverlay';
import { Menu, X, MessageSquare, Plus, QrCode } from 'lucide-react'; // Assumes lucide-react or similar icons

// Simplified Icon components if lucide-react is not installed
const IconMenu = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconUsers = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;

// Helper function to format Turkish phone numbers
const formatPhone = (phone) => {
    if (!phone) return 'N/A';

    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');

    // Remove leading country codes if present (90, 0090, etc)
    if (digits.startsWith('0090')) {
        digits = digits.slice(4);
    } else if (digits.startsWith('90')) {
        digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    // Turkish mobile numbers are 10 digits starting with 5
    // If number is longer than 10 digits, take the last 10
    if (digits.length > 10) {
        digits = digits.slice(-10);
    }

    // If it's a valid 10-digit number starting with 5
    if (digits.length === 10 && digits.startsWith('5')) {
        return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    }

    // If still not valid, just return cleaned digits with +90
    if (digits.length === 10) {
        return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    }

    // Return original if can't format
    return phone;
};

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [role, setRole] = useState(localStorage.getItem('role') || 'ADMIN');

    // -- Permissions Configuration --
    const PERMISSIONS = {
        ADMIN: ['dashboard', 'appointments', 'services', 'feedbacks', 'complaints', 'broadcast', 'staff', 'settings'],
        BARBER: ['dashboard', 'appointments', 'feedbacks'],
        STAFF: ['dashboard', 'appointments', 'feedbacks', 'complaints']
    };

    // Get allowed tabs for current role
    const allowedTabs = PERMISSIONS[role] || PERMISSIONS['STAFF'];

    // Redirect if accessing restricted tab
    useEffect(() => {
        if (!allowedTabs.includes(activeTab)) {
            setActiveTab(allowedTabs[0]);
        }
    }, [activeTab, role, allowedTabs]);

    // Security check on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS';
            return;
        }
        API.get('/admin/appointments').then(() => {
            setIsAuthenticated(true);
            setIsLoading(false);
        }).catch(() => {
            localStorage.removeItem('token');
            window.location.href = '/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS';
        });
    }, []);

    // Close sidebar on mobile tab select
    useEffect(() => {
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    }, [activeTab]);

    if (isLoading) return <div className="flex h-screen bg-dark-950 items-center justify-center"><div className="text-white text-xl">Yükleniyor...</div></div>;
    if (!isAuthenticated) return null;

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS';
    };

    return (
        <div className="flex h-screen bg-dark-950 font-sans text-white overflow-hidden relative">
            <GrainOverlay />
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-gold-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-dark-950/90 backdrop-blur-lg border-b border-white/10 z-50 px-6 py-4 flex justify-between items-center">
                <h1 className="text-lg font-serif tracking-widest text-gold-500">BY RAMAZAN</h1>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white">{isSidebarOpen ? <IconX /> : <IconMenu />}</button>
            </div>

            {/* Sidebar */}
            <aside className={`fixed md:relative top-0 left-0 bottom-0 w-72 bg-dark-950/95 md:bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col z-40 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} pt-20 md:pt-0`}>
                <div className="p-8 border-b border-white/5 hidden md:block">
                    <h1 className="text-2xl font-serif text-white tracking-wider flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gold-500 text-dark-950 flex items-center justify-center text-sm font-bold">R</span>
                        BY RAMAZAN
                    </h1>
                    <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mt-3 ml-1">Admin Console</p>
                </div>

                <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-2 custom-scrollbar">
                    {allowedTabs.includes('dashboard') && <SidebarItem icon="📊" label="Genel Bakış" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />}
                    {allowedTabs.includes('appointments') && <SidebarItem icon="📅" label="Randevular" active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} />}
                    {allowedTabs.includes('services') && <SidebarItem icon="✂️" label="Hizmetler" active={activeTab === 'services'} onClick={() => setActiveTab('services')} />}
                    {allowedTabs.includes('feedbacks') && <SidebarItem icon="⭐" label="Yorumlar" active={activeTab === 'feedbacks'} onClick={() => setActiveTab('feedbacks')} />}
                    {allowedTabs.includes('complaints') && <SidebarItem icon="⚠️" label="Şikayetler" active={activeTab === 'complaints'} onClick={() => setActiveTab('complaints')} />}
                    {allowedTabs.includes('broadcast') && <SidebarItem icon="📢" label="Toplu Mesaj" active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} />}
                    {allowedTabs.includes('staff') && <SidebarItem icon="👥" label="Personel" active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} />}
                    {allowedTabs.includes('settings') && <SidebarItem icon="⚙️" label="Ayarlar" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
                </nav>

                <div className="p-6 border-t border-white/5 bg-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-dark-950 font-bold">
                            {role === 'ADMIN' ? 'A' : role === 'BARBER' ? 'B' : 'P'}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">
                                {role === 'ADMIN' ? 'Yönetici' : role === 'BARBER' ? 'Berber' : 'Personel'}
                            </p>
                            <p className="text-xs text-green-400">● Çevrimiçi</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-semibold uppercase tracking-wider">
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
                            {activeTab === 'services' && 'Hizmet & Fiyat Yönetimi'}
                            {activeTab === 'feedbacks' && 'Müşteri Yorumları'}
                            {activeTab === 'complaints' && 'Şikayet & Talep Yönetimi'}
                            {activeTab === 'broadcast' && 'Mesaj Merkezi'}
                            {activeTab === 'staff' && 'Personel Yönetimi'}
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
                            {activeTab === 'services' && <ServicesManager />}
                            {activeTab === 'feedbacks' && <FeedbackManager />}
                            {activeTab === 'complaints' && <ComplaintsManager />}
                            {activeTab === 'complaints' && <ComplaintsManager />}
                            {activeTab === 'broadcast' && <BroadcastManager />}
                            {activeTab === 'staff' && <StaffManager />}
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

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Manual Booking / Edit Form
    const [manualForm, setManualForm] = useState({ customerName: '', phone: '', date: '', hour: '', notes: '', barberId: '' });
    const [barbers, setBarbers] = useState([]);
    const [selectedBarber, setSelectedBarber] = useState('');

    useEffect(() => {
        const fetchBarbers = async () => {
            try {
                const res = await API.get('/admin/staff');
                // Filter only those who can take appointments (e.g. role BARBER or ADMIN)
                setBarbers(res.data);
            } catch (e) { console.error(e); }
        };
        fetchBarbers();
    }, []);

    const fetchAppointments = async () => {
        try {
            let url = '/admin/appointments';
            if (subTab === 'archive') {
                url += '?view=archive';
            }
            if (selectedBarber) {
                url += `${url.includes('?') ? '&' : '?'}barberId=${selectedBarber}`;
            }
            const res = await API.get(url);
            setAppointments(res.data);
        } catch (error) { toast.error('Yüklenemedi: ' + (error.response?.data?.error || error.message)); }
    };

    useEffect(() => { fetchAppointments(); }, [subTab, selectedBarber]);

    // Auto-select barber if filtering by one
    useEffect(() => {
        if (selectedBarber && !isEditMode) {
            setManualForm(prev => ({ ...prev, barberId: selectedBarber }));
        }
    }, [selectedBarber, isEditMode]);

    // --- Handlers ---

    const openCreateModal = () => {
        setIsEditMode(false);
        setManualForm({ customerName: '', phone: '', date: '', hour: '', notes: '', barberId: selectedBarber || '' });
        setShowModal(true);
    };

    const openEditModal = (appt) => {
        setIsEditMode(true);
        setEditingId(appt._id || appt.id);
        setManualForm({
            customerName: appt.customerName,
            phone: appt.phone,
            date: appt.date,
            hour: appt.hour,
            notes: appt.notes || '',
            barberId: appt.barberId || ''
        });
        setShowModal(true);
    };

    const openBlockModal = () => {
        setIsEditMode(false);
        setManualForm({
            customerName: 'KAPALI',
            phone: '0000000000',
            date: '',
            hour: '',
            notes: 'Mola / Kapalı Slot'
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const confirmMsg = isEditMode ? 'Değişiklikleri kaydediyor musunuz?' : 'Yeni kaydı onaylıyor musunuz?';
        if (!window.confirm(confirmMsg)) return;

        try {
            if (isEditMode) {
                await API.put(`/admin/appointments/${editingId}`, manualForm);
                toast.success('Randevu güncellendi');
            } else {
                await API.post('/admin/appointments', manualForm);
                toast.success('Kayıt oluşturuldu');
            }
            setShowModal(false);
            setManualForm({ customerName: '', phone: '', date: '', hour: '', notes: '', barberId: '' });
            fetchAppointments();
        } catch (error) { toast.error('İşlem başarısız: ' + (error.response?.data?.error || error.message)); }
    };

    const handleShowHistory = async (phone) => {
        if (!phone || phone === '0000000000') return;
        setHistoryLoading(true);
        setShowHistoryModal(true);
        try {
            const res = await API.get(`/admin/appointments/search?q=${phone}`);
            setHistoryData(res.data);
        } catch (e) { toast.error('Geçmiş yüklenemedi'); }
        finally { setHistoryLoading(false); }
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
                    {/* Barber Filter */}
                    <select
                        value={selectedBarber}
                        onChange={(e) => setSelectedBarber(e.target.value)}
                        className="bg-dark-950/50 text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-gold-500"
                    >
                        <option value="">Tüm Personel</option>
                        {barbers.map(b => (
                            <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={openBlockModal} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all">
                        ⛔ Saat Kapat
                    </button>
                    <button onClick={openCreateModal} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all">
                        <IconPlus /> Randevu Ekle
                    </button>
                </div>
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
                                        <button
                                            onClick={() => handleShowHistory(app.phone)}
                                            className="text-white hover:text-gold-400 font-bold underline decoration-dotted underline-offset-4 transition-colors text-left"
                                        >
                                            {app.customerName}
                                        </button>
                                        <a
                                            href={`tel:${app.phone}`}
                                            className="text-gold-400 hover:text-gold-300 text-xs transition-colors flex items-center gap-1"
                                        >
                                            📞 {formatPhone(app.phone)}
                                        </a>
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
                                            <button
                                                onClick={() => openEditModal(app)}
                                                className="p-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500 hover:text-white"
                                                title="Düzenle"
                                            >
                                                ✏️
                                            </button>
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


            {/* Manual/Block/Edit Modal */}
            {/* Manual/Block/Edit Modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] border border-white/20 p-6 md:p-8 rounded-2xl w-full max-w-md relative shadow-2xl">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-full"><IconX /></button>
                        <h3 className="text-xl font-serif text-white mb-6">
                            {manualForm.customerName === 'KAPALI' ? '⛔ Saat Kapat (Mola)' : isEditMode ? '✏️ Randevu Düzenle' : '➕ Yeni Randevu'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            {manualForm.customerName !== 'KAPALI' && (
                                <>
                                    <input required placeholder="Ad Soyad" className="w-full bg-white/10 border border-white/20 p-3 rounded text-white placeholder-gray-500 focus:border-gold-500 outline-none transition-colors" value={manualForm.customerName} onChange={e => setManualForm({ ...manualForm, customerName: e.target.value })} />
                                    <input required placeholder="Telefon" className="w-full bg-white/10 border border-white/20 p-3 rounded text-white placeholder-gray-500 focus:border-gold-500 outline-none transition-colors" value={manualForm.phone} onChange={e => setManualForm({ ...manualForm, phone: e.target.value })} />

                                    <div>
                                        <select
                                            value={manualForm.barberId || ''}
                                            onChange={e => {
                                                const b = barbers.find(bar => bar._id === e.target.value);
                                                setManualForm({ ...manualForm, barberId: e.target.value, barberName: b ? b.name : '' });
                                            }}
                                            className="w-full bg-dark-900 border border-white/20 p-3 rounded text-white outline-none focus:border-gold-500"
                                        >
                                            <option className="bg-dark-900 text-white" value="">Personel Seçiniz (Opsiyonel)</option>
                                            {barbers.map(b => (
                                                <option className="bg-dark-900 text-white" key={b._id} value={b._id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block pl-1">Tarih</label>
                                    <input type="date" required className="w-full bg-white/10 border border-white/20 p-3 rounded text-white focus:border-gold-500 outline-none transition-colors" value={manualForm.date} onChange={e => setManualForm({ ...manualForm, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block pl-1">Saat</label>
                                    <select
                                        required
                                        className="w-full bg-dark-900 border border-white/20 p-3 rounded text-white focus:border-gold-500 outline-none transition-colors appearance-none"
                                        value={manualForm.hour}
                                        onChange={e => setManualForm({ ...manualForm, hour: e.target.value })}
                                    >
                                        <option className="bg-dark-900 text-white" value="">Seçiniz</option>
                                        {Array.from({ length: 14 }, (_, i) => i + 9).map(h => (
                                            <option className="bg-dark-900 text-white" key={h} value={`${String(h).padStart(2, '0')}:00`}>
                                                {String(h).padStart(2, '0')}:00
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <textarea placeholder="Notlar (Opsiyonel)" rows="3" className="w-full bg-white/10 border border-white/20 p-3 rounded text-white placeholder-gray-500 focus:border-gold-500 outline-none transition-colors" value={manualForm.notes || ''} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} />

                            <button type="submit" className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95 ${manualForm.customerName === 'KAPALI' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gold-500 text-dark-950 hover:bg-gold-400'}`}>
                                {manualForm.customerName === 'KAPALI' ? 'Bu Saati Kapat' : 'Kaydet'}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-white/10 p-6 md:p-8 rounded-2xl w-full max-w-2xl relative max-h-[80vh] flex flex-col">
                        <button onClick={() => setShowHistoryModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><IconX /></button>
                        <h3 className="text-xl font-serif text-white mb-4">Müşteri Geçmişi</h3>

                        {historyLoading ? (
                            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                        ) : historyData.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Kayıt bulunamadı.</div>
                        ) : (
                            <div className="overflow-y-auto flex-1 space-y-2">
                                {historyData.map(h => (
                                    <div key={h._id} className="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-white">{h.date} - {h.hour}</p>
                                            <p className="text-sm text-gray-400">{h.serviceName || 'Hizmet'}</p>
                                        </div>
                                        <div className={`text-xs px-2 py-1 rounded ${h.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {h.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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

const StaffManager = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'BARBER', color: '#D4AF37' });

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const res = await API.get('/admin/staff');
            setStaff(res.data);
        } catch (error) {
            toast.error('Personel listesi yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/staff', formData);
            toast.success('Personel eklendi ✅');
            setShowModal(false);
            setFormData({ username: '', password: '', name: '', role: 'BARBER', color: '#D4AF37' });
            fetchStaff();
        } catch (error) {
            toast.error(error.response?.data?.error || 'İşlem başarısız');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu personeli silmek istediğinize emin misiniz?')) return;
        try {
            await API.delete(`/admin/staff/${id}`);
            toast.success('Personel silindi');
            fetchStaff();
        } catch (error) {
            toast.error('Silinemedi');
        }
    };

    const openCreateModal = () => {
        setFormData({ username: '', password: '', name: '', role: 'BARBER', color: '#D4AF37' });
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                <div>
                    <h2 className="text-2xl font-serif text-white flex items-center gap-3">
                        <span className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><IconUsers /></span>
                        Personel Listesi
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Sisteme giriş yapabilecek personelleri yönetin.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all hover:scale-[1.02] cursor-pointer relative z-50"
                >
                    <IconPlus /> Yeni Personel Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staff.map(user => (
                    <div key={user._id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-6 relative group transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-dark-950 border border-white/10" style={{ color: user.color }}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">{user.name}</h3>
                                    <p className="text-gray-500 text-xs">@{user.username}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(user._id)} className="text-gray-600 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors" title="Sil">
                                <IconX />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${user.role === 'ADMIN' ? 'bg-gold-500/20 text-gold-500' : 'bg-blue-500/20 text-blue-400'}`}>
                                {user.role}
                            </span>
                            <div className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: user.color }}></div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && createPortal(
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-dark-900 border border-white/20 p-8 rounded-2xl w-full max-w-md relative shadow-2xl"
                    >
                        <button type="button" onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><IconX /></button>
                        <h3 className="text-xl font-serif text-white mb-6">Yeni Personel Ekle</h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block pl-1">Ad Soyad (Görünen İsim)</label>
                                <input required type="text" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-purple-500 transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block pl-1">Kullanıcı Adı (Giriş İçin)</label>
                                <input required type="text" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-purple-500 transition-colors" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block pl-1">Şifre</label>
                                <input required type="password" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-purple-500 transition-colors" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block pl-1">Rol</label>
                                    <select className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-purple-500" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                        <option className="bg-dark-950 text-white" value="BARBER">Berber</option>
                                        <option className="bg-dark-950 text-white" value="ADMIN">Yönetici</option>
                                        <option className="bg-dark-950 text-white" value="STAFF">Personel</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block pl-1">Renk</label>
                                    <input type="color" className="w-full h-[46px] bg-transparent border-0 cursor-pointer" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl mt-4 transition-colors">
                                Oluştur
                            </button>
                        </form>
                    </motion.div>
                </div>,
                document.body
            )}
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
    const [closedDates, setClosedDates] = useState([]);
    const [newClosedDate, setNewClosedDate] = useState({ date: '', reason: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchClosedDates();
    }, []);

    const fetchClosedDates = async () => {
        try {
            const res = await API.get('/admin/closed-dates');
            setClosedDates(res.data);
        } catch (error) { console.error(error); }
    };

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

    const handleAddClosedDate = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/closed-dates', newClosedDate);
            toast.success('Tatil günü eklendi');
            setNewClosedDate({ date: '', reason: '' });
            fetchClosedDates();
        } catch (error) { toast.error('Eklenemedi'); }
    };

    const handleDeleteClosedDate = async (id) => {
        if (!window.confirm('Silmek istiyor musunuz?')) return;
        try {
            await API.delete(`/admin/closed-dates/${id}`);
            toast.success('Silindi');
            fetchClosedDates();
        } catch (error) { toast.error('Silinemedi'); }
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
            {/* Closed Dates Management */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="text-xl font-serif text-white mb-6 flex items-center gap-2">
                    <span className="p-2 bg-red-500/20 rounded-lg text-red-400">📅</span>
                    Tatil ve Kapalı Günler
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-white font-bold mb-4">Yeni Kapalı Gün Ekle</h4>
                        <form onSubmit={handleAddClosedDate} className="space-y-4">
                            <input
                                type="date"
                                required
                                className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-3"
                                value={newClosedDate.date}
                                onChange={e => setNewClosedDate({ ...newClosedDate, date: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Sebep (Örn: Bayram)"
                                className="w-full bg-dark-950/50 border border-white/10 text-white rounded-xl p-3"
                                value={newClosedDate.reason}
                                onChange={e => setNewClosedDate({ ...newClosedDate, reason: e.target.value })}
                            />
                            <button type="submit" className="w-full bg-red-500/20 text-red-400 border border-red-500/50 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors">
                                Günü Kapat
                            </button>
                        </form>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4">Kapalı Günler Listesi</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {closedDates.length === 0 && <p className="text-gray-500 text-sm">Kapalı gün bulunmuyor.</p>}
                            {closedDates.map(d => (
                                <div key={d._id || d.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                    <div>
                                        <p className="text-white font-bold">{d.date}</p>
                                        <p className="text-gray-500 text-xs">{d.reason}</p>
                                    </div>
                                    <button onClick={() => handleDeleteClosedDate(d._id || d.id)} className="text-red-400 hover:text-red-300 text-xs uppercase font-bold">Sil</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ComplaintsManager = () => {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchComplaints = async () => {
        try {
            const res = await API.get('/complaints');
            setComplaints(res.data);
        } catch (e) { toast.error('Şikayetler yüklenemedi'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchComplaints(); }, []);

    const handleResolve = async (id) => {
        try {
            await API.patch(`/complaints/${id}/resolve`);
            toast.success('Şikayet çözüldü olarak işaretlendi');
            fetchComplaints();
        } catch (e) { toast.error('İşlem başarısız'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu kaydı silmek istiyor musunuz?')) return;
        try {
            await API.delete(`/complaints/${id}`);
            toast.success('Silindi');
            fetchComplaints();
        } catch (e) { toast.error('Silinemedi'); }
    };

    return (
        <div className="space-y-6">
            <div className="h-full overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? <div className="text-white">Yükleniyor...</div> : complaints.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-lg">Henüz şikayet veya talep bulunmuyor. 🎉</p>
                        </div>
                    ) : (
                        complaints.map(item => (
                            <div key={item._id} className={`p-6 rounded-2xl border ${item.status === 'resolved' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'} relative group`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-white font-bold">{item.customerName}</h4>
                                        <p className="text-sm text-gray-400">{item.phone}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${item.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {item.status === 'resolved' ? 'Çözüldü' : 'Bekliyor'}
                                    </span>
                                </div>
                                <p className="text-gray-300 text-sm mb-6 bg-dark-950/30 p-3 rounded-lg border border-white/5">
                                    "{item.message}"
                                </p>
                                <div className="flex justify-between items-center text-xs text-gray-500 border-t border-white/5 pt-4">
                                    <span>{new Date(item.createdAt).toLocaleString('tr-TR')}</span>
                                    <div className="flex gap-2">
                                        {item.status !== 'resolved' && (
                                            <button onClick={() => handleResolve(item._id)} className="text-green-400 hover:text-green-300 font-bold transition-colors">
                                                ✓ Çözüldü
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(item._id)} className="text-red-400 hover:text-red-300 ml-2 transition-colors">
                                            Sil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

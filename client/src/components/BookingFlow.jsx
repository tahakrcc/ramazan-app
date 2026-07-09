import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import GrainOverlay from '../components/GrainOverlay';
import CustomCursor from '../components/CustomCursor';

const CONFIG = {
    businessName: 'By Ramazan',
    tagline: 'GENTLEMEN\'S\nGROOMING',
    workingHours: { start: 8, end: 20 },
    location: {
        address: 'Movenpick Hotel -1 Kat',
        city: 'Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    },
    whatsapp: '905306978233'
};

const AccordionSection = ({ title, step, activeStep, onOpen, isCompleted, children, summary }) => {
    const isOpen = activeStep === step;
    return (
        <div className="border border-white/10 rounded-sm mb-4 bg-dark-900 overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <button
                type="button"
                onClick={() => onOpen(step)}
                className="w-full flex items-center justify-between p-4 md:p-6 bg-dark-950 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base transition-all duration-300 ${isCompleted || isOpen ? 'bg-gold-500 text-dark-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'bg-dark-800 text-gray-500'}`}>
                        {isCompleted && !isOpen ? '✓' : step}
                    </div>
                    <div className="text-left flex flex-col justify-center">
                        <h3 className={`font-serif text-lg md:text-2xl leading-none ${isOpen || isCompleted ? 'text-white' : 'text-gray-500'}`}>{title}</h3>
                        {!isOpen && isCompleted && summary && <p className="text-gold-500 text-xs mt-2 uppercase tracking-widest leading-none">{summary}</p>}
                    </div>
                </div>
                <div className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-gold-500' : ''}`}>
                    ▼
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5"
                    >
                        <div className="p-4 md:p-6 bg-dark-950/50">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const BookingFlow = ({ onBack, services, barbers, settings }) => {
    const [isLoading, setIsLoading] = useState(true);
    
    
    // Accordion State
    const [activeAccordion, setActiveAccordion] = useState(1);
    
    // Booking State
    const [isDoubleBooking, setIsDoubleBooking] = useState(false);
    const [selection, setSelection] = useState({ service: null, barber: null, date: null, slots: [] });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [formData, setFormData] = useState({ name: '', phone: '', secondName: '', secondPhone: '' });
    const [savedProfiles, setSavedProfiles] = useState([]);
    const [showSecondPerson, setShowSecondPerson] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        

        // Load Profiles
        let profiles = [];
        const saved = localStorage.getItem('byramazan_profiles');
        if (saved) {
            try {
                profiles = JSON.parse(saved);
            } catch (e) {
                profiles = [];
            }
        }
        setSavedProfiles(profiles);
        if (profiles.length > 0) {
            setFormData(prev => ({ ...prev, name: profiles[0].name, phone: profiles[0].phone }));
        }
    }, []);

    // Fetch Slots when date/barber changes
    useEffect(() => {
        if (selection.date) {
            const fetchSlots = async () => {
                try {
                    const barberQuery = selection.barber ? `&barberId=${selection.barber._id}` : '';
                    const res = await API.get(`/appointments/available?date=${selection.date}${barberQuery}`);
                    setAvailableSlots(res.data.availableSlots || []);
                } catch (error) {
                    toast.error('Saatler yüklenemedi');
                }
            };
            fetchSlots();
        }
    }, [selection.date, selection.barber]);

    // Cleanup slots when switching dates
    useEffect(() => {
        setSelection(prev => ({ ...prev, slots: [] }));
    }, [selection.date]);

    const handlePhoneChange = (val, field) => {
        let cleaned = val.replace(/\D/g, '');
        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
        cleaned = cleaned.substring(0, 10);
        setFormData({ ...formData, [field]: cleaned });
    };

    const clearSavedData = () => {
        setFormData(prev => ({ ...prev, name: '', phone: '' }));
        toast.info('Yeni kişi bilgilerini girebilirsiniz.', { autoClose: 2000 });
    };

    const deleteProfile = (e, phoneToRemove) => {
        e.stopPropagation();
        const updated = savedProfiles.filter(p => p.phone !== phoneToRemove);
        setSavedProfiles(updated);
        localStorage.setItem('byramazan_profiles', JSON.stringify(updated));
        if (formData.phone === phoneToRemove) {
            setFormData(prev => ({ ...prev, name: '', phone: '' }));
        }
        toast.info('Kişi silindi.');
    };

    const submitBooking = async (e) => {
        e.preventDefault();
        
        if (formData.phone.length !== 10) {
            toast.error('Lütfen telefon numarasını eksiksiz 10 hane olarak giriniz (Başına 0 koymadan).');
            return;
        }
        if (isDoubleBooking && formData.secondPhone && formData.secondPhone.length !== 10) {
            toast.error('Lütfen 2. kişinin telefon numarasını eksiksiz 10 hane olarak giriniz.');
            return;
        }
        if (isDoubleBooking && selection.slots.length !== 2) {
            toast.error('Lütfen 2 adet saat seçiniz.');
            return;
        }

        try {
            const sortedSlots = [...selection.slots].sort();
            const payload = {
                customerName: formData.name,
                phone: formData.phone,
                date: selection.date,
                hour: sortedSlots[0],
                service: selection.service.id,
                barberId: selection.barber?._id,
                barberName: selection.barber?.name
            };

            const existingProfilesStr = localStorage.getItem('byramazan_profiles');
            const existingProfiles = existingProfilesStr ? JSON.parse(existingProfilesStr) : [];

            // 1st Appt
            await API.post('/appointments', payload);
            
            // Save 1st Profile
            const newProfile = { name: formData.name, phone: formData.phone };
            if (!existingProfiles.some(p => p.phone === newProfile.phone)) {
                existingProfiles.push(newProfile);
                localStorage.setItem('byramazan_profiles', JSON.stringify(existingProfiles));
                setSavedProfiles([...existingProfiles]);
            }

            // 2nd Appt
            if (isDoubleBooking) {
                await API.post('/appointments', {
                    ...payload,
                    customerName: formData.secondName || formData.name,
                    phone: formData.secondPhone || formData.phone,
                    hour: sortedSlots[1],
                });

                if (formData.secondName && formData.secondPhone) {
                    const secondProfile = { name: formData.secondName, phone: formData.secondPhone };
                    if (!existingProfiles.some(p => p.phone === secondProfile.phone)) {
                        existingProfiles.push(secondProfile);
                        localStorage.setItem('byramazan_profiles', JSON.stringify(existingProfiles));
                        setSavedProfiles([...existingProfiles]);
                    }
                }
            }

            setIsSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || error.message || 'Hata oluştu. Seçilen saatler dolmuş olabilir.';
            toast.error(errorMsg);
        }
    };

    



    return (
        <div className="bg-dark-950 min-h-screen text-white font-sans selection:bg-gold-500 selection:text-dark-950 overflow-x-hidden cursor-none pt-24 pb-20 relative">
            <GrainOverlay />
            <CustomCursor />
            
            {/* Simple Navbar */}
            

            <div className="max-w-2xl mx-auto px-4 mt-8 relative z-10">
                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-serif mb-4">Randevu Oluştur</h1>
                    <p className="text-gray-400 text-sm tracking-widest uppercase">Size en uygun zamanı seçin.</p>
                </div>

                {/* ACCORDION 1: Hizmet Seçimi */}
                <AccordionSection 
                    title="Hizmet & Kişi Sayısı" 
                    step={1} 
                    activeStep={activeAccordion} 
                    onOpen={setActiveAccordion}
                    isCompleted={selection.service !== null}
                    summary={selection.service ? `${isDoubleBooking ? '2 Kişi' : 'Tek Kişi'} • ${selection.service.name}` : ''}
                >
                    <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-sm">
                        <p className="text-xs text-gray-400 mb-4 font-bold uppercase tracking-widest">Kişi Sayısı Seçin</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsDoubleBooking(false)}
                                className={`flex-1 py-3 rounded-sm border transition-all flex items-center justify-center gap-2 ${!isDoubleBooking ? 'bg-gold-500 text-dark-950 border-gold-500 font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-white/10 text-gray-400 hover:text-white'}`}
                            >
                                <span>👤</span> Tek Kişi
                            </button>
                            <button
                                onClick={() => setIsDoubleBooking(true)}
                                className={`flex-1 py-3 rounded-sm border transition-all flex items-center justify-center gap-2 ${isDoubleBooking ? 'bg-gold-500 text-dark-950 border-gold-500 font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-white/10 text-gray-400 hover:text-white'}`}
                            >
                                <span>👥</span> İki Kişi
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-4 font-bold uppercase tracking-widest">Hizmet Seçin</p>
                    <div className="grid gap-3">
                        {services.map(s => (
                            <button
                                key={s.id}
                                onClick={() => {
                                    setSelection({ ...selection, service: s });
                                    setTimeout(() => setActiveAccordion(2), 200);
                                }}
                                className={`text-left p-4 md:p-5 border transition-all group rounded-sm flex justify-between items-center ${selection.service?.id === s.id ? 'border-gold-500 bg-gold-500/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-white/10 hover:border-gold-500/50 hover:bg-white/5'}`}
                            >
                                <span className={`font-serif text-lg md:text-xl ${selection.service?.id === s.id ? 'text-gold-500' : 'text-gray-200'}`}>{s.name}</span>
                                <span className={`font-serif text-lg ${selection.service?.id === s.id ? 'text-gold-500' : 'text-gray-400'}`}>{s.price}₺</span>
                            </button>
                        ))}
                    </div>
                </AccordionSection>

                {/* ACCORDION 2: Personel Seçimi */}
                <AccordionSection 
                    title="Personel Seçimi" 
                    step={2} 
                    activeStep={activeAccordion} 
                    onOpen={(step) => { if (selection.service) setActiveAccordion(step); }}
                    isCompleted={selection.barber !== null}
                    summary={selection.barber?.name === 'Admin' ? 'Ramazan' : selection.barber?.name}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {barbers.map(b => (
                            <button
                                key={b._id}
                                onClick={() => {
                                    setSelection({ ...selection, barber: b });
                                    setTimeout(() => setActiveAccordion(3), 200);
                                }}
                                className={`flex items-center gap-4 p-4 border transition-all group rounded-sm text-left ${selection.barber?._id === b._id ? 'border-gold-500 bg-gold-500/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-white/10 hover:border-gold-500/50 hover:bg-white/5'}`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold bg-dark-950 border transition-colors ${selection.barber?._id === b._id ? 'border-gold-500' : 'border-white/10'}`} style={{ color: b.color || '#D4AF37' }}>
                                    {b.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className={`font-serif text-lg ${selection.barber?._id === b._id ? 'text-gold-500' : 'text-white'}`}>{b.name === 'Admin' ? 'Ramazan' : b.name}</h3>
                                    <p className="text-gray-400 text-[10px] uppercase tracking-widest">{b.role === 'ADMIN' ? 'Master Barber' : 'Barber'}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </AccordionSection>

                {/* ACCORDION 3: Tarih & Saat */}
                <AccordionSection 
                    title="Tarih ve Saat" 
                    step={3} 
                    activeStep={activeAccordion} 
                    onOpen={(step) => { if (selection.barber) setActiveAccordion(step); }}
                    isCompleted={selection.date !== null && selection.slots.length > (isDoubleBooking ? 1 : 0)}
                    summary={selection.date ? `${format(new Date(selection.date), 'dd MMM', {locale: tr})} • ${selection.slots.join(', ')}` : ''}
                >
                    {/* Date Scroller */}
                    <div className="mb-8">
                        <p className="text-xs text-gray-400 mb-3 font-bold uppercase tracking-widest">Gün Seçin</p>
                        <div id="date-scroller" className="flex gap-2 md:gap-3 overflow-x-auto pb-4 hide-scrollbar px-1 scroll-smooth">
                            {Array.from({ length: settings?.bookingRangeDays || 14 }).map((_, i) => {
                                const now = new Date();
                                const turkeyNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
                                const dateObj = addDays(turkeyNow, i);
                                const d = format(dateObj, 'yyyy-MM-dd');
                                const isClosed = settings.closedWeekDays?.includes(dateObj.getDay());
                                const isSelected = selection.date === d;
                                return (
                                    <button
                                        key={d}
                                        onClick={() => !isClosed && setSelection({ ...selection, date: d })}
                                        disabled={isClosed}
                                        className={`flex-shrink-0 w-16 h-20 md:w-20 md:h-24 border ${isClosed ? 'border-red-900/30 bg-red-950/20 text-gray-600 opacity-50' : isSelected ? 'border-gold-500 bg-gold-500 text-dark-950 shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'border-white/10 hover:border-gold-500 text-gray-400 hover:text-white'} transition-all flex flex-col items-center justify-center rounded-sm relative`}
                                    >
                                        <span className="text-[10px] uppercase tracking-widest opacity-80">{format(dateObj, 'EEE', { locale: tr })}</span>
                                        <span className="text-xl md:text-2xl font-serif font-bold mt-1">{format(dateObj, 'dd')}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Time Slots */}
                    {selection.date && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Saat Seçin {isDoubleBooking && "(2 Adet)"}</p>
                                {isDoubleBooking && selection.slots.length > 0 && (
                                    <span className="text-[10px] text-gold-500 border border-gold-500/30 px-2 py-1 rounded-sm bg-gold-500/10">
                                        {selection.slots.length}/2 Seçildi
                                    </span>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 md:gap-3">
                                {availableSlots.length > 0 ? availableSlots.map(t => {
                                    const isSelected = selection.slots.includes(t);
                                    const index = selection.slots.indexOf(t);
                                    let bgClass = "border-white/10 bg-dark-950 text-gray-300 hover:border-gold-500 hover:text-white";
                                    
                                    if (isSelected) {
                                        bgClass = index === 0 
                                            ? "bg-gold-500 text-dark-950 border-gold-500 font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]" 
                                            : "bg-gray-200 text-dark-950 border-gray-200 font-bold shadow-[0_0_15px_rgba(255,255,255,0.3)]";
                                    }
                                    
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                let newSlots = [...selection.slots];
                                                if (isDoubleBooking) {
                                                    if (newSlots.length >= 2) newSlots = [t];
                                                    else if (newSlots.includes(t)) newSlots = newSlots.filter(s => s !== t);
                                                    else newSlots.push(t);
                                                } else {
                                                    newSlots = [t];
                                                }
                                                setSelection({ ...selection, slots: newSlots });
                                                
                                                if (!isDoubleBooking && newSlots.length === 1) setTimeout(() => setActiveAccordion(4), 400);
                                                if (isDoubleBooking && newSlots.length === 2) setTimeout(() => setActiveAccordion(4), 400);
                                            }}
                                            className={`py-3 md:py-4 border transition-all rounded-sm text-sm relative ${bgClass}`}
                                        >
                                            {t}
                                            {isSelected && isDoubleBooking && (
                                                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] flex items-center justify-center bg-dark-900 text-white font-bold border border-white/20">
                                                    {index + 1}
                                                </span>
                                            )}
                                        </button>
                                    );
                                }) : (
                                    <div className="col-span-3 py-6 px-4 text-center border border-dashed border-white/10 rounded-sm bg-white/5">
                                        <span className="text-2xl mb-2 block">📅</span>
                                        <p className="text-gray-400 text-sm">Müsait saat bulunamadı.<br/>Lütfen başka bir gün veya personel seçin.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </AccordionSection>

                {/* ACCORDION 4: Bilgileriniz & Onay */}
                <AccordionSection 
                    title="Kişisel Bilgiler & Onay" 
                    step={4} 
                    activeStep={activeAccordion} 
                    onOpen={(step) => { if (selection.slots.length > (isDoubleBooking ? 1 : 0)) setActiveAccordion(step); }}
                    isCompleted={false}
                >
                    <form onSubmit={submitBooking} className="space-y-6">
                        
                        {savedProfiles.length > 0 && (
                            <div className="mb-6 p-4 md:p-5 bg-dark-950 border border-white/5 rounded-sm shadow-inner">
                                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                    <span className="text-xs uppercase tracking-widest text-gold-500 font-bold">Kayıtlı Profiller</span>
                                    <button type="button" onClick={clearSavedData} className="text-[10px] uppercase text-white hover:text-gold-500 transition-colors">+ Yeni Kişi Ekle</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {savedProfiles.map((profile, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => setFormData(prev => ({ ...prev, name: profile.name, phone: profile.phone }))}
                                            className={`relative cursor-pointer px-4 py-2 rounded-sm border transition-all flex items-center gap-3 ${formData.phone === profile.phone ? 'bg-gold-500/20 border-gold-500 text-gold-500' : 'bg-white/5 border-white/10 text-gray-400 hover:border-gold-500/50'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold uppercase tracking-wider">{profile.name}</span>
                                                <span className="text-[10px] tracking-widest opacity-80">{profile.phone}</span>
                                            </div>
                                            <button onClick={(e) => deleteProfile(e, profile.phone)} className="ml-2 w-5 h-5 flex items-center justify-center rounded-full bg-dark-900 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h4 className="text-sm font-serif text-white border-b border-white/10 pb-2">{isDoubleBooking ? '1. Kişi Bilgileri (Kendiniz)' : 'Sizin Bilgileriniz'}</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-widest text-gold-500 ml-1">Ad Soyad</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border-b-2 border-white/10 py-3 px-4 text-white focus:outline-none focus:border-gold-500 focus:bg-white/10 transition-all rounded-t-sm" placeholder="İsminizi giriniz" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-widest text-gold-500 ml-1">Telefon</label>
                                    <input type="tel" required value={formData.phone} onChange={e => handlePhoneChange(e.target.value, 'phone')} className="w-full bg-white/5 border-b-2 border-white/10 py-3 px-4 text-white focus:outline-none focus:border-gold-500 focus:bg-white/10 transition-all rounded-t-sm tracking-widest" placeholder="5XX XXX XX XX" />
                                </div>
                            </div>
                        </div>

                        {isDoubleBooking && (
                            <div className="space-y-4 pt-4 mt-4 border-t border-white/5">
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <h4 className="text-sm font-serif text-white">2. Kişi Bilgileri</h4>
                                    <button type="button" onClick={() => setShowSecondPerson(!showSecondPerson)} className="text-[10px] text-gray-400 hover:text-white uppercase transition-colors">{showSecondPerson ? 'Gizle' : 'Farklı Bir İsim Ekle (Opsiyonel)'}</button>
                                </div>
                                <AnimatePresence>
                                    {showSecondPerson && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <p className="text-gray-500 text-[10px] mb-3">*Eğer bu alanı boş bırakırsanız, 2. randevu da sizin adınıza oluşturulur.</p>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase tracking-widest text-gray-400 ml-1">Ad Soyad</label>
                                                    <input type="text" value={formData.secondName} onChange={e => setFormData({ ...formData, secondName: e.target.value })} className="w-full bg-white/5 border-b-2 border-white/10 py-3 px-4 text-white focus:outline-none focus:border-white focus:bg-white/10 transition-all rounded-t-sm" placeholder="Arkadaşınızın ismi" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase tracking-widest text-gray-400 ml-1">Telefon</label>
                                                    <input type="tel" value={formData.secondPhone} onChange={e => handlePhoneChange(e.target.value, 'secondPhone')} className="w-full bg-white/5 border-b-2 border-white/10 py-3 px-4 text-white focus:outline-none focus:border-white focus:bg-white/10 transition-all rounded-t-sm tracking-widest" placeholder="5XX XXX XX XX" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        <div className="pt-8">
                            <button
                                type="submit"
                                className="w-full py-4 md:py-6 bg-gold-500 text-dark-950 hover:bg-white hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all rounded-sm uppercase tracking-[0.2em] font-bold text-sm"
                            >
                                Randevuyu Oluştur
                            </button>
                        </div>
                    </form>
                </AccordionSection>
            </div>

            {/* SUCCESS MODAL */}
            <AnimatePresence>
                {isSuccess && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-dark-950/80 backdrop-blur-md px-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-dark-900 border border-gold-500/20 p-8 md:p-10 rounded-xl flex flex-col items-center max-w-sm w-full shadow-2xl relative"
                        >
                            <div className="w-20 h-20 border-2 border-gold-500 rounded-full flex items-center justify-center mb-6 text-gold-500 text-4xl shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                                ✓
                            </div>
                            <h2 className="text-3xl font-serif mb-3 text-center text-white">Teşekkürler</h2>
                            <p className="text-gray-400 mb-8 text-center text-sm leading-relaxed">
                                {isDoubleBooking ? 'Randevularınız başarıyla oluşturuldu. Sizi bekliyoruz.' : 'Randevunuz başarıyla oluşturuldu. Sizi bekliyoruz.'}
                            </p>
                            <button 
                                onClick={() => onBack()} 
                                className="w-full py-4 bg-gold-500 text-dark-950 font-bold uppercase tracking-widest rounded-sm hover:bg-white hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all"
                            >
                                KAPAT
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BookingFlow;

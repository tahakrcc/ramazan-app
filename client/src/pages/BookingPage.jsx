import React, { useState, useEffect, useRef } from 'react';
import API from '../utils/api';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import GrainOverlay from '../components/GrainOverlay';
import CustomCursor from '../components/CustomCursor';

const CONFIG = {
    businessName: 'By Ramazan',
    tagline: 'GENTLEMEN\'S\nGROOMING',
    workingHours: { start: 8, end: 20 },
    services: [
        { id: 'sac', name: 'Saç Kesimi', price: 500, duration: '45dk' },
        { id: 'sakal', name: 'Sakal Tıraşı', price: 300, duration: '30dk' },
        { id: 'sac_sakal', name: 'Komple Bakım', price: 600, duration: '1sa 15dk' }
    ],
    location: {
        address: 'Movenpick Hotel -1 Kat',
        city: 'Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    },
    whatsapp: '905307662779'
};

const BookingPage = () => {
    const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load Animation
    useEffect(() => {
        setTimeout(() => setIsLoading(false), 2000);
    }, []);

    if (isLoading) return <LoadingScreen />;

    return (
        <div className="bg-dark-950 min-h-screen text-white font-sans selection:bg-gold-500 selection:text-dark-950 overflow-x-hidden cursor-none">
            <GrainOverlay />
            <CustomCursor />
            <WhatsAppButton />
            <Nav />
            <AnimatePresence mode="wait">
                {step === 0 ? (
                    <LandingView key="landing" onStart={() => setStep(1)} />
                ) : (
                    <BookingFlow key="booking" onBack={() => setStep(0)} />
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Sub Components ---



const LoadingScreen = () => (
    <div className="fixed inset-0 bg-dark-950 flex items-center justify-center z-50">
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
            className="text-gold-500 font-serif text-6xl italic"
        >
            R
        </motion.div>
    </div>
);

const LandingView = ({ onStart }) => {
    const { scrollYProgress } = useScroll();
    const yHero = useTransform(scrollYProgress, [0, 1], [0, 300]);
    const opacityHero = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.8 }}
            className="relative"
        >
            {/* Hero Section */}
            <section className="h-screen flex items-center justify-center relative overflow-hidden px-6">
                {/* Abstract Background Shapes */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[150px] pointer-events-none"
                />

                <motion.div style={{ y: yHero, opacity: opacityHero }} className="z-10 text-center">
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 1 }}
                        className="mb-6 overflow-hidden"
                    >
                        <p className="text-gold-500 tracking-[0.5em] text-xs md:text-sm uppercase font-bold">Est. 2014</p>
                    </motion.div>

                    <h1 className="text-[12vw] leading-[0.8] font-serif font-medium mb-8">
                        <span className="block overflow-hidden"><motion.span initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="block text-white/90">BY</motion.span></span>
                        <span className="block overflow-hidden"><motion.span initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400">RAMAZAN</motion.span></span>
                    </h1>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="flex flex-col items-center gap-8"
                    >
                        <p className="max-w-md text-gray-300 text-sm md:text-base font-light leading-relaxed">
                            Erkek bakımında modern sanat. Sadece randevuyla çalışıyoruz.
                        </p>

                        <button
                            onClick={onStart}
                            className="group relative px-10 py-5 bg-white/5 border border-white/20 hover:border-gold-500 hover:bg-gold-500 transition-all duration-500 rounded-sm overflow-hidden"
                        >
                            <span className="relative z-10 text-xs tracking-[0.25em] uppercase text-white group-hover:text-dark-950 font-bold transition-colors duration-300">Randevu Al</span>
                        </button>
                    </motion.div>
                </motion.div>

            </section>

            {/* Editorial Services */}
            <ServicesSection />
            <AboutSection />
            <ContactSection />
            <Footer />
        </motion.div>
    );
};

const ServicesSection = () => (
    <section id="hizmetler" className="py-32 px-6 md:px-20 border-t border-white/5 bg-dark-900 relative">
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                <div className="max-w-xl">
                    <span className="text-gold-500 text-xs font-bold tracking-[0.3em] uppercase block mb-4">Hizmetlerimiz</span>
                    <h2 className="text-5xl md:text-7xl font-serif text-white leading-tight">Hizmet<br />Koleksiyonu</h2>
                </div>
                <p className="text-gray-400 max-w-sm text-sm leading-relaxed">Kendinizi yeniden keşfedin. Her işlem, uzman stilistlerimiz tarafından kişiye özel tasarlanır.</p>
            </div>

            <div className="grid grid-cols-1 gap-px bg-white/10 border border-white/10">
                {CONFIG.services.map((service, index) => (
                    <motion.div
                        key={service.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-dark-950 p-12 group hover:bg-dark-900 transition-colors duration-500 relative overflow-hidden"
                    >
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div>
                                <h3 className="text-3xl font-serif mb-2 text-white group-hover:text-gold-500 transition-colors">{service.name}</h3>
                                <p className="text-gray-300 text-sm tracking-widest uppercase">{service.duration} • Premium Bakım</p>
                            </div>
                            <div className="text-4xl font-serif text-gold-500 transition-colors">
                                {service.price}₺
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

const BookingFlow = ({ onBack }) => {
    const [bookingStep, setBookingStep] = useState(0); // 0: Service, 1: Date/Time, 2: Form, 3: Success
    const [selection, setSelection] = useState({ service: null, date: null, time: null });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [formData, setFormData] = useState({ name: '', phone: '' });

    // Fetch Slots logic
    useEffect(() => {
        if (selection.date) {
            const fetchSlots = async () => {
                try {
                    const res = await API.get(`/appointments/available?date=${selection.date}`);
                    setAvailableSlots(res.data.availableSlots || []);
                } catch (error) {
                    toast.error('Saatler yüklenemedi');
                }
            };
            fetchSlots();
        }
    }, [selection.date]);

    const handleServiceSelect = (s) => {
        setSelection({ ...selection, service: s });
        setBookingStep(1);
    };

    const handleTimeSelect = (t) => {
        setSelection({ ...selection, time: t });
        setBookingStep(2);
    };

    const submitBooking = async (e) => {
        e.preventDefault();
        try {
            await API.post('/appointments', {
                customerName: formData.name,
                phone: formData.phone,
                date: selection.date,
                hour: selection.time,
                service: selection.service.id
            });
            setBookingStep(3);
        } catch (error) {
            toast.error('Hata oluştu');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="min-h-screen bg-dark-950 flex flex-col pt-32"
        >
            <div className="p-8 flex justify-between items-center border-b border-white/5">
                <button
                    onClick={() => bookingStep > 0 ? setBookingStep(bookingStep - 1) : onBack()}
                    className="text-xs uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                    <span>←</span>
                    {bookingStep > 0 ? 'Geri' : 'Ana Menü'}
                </button>
                <div className="flex gap-2">
                    {[0, 1, 2].map(i => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i <= bookingStep ? 'bg-gold-500 shadow-[0_0_10px_#D4AF37]' : 'bg-dark-800'}`} />
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-start max-w-3xl mx-auto w-full px-6 py-8 md:py-12 pt-8">
                <AnimatePresence mode="wait">
                    {bookingStep === 0 && (
                        <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h2 className="text-4xl md:text-5xl font-serif mb-12 text-center text-white">Hizmet Seçimi</h2>
                            <div className="grid gap-4">
                                {CONFIG.services.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleServiceSelect(s)}
                                        className="text-left p-8 border border-white/10 hover:border-gold-500 hover:bg-white/5 transition-all group rounded-sm"
                                    >
                                        <div className="flex justify-between items-baseline">
                                            <h3 className="text-2xl font-serif text-gray-200 group-hover:text-gold-500 transition-colors">{s.name}</h3>
                                            <span className="text-xl text-gold-500 font-serif">{s.price}₺</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {bookingStep === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h2 className="text-3xl md:text-5xl font-serif mb-2 text-center text-white">Zamanlama</h2>
                            <p className="text-center text-gold-500 mb-8 md:mb-12 text-xs md:text-sm uppercase tracking-widest font-bold">
                                {selection.service?.name}
                            </p>

                            {/* Date Scroller */}
                            <div className="relative">
                                {/* Scroll Hint for Mobile */}
                                <div className="md:hidden absolute -top-6 right-0 text-gray-400 text-[10px] animate-bounce flex items-center gap-1">
                                    Kaydır <span className="text-gold-500">→</span>
                                </div>

                                {/* Desktop Scroll Buttons */}
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        document.getElementById('date-scroller').scrollBy({ left: -200, behavior: 'smooth' });
                                    }}
                                    className="hidden md:flex absolute -left-12 top-1/2 -translate-y-[60%] w-10 h-10 items-center justify-center text-gold-500 hover:text-white hover:scale-110 transition-all z-20 bg-dark-900/80 rounded-full border border-gold-500/30 shadow-[0_0_15px_rgba(212,175,55,0.1)] backdrop-blur-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        document.getElementById('date-scroller').scrollBy({ left: 200, behavior: 'smooth' });
                                    }}
                                    className="hidden md:flex absolute -right-12 top-1/2 -translate-y-[60%] w-10 h-10 items-center justify-center text-gold-500 hover:text-white hover:scale-110 transition-all z-20 bg-dark-900/80 rounded-full border border-gold-500/30 shadow-[0_0_15px_rgba(212,175,55,0.1)] backdrop-blur-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </button>

                                <div id="date-scroller" className="flex gap-3 md:gap-4 overflow-x-auto pb-8 mb-8 hide-scrollbar px-1 scroll-smooth">
                                    {Array.from({ length: 14 }).map((_, i) => {
                                        const d = format(addDays(new Date(), i), 'yyyy-MM-dd');
                                        const isSelected = selection.date === d;
                                        return (
                                            <button
                                                key={d}
                                                onClick={() => setSelection({ ...selection, date: d })}
                                                className={`flex-shrink-0 w-20 h-28 md:w-24 md:h-32 border ${isSelected ? 'border-gold-500 bg-gold-500 text-dark-950 shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'border-white/10 hover:border-gold-500 text-gray-400 hover:text-white'} transition-all flex flex-col items-center justify-center gap-2 rounded-sm`}
                                            >
                                                <span className="text-[10px] md:text-xs uppercase tracking-widest opacity-80">{format(addDays(new Date(), i), 'EEE', { locale: tr })}</span>
                                                <span className="text-2xl md:text-3xl font-serif font-bold">{format(addDays(new Date(), i), 'dd')}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Time Slots */}
                            {selection.date && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                                    {availableSlots.length > 0 ? availableSlots.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => handleTimeSelect(t)}
                                            className="py-3 md:py-4 border border-white/10 text-gray-300 hover:bg-gold-500 hover:border-gold-500 hover:text-dark-950 hover:font-bold transition-all rounded-sm text-sm md:text-base"
                                        >
                                            {t}
                                        </button>
                                    )) : (
                                        <div className="col-span-4 text-center text-gray-400 py-4 italic">Müsait saat bulunamadı.</div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {bookingStep === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-3xl md:text-5xl font-serif mb-8 md:mb-12 text-center text-white">Son Adım</h2>
                            <form onSubmit={submitBooking} className="space-y-6 md:space-y-8 max-w-md mx-auto">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-widest text-gold-500 font-bold ml-1">Ad Soyad</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border-b-2 border-white/10 py-3 md:py-4 px-4 text-lg md:text-xl text-white focus:outline-none focus:border-gold-500 focus:bg-white/10 transition-all rounded-t-sm"
                                        placeholder="İsminizi giriniz"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-widest text-gold-500 font-bold ml-1">Telefon</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-white/5 border-b-2 border-white/10 py-3 md:py-4 px-4 text-lg md:text-xl text-white focus:outline-none focus:border-gold-500 focus:bg-white/10 transition-all rounded-t-sm"
                                        placeholder="05XX XXX XX XX"
                                    />
                                </div>

                                <div className="pt-4 md:pt-8">
                                    <div className="bg-white/5 p-6 md:p-8 mb-6 md:mb-8 border border-white/10 rounded-sm">
                                        <div className="flex justify-between mb-4 pb-4 border-b border-white/5">
                                            <span className="text-gray-400 text-xs md:text-sm uppercase tracking-wider">Hizmet</span>
                                            <span className="text-white font-serif text-base md:text-lg">{selection.service?.name}</span>
                                        </div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-gray-400 text-xs md:text-sm uppercase tracking-wider">Tarih</span>
                                            <span className="text-white font-mono text-sm md:text-base">{selection.date}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 text-xs md:text-sm uppercase tracking-wider">Saat</span>
                                            <span className="text-gold-500 font-bold text-sm md:text-base">{selection.time}</span>
                                        </div>
                                    </div>

                                    <button type="submit" className="w-full bg-gold-500 text-dark-950 py-4 md:py-5 font-bold uppercase tracking-[0.2em] hover:bg-white hover:scale-[1.02] transition-all rounded-sm shadow-[0_0_20px_rgba(212,175,55,0.2)] text-sm md:text-base">
                                        Onayla & Bitir
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {bookingStep === 3 && (
                        <motion.div key="success" className="text-center py-20">
                            <motion.div
                                initial={{ scale: 0 }} animate={{ scale: 1 }}
                                className="w-24 h-24 border-2 border-gold-500 rounded-full flex items-center justify-center mx-auto mb-8 text-gold-500 text-4xl"
                            >
                                ✓
                            </motion.div>
                            <h2 className="text-5xl font-serif mb-6">Teşekkürler</h2>
                            <p className="text-gray-400 mb-12">Randevunuz başarıyla oluşturuldu.</p>
                            <button onClick={() => window.location.reload()} className="text-xs uppercase tracking-widest text-gold-500 border-b border-gold-500 pb-1 hover:text-white hover:border-white transition-colors">
                                Ana Sayfaya Dön
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

const AboutSection = () => (
    <section id="hakkimizda" className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
            <div className="relative aspect-[3/4] overflow-hidden group rounded-sm">
                <img
                    src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop"
                    alt="Barber"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter grayscale group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 to-transparent opacity-60"></div>
            </div>
            <div>
                <span className="text-gold-500 text-xs font-bold tracking-[0.3em] uppercase block mb-8">Manifesto</span>
                <h2 className="text-5xl md:text-6xl font-serif leading-tight mb-8 text-white">Sadece Bir Tıraş Değil,<br />Bir Ritüel.</h2>
                <p className="text-gray-300 text-lg leading-relaxed font-light mb-12">
                    By Ramazan'da biz, berberliği bir sanat formu olarak görüyoruz.
                    Her makas darbesi, her havlu sıcaklığı ve her sohbet,
                    sizin en iyi versiyonunuza ulaşmanız için tasarlandı.
                </p>
                <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
                    <div>
                        <div className="text-3xl font-serif text-white mb-2">20+</div>
                        <div className="text-xs uppercase tracking-widest text-gray-400">Yıllık Tecrübe</div>
                    </div>
                    <div>
                        <div className="text-3xl font-serif text-white mb-2">5k+</div>
                        <div className="text-xs uppercase tracking-widest text-gray-400">Mutlu Müşteri</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

const ContactSection = () => (
    <section id="iletisim" className="py-32 border-t border-white/5 bg-dark-900 text-center">
        <p className="text-gold-500 text-xs font-bold tracking-[0.3em] uppercase mb-8">İletişim</p>
        <h2 className="text-5xl md:text-8xl font-serif mb-12 text-white hover:text-gold-500 transition-colors duration-700 cursor-pointer">
            Bize Ulaşın
        </h2>
        <div className="flex flex-col md:flex-row justify-center gap-12 text-sm tracking-widest uppercase text-gray-400">
            <a href={`https://wa.me/${CONFIG.whatsapp}`} className="hover:text-white transition-colors">WhatsApp: {CONFIG.whatsapp}</a>
            <span className="hidden md:inline">•</span>
            <a href={CONFIG.location.mapsLink} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{CONFIG.location.address}, {CONFIG.location.city}</a>
        </div>
    </section>
);

const Footer = () => (
    <footer className="py-12 border-t border-white/5 text-center text-xs text-gray-600 uppercase tracking-widest">
        &copy; 2024 By Ramazan. All rights reserved.
    </footer>
);

const Nav = () => {
    return (
        <nav className="fixed top-0 left-0 right-0 p-6 md:p-8 flex justify-between items-center z-40 bg-gradient-to-b from-dark-950/80 to-transparent backdrop-blur-sm md:bg-none md:backdrop-blur-none transition-all duration-300">
            <span className="font-serif text-xl tracking-widest text-white mix-blend-difference z-50 relative">BY RAMAZAN</span>

            {/* Desktop Nav */}
            <div className="hidden md:flex gap-8 text-xs uppercase tracking-widest text-white mix-blend-difference">
                <a href="#hizmetler" className="hover:text-gold-500 transition-colors">Hizmetler</a>
                <a href="#hakkimizda" className="hover:text-gold-500 transition-colors">Hakkımızda</a>
                <a href="#iletisim" className="hover:text-gold-500 transition-colors">İletişim</a>
            </div>

            {/* Mobile Nav Actions */}
            <div className="flex md:hidden items-center gap-4 z-50">
                <button
                    onClick={() => document.querySelector('button[class*="group relative px-10"]').click()}
                    className="px-4 py-2 bg-gold-500 text-dark-950 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                >
                    Randevu Al
                </button>
            </div>
        </nav>
    );
};

const WhatsAppButton = () => (
    <motion.a
        href="https://wa.me/905306978233?text=merhaba"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="fixed bottom-8 left-8 z-50 group hover:scale-110 transition-transform duration-300"
    >
        {/* Using official PNG from a reliable CDN for perfect brand match */}
        <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
            alt="WhatsApp"
            className="w-16 h-16 drop-shadow-lg"
        />
    </motion.a>
);

export default BookingPage;

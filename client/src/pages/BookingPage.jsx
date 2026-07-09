import React, { useState, useEffect, useRef } from 'react';
import BookingFlow from '../components/BookingFlow';
import API from '../utils/api';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useAnimationFrame } from 'framer-motion';
import GrainOverlay from '../components/GrainOverlay';
import CustomCursor from '../components/CustomCursor';

const CONFIG = {
    businessName: 'By Ramazan',
    tagline: 'GENTLEMEN\'S\nGROOMING',
    workingHours: { start: 8, end: 20 },
    // services: removed hardcoded
    location: {
        address: 'Movenpick Hotel -1 Kat',
        city: 'Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    },
    whatsapp: '905306978233'
};

const BookingPage = () => {
    const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) setStep(1);
    }, []);
    const [isLoading, setIsLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [barbers, setBarbers] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [settings, setSettings] = useState({ bookingRangeDays: 14, closedWeekDays: [] }); // Dynamic settings

    // Initial Load Animation & Fetch Services & Feedbacks & Settings
    useEffect(() => {
        const loadData = async () => {
            try {
                const [servicesRes, barbersRes, feedbacksRes, settingsRes] = await Promise.all([
                    API.get('/appointments/services'),
                    API.get('/appointments/barbers'),
                    API.get('/feedbacks/approved'),
                    API.get('/settings/public')
                ]);
                setServices(servicesRes.data);
                setBarbers(barbersRes.data);
                setFeedbacks(feedbacksRes.data);
                setSettings(settingsRes.data);
            } catch (error) {
                console.error('Failed to load data', error);
                // Fallback if API fails
                setServices([
                    { id: 'sac', name: 'Saç Kesimi', price: 500, duration: 45 },
                    { id: 'sakal', name: 'Sakal Tıraşı', price: 300, duration: 30 },
                    { id: 'sac_sakal', name: 'Komple Bakım', price: 600, duration: 75 }
                ]);
            } finally {
                setTimeout(() => setIsLoading(false), 2000);
            }
        };
        loadData();
    }, []);

    if (isLoading) return <LoadingScreen />;

    return (
        <div className="bg-dark-950 min-h-screen text-white font-sans selection:bg-gold-500 selection:text-dark-950 overflow-x-hidden cursor-none">
            <GrainOverlay />
            <CustomCursor />
            <AnimatePresence>
                {step === 0 && (
                    <>
                        <WhatsAppButton />
                        <InstagramButton />
                    </>
                )}
            </AnimatePresence>
            <Nav />
            <AnimatePresence mode="wait">
                {step === 0 ? (
                    <LandingView key="landing" onStart={() => setStep(1)} services={services} feedbacks={feedbacks} />
                ) : (
                    <BookingFlow key="booking" onBack={() => setStep(0)} services={services} barbers={barbers} settings={settings} />
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Sub Components ---

const HeroSlideshow = () => {
    const images = ['/hero1.jpg', '/hero2.jpg', '/hero3.jpg'];
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 5000); // Change every 5 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-full">
            <AnimatePresence mode="wait">
                <motion.img
                    key={currentIndex}
                    src={images[currentIndex]}
                    alt="Hero Background"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </AnimatePresence>
        </div>
    );
};



const LoadingScreen = () => (
    <div className="fixed inset-0 bg-dark-950 flex items-center justify-center z-50">
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
            className="flex flex-col items-center justify-center gap-6"
        >
            {/* Logo - Full Visibility */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gold-500 blur-3xl opacity-20"></div>
                <img src="/logo.png" alt="Logo" className="relative w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl" />
            </div>


            {/* Foreground Text */}
            <span className="relative z-10 text-gold-500 font-serif text-3xl md:text-5xl tracking-[0.3em] font-bold text-center drop-shadow-lg">
                BY RAMAZAN
            </span>
        </motion.div>
    </div>
);

const LandingView = ({ onStart, services, feedbacks }) => {
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
                {/* Background Slideshow */}
                <div className="absolute inset-0 z-0">
                    <HeroSlideshow />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/80 to-dark-950/40" />
                </div>

                <motion.div style={{ y: yHero, opacity: opacityHero }} className="z-10 text-center relative">
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 1 }}
                        className="mb-6 overflow-hidden"
                    >
                        <p className="text-gold-500 tracking-[0.5em] text-xs md:text-sm uppercase font-bold drop-shadow-md">Est. 2014</p>
                    </motion.div>

                    <h1 className="text-[12vw] leading-[0.8] font-serif font-medium mb-8 drop-shadow-2xl">
                        <span className="block overflow-hidden"><motion.span initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="block text-white">BY</motion.span></span>
                        <span className="block overflow-hidden"><motion.span initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400">RAMAZAN</motion.span></span>
                    </h1>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="flex flex-col items-center gap-8"
                    >
                        <p className="max-w-md text-gray-200 text-sm md:text-base font-light leading-relaxed drop-shadow-md">
                            Erkek bakımında modern sanat. Sadece randevuyla çalışıyoruz.
                        </p>

                        <button
                            onClick={onStart}
                            className="group relative px-10 py-5 bg-white/10 border border-white/20 hover:border-gold-500 hover:bg-gold-500 transition-all duration-500 rounded-sm overflow-hidden backdrop-blur-sm"
                        >
                            <span className="relative z-10 text-xs tracking-[0.25em] uppercase text-white group-hover:text-dark-950 font-bold transition-colors duration-300">Randevu Al</span>
                        </button>
                    </motion.div>
                </motion.div>

            </section>

            {/* Editorial Services */}
            <ServicesSection services={services} />

            {/* Customer Feedbacks */}
            {feedbacks && feedbacks.length > 0 && <FeedbackSection feedbacks={feedbacks} />}

            <AboutSection />
            <ContactSection />
            <Footer />
        </motion.div>
    );
};

const ServicesSection = ({ services }) => (
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
                {services.map((service, index) => (
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
                                <p className="text-gray-300 text-sm tracking-widest uppercase">{service.duration}dk • Premium Bakım</p>
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

const FeedbackSection = ({ feedbacks }) => {
    // Swipeable Slider Logic
    const [[page, direction], setPage] = useState([0, 0]);
    const [isDragging, setIsDragging] = useState(false);

    // Provide infinite loop index
    const feedbackIndex = Math.abs(page % feedbacks.length);
    const feedback = feedbacks[feedbackIndex];

    const paginate = (newDirection) => {
        setPage([page + newDirection, newDirection]);
    };

    // Auto-play
    useEffect(() => {
        if (isDragging) return;
        const timer = setInterval(() => {
            paginate(1);
        }, 5000);
        return () => clearInterval(timer);
    }, [page, isDragging]);

    const variants = {
        enter: (direction) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0
        })
    };

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset, velocity) => {
        return Math.abs(offset) * velocity;
    };

    return (
        <section className="py-24 bg-dark-900 border-t border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gold-500/20 to-transparent"></div>
            <div className="max-w-4xl mx-auto px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-serif text-white mb-16">Müşteri Deneyimleri</h2>

                <div className="relative h-64 md:h-48 flex items-center justify-center overflow-hidden">
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.div
                            key={page}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={1}
                            onDragStart={() => setIsDragging(true)}
                            onDragEnd={(e, { offset, velocity }) => {
                                setIsDragging(false);
                                const swipe = swipePower(offset.x, velocity.x);

                                if (swipe < -swipeConfidenceThreshold) {
                                    paginate(1);
                                } else if (swipe > swipeConfidenceThreshold) {
                                    paginate(-1);
                                }
                            }}
                            className="absolute w-full cursor-grab active:cursor-grabbing"
                        >
                            <div className="flex flex-col items-center">
                                <div className="text-gold-500 text-2xl mb-4">{'★'.repeat(feedback.rating)}</div>
                                <p className="text-xl md:text-2xl text-gray-300 font-serif italic mb-6 select-none">"{feedback.comment}"</p>
                                <p className="text-sm font-bold text-white uppercase tracking-widest">— {feedback.customerName}</p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Indicators */}
                <div className="flex justify-center gap-2 mt-8 z-10 relative">
                    {feedbacks.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                const newDir = idx > feedbackIndex ? 1 : -1;
                                setPage([page + (idx - feedbackIndex), newDir]);
                            }}
                            className={`w-2 h-2 rounded-full transition-all ${idx === feedbackIndex ? 'bg-gold-500 w-6' : 'bg-white/10'}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

const AboutSection = () => (
    <section id="hakkimizda" className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
            <div className="relative aspect-[3/4] overflow-hidden group rounded-sm">
                <img
                    src="/about.jpg"
                    alt="By Ramazan Berber"
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
    const [canInstall, setCanInstall] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const checkIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setIsIOS(checkIOS);

        const checkInstall = () => {
            if (window.deferredPrompt) {
                setCanInstall(true);
            }
        };

        if (window.deferredPrompt) {
            setCanInstall(true);
        } else if (checkIOS && !isStandalone) {
            setCanInstall(true); // Always show for iOS if not installed to give manual instructions
        }

        window.addEventListener('deferredPromptReady', checkInstall);
        return () => window.removeEventListener('deferredPromptReady', checkInstall);
    }, []);

    const handleTopInstall = async () => {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                window.deferredPrompt = null;
                setCanInstall(false);
            }
        } else if (isIOS) {
            toast.info('Safari menüsünden "Paylaş" ikonuna tıklayıp "Ana Ekrana Ekle"yi seçin.', { autoClose: 5000 });
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 p-6 md:p-8 flex justify-between items-center z-40 bg-gradient-to-b from-dark-950/80 to-transparent backdrop-blur-sm md:bg-none md:backdrop-blur-none transition-all duration-300">
            <div className="z-50 relative flex items-center gap-4">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-lg" />
                <span className="font-serif text-xl tracking-widest text-white mix-blend-difference">BY RAMAZAN</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest text-white mix-blend-difference">
                <a href="#hizmetler" className="hover:text-gold-500 transition-colors">Hizmetler</a>
                <a href="#hakkimizda" className="hover:text-gold-500 transition-colors">Hakkımızda</a>
                <a href="#iletisim" className="hover:text-gold-500 transition-colors">İletişim</a>
                {canInstall && (
                    <button 
                        onClick={handleTopInstall}
                        className="px-4 py-2 bg-gold-500 text-dark-950 font-bold hover:bg-white transition-colors rounded-sm"
                    >
                        Uygulamayı İndir
                    </button>
                )}
            </div>

            {/* Mobile Nav Actions */}
            <div className="flex md:hidden items-center gap-4 z-50">
                {canInstall && (
                    <button 
                        onClick={handleTopInstall}
                        className="px-3 py-2 bg-white text-dark-950 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                    >
                        Yükle
                    </button>
                )}
                <button
                    onClick={() => document.querySelector('button[class*="group relative px-10"]')?.click()}
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
        className="fixed bottom-8 left-8 z-50 group"
    >
        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-gray-300 group-hover:text-gold-500 group-hover:border-gold-500 group-hover:bg-gold-500/10 transition-all duration-300 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="transition-transform group-hover:scale-110">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
        </div>
    </motion.a>
);

const InstagramButton = () => (
    <motion.a
        href="https://www.instagram.com/by_ramazan1?igsh=MTBvNm12aW5yZDA2Mw=="
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="fixed bottom-28 left-8 z-50 group"
    >
        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-gray-300 group-hover:text-gold-500 group-hover:border-gold-500 group-hover:bg-gold-500/10 transition-all duration-300 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="transition-transform group-hover:scale-110">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.069-4.85.069-3.204 0-3.584-.012-4.849-.069-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
        </div>
    </motion.a>
);

export default BookingPage;

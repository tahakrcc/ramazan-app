import React, { useState, useEffect, useRef } from 'react';
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
    whatsapp: '905307662779'
};

const BookingPage = () => {
    const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow
    const [isLoading, setIsLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [settings, setSettings] = useState({ bookingRangeDays: 14 }); // Dynamic settings

    // Initial Load Animation & Fetch Services & Feedbacks & Settings
    useEffect(() => {
        const loadData = async () => {
            try {
                const [servicesRes, feedbacksRes, settingsRes] = await Promise.all([
                    API.get('/appointments/services'),
                    API.get('/feedbacks/approved'),
                    API.get('/settings/public')
                ]);
                setServices(servicesRes.data);
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
                    <BookingFlow key="booking" onBack={() => setStep(0)} services={services} settings={settings} />
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
            {/* Logo Removed */}{/*
            <div className="relative group">
                <div className="absolute inset-0 bg-gold-500 blur-3xl opacity-20"></div>
                <img src="/logo.png" alt="Logo" className="relative w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl" />
            </div>
            */}

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

const BookingFlow = ({ onBack, services, settings }) => {
    // 0: Person Count, 1: Service, 1.5: Barber, 2: Date/Time, 3: Form, 4: Success
    const [bookingStep, setBookingStep] = useState(0);
    const [isDoubleBooking, setIsDoubleBooking] = useState(false);
    const [selection, setSelection] = useState({ service: null, barber: null, date: null, slots: [] }); // Added barber
    const [availableSlots, setAvailableSlots] = useState([]);
    const [formData, setFormData] = useState({ name: '', phone: '', secondName: '', secondPhone: '' });
    const [showSecondPerson, setShowSecondPerson] = useState(false);
    const [barbers, setBarbers] = useState([]);

    useEffect(() => {
        // Fetch barbers
        API.get('/appointments/barbers').then(res => setBarbers(res.data)).catch(err => console.error(err));
    }, []);

    // Fetch Slots logic - Updated to include barberId
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
    }, [selection.date, selection.barber]); // Re-fetch if barber changes

    // Cleanup slots when switching dates
    useEffect(() => {
        setSelection(prev => ({ ...prev, slots: [] }));
    }, [selection.date]);

    const handlePersonCountSelect = (double) => {
        setIsDoubleBooking(double);
        setBookingStep(1);
    };

    const handleServiceSelect = (s) => {
        setSelection({ ...selection, service: s });
        setBookingStep(1.5); // Go to Barber Selection
    };

    const handleBarberSelect = (b) => {
        setSelection({ ...selection, barber: b });
        setBookingStep(2); // Go to Time
    };

    const handleTimeSelect = (t) => {
        let newSlots = [...selection.slots];

        if (isDoubleBooking) {
            // If already picked 2, reset and pick new one
            if (newSlots.length >= 2) {
                newSlots = [t];
            } else {
                // If picking the same one, toggle off
                if (newSlots.includes(t)) {
                    newSlots = newSlots.filter(slot => slot !== t);
                } else {
                    newSlots.push(t);
                }
            }
        } else {
            // Single booking: just one slot always
            newSlots = [t];
        }

        setSelection({ ...selection, slots: newSlots });

        // Auto move next if conditions met
        if (!isDoubleBooking) {
            setBookingStep(3);
        } else if (isDoubleBooking && newSlots.length === 2) {
            // Small delay to let user see the 2nd selection
            setTimeout(() => setBookingStep(3), 500);
        }
    };

    const submitBooking = async (e) => {
        e.preventDefault();

        // Confirmation Dialog
        if (!window.confirm('Randevuyu onaylıyor musunuz?')) return;

        // Validate
        if (isDoubleBooking && selection.slots.length !== 2) {
            toast.error('Lütfen 2 adet saat seçiniz.');
            return;
        }

        try {
            // Sort slots to ensure chronological order (optional, but good for logic)
            const sortedSlots = [...selection.slots].sort();

            const payload = {
                customerName: formData.name,
                phone: formData.phone,
                date: selection.date,
                hour: sortedSlots[0],
                service: selection.service.id,
                barberId: selection.barber?._id, // Add Barber
                barberName: selection.barber?.name // Add Name
            };

            // Create First Appointment
            await API.post('/appointments', payload);

            // Create Second Appointment
            if (isDoubleBooking) {
                await API.post('/appointments', {
                    ...payload,
                    customerName: formData.secondName || formData.name, // Use 2nd person detail OR Main User
                    phone: formData.secondPhone || formData.phone,
                    hour: sortedSlots[1],
                });
            }

            setBookingStep(4);
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || error.message || 'Hata oluştu. Seçilen saatler dolmuş olabilir.';
            toast.error(errorMsg);
        }
    };

    const BackButton = () => (
        <button
            type="button"
            onClick={() => setBookingStep(bookingStep === 1.5 ? 1 : bookingStep === 2 ? 1.5 : bookingStep - 1)}
            className="w-full mt-6 py-4 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 rounded-sm uppercase tracking-widest text-sm transition-all"
        >
            ← Geri Dön
        </button>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="min-h-screen bg-dark-950 flex flex-col pt-32"
        >
            <div className="p-8 flex justify-between items-center border-b border-white/5">
                <button
                    onClick={() => {
                        if (bookingStep === 1.5) setBookingStep(1);
                        else if (bookingStep > 0) setBookingStep(bookingStep - 1);
                        else onBack();
                    }}
                    className="text-base font-bold uppercase tracking-widest text-white hover:text-gold-500 transition-colors flex items-center gap-2"
                >
                    <span>←</span>
                    {bookingStep > 0 ? 'Geri' : 'Ana Menü'}
                </button>
                <div className="flex gap-2">
                    {[0, 1, 1.5, 2, 3].map(i => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i <= bookingStep ? 'bg-gold-500 shadow-[0_0_10px_#D4AF37]' : 'bg-dark-800'}`} />
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-start max-w-3xl mx-auto w-full px-6 py-8 md:py-12 pt-8">
                <AnimatePresence mode="wait">

                    {/* STEP 0: Person Count Selection */}
                    {bookingStep === 0 && (
                        <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h2 className="text-4xl md:text-5xl font-serif mb-12 text-center text-white">Kaç Kişisiniz?</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    onClick={() => handlePersonCountSelect(false)}
                                    className="p-10 border border-white/10 hover:border-gold-500 hover:bg-white/5 transition-all group rounded-sm flex flex-col items-center gap-4"
                                >
                                    <span className="text-6xl group-hover:scale-110 transition-transform">👤</span>
                                    <h3 className="text-2xl font-serif text-white group-hover:text-gold-500">Tek Kişi</h3>
                                    <p className="text-gray-400 text-sm">Kendim için randevu alacağım.</p>
                                </button>
                                <button
                                    onClick={() => handlePersonCountSelect(true)}
                                    className="p-10 border border-white/10 hover:border-gold-500 hover:bg-white/5 transition-all group rounded-sm flex flex-col items-center gap-4"
                                >
                                    <span className="text-6xl group-hover:scale-110 transition-transform">👥</span>
                                    <h3 className="text-2xl font-serif text-white group-hover:text-gold-500">İki Kişi</h3>
                                    <p className="text-gray-400 text-sm">Arkadaşımla geliyorum.</p>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 1: Service Selection */}
                    {bookingStep === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h2 className="text-4xl md:text-5xl font-serif mb-12 text-center text-white">Hizmet Seçimi</h2>
                            <div className="grid gap-4">
                                {services.map(s => (
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
                            <BackButton />
                        </motion.div>
                    )}

                    {/* STEP 1.5: Barber Selection */}
                    {bookingStep === 1.5 && (
                        <motion.div key="step1.5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h2 className="text-4xl md:text-5xl font-serif mb-12 text-center text-white">Personel Seçimi</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {barbers.map(b => (
                                    <button
                                        key={b._id}
                                        onClick={() => handleBarberSelect(b)}
                                        className="flex items-center gap-4 p-6 border border-white/10 hover:border-gold-500 hover:bg-white/5 transition-all group rounded-sm text-left"
                                    >
                                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-dark-950 border border-white/10 group-hover:border-gold-500 transition-colors" style={{ color: b.color || '#D4AF37' }}>
                                            {b.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-serif text-white group-hover:text-gold-500 transition-colors">{b.name === 'Admin' ? 'Ramazan' : b.name}</h3>
                                            <p className="text-gray-400 text-xs uppercase tracking-widest">{b.role === 'ADMIN' ? 'Master Barber' : 'Barber'}</p>
                                        </div>
                                    </button>
                                ))}
                                {/*
                                <button
                                    onClick={() => handleBarberSelect(null)}
                                    className="flex items-center gap-4 p-6 border border-white/10 hover:border-gold-500 hover:bg-white/5 transition-all group rounded-sm text-left opacity-60 hover:opacity-100"
                                >
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-white/5 text-gray-400 group-hover:text-gold-500">?</div>
                                    <div>
                                        <h3 className="text-xl font-serif text-white group-hover:text-gold-500">Fark Etmez</h3>
                                        <p className="text-gray-400 text-xs">Müsait olan herhangi bir personel.</p>
                                    </div>
                                </button>
                                */}
                            </div>
                            <BackButton />
                        </motion.div>
                    )}

                    {/* STEP 2: Date/Time Selection */}
                    {bookingStep === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h2 className="text-3xl md:text-5xl font-serif mb-2 text-center text-white">Zamanlama</h2>
                            <p className="text-center text-gray-400 mb-8 md:mb-12 text-xs md:text-sm uppercase tracking-widest font-bold">
                                {selection.service?.name} • <span className="text-gold-500">{selection.barber?.name || 'Herhangi Biri'}</span>
                            </p>

                            {/* Date Scroller */}
                            <div className="relative">
                                {/* Scroll Hint for Mobile */}
                                <div className="md:hidden absolute -top-8 right-0 text-white font-bold text-sm animate-bounce flex items-center gap-1">
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
                                    {Array.from({ length: settings?.bookingRangeDays || 14 }).map((_, i) => {
                                        const d = format(addDays(new Date(), i), 'yyyy-MM-dd');
                                        const dateObj = addDays(new Date(), i);
                                        const dayOfWeek = dateObj.getDay(); // 0=Sunday
                                        const isSunday = dayOfWeek === 0;
                                        const isSelected = selection.date === d;
                                        return (
                                            <button
                                                key={d}
                                                onClick={() => !isSunday && setSelection({ ...selection, date: d })}
                                                disabled={isSunday}
                                                className={`flex-shrink-0 w-20 h-28 md:w-24 md:h-32 border ${isSunday ? 'border-red-900/30 bg-red-950/20 text-gray-600 cursor-not-allowed opacity-50' : isSelected ? 'border-gold-500 bg-gold-500 text-dark-950 shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'border-white/10 hover:border-gold-500 text-gray-400 hover:text-white'} transition-all flex flex-col items-center justify-center gap-2 rounded-sm relative`}
                                            >
                                                {isSunday && <span className="absolute top-1 right-1 text-xs">🚫</span>}
                                                <span className="text-[10px] md:text-xs uppercase tracking-widest opacity-80">{format(dateObj, 'EEE', { locale: tr })}</span>
                                                <span className="text-2xl md:text-3xl font-serif font-bold">{format(dateObj, 'dd')}</span>
                                                {isSunday && <span className="text-[8px] opacity-60">Kapalı</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Time Slots */}
                            {selection.date && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                                    {availableSlots.length > 0 ? availableSlots.map(t => {
                                        const isSelected = selection.slots.includes(t);
                                        const index = selection.slots.indexOf(t);

                                        // Visual style based on selection
                                        // First slot: Gold
                                        // Second slot: White/Silver (if double booking)
                                        let bgClass = "border-white/10 text-gray-300 hover:bg-gold-500 hover:border-gold-500 hover:text-dark-950";

                                        if (isSelected) {
                                            if (index === 0) bgClass = "bg-gold-500 text-dark-950 border-gold-500 font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)]";
                                            else if (index === 1) bgClass = "bg-gray-200 text-dark-950 border-gray-200 font-bold shadow-[0_0_15px_rgba(255,255,255,0.4)]";
                                        }

                                        return (
                                            <button
                                                key={t}
                                                onClick={() => handleTimeSelect(t)}
                                                className={`py-3 md:py-4 border transition-all rounded-sm text-sm md:text-base relative ${bgClass}`}
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
                                        <div className="col-span-4 text-center text-gray-400 py-4 italic">Müsait saat bulunamadı.</div>
                                    )}
                                </motion.div>
                            )}

                            {isDoubleBooking && selection.slots.length > 0 && (
                                <div className="mt-8 text-center bg-white/5 p-4 rounded-sm border border-white/10">
                                    <p className="text-gray-300 text-sm mb-2">Seçilen Saatler:</p>
                                    <div className="flex justify-center gap-4">
                                        {selection.slots[0] && <span className="text-gold-500 font-bold">{selection.slots[0]} (1. Kişi)</span>}
                                        {selection.slots[1] && <span className="text-white font-bold">{selection.slots[1]} (2. Kişi)</span>}
                                    </div>
                                </div>
                            )}

                            <BackButton />
                        </motion.div>
                    )}

                    {/* STEP 3: Details Form */}
                    {bookingStep === 3 && (
                        <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <h2 className="text-3xl md:text-5xl font-serif mb-8 md:mb-12 text-center text-white">Yolcu Bilgileri</h2>
                            <form onSubmit={submitBooking} className="space-y-6 md:space-y-8 max-w-md mx-auto">

                                {/* 1. Person */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-6 h-6 rounded-full bg-gold-500 text-dark-950 flex items-center justify-center font-bold text-xs">1</div>
                                        <h3 className="text-white font-serif text-lg">Hizmet Alan Kişi</h3>
                                    </div>

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
                                </div>

                                {/* 2. Person (Optional) */}
                                {isDoubleBooking && (
                                    <div className="pt-6 border-t border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setShowSecondPerson(!showSecondPerson)}
                                            className="flex items-center gap-2 w-full text-left mb-4 hover:opacity-80 transition-opacity"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-white text-dark-950 flex items-center justify-center font-bold text-xs">2</div>
                                            <h3 className="text-white font-serif text-lg flex-1">2. Kişi Bilgileri</h3>
                                            <span className="text-gray-400 text-xs uppercase">{showSecondPerson ? 'Gizle' : 'Ekle (Opsiyonel)'}</span>
                                        </button>

                                        <AnimatePresence>
                                            {showSecondPerson && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="space-y-4 overflow-hidden"
                                                >
                                                    <p className="text-gray-500 text-xs italic mb-2">
                                                        *Doldurulmazsa, 2. randevu da {formData.name || 'sizin'} adınıza oluşturulur.
                                                    </p>
                                                    <div className="space-y-2">
                                                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">2. Kişi Ad Soyad</label>
                                                        <input
                                                            type="text"
                                                            value={formData.secondName}
                                                            onChange={e => setFormData({ ...formData, secondName: e.target.value })}
                                                            className="w-full bg-white/5 border-b-2 border-white/10 py-3 md:py-4 px-4 text-lg text-white focus:outline-none focus:border-white focus:bg-white/10 transition-all rounded-t-sm"
                                                            placeholder="Arkadaşınızın ismi"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">2. Kişi Telefon</label>
                                                        <input
                                                            type="tel"
                                                            value={formData.secondPhone}
                                                            onChange={e => setFormData({ ...formData, secondPhone: e.target.value })}
                                                            className="w-full bg-white/5 border-b-2 border-white/10 py-3 md:py-4 px-4 text-lg text-white focus:outline-none focus:border-white focus:bg-white/10 transition-all rounded-t-sm"
                                                            placeholder="05XX XXX XX XX"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                <div className="pt-4 md:pt-8 text-center">
                                    <button type="submit" className="w-full bg-gold-500 text-dark-950 py-4 md:py-5 font-bold uppercase tracking-[0.2em] hover:bg-white hover:scale-[1.02] transition-all rounded-sm shadow-[0_0_20px_rgba(212,175,55,0.2)] text-sm md:text-base">
                                        {isDoubleBooking ? 'Randevuları Onayla' : 'Randevuyu Onayla'}
                                    </button>
                                </div>
                            </form>
                            <BackButton />
                        </motion.div>
                    )}

                    {bookingStep === 4 && (
                        <motion.div key="success" className="text-center py-20">
                            <motion.div
                                initial={{ scale: 0 }} animate={{ scale: 1 }}
                                className="w-24 h-24 border-2 border-gold-500 rounded-full flex items-center justify-center mx-auto mb-8 text-gold-500 text-4xl"
                            >
                                ✓
                            </motion.div>
                            <h2 className="text-5xl font-serif mb-6">Teşekkürler</h2>
                            <p className="text-gray-400 mb-12">
                                {isDoubleBooking ? 'Randevularınız başarıyla oluşturuldu.' : 'Randevunuz başarıyla oluşturuldu.'}
                            </p>
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
    return (
        <nav className="fixed top-0 left-0 right-0 p-6 md:p-8 flex justify-between items-center z-40 bg-gradient-to-b from-dark-950/80 to-transparent backdrop-blur-sm md:bg-none md:backdrop-blur-none transition-all duration-300">
            <div className="z-50 relative flex items-center gap-4">
                {/* <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain drop-shadow-lg" /> */}
                <span className="font-serif text-xl tracking-widest text-white mix-blend-difference">BY RAMAZAN</span>
            </div>

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

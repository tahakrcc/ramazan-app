import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'react-toastify';

const CONFIG = {
    businessName: 'By Ramazan',
    tagline: 'Gentlemen\'s Grooming',
    workingHours: { start: 8, end: 20 },
    services: [
        { id: 'sac', name: 'Saç Kesimi', price: 500 },
        { id: 'sakal', name: 'Sakal Tıraşı', price: 300 },
        { id: 'sac_sakal', name: 'Komple Bakım', price: 600 }
    ],
    location: {
        address: 'Mövenpick Hotel -1 Kat',
        city: 'Malatya',
        mapsLink: 'https://www.google.com/maps?daddr=%C4%B0n%C3%B6n%C3%BC,+%C4%B0n%C3%B6n%C3%BC+Cd.+No:174,+44090+Ye%C5%9Filyurt/Malatya'
    },
    whatsapp: '905307662779'
};

const BookingPage = () => {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [formData, setFormData] = useState({ customerName: '', phone: '', hour: '' });
    const [step, setStep] = useState(0);
    const [config, setConfig] = useState({
        bookingRangeDays: 14,
        appointmentStartHour: 8,
        appointmentEndHour: 20
    });

    const [dates, setDates] = useState([]);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        const newDates = Array.from({ length: config.bookingRangeDays }).map((_, i) => format(addDays(new Date(), i), 'yyyy-MM-dd'));
        setDates(newDates);
    }, [config]);

    const fetchSettings = async () => {
        try {
            const res = await API.get('/appointments/settings');
            setConfig(res.data);
        } catch (error) {
            console.error('Settings fetch error', error);
        }
    };

    useEffect(() => {
        if (step === 1) fetchSlots();
    }, [selectedDate, step]);

    const fetchSlots = async () => {
        setLoading(true);
        try {
            const res = await API.get(`/appointments/available?date=${selectedDate}`);
            setAvailableSlots(res.data.availableSlots);
        } catch (error) {
            toast.error('Saatler yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.hour || !selectedService) {
            return toast.warning('Lütfen tüm alanları doldurun');
        }

        try {
            await API.post('/appointments', {
                ...formData,
                date: selectedDate,
                service: selectedService.id
            });
            setStep(2);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Bir hata oluştu');
        }
    };

    // Success Screen
    if (step === 2) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-100 px-6">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-8 text-green-600">✓</div>
                    <h1 className="text-4xl font-semibold mb-4 text-stone-900">Teşekkürler</h1>
                    <p className="text-stone-600 mb-8">
                        Randevunuz başarıyla oluşturuldu. Sizi bekliyoruz.
                    </p>
                    <button onClick={() => { setStep(0); setFormData({ customerName: '', phone: '', hour: '' }); setSelectedService(null); }}
                        className="border border-stone-900 text-stone-900 py-3 px-8 hover:bg-stone-900 hover:text-white transition-all">
                        Ana Sayfa
                    </button>
                </div>
            </div>
        );
    }

    // Booking Screen
    if (step === 1) {
        return (
            <div className="min-h-screen bg-stone-100">
                <header className="fixed top-0 left-0 right-0 bg-stone-100 z-50 border-b border-stone-200">
                    <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
                        <button onClick={() => setStep(0)} className="text-stone-600 hover:text-stone-900 transition">
                            ← Geri
                        </button>
                        <span className="text-xl tracking-widest uppercase text-stone-900">{CONFIG.businessName}</span>
                        <div className="w-12"></div>
                    </div>
                </header>

                <main className="max-w-xl mx-auto px-6 pt-32 pb-20">
                    <h1 className="text-4xl text-center mb-2 text-stone-900">Randevu</h1>
                    <div className="w-16 h-px bg-stone-300 mx-auto my-6"></div>

                    {/* Service */}
                    <div className="mb-10">
                        <label className="block text-xs uppercase tracking-widest text-stone-500 mb-4">Hizmet</label>
                        <div className="grid grid-cols-3 gap-3">
                            {config.services && config.services.length > 0 ? (
                                config.services.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedService(s)}
                                        className={`py-4 border text-center transition-all ${selectedService?.id === s.id
                                            ? 'border-stone-900 bg-stone-900 text-white'
                                            : 'border-stone-300 bg-white text-stone-900 hover:border-stone-500'
                                            }`}
                                    >
                                        <div className="text-sm font-medium">{s.name}</div>
                                        <div className="text-xs mt-1 opacity-70">{s.price}₺</div>
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-3 text-center text-stone-500 text-sm">Aktif hizmet bulunamadı.</div>
                            )}
                        </div>
                    </div>

                    {/* Date */}
                    <div className="mb-10 relative group">
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-xs uppercase tracking-widest text-stone-500">Tarih</label>
                            <span className="text-[10px] text-stone-400 flex items-center gap-1 animate-pulse">
                                Yana kaydırınız
                                <span className="text-lg">→</span>
                            </span>
                        </div>

                        <div className="relative flex items-center">
                            {/* Left Scroll Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    document.getElementById('date-scroll-container').scrollBy({ left: -200, behavior: 'smooth' });
                                }}
                                className="absolute left-0 z-20 bg-white/80 backdrop-blur shadow-md border border-stone-200 rounded-full w-8 h-8 flex items-center justify-center text-stone-900 -ml-3 md:-ml-4 hover:bg-white hover:scale-110 transition hidden md:flex"
                            >
                                ←
                            </button>

                            <div id="date-scroll-container" className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 relative z-10 w-full scroll-smooth">
                                {dates.map(date => (
                                    <button
                                        key={date}
                                        onClick={() => setSelectedDate(date)}
                                        className={`flex-shrink-0 w-20 py-4 border text-center transition-all ${selectedDate === date
                                            ? 'border-stone-900 bg-stone-900 text-white'
                                            : 'border-stone-300 bg-white text-stone-900 hover:border-stone-500'
                                            }`}
                                    >
                                        <div className="text-xs opacity-70">{format(new Date(date), 'EEE', { locale: tr })}</div>
                                        <div className="text-lg font-semibold">{format(new Date(date), 'dd')}</div>
                                        <div className="text-xs opacity-70">{format(new Date(date), 'MMM', { locale: tr })}</div>
                                    </button>
                                ))}
                                {/* Spacer for better scrolling */}
                                <div className="w-4 flex-shrink-0"></div>
                            </div>

                            {/* Right Scroll Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    document.getElementById('date-scroll-container').scrollBy({ left: 200, behavior: 'smooth' });
                                }}
                                className="absolute right-0 z-20 bg-white/80 backdrop-blur shadow-md border border-stone-200 rounded-full w-8 h-8 flex items-center justify-center text-stone-900 -mr-3 md:-mr-4 hover:bg-white hover:scale-110 transition hidden md:flex"
                            >
                                →
                            </button>

                            {/* Fade effect */}
                            <div className="absolute right-0 top-8 bottom-2 w-12 bg-gradient-to-l from-stone-100 to-transparent pointer-events-none md:hidden"></div>
                        </div>
                    </div>

                    {/* Time */}
                    <div className="mb-10">
                        <label className="block text-xs uppercase tracking-widest text-stone-500 mb-4">Saat</label>
                        {loading ? (
                            <div className="text-center py-8 text-stone-500">Yükleniyor...</div>
                        ) : availableSlots.length === 0 ? (
                            <div className="text-center py-8 text-stone-500">Bu tarihte müsait saat yok</div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {availableSlots.map(slot => (
                                    <button
                                        key={slot}
                                        onClick={() => setFormData({ ...formData, hour: slot })}
                                        className={`py-3 border text-sm transition-all ${formData.hour === slot
                                            ? 'border-stone-900 bg-stone-900 text-white'
                                            : 'border-stone-300 bg-white text-stone-900 hover:border-stone-500'
                                            }`}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">Ad Soyad</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-white border border-stone-300 px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">Telefon</label>
                            <input
                                type="tel"
                                required
                                className="w-full bg-white border border-stone-300 px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
                                placeholder="05XX XXX XX XX"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <button type="submit" className="w-full bg-stone-900 text-white py-4 hover:bg-stone-800 transition-all uppercase tracking-wide text-sm mt-6">
                            Randevuyu Onayla
                        </button>
                    </form>
                </main>
            </div>
        );
    }

    // Landing Page
    return (
        <div className="min-h-screen bg-stone-100">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 bg-stone-100 z-50 border-b border-stone-200">
                <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
                    <span className="text-xl tracking-widest uppercase text-stone-900">{CONFIG.businessName}</span>
                    <div className="hidden md:flex items-center gap-10 text-sm tracking-wide">
                        <a href="#hizmetler" className="text-stone-600 hover:text-stone-900 transition">Hizmetler</a>
                        <a href="#hakkimizda" className="text-stone-600 hover:text-stone-900 transition">Hakkımızda</a>
                        <a href="#iletisim" className="text-stone-600 hover:text-stone-900 transition">İletişim</a>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="min-h-screen flex items-center justify-center px-6 pt-20">
                <div className="text-center max-w-3xl">
                    <p className="text-sm tracking-[0.3em] uppercase text-stone-500 mb-6">{CONFIG.tagline}</p>
                    <h1 className="text-6xl md:text-8xl font-semibold mb-8 leading-tight text-stone-900">{CONFIG.businessName}</h1>
                    <div className="w-16 h-px bg-stone-400 mx-auto my-6"></div>
                    <p className="text-stone-600 text-lg max-w-xl mx-auto mb-12">
                        Profesyonel erkek bakımında yılların deneyimi.
                        Modern teknikler, klasik zarafet.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => setStep(1)} className="bg-stone-900 text-white py-4 px-10 hover:bg-stone-800 transition-all uppercase tracking-wide text-sm">
                            Randevu Al
                        </button>
                        <a href={`https://wa.me/${CONFIG.whatsapp}`} target="_blank" rel="noopener noreferrer"
                            className="border border-stone-900 text-stone-900 py-4 px-10 hover:bg-stone-900 hover:text-white transition-all uppercase tracking-wide text-sm">
                            WhatsApp
                        </a>
                    </div>
                </div>
            </section>

            {/* Services */}
            <section id="hizmetler" className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-sm tracking-[0.3em] uppercase text-stone-500 mb-4">Hizmetler</p>
                    <h2 className="text-4xl md:text-5xl font-semibold mb-4 text-stone-900">Ne Sunuyoruz</h2>
                    <div className="w-16 h-px bg-stone-300 mx-auto my-6"></div>

                    <div className="grid md:grid-cols-3 gap-8 mt-16">
                        {config.services && config.services.length > 0 ? (
                            config.services.map(service => (
                                <div key={service.id} className="group cursor-pointer" onClick={() => { setSelectedService(service); setStep(1); }}>
                                    <div className="border border-stone-200 p-10 group-hover:border-stone-900 transition-all bg-stone-50 h-full flex flex-col justify-center">
                                        <h3 className="text-2xl font-semibold mb-3 text-stone-900">{service.name}</h3>
                                        <p className="text-stone-500 mb-4">Premium hizmet</p>
                                        <p className="text-3xl text-stone-900">{service.price}<span className="text-lg">₺</span></p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-3 text-stone-500">Hizmetler yükleniyor...</div>
                        )}
                    </div>
                </div>
            </section>

            {/* About */}
            <section id="hakkimizda" className="py-24 px-6 bg-stone-100">
                <div className="max-w-4xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <p className="text-sm tracking-[0.3em] uppercase text-stone-500 mb-4">Hakkımızda</p>
                            <h2 className="text-4xl font-semibold mb-6 text-stone-900">Ustalık & Zarafet</h2>
                            <p className="text-stone-600 leading-relaxed mb-6">
                                10 yılı aşkın tecrübemizle erkek bakımında kalite ve zarafetin
                                buluşma noktasıyız. Modern salon ortamımızda geleneksel
                                berberlik sanatını yaşatıyoruz.
                            </p>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 bg-stone-900 rounded-full"></span>
                                    <span className="text-stone-700">Premium ürünler</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 bg-stone-900 rounded-full"></span>
                                    <span className="text-stone-700">Deneyimli ekip</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 bg-stone-900 rounded-full"></span>
                                    <span className="text-stone-700">Hijyenik ortam</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-stone-200 aspect-square flex items-center justify-center">
                            <span className="text-8xl text-stone-400">✂</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section id="iletisim" className="py-24 px-6 bg-stone-900 text-white">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-sm tracking-[0.3em] uppercase text-stone-400 mb-4">İletişim</p>
                    <h2 className="text-4xl md:text-5xl font-semibold mb-4 text-white">Bize Ulaşın</h2>
                    <div className="w-16 h-px bg-stone-700 mx-auto my-6"></div>

                    <div className="grid md:grid-cols-3 gap-8 mt-12 text-center">
                        <div>
                            <p className="text-stone-400 text-sm uppercase tracking-wide mb-2">Adres</p>
                            <p className="text-stone-200">{CONFIG.location.address}</p>
                            <p className="text-stone-200">{CONFIG.location.city}</p>
                        </div>
                        <div>
                            <p className="text-stone-400 text-sm uppercase tracking-wide mb-2">Çalışma Saatleri</p>
                            <p className="text-stone-200">Her Gün</p>
                            <p className="text-stone-200">{config.appointmentStartHour}:00 - {config.appointmentEndHour}:00</p>
                        </div>
                        <div>
                            <p className="text-stone-400 text-sm uppercase tracking-wide mb-2">Rezervasyon</p>
                            <p className="text-stone-200">WhatsApp veya</p>
                            <p className="text-stone-200">Online Randevu</p>
                        </div>
                    </div>

                    <a href={CONFIG.location.mapsLink} target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-12 text-stone-400 hover:text-white transition text-sm tracking-wide">
                        → Google Maps'te Görüntüle
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-stone-950 text-stone-500 text-center text-sm">
                © 2024 {CONFIG.businessName}. Tüm hakları saklıdır.
            </footer>
        </div>
    );
};

export default BookingPage;

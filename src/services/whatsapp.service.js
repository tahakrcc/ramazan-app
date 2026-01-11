const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { addDays, format, subDays, subHours } = require('date-fns');
const AppointmentService = require('./appointment.service');
const BotState = require('../models/botState.model');
const Blacklist = require('../models/blacklist.model');
const ClosedDate = require('../models/closedDate.model'); // Added ClosedDate
const logger = require('../config/logger');

const Settings = require('../models/settings.model');
const Service = require('../models/service.model');

// ============= DYNAMIC CONFIGURATION =============
const getConfig = async () => {
    let settings = await Settings.findOne();
    if (!settings) settings = {
        appointmentStartHour: 8,
        appointmentEndHour: 20,
        businessAddress: 'Movenpick Hotel -1 Kat - Malatya',
        businessMapsLink: 'https://maps.google.com'
    };

    const services = await Service.find({ isActive: true });

    // Default services fallback used mostly for seeding or critical fail
    const defaultServices = [
        { id: 'sac', name: 'Saç Kesimi', price: 500, duration: 60 },
        { id: 'sakal', name: 'Sakal', price: 300, duration: 60 },
        { id: 'sac_sakal', name: 'Saç + Sakal', price: 600, duration: 60 }
    ];

    return {
        businessName: 'By Ramazan',
        workingHours: { start: settings.appointmentStartHour, end: settings.appointmentEndHour },
        bookingRangeDays: settings.bookingRangeDays, // Added booking range
        services: services.length > 0 ? services : defaultServices,
        location: {
            address: settings.businessAddress,
            mapsLink: settings.businessMapsLink
        }
    };
};


// Helper to parse turkish dates
const parseTurkishDate = (text) => {
    const lower = text.toLowerCase()
        .replace(/ı/g, 'i') // Normalize turkish chars for easier matching
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');

    const today = new Date();

    if (lower.includes('bugun')) return format(today, 'yyyy-MM-dd');
    if (lower.includes('yarin')) return format(addDays(today, 1), 'yyyy-MM-dd');
    if (lower.includes('yarindan sonra')) return format(addDays(today, 2), 'yyyy-MM-dd');

    const monthMap = {
        'ocak': '01', 'subat': '02', 'mart': '03', 'nisan': '04', 'mayis': '05', 'haziran': '06',
        'temmuz': '07', 'agustos': '08', 'eylul': '09', 'ekim': '10', 'kasim': '11', 'aralik': '12'
    };

    for (const [month, code] of Object.entries(monthMap)) {
        if (lower.includes(month)) {
            const dayMatch = lower.match(new RegExp(`(\\d{1,2})\\s*${month}`));
            if (dayMatch) {
                const day = dayMatch[1].padStart(2, '0');
                const currentYear = today.getFullYear();
                return `${currentYear}-${code}-${day}`;
            }
        }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const dateMatch = text.match(/(\d{2})[./](\d{2})[./](\d{4})/);
    if (dateMatch) {
        return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    return null;
};

const parseTime = (text, workingHours) => {
    // 1. Explicit time format (14:00, 14.00)
    const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
    if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        if (hour >= workingHours.start && hour < workingHours.end) {
            return `${String(hour).padStart(2, '0')}:00`;
        }
    }

    // 2. "Saat 14" format
    const hourPrefixMatch = text.match(/saat\s*(\d{1,2})/i);
    if (hourPrefixMatch) {
        let hour = parseInt(hourPrefixMatch[1]);
        if (hour >= workingHours.start && hour < workingHours.end) {
            return `${String(hour).padStart(2, '0')}:00`;
        }
    }

    // 3. Standalone number check (Risky for dates like "16 Ocak")
    // We must ensure this number is NOT followed by a month name
    const months = ['ocak', 'şubat', 'subat', 'mart', 'nisan', 'mayıs', 'mayis', 'haziran', 'temmuz', 'ağustos', 'agustos', 'eylül', 'eylul', 'ekim', 'kasım', 'kasim', 'aralık', 'aralik'];

    // Regex explanation:
    // (\d{1,2})  -> Match 1 or 2 digits
    // (?!\d)     -> Not followed by another digit
    // (?!\s*(?:ocak|...)) -> Negative lookahead: Not followed by any month name
    const monthPattern = months.join('|');
    const standaloneRegex = new RegExp(`(\\d{1,2})(?!\\d)(?!\\s*(?:${monthPattern}))`, 'i');

    const hourMatch = text.match(standaloneRegex);
    if (hourMatch) {
        let hour = parseInt(hourMatch[1]);
        // Valid working hours check to filter out unlikely numbers (e.g. "3 elma")
        // But context matters. For now, strict strict working hours.
        if (hour >= workingHours.start && hour < workingHours.end) {
            return `${String(hour).padStart(2, '0')}:00`;
        }
    }

    return null;
};

const findNextAvailableDays = async (startDate, maxDays = 7) => {
    const available = [];
    for (let i = 0; i < maxDays; i++) {
        const date = format(addDays(new Date(startDate), i), 'yyyy-MM-dd');
        const slots = await AppointmentService.getAvailableSlots(date);
        if (slots.length > 0) {
            available.push({ date, slots });
            if (available.length >= 3) break;
        }
    }
    return available;
};

// Parse service from text
const parseService = (text, services) => {
    const lower = text.toLowerCase();
    if (lower.includes('saç') && lower.includes('sakal')) return services.find(s => s.id === 'sac_sakal');
    if (lower.includes('sakal')) return services.find(s => s.id === 'sakal');
    if (lower.includes('saç') || lower.includes('kesim')) return services.find(s => s.id === 'sac');

    // Check by number
    if (lower.includes('1')) return services[0];
    if (lower.includes('2')) return services[1];
    if (lower.includes('3')) return services[2];

    return null;
};

let qrStream = null;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: process.env.WA_SESSION_PATH || './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.2.html',
    }
});

client.on('qr', async (qr) => {
    logger.info('QR Code generated');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('SCAN THIS QR CODE WITH WHATSAPP TO LOG IN');

    try {
        qrStream = await QRCode.toDataURL(qr);
    } catch (err) {
        logger.error('Error generating QR code image', err);
    }
});

client.on('ready', () => {
    logger.info('WhatsApp Client is ready!');
    qrStream = 'READY';
});

client.on('authenticated', () => {
    logger.info('WhatsApp Authenticated!');
    qrStream = 'AUTHENTICATED_PROCESSING';
});

client.on('auth_failure', (msg) => {
    logger.error('WhatsApp Authentication Failure', msg);
});

client.on('loading_screen', (percent, message) => {
    logger.info(`WhatsApp Loading: ${percent}% - ${message}`);
});

const getQR = () => qrStream;

client.on('message', async (msg) => {
    const chat = await msg.getChat();
    // console.log('Message received:', msg.body, 'From:', msg.from, 'IsGroup:', chat.isGroup); // Removed for privacy
    if (chat.isGroup) return;

    try {
        await handleMessage(msg);
    } catch (error) {
        logger.error(`WhatsApp Error: ${error.message}`);
        msg.reply('Üzgünüz, bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.');
    }
});

const handleMessage = async (msg) => {
    const config = await getConfig();
    const sender = msg.from;
    const phone = sender.replace('@c.us', '');
    const text = msg.body.trim().toLowerCase();

    // 1. BLACKLIST CHECK
    const isBlocked = await Blacklist.findOne({ phone });
    if (isBlocked) {
        logger.warn(`Blocked user tried to message: ${phone}`);
        return; // Ignore message
    }

    // 2. ADMIN COMMANDS (Run only if sender is self/admin)
    // Checking if the sender is the bot itself (Admin)
    // 2. ADMIN COMMANDS (Run only if sender is self/admin)
    // Checking if the sender is the bot itself (Admin)
    if (msg.fromMe || (client.info && msg.from === client.info.wid._serialized)) {

        // Command: engelle 532xxxxxxx
        if (text.startsWith('engelle ')) {
            const targetPhone = text.split(' ')[1];
            if (targetPhone && targetPhone.length > 9) {
                await Blacklist.create({ phone: targetPhone });
                await msg.reply(`✅ ${targetPhone} engellendi.`);
            } else {
                await msg.reply('❌ Hatalı numara formatı. Örnek: engelle 90532xxxxxxx');
            }
            return;
        }

        // Command: engel kaldır 532xxxxxxx
        if (text.startsWith('engel kaldır ')) {
            const targetPhone = text.split(' ')[2]; // "engel" "kaldır" "numara"
            if (targetPhone) {
                await Blacklist.findOneAndDelete({ phone: targetPhone });
                await msg.reply(`✅ ${targetPhone} engeli kaldırıldı.`);
            }
            return;
        }

        // Command: kapat [tarih]
        if (text.startsWith('kapat ')) {
            const dateStr = text.replace('kapat ', '').trim();
            const parsedDate = parseTurkishDate(dateStr);

            if (parsedDate) {
                // Check if already closed
                const existing = await ClosedDate.findOne({ date: parsedDate });
                if (existing) {
                    await msg.reply(`⚠️ ${parsedDate} tarihi zaten kapalı.`);
                } else {
                    await ClosedDate.create({ date: parsedDate, reason: 'WhatsApp üzerinden kapatıldı' });
                    await msg.reply(`✅ ${parsedDate} tarihi başarıyla randevulara kapatıldı.`);
                }
            } else {
                await msg.reply('❌ Tarih anlaşılamadı. Örnek: kapat yarın, kapat 25.12.2024');
            }
            return;
        }

        // Command: aç [tarih] (Re-open)
        if (text.startsWith('aç ')) {
            const dateStr = text.replace('aç ', '').trim();
            const parsedDate = parseTurkishDate(dateStr);

            if (parsedDate) {
                const deleted = await ClosedDate.findOneAndDelete({ date: parsedDate });
                if (deleted) {
                    await msg.reply(`✅ ${parsedDate} tarihi tekrar açıldı.`);
                } else {
                    await msg.reply(`⚠️ ${parsedDate} tarihi zaten açık.`);
                }
            } else {
                await msg.reply('❌ Tarih anlaşılamadı. Örnek: aç yarın');
            }
            return;
        }

        // Command: bugün (Get today's schedule)
        if (text === 'bugün') {
            const today = new Date().toISOString().split('T')[0];
            const appointments = await AppointmentService.getDailyAppointments(today);

            if (appointments.length === 0) {
                await msg.reply(`📅 *${today}* tarihinde henüz randevu yok.`);
            } else {
                let response = `📅 *${today} - Günlük Program*\n`;
                appointments.forEach(app => {
                    response += `\n⏰ *${app.hour}* - *${app.customerName}*\n     ✂️ _${app.service || 'Genel'}_\n`;
                });
                await msg.reply(response);
            }
            return;
        }
    }

    // If no admin command matched, DO NOT RETURN. 
    // Let it fall through to normal user logic so admin can use "randevu", "fiyat", etc.
    // Let it fall through to normal user logic so admin can use "randevu", "fiyat", etc.

    // Get customer name with fallback (whatsapp-web.js bug workaround)
    let customerName = 'Değerli Müşterimiz';
    try {
        const contact = await msg.getContact();
        customerName = contact.pushname || contact.name || contact.shortName;

        // Fallback to notifyName (raw data) if standard contact properties fail
        if (!customerName && msg._data && msg._data.notifyName) {
            customerName = msg._data.notifyName;
        }

        if (!customerName) customerName = 'Değerli Müşterimiz';
    } catch (e) {
        logger.warn('Contact name fetch failed:', e);
    }

    let userState = await BotState.findOne({ phone });
    if (!userState) {
        userState = await BotState.create({ phone });
    }

    // ============= GLOBAL COMMANDS =============

    // Cancel flow
    if (text === 'iptal' && userState.state !== 'IDLE') {
        userState.state = 'IDLE';
        userState.tempData = {};
        await userState.save();
        await msg.reply(`Sayın ${customerName},\n\nİşleminiz iptal edilmiştir.`);
        return;
    }

    // Back command
    if ((text === 'geri' || text === 'geri gel' || text === 'vazgeç') && userState.state !== 'IDLE') {
        if (userState.state === 'SELECT_HOUR') {
            userState.state = 'SELECT_DATE';
            userState.tempData = {};
            await userState.save();
            await msg.reply(`Sayın ${customerName},\n\nTamam, tarih seçimine geri döndük.\n\nLütfen yeni bir tarih yazınız (örn: Yarın, 25 Aralık).`);
            return;
        } else if (userState.state === 'SELECT_SERVICE') {
            userState.state = 'SELECT_HOUR';
            // We need to re-show slots. Since tempData has the date, we can fetch slots again.
            // However, simplicity is better: just ask for hour again.
            await userState.save();

            const slots = await AppointmentService.getAvailableSlots(userState.tempData.date);
            const slotList = slots.map(s => `• ${s}`).join('\n');

            await msg.reply(`Sayın ${customerName},\n\nTamam, saat seçimine geri döndük.\n\n${userState.tempData.date} için müsait saatler:\n\n${slotList}\n\nLütfen saat seçiniz.`);
            return;
        } else if (userState.state === 'CONFIRM_BOOKING') {
            userState.state = 'SELECT_SERVICE';
            await userState.save();

            // Re-show service list
            const config = await getConfig();
            let serviceList = `Sayın ${customerName},\n\nTamam, hizmet seçimine geri döndük.\n\n${userState.tempData.date} saat ${userState.tempData.hour} için hizmet seçiniz:\n`;
            config.services.forEach((s, i) => {
                serviceList += `\n${i + 1}. ${s.name} - ${s.price}₺`;
            });
            await msg.reply(serviceList);
            return;
        } else if (userState.state === 'SELECT_DATE') {
            userState.state = 'IDLE';
            userState.tempData = {};
            await userState.save();
            await msg.reply(`Sayın ${customerName},\n\nAna menüye döndük. Randevu almak için "randevu" yazabilirsiniz.`);
            return;
        }
    }

    // Price inquiry
    if (text.includes('fiyat') || text.includes('ücret') || text.includes('kaç para') || text.includes('ne kadar')) {
        let priceList = `Sayın ${customerName},\n\nHizmet fiyatlarımız:\n`;
        config.services.forEach(s => {
            priceList += `\n• ${s.name}: ${s.price}₺`;
        });
        priceList += `\n\nTüm hizmetlerimiz yaklaşık 1 saat sürmektedir.`;
        await msg.reply(priceList);
        return;
    }

    // Working hours inquiry
    if (text.includes('saat kaç') || text.includes('kaça kadar') || text.includes('çalışma saat') || text.includes('açık mı')) {
        await msg.reply(`Sayın ${customerName},\n\nÇalışma saatlerimiz:\n🕗 ${config.workingHours.start}:00 - ${config.workingHours.end}:00\n\nHer gün hizmetinizdeyiz.`);
        return;
    }

    // Location inquiry
    if (text.includes('adres') || text.includes('nerede') || text.includes('konum') || text.includes('yer')) {
        await msg.reply(`Sayın ${customerName},\n\n📍 Adresimiz:\n${config.location.address}\n\n🗺️ Google Maps:\n${config.location.mapsLink}`);
        return;
    }

    // Check existing appointment
    if (text.includes('randevum ne zaman') || text.includes('randevum var mı')) {
        const appt = await AppointmentService.getMyAppointment(phone);
        if (appt) {
            const service = config.services.find(s => s.id === appt.service) || { name: 'Genel', price: '-' };
            await msg.reply(`Sayın ${customerName},\n\nMevcut randevunuz:\n📅 Tarih: ${appt.date}\n⏰ Saat: ${appt.hour}\n💇 Hizmet: ${service.name}\n💰 Ücret: ${service.price}₺\n\nSizi bekliyoruz.`);
        } else {
            await msg.reply(`Sayın ${customerName},\n\nŞu an için kayıtlı bir randevunuz bulunmamaktadır.\n\nRandevu almak için "randevu" yazabilirsiniz.`);
        }
        return;
    }

    // Cancel existing appointment
    if (text.includes('randevu') && (text.includes('iptal') || text.includes('sil') || text.includes('vazgeç'))) {
        const appt = await AppointmentService.getMyAppointment(phone);
        if (appt) {
            await AppointmentService.deleteAppointment(appt._id);
            await msg.reply(`Sayın ${customerName},\n\n${appt.date} tarihli saat ${appt.hour} randevunuz sistemden tamamen silinmiştir.\n\nYeniden randevu almak için "randevu" yazabilirsiniz.`);

            // ADMIN NOTIFICATION (Cancellation)
            try {
                const adminMsg = `⚠️ *RANDEVU SİLİNDİ*\n\n👤 Müşteri: ${customerName}\n📱 Tel: ${phone}\n📅 Tarih: ${appt.date}\n⏰ Saat: ${appt.hour}`;
                if (client.info && client.info.wid) {
                    await client.sendMessage(client.info.wid._serialized, adminMsg);
                }
            } catch (ignore) { }

        } else {
            await msg.reply(`Sayın ${customerName},\n\nİptal edilecek aktif bir randevunuz bulunmamaktadır.`);
        }
        return;
    }

    // Customer history
    if (text.includes('geçmiş') || text.includes('son randevu') || text.includes('kaç kez')) {
        const history = await AppointmentService.getCustomerHistory(phone);
        if (history && history.length > 0) {
            let historyText = `Sayın ${customerName},\n\nSon randevularınız:\n`;
            history.slice(0, 5).forEach(h => {
                historyText += `\n• ${h.date} - ${h.hour}`;
            });
            historyText += `\n\nToplam ${history.length} kez ziyaret ettiniz. Teşekkür ederiz!`;
            await msg.reply(historyText);
        } else {
            await msg.reply(`Sayın ${customerName},\n\nGeçmiş randevu kaydınız bulunmamaktadır.`);
        }
        return;
    }

    // ============= STATE MACHINE =============
    switch (userState.state) {
        case 'IDLE':
            if (text.includes('randevu') || text === 'merhaba' || text === 'selam' || text === 'slm') {
                // Check for direct booking attempt
                const parsedDate = parseTurkishDate(text);
                const parsedTime = parseTime(text, config.workingHours);

                if (parsedDate && parsedTime) {
                    // Direct booking attempt
                    userState.tempData = { date: parsedDate, hour: parsedTime };
                    userState.state = 'SELECT_SERVICE';
                    await userState.save();

                    let serviceList = `Sayın ${customerName},\n\n${parsedDate} saat ${parsedTime} için randevu oluşturuyoruz.\n\nLütfen hizmet seçiniz:\n`;
                    config.services.forEach((s, i) => {
                        serviceList += `\n${i + 1}. ${s.name} - ${s.price}₺`;
                    });
                    serviceList += `\n\nNumara veya hizmet adı yazabilirsiniz.`;
                    await msg.reply(serviceList);
                    return;
                }

                userState.state = 'SELECT_DATE';
                await userState.save();
                await msg.reply(`Sayın ${customerName},\n\n${config.businessName}'a hoş geldiniz.\n\nRandevu için tarih ve saat belirtiniz.\n\nÖrnekler:\n• "25 Aralık 14:00"\n• "Yarın 15:00"\n• Sadece tarih yazarsanız müsait saatleri gösteririz\n\nÇalışma saatlerimiz: ${config.workingHours.start}:00 - ${config.workingHours.end}:00`);
            } else {
                await msg.reply(`Sayın ${customerName},\n\n${config.businessName} otomatik randevu sistemine hoş geldiniz.\n\n📅 Randevu almak için "randevu" yazınız\n🔍 Randevunuzu sorgulamak için "randevum ne zaman"\n💰 Fiyatlar için "fiyatlar"\n📍 Adres için "adres"\n🕐 Çalışma saatleri için "saat kaça kadar"`);
            }
            break;

        case 'SELECT_DATE':
            const parsedDate = parseTurkishDate(text);
            const parsedTime = parseTime(text, config.workingHours);

            if (!parsedDate) {
                await msg.reply(`Sayın ${customerName},\n\nGirdiğiniz tarih anlaşılamamıştır.\n\nÖrnekler: Bugün, Yarın, 25 Aralık, 25.12.2024\n\n(Geri dönmek için "geri" yazabilirsiniz)`);
                return;
            }

            const slots = await AppointmentService.getAvailableSlots(parsedDate);

            if (parsedTime && slots.includes(parsedTime)) {
                userState.tempData = { date: parsedDate, hour: parsedTime };
                userState.state = 'SELECT_SERVICE';
                await userState.save();

                let serviceList = `Sayın ${customerName},\n\n${parsedDate} saat ${parsedTime} için randevu oluşturuyoruz.\n\nLütfen hizmet seçiniz:\n`;
                config.services.forEach((s, i) => {
                    serviceList += `\n${i + 1}. ${s.name} - ${s.price}₺`;
                });
                await msg.reply(serviceList);
                return;
            }

            if (slots.length === 0) {
                const nextDays = await findNextAvailableDays(parsedDate);
                if (nextDays.length > 0) {
                    let response = `Sayın ${customerName},\n\n${parsedDate} tarihinde müsait yerimiz yok.\n\nEn yakın müsait günler:\n`;
                    nextDays.forEach(day => {
                        response += `\n📅 ${day.date}: ${day.slots.slice(0, 4).join(', ')}`;
                    });
                    await msg.reply(response);
                } else {
                    await msg.reply(`Sayın ${customerName},\n\nÜzgünüz, önümüzdeki günlerde müsait randevu bulunmamaktadır.`);
                }
                return;
            }

            userState.tempData = { date: parsedDate };
            userState.state = 'SELECT_HOUR';
            await userState.save();

            const slotList = slots.map(s => `• ${s}`).join('\n');
            await msg.reply(`Sayın ${customerName},\n\n${parsedDate} için müsait saatler:\n\n${slotList}\n\nLütfen saat yazınız.\n\n(Geri dönmek için "geri" yazabilirsiniz)`);
            break;

        case 'SELECT_HOUR':
            const selectedHour = parseTime(text, config.workingHours);

            if (!selectedHour) {
                await msg.reply(`Sayın ${customerName},\n\nSaat anlaşılamamıştır. Örnek: 14:00 veya 14`);
                return;
            }

            userState.tempData.hour = selectedHour;
            userState.state = 'SELECT_SERVICE';
            await userState.save();

            let serviceList = `Sayın ${customerName},\n\n${userState.tempData.date} saat ${selectedHour} için hizmet seçiniz:\n`;
            config.services.forEach((s, i) => {
                serviceList += `\n${i + 1}. ${s.name} - ${s.price}₺`;
            });
            await msg.reply(serviceList + '\n\n(Geri dönmek için "geri" yazabilirsiniz)');
            break;

        case 'SELECT_SERVICE':
            const service = parseService(text, config.services);

            if (!service) {
                await msg.reply(`Sayın ${customerName},\n\nHizmet anlaşılamamıştır.\n\n1. Saç Kesimi\n2. Sakal\n3. Saç + Sakal\n\nNumara veya isim yazınız.`);
                return;
            }

            userState.tempData.service = service;
            userState.state = 'CONFIRM_BOOKING';
            await userState.save();

            await msg.reply(`Sayın ${customerName},\n\nRandevu Onayı:\n📅 Tarih: ${userState.tempData.date}\n⏰ Saat: ${userState.tempData.hour}\n💇 Hizmet: ${service.name}\n💰 Ücret: ${service.price}₺\n\nOnaylıyor musunuz? (Evet / Hayır)\n\n(Geri dönmek için "geri" yazabilirsiniz)`);
            break;

        case 'CONFIRM_BOOKING':
            if (text === 'evet' || text === 'onaylıyorum' || text === 'e') {
                try {
                    const selectedService = userState.tempData.service; // Get from temp data

                    await AppointmentService.createAppointment({
                        customerName: customerName,
                        phone: phone,
                        date: userState.tempData.date,
                        hour: userState.tempData.hour,
                        service: selectedService.id,
                        createdFrom: 'whatsapp'
                    });

                    await msg.reply(`Sayın ${customerName},\n\nRandevunuz başarıyla oluşturulmuştur. ✅\n\nSizi bekliyoruz. İyi günler dileriz.`);

                    // ADMIN NOTIFICATION (Self-Message)
                    try {
                        const adminMsg = `🔔 *YENİ RANDEVU!*\n\n👤 Müşteri: ${customerName}\n📱 Tel: ${phone}\n📅 Tarih: ${userState.tempData.date}\n⏰ Saat: ${userState.tempData.hour}\n💇 İşlem: ${selectedService.name}`;
                        // Send to own number (Note: client.info might be null if not fully ready, but usually fine here)
                        if (client.info && client.info.wid) {
                            await client.sendMessage(client.info.wid._serialized, adminMsg);
                        } else {
                            logger.warn('Admin notification failed: Client info not available');
                        }
                    } catch (adminErr) {
                        logger.error('Failed to send admin notification', adminErr);
                    }

                    userState.state = 'IDLE';
                    userState.tempData = {};
                    await userState.save();

                } catch (error) {
                    if (error.message.includes('dolu')) {
                        await msg.reply(`Sayın ${customerName},\n\nÜzgünüz, onay sırasında seçtiğiniz saat doldu.\n\nLütfen farklı bir saat seçiniz.`);
                        userState.state = 'SELECT_DATE';
                        await userState.save();
                    } else {
                        logger.error('Booking Creation Error:', error); // Log the exact error
                        await msg.reply(`Sayın ${customerName},\n\nBir hata oluştu (${error.message}). Lütfen tekrar deneyiniz.`);
                        userState.state = 'IDLE';
                        await userState.save();
                    }
                }
            } else if (text === 'hayır' || text === 'h' || text === 'iptal') {
                userState.state = 'IDLE';
                userState.tempData = {};
                await userState.save();
                await msg.reply(`Sayın ${customerName},\n\nRandevu işlemi iptal edilmiştir.`);
            } else {
                await msg.reply(`Sayın ${customerName},\n\nLütfen "Evet" veya "Hayır" yazınız.`);
            }
            break;

        default:
            userState.state = 'IDLE';
            await userState.save();
            break;
    }
};

const pairWithPhone = async (phoneNumber) => {
    try {
        if (client.info && client.info.wid) {
            throw new Error('Already connected');
        }
        // Ensure format is correct (remove +)
        const formattedPhone = phoneNumber.replace('+', '').replace(/\s/g, '');

        // Retry logic for pairing code request
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                // Wait for page to be ready and stabilized
                logger.info(`Waiting 10s for page stability before requesting code (Attempt ${attempts + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 10000));

                const code = await client.requestPairingCode(formattedPhone);
                return code;
            } catch (err) {
                attempts++;
                logger.warn(`Pairing attempt ${attempts} failed:`, err);

                if (attempts >= maxAttempts) throw err;

                // Wait 2 seconds before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    } catch (error) {
        logger.error('Pairing failed', error);
        throw error;
    }
};

const initialize = () => {
    client.initialize();
};

const logout = async () => {
    try {
        await client.logout();
    } catch (ignored) { } // Ignore if already logged out

    try {
        await client.destroy();
    } catch (ignored) { }

    qrStream = null;
    initialize(); // Re-init for fresh QR
    return true;
};

// Export config for use in other modules
module.exports = { initialize, getQR, pairWithPhone, logout, client };

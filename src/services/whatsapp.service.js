const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { addDays, format, subDays, subHours } = require('date-fns');
const AppointmentService = require('./appointment.service');
const BotState = require('../models/botState.model');
const Blacklist = require('../models/blacklist.model');
const ClosedDate = require('../models/closedDate.model');
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
    // Default services fallback
    const defaultServices = [
        { id: 'sac', name: 'Saç Kesimi', price: 500, duration: 60 },
        { id: 'sakal', name: 'Sakal', price: 300, duration: 60 },
        { id: 'sac_sakal', name: 'Saç + Sakal', price: 600, duration: 60 }
    ];

    return {
        businessName: 'By Ramazan',
        workingHours: { start: settings.appointmentStartHour, end: settings.appointmentEndHour },
        bookingRangeDays: settings.bookingRangeDays || 14,
        services: services.length > 0 ? services : defaultServices,
        location: {
            address: settings.businessAddress,
            mapsLink: settings.businessMapsLink
        }
    };
};

// ============= UTILS & HELPERS =============

// Levenshtein for Fuzzy Matching
const levenshtein = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const isSimilar = (text, target, threshold = 2) => {
    return levenshtein(text, target) <= threshold;
};

// Generate full list of slots for a day based on working hours
const generateAllSlots = (workingHours) => {
    const slots = [];
    for (let i = workingHours.start; i < workingHours.end; i++) {
        slots.push(`${String(i).padStart(2, '0')}:00`);
    }
    return slots;
};

const parseTurkishDate = (text) => {
    const lower = text.toLowerCase()
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
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
    if (dateMatch) return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    return null;
};

const parseTime = (text, workingHours) => {
    const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
    if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        if (hour >= workingHours.start && hour < workingHours.end) return `${String(hour).padStart(2, '0')}:00`;
    }
    const hourPrefixMatch = text.match(/saat\s*(\d{1,2})/i);
    if (hourPrefixMatch) {
        let hour = parseInt(hourPrefixMatch[1]);
        if (hour >= workingHours.start && hour < workingHours.end) return `${String(hour).padStart(2, '0')}:00`;
    }
    const months = ['ocak', 'şubat', 'subat', 'mart', 'nisan', 'mayıs', 'mayis', 'haziran', 'temmuz', 'ağustos', 'agustos', 'eylül', 'eylul', 'ekim', 'kasım', 'kasim', 'aralık', 'aralik'];
    const monthPattern = months.join('|');
    const standaloneRegex = new RegExp(`(\\d{1,2})(?!\\d)(?!\\s*(?:${monthPattern}))`, 'i');
    const hourMatch = text.match(standaloneRegex);
    if (hourMatch) {
        let hour = parseInt(hourMatch[1]);
        if (hour >= workingHours.start && hour < workingHours.end) return `${String(hour).padStart(2, '0')}:00`;
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

const parseService = (text, services) => {
    const lower = text.toLowerCase();
    if (lower.includes('saç') && lower.includes('sakal')) return services.find(s => s.id === 'sac_sakal') || services[2];
    if (lower.includes('sakal')) return services.find(s => s.id === 'sakal') || services[1];
    if (lower.includes('saç') || lower.includes('kesim')) return services.find(s => s.id === 'sac') || services[0];
    if (lower.includes('1')) return services[0];
    if (lower.includes('2')) return services[1];
    if (lower.includes('3')) return services[2];
    return null;
};

// ============= CLIENT SETUP =============
let qrStream = null;
let activeClient = null; // Used for export
// 10 second safety buffer for old messages
const BOT_START_TIME = Math.floor(Date.now() / 1000);

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
            '--single-process', // Tek process modunda çalış - RAM tasarrufu
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-domain-reliability',
            '--disable-features=TranslateUI,BlinkGenPropertyTrees,IsolateOrigins,site-per-process',
            '--disable-hang-monitor',
            '--disable-ipc-flooding-protection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-renderer-backgrounding',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-pings',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--js-flags=--max-old-space-size=256' // JS heap limiti
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

// CRITICAL SAFETY FUNCTION
// All message sending must go through this to avoid "markedUnread" error
const sendMessageSafe = async (chatId, content) => {
    if (!client) return false;
    try {
        await client.sendMessage(chatId, content, { sendSeen: false });
        return true;
    } catch (error) {
        logger.error(`Failed to send message to ${chatId}: ${error.message}`);
        return false;
    }
};

client.on('qr', async (qr) => {
    logger.info('QR Code generated');
    qrcodeTerminal.generate(qr, { small: true });
    try { qrStream = await QRCode.toDataURL(qr); } catch (err) { logger.error('Error generating QR image', err); }
});

client.on('ready', () => {
    logger.info('WhatsApp Client is ready!');
    qrStream = 'READY';
    activeClient = client;
});

client.on('authenticated', () => {
    logger.info('WhatsApp Authenticated!');
    qrStream = 'AUTHENTICATED_PROCESSING';
});

client.on('loading_screen', (percent, message) => logger.info(`WhatsApp Loading: ${percent}%`));

// ============= RATE LIMITER =============
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_MSGS_PER_WINDOW = 15;
const userMessageCounts = new Map();

const isRateLimited = (phone) => {
    const now = Date.now();
    const userRecord = userMessageCounts.get(phone) || { count: 0, startTime: now };

    if (now - userRecord.startTime > RATE_LIMIT_WINDOW) {
        userRecord.count = 1;
        userRecord.startTime = now;
        userMessageCounts.set(phone, userRecord);
        return false;
    }

    userRecord.count++;
    if (userRecord.count > MAX_MSGS_PER_WINDOW) {
        return true;
    }

    return false;
};

// ============= MESSAGE HANDLING =============
client.on('message', async (msg) => {
    if (msg.timestamp < (BOT_START_TIME - 10)) return; // Ignore old messages
    const chat = await msg.getChat();
    if (chat.isGroup) return;

    // reply helper with HUMAN-LIKE DELAY
    const reply = async (text) => {
        const delay = Math.floor(Math.random() * 1500) + 1000; // 1-2.5s delay
        await new Promise(resolve => setTimeout(resolve, delay));
        await sendMessageSafe(msg.from, text);
    };

    try {
        await handleMessage(msg, reply);
    } catch (error) {
        logger.error(`WhatsApp Error: ${error.message}`);
        await reply('Üzgünüz, bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.');
    }
});

const handleMessage = async (msg, reply) => {
    const config = await getConfig();
    const sender = msg.from;
    const phone = sender.replace('@c.us', '');
    const text = msg.body.trim().toLowerCase();

    // RATE LIMIT CHECK
    const isAdmin = msg.fromMe || (client.info && msg.from === client.info.wid._serialized);
    if (!isAdmin && isRateLimited(phone)) {
        logger.warn(`Rate limit exceeded for ${phone}`);
        return;
    }

    // 1. BLACKLIST
    const isBlocked = await Blacklist.findOne({ phone });
    if (isBlocked) {
        logger.warn(`Blocked user: ${phone}`);
        return;
    }

    // 2. ADMIN COMMANDS
    if (msg.fromMe || (client.info && msg.from === client.info.wid._serialized)) {
        if (text.startsWith('engelle ')) {
            const target = text.split(' ')[1];
            if (target && target.length > 9) {
                await Blacklist.create({ phone: target });
                await reply(`✅ ${target} engellendi.`);
            } else await reply('❌ Hatalı format.');
            return;
        }
        if (text.startsWith('engel kaldır ')) {
            const target = text.split(' ')[2];
            if (target) {
                await Blacklist.findOneAndDelete({ phone: target });
                await reply(`✅ ${target} engeli kaldırıldı.`);
            }
            return;
        }
        if (text.startsWith('kapat ')) {
            const dateStr = text.replace('kapat ', '').trim();
            const parsed = parseTurkishDate(dateStr);
            if (parsed) {
                await ClosedDate.create({ date: parsed, reason: 'Admin Action' });
                await reply(`✅ ${parsed} kapatıldı.`);
            } else await reply('❌ Tarih anlaşılamadı.');
            return;
        }
        if (text.startsWith('aç ')) {
            const dateStr = text.replace('aç ', '').trim();
            const parsed = parseTurkishDate(dateStr);
            if (parsed) {
                await ClosedDate.findOneAndDelete({ date: parsed });
                await reply(`✅ ${parsed} tekrar açıldı.`);
            } else await reply('❌ Tarih anlaşılamadı.');
            return;
        }
        if (text === 'bugün') {
            const today = new Date().toISOString().split('T')[0];
            const apps = await AppointmentService.getDailyAppointments(today);
            if (apps.length === 0) await reply(`📅 ${today} için randevu yok.`);
            else {
                let res = `📅 *${today} Programı*\n`;
                apps.forEach(a => res += `\n⏰ ${a.hour} - ${a.customerName} (${a.service || 'Genel'})`);
                await reply(res);
            }
            return;
        }
    }

    // 3. GET USER INFO & STATE
    let customerName = 'Değerli Müşterimiz';
    try {
        const contact = await msg.getContact();
        customerName = contact.pushname || contact.name || contact.shortName || msg._data.notifyName || customerName;
    } catch (e) { }

    let userState = await BotState.findOne({ phone });
    if (!userState) userState = await BotState.create({ phone });

    // 4. GLOBAL COMMANDS

    // Check for Cancel (Unique or fuzzy)
    const isCancel = ['iptal', 'vazgeç', 'sil'].some(k => text.includes(k) || isSimilar(text, k, 2));
    if (isCancel && userState.state !== 'IDLE') {
        userState.state = 'IDLE'; userState.tempData = {}; await userState.save();
        await reply(`Sayın ${customerName},\n\nİşleminiz iptal edilmiştir.`);
        return;
    }

    // Check for Back (Unique or fuzzy)
    const isBack = ['geri', 'geri gel', 'önceki'].some(k => text.includes(k) || isSimilar(text, k, 2));
    if (isBack && userState.state !== 'IDLE') {
        const stateMap = {
            'SELECT_DATE': 'IDLE',
            'SELECT_HOUR': 'SELECT_DATE',
            'SELECT_SERVICE': 'SELECT_HOUR',
            'CONFIRM_BOOKING': 'SELECT_SERVICE'
        };
        const nextState = stateMap[userState.state] || 'IDLE';
        userState.state = nextState;

        await userState.save();

        const msgs = {
            'IDLE': 'Ana menüye dönüldü.',
            'SELECT_DATE': 'Tarih seçimine dönüldü.',
            'SELECT_HOUR': 'Saat seçimine dönüldü.',
            'SELECT_SERVICE': 'Hizmet seçimine dönüldü.'
        };
        await reply(`Sayın ${customerName},\n\n${msgs[nextState] || 'Bir önceki adıma dönüldü.'} Devam ediniz.`);
        return;
    }

    if (text.includes('fiyat') || text.includes('ücret')) {
        let pList = `Sayın ${customerName},\n\nFiyat Listemiz:\n`;
        config.services.forEach(s => pList += `\n• ${s.name}: ${s.price}₺`);
        await reply(pList);
        return;
    }
    if (text.includes('adres') || text.includes('konum')) {
        await reply(`📍 Adresimiz:\n${config.location.address}\n\n${config.location.mapsLink}`);
        return;
    }
    // Enhanced "Randevum ne zaman" check
    if (text.includes('randevum') || text.includes('randevu sorgula')) {
        const appt = await AppointmentService.getMyAppointment(phone);
        if (appt) {
            const serviceName = config.services.find(s => s.id === appt.service)?.name || 'Hizmet Belirtilmemiş';
            await reply(`📅 *Mevcut Randevunuz*\n\n👤 İsim: ${appt.customerName}\n🗓️ Tarih: ${appt.date}\n⏰ Saat: ${appt.hour}\n✂️ İşlem: ${serviceName}\n📍 Adres: ${config.location.address}\n\n(İptal etmek için "randevu sil" yazabilirsiniz)`);
        } else await reply('Şu anda aktif bir randevunuz bulunmamaktadır.\n\nYeni randevu almak için "randevu" yazabilirsiniz.');
        return;
    }
    if (text.includes('geçmiş')) {
        const hist = await AppointmentService.getCustomerHistory(phone);
        await reply(`Daha önce ${hist.length} kez bizi tercih ettiniz. Teşekkürler!`);
        return;
    }

    // 5. STATE MACHINE
    switch (userState.state) {
        case 'IDLE':
            // Enhanced Trigger Logic (Fuzzy + "Başka randevu")
            const isBooking = text.includes('randevu') || isSimilar(text, 'randevu', 3) ||
                text.includes('başka') || text.includes('yeni') ||
                ['merhaba', 'selam', 'slm'].some(w => text === w || isSimilar(text, w, 1));

            if (isBooking) {
                // Check direct quick booking
                const pDate = parseTurkishDate(text);
                const pTime = parseTime(text, config.workingHours);
                if (pDate && pTime) {
                    userState.tempData = { date: pDate, hour: pTime };
                    userState.state = 'SELECT_SERVICE';
                    await userState.save();
                    let sList = `Sayın ${customerName},\n\n${pDate} ${pTime} için hizmet seçiniz:\n`;
                    config.services.forEach((s, i) => sList += `\n${i + 1}. ${s.name} - ${s.price}₺`);
                    await reply(sList);
                } else {
                    userState.state = 'SELECT_DATE';
                    await userState.save();

                    // Date Range Display
                    const today = new Date();
                    const maxDate = addDays(today, config.bookingRangeDays);
                    const rangeStr = `${format(today, 'dd.MM')} - ${format(maxDate, 'dd.MM')}`;

                    await reply(`Sayın ${customerName},\n\nHoş geldiniz. Randevu için lütfen tarih belirtiniz.\n\n📅 Müsait Aralık: *${rangeStr}*\n(Örn: Yarın, 20 Ocak vb).`);
                }
            } else if (text.includes('iptal') || text.includes('sil') || isSimilar(text, 'iptal', 2)) {
                // Explicit cancel command in IDLE
                const appt = await AppointmentService.getMyAppointment(phone);
                if (appt) {
                    await AppointmentService.deleteAppointment(appt._id);
                    await reply(`Sayın ${customerName},\n\n${appt.date} ${appt.hour} randevunuz silinmiştir. ✅`);

                    // Detailed Admin Notify (Cancellation)
                    if (client.info && client.info.wid) {
                        const amsg = `🗑️ *RANDEVU SİLİNDİ*\n\n👤 Müşteri: ${customerName}\n📱 Tel: ${phone}\n📅 Tarih: ${appt.date}\n⏰ Saat: ${appt.hour}`;
                        await sendMessageSafe(client.info.wid._serialized, amsg);
                    }
                } else {
                    await reply('İptal edilecek aktif randevunuz bulunmamaktadır.');
                }
            } else {
                await reply(`Sayın ${customerName},\n\nHoş geldiniz! Randevu almak için "randevu" yazabilir, "fiyat", "adres" gibi sorular sorabilirsiniz.`);
            }
            break;

        case 'SELECT_DATE':
            const date = parseTurkishDate(text);
            if (!date) {
                await reply('Tarih anlaşılamadı. Lütfen "Yarın" veya "20 Ocak" gibi yazınız.');
                return;
            }

            // Get Available only
            const freeSlots = await AppointmentService.getAvailableSlots(date);

            // Generate Full List 
            const allSlots = generateAllSlots(config.workingHours);

            if (freeSlots.length === 0) {
                // If NO slots at all
                const next = await findNextAvailableDays(date);
                if (next.length > 0) {
                    let msg = `Sayın ${customerName},\n\n${date} tarihinde yerimiz yok. En yakın müsait günler:\n`;
                    next.forEach(d => msg += `\n📅 ${d.date}: ${d.slots.slice(0, 3).join(', ')}`);
                    await reply(msg);
                } else {
                    await reply('Üzgünüz, yakın tarihte boşluk bulamadık.');
                }
                return;
            }

            // Render Slots with Strikethrough for booked ones
            // If a slot is in `allSlots` but NOT in `freeSlots`, it is Booked.
            const renderedSlots = allSlots.map(slot => {
                if (freeSlots.includes(slot)) {
                    return `• ${slot}`;
                } else {
                    return `• ~${slot}~ (Dolu)`;
                }
            }).join('\n');

            userState.tempData = { date };
            userState.state = 'SELECT_HOUR';
            await userState.save();
            await reply(`${date} için saat durumu:\n\n${renderedSlots}\n\nLütfen *müsait* olan saatlerden birini yazınız.`);
            break;

        case 'SELECT_HOUR':
            const time = parseTime(text, config.workingHours);
            if (!time) {
                await reply('Saat anlaşılamadı. Lütfen listeden bir saat yazınız (Örn: 14:00).');
                return;
            }
            // Smart Slot check
            const currentSlots = await AppointmentService.getAvailableSlots(userState.tempData.date);
            if (!currentSlots.includes(time)) {
                // Slot Full Logic
                if (currentSlots.length > 0) {
                    await reply(`⚠️ Seçtiğiniz saat (${time}) maalesef doldu veya uygun değil.\n\nGüncel müsait saatler:\n${currentSlots.map(s => `• ${s}`).join('\n')}\n\nLütfen bunlardan birini seçiniz.`);
                } else {
                    await reply(`⚠️ ${userState.tempData.date} tarihi için tüm randevular doldu.\n\nLütfen farklı bir gün seçmek için "geri" yazınız.`);
                }
                return;
            }
            userState.tempData.hour = time;
            userState.state = 'SELECT_SERVICE';
            await userState.save();
            let servList = `Sayın ${customerName},\n\n${userState.tempData.date} ${time} için hizmet seçiniz:\n`;
            config.services.forEach((s, i) => servList += `\n${i + 1}. ${s.name} - ${s.price}₺`);
            await reply(servList);
            break;

        case 'SELECT_SERVICE':
            const srv = parseService(text, config.services);
            if (!srv) {
                await reply('Hizmet anlaşılamadı. Lütfen numara veya isim yazınız.');
                return;
            }
            userState.tempData.service = srv;
            userState.state = 'CONFIRM_BOOKING';
            await userState.save();
            await reply(`📝 *RANDEVU ONAYI*\n\nMüşteri: ${customerName}\nTarih: ${userState.tempData.date}\nSaat: ${userState.tempData.hour}\nİşlem: ${srv.name}\nÜcret: ${srv.price}₺\n\nOnaylıyor musunuz? (Evet / Hayır)`);
            break;

        case 'CONFIRM_BOOKING':
            if (['evet', 'onaylıyorum', 'e'].includes(text) || isSimilar(text, 'evet', 1)) {
                try {
                    await AppointmentService.createAppointment({
                        customerName, phone,
                        date: userState.tempData.date,
                        hour: userState.tempData.hour,
                        service: userState.tempData.service.id,
                        createdFrom: 'whatsapp'
                    });

                    await reply(`✅ Randevunuz oluşturuldu! Sizi bekliyoruz.`);

                    // Admin Notify (New Appointment)
                    if (client.info && client.info.wid) {
                        const amsg = `🔔 *YENİ RANDEVU!*\n\n👤 Müşteri: ${customerName}\n📱 Tel: ${phone}\n📅 Tarih: ${userState.tempData.date}\n⏰ Saat: ${userState.tempData.hour}\n✂️ İşlem: ${userState.tempData.service.name}`;
                        await sendMessageSafe(client.info.wid._serialized, amsg);
                    }

                    userState.state = 'IDLE';
                    userState.tempData = {};
                    await userState.save();

                } catch (err) {
                    if (err.message.includes('dolu')) {
                        // Smart Error Handling
                        const currentSlots = await AppointmentService.getAvailableSlots(userState.tempData.date);
                        if (currentSlots.length > 0) {
                            await reply(`⚠️ Tam onaylarken seçtiğiniz saat doldu.\n\nGüncel müsait saatler:\n${currentSlots.map(s => `• ${s}`).join('\n')}\n\nLütfen yeni bir saat yazınız.`);
                            userState.state = 'SELECT_HOUR';
                        } else {
                            await reply(`⚠️ Üzgünüz, bu tarihteki tüm randevular doldu.\n\nLütfen farklı bir tarih seçmek için "geri" yazınız.`);
                            userState.state = 'SELECT_HOUR'; // effectively stuck until back
                        }
                        await userState.save();
                    } else {
                        await reply('Bir hata oluştu. Lütfen tekrar deneyin.');
                        userState.state = 'IDLE';
                        await userState.save();
                    }
                }
            } else if (['hayır', 'iptal', 'merhaba', 'selam'].includes(text) || isSimilar(text, 'hayır', 1)) {
                // Graceful exit/reset
                userState.state = 'IDLE';
                userState.tempData = {};
                await userState.save();
                await reply('İşlem iptal edildi veya başa dönüldü. Nasıl yardımcı olabilirim?');
            } else {
                await reply('Lütfen "Evet" diyerek onaylayın veya "Hayır" diyerek iptal edin.');
            }
            break;

        default:
            userState.state = 'IDLE';
            await userState.save();
            break;
    }
};

const initialize = () => client.initialize();
const getQR = () => qrStream;
const logout = async () => { await client.logout(); await client.destroy(); initialize(); };
const pairWithPhone = async (p) => {
    if (client.info) throw new Error('Connected');
    return await client.requestPairingCode(p.replace('+', '').replace(/\s/g, ''));
};

module.exports = { initialize, getQR, pairWithPhone, logout, client, sendMessage: sendMessageSafe };

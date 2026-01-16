const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { addDays, format, subDays, subHours } = require('date-fns');
const AppointmentService = require('./appointment.service');
const BotState = require('../models/botState.model');
const logger = require('../config/logger');

// ============= CONFIGURATION =============
const CONFIG = {
    businessName: 'By Ramazan',
    workingHours: { start: 8, end: 20 }, // 08:00 - 20:00
    services: [
        { id: 'sac', name: 'Saç Kesimi', price: 500, duration: 60 },
        { id: 'sakal', name: 'Sakal', price: 300, duration: 60 },
        { id: 'sac_sakal', name: 'Saç + Sakal', price: 600, duration: 60 }
    ],
    location: {
        address: 'Movenpick Hotel -1 Kat - Malatya',
        mapsLink: 'https://www.google.com/maps?gs_lcrp=EgZjaHJvbWUqEggBEC4YJxjHARjRAxiABBiKBTIGCAAQRRg5MhIIARAuGCcYxwEY0QMYgAQYigUyBggCEEUYQDIQCAMQRRgTGCcYOxiABBiKBTIHCAQQABiABDIWCAUQLhivARjHARiABBiYBRiZBRieBTIHCAYQABiABDIHCAcQABiABNIBCDE2MDNqMGo3qAIAsAIA&um=1&ie=UTF-8&fb=1&gl=tr&sa=X&geocode=KdFDqFFTN3ZAMQK_H203Wt62&daddr=%C4%B0n%C3%B6n%C3%BC,+%C4%B0n%C3%B6n%C3%BC+Cd.+No:174,+44090+Ye%C5%9Filyurt/Malatya'
    }
};

// Helper to parse turkish dates
const parseTurkishDate = (text) => {
    const lower = text.toLowerCase();
    const today = new Date();

    if (lower.includes('bugün')) return format(today, 'yyyy-MM-dd');
    if (lower.includes('yarın')) return format(addDays(today, 1), 'yyyy-MM-dd');
    if (lower.includes('yarından sonra')) return format(addDays(today, 2), 'yyyy-MM-dd');

    const monthMap = {
        'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'haziran': '06',
        'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
    };

    for (const [month, code] of Object.entries(monthMap)) {
        if (lower.includes(month)) {
            const dayMatch = lower.match(/(\d{1,2})/);
            if (dayMatch) {
                const day = dayMatch[0].padStart(2, '0');
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

const parseTime = (text) => {
    const timeMatch = text.match(/(\d{1,2})[:.]?00/);
    if (timeMatch) {
        const hour = timeMatch[1].padStart(2, '0');
        return `${hour}:00`;
    }

    const hourMatch = text.match(/(?:saat\s*)?(\d{1,2})(?!\d)/);
    if (hourMatch && parseInt(hourMatch[1]) >= CONFIG.workingHours.start && parseInt(hourMatch[1]) < CONFIG.workingHours.end) {
        const hour = hourMatch[1].padStart(2, '0');
        return `${hour}:00`;
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
const parseService = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('saç') && lower.includes('sakal')) return CONFIG.services.find(s => s.id === 'sac_sakal');
    if (lower.includes('sakal')) return CONFIG.services.find(s => s.id === 'sakal');
    if (lower.includes('saç') || lower.includes('kesim')) return CONFIG.services.find(s => s.id === 'sac');

    // Check by number
    if (lower.includes('1')) return CONFIG.services[0];
    if (lower.includes('2')) return CONFIG.services[1];
    if (lower.includes('3')) return CONFIG.services[2];

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
            '--disable-gpu'
        ]
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
    if (chat.isGroup) return;

    try {
        await handleMessage(msg);
    } catch (error) {
        logger.error(`WhatsApp Error: ${error.message}`);
        msg.reply('Üzgünüz, bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.');
    }
});

const handleMessage = async (msg) => {
    const sender = msg.from;
    const phone = sender.replace('@c.us', '');
    const text = msg.body.trim().toLowerCase();

    // Get customer name with fallback (whatsapp-web.js bug workaround)
    let customerName = 'Değerli Müşterimiz';
    try {
        const contact = await msg.getContact();
        customerName = contact.pushname || contact.name || 'Değerli Müşterimiz';
    } catch (e) {
        // Ignore contact fetch errors
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

    // Price inquiry
    if (text.includes('fiyat') || text.includes('ücret') || text.includes('kaç para') || text.includes('ne kadar')) {
        let priceList = `Sayın ${customerName},\n\nHizmet fiyatlarımız:\n`;
        CONFIG.services.forEach(s => {
            priceList += `\n• ${s.name}: ${s.price}₺`;
        });
        priceList += `\n\nTüm hizmetlerimiz yaklaşık 1 saat sürmektedir.`;
        await msg.reply(priceList);
        return;
    }

    // Working hours inquiry
    if (text.includes('saat kaç') || text.includes('kaça kadar') || text.includes('çalışma saat') || text.includes('açık mı')) {
        await msg.reply(`Sayın ${customerName},\n\nÇalışma saatlerimiz:\n🕗 ${CONFIG.workingHours.start}:00 - ${CONFIG.workingHours.end}:00\n\nHer gün hizmetinizdeyiz.`);
        return;
    }

    // Location inquiry
    if (text.includes('adres') || text.includes('nerede') || text.includes('konum') || text.includes('yer')) {
        await msg.reply(`Sayın ${customerName},\n\n📍 Adresimiz:\n${CONFIG.location.address}\n\n🗺️ Google Maps:\n${CONFIG.location.mapsLink}`);
        return;
    }

    // Check existing appointment
    if (text.includes('randevum ne zaman') || text.includes('randevum var mı')) {
        const appt = await AppointmentService.getMyAppointment(phone);
        if (appt) {
            const service = CONFIG.services.find(s => s.id === appt.service) || { name: 'Genel', price: '-' };
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
            await AppointmentService.cancelAppointment(appt._id);
            await msg.reply(`Sayın ${customerName},\n\n${appt.date} tarihli saat ${appt.hour} randevunuz iptal edilmiştir.\n\nYeniden randevu almak için "randevu" yazabilirsiniz.`);
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
                const parsedTime = parseTime(text);

                if (parsedDate && parsedTime) {
                    // Direct booking attempt
                    userState.tempData = { date: parsedDate, hour: parsedTime };
                    userState.state = 'SELECT_SERVICE';
                    await userState.save();

                    let serviceList = `Sayın ${customerName},\n\n${parsedDate} saat ${parsedTime} için randevu oluşturuyoruz.\n\nLütfen hizmet seçiniz:\n`;
                    CONFIG.services.forEach((s, i) => {
                        serviceList += `\n${i + 1}. ${s.name} - ${s.price}₺`;
                    });
                    serviceList += `\n\nNumara veya hizmet adı yazabilirsiniz.`;
                    await msg.reply(serviceList);
                    return;
                }

                userState.state = 'SELECT_DATE';
                await userState.save();
                await msg.reply(`Sayın ${customerName},\n\n${CONFIG.businessName}'a hoş geldiniz.\n\nRandevu için tarih ve saat belirtiniz.\n\nÖrnekler:\n• "25 Aralık 14:00"\n• "Yarın 15:00"\n• Sadece tarih yazarsanız müsait saatleri gösteririz\n\nÇalışma saatlerimiz: ${CONFIG.workingHours.start}:00 - ${CONFIG.workingHours.end}:00`);
            } else {
                await msg.reply(`Sayın ${customerName},\n\n${CONFIG.businessName} otomatik randevu sistemine hoş geldiniz.\n\n📅 Randevu almak için "randevu" yazınız\n🔍 Randevunuzu sorgulamak için "randevum ne zaman"\n💰 Fiyatlar için "fiyatlar"\n📍 Adres için "adres"\n🕐 Çalışma saatleri için "saat kaça kadar"`);
            }
            break;

        case 'SELECT_DATE':
            const parsedDate = parseTurkishDate(text);
            const parsedTime = parseTime(text);

            if (!parsedDate) {
                await msg.reply(`Sayın ${customerName},\n\nGirdiğiniz tarih anlaşılamamıştır.\n\nÖrnekler: Bugün, Yarın, 25 Aralık, 25.12.2024`);
                return;
            }

            const slots = await AppointmentService.getAvailableSlots(parsedDate);

            if (parsedTime && slots.includes(parsedTime)) {
                userState.tempData = { date: parsedDate, hour: parsedTime };
                userState.state = 'SELECT_SERVICE';
                await userState.save();

                let serviceList = `Sayın ${customerName},\n\n${parsedDate} saat ${parsedTime} için randevu oluşturuyoruz.\n\nLütfen hizmet seçiniz:\n`;
                CONFIG.services.forEach((s, i) => {
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
            await msg.reply(`Sayın ${customerName},\n\n${parsedDate} için müsait saatler:\n\n${slotList}\n\nLütfen saat yazınız.`);
            break;

        case 'SELECT_HOUR':
            const selectedHour = parseTime(text);

            if (!selectedHour) {
                await msg.reply(`Sayın ${customerName},\n\nSaat anlaşılamamıştır. Örnek: 14:00 veya 14`);
                return;
            }

            userState.tempData.hour = selectedHour;
            userState.state = 'SELECT_SERVICE';
            await userState.save();

            let serviceList = `Sayın ${customerName},\n\n${userState.tempData.date} saat ${selectedHour} için hizmet seçiniz:\n`;
            CONFIG.services.forEach((s, i) => {
                serviceList += `\n${i + 1}. ${s.name} - ${s.price}₺`;
            });
            await msg.reply(serviceList);
            break;

        case 'SELECT_SERVICE':
            const service = parseService(text);

            if (!service) {
                await msg.reply(`Sayın ${customerName},\n\nHizmet anlaşılamamıştır.\n\n1. Saç Kesimi\n2. Sakal\n3. Saç + Sakal\n\nNumara veya isim yazınız.`);
                return;
            }

            try {
                await AppointmentService.createAppointment({
                    customerName: customerName,
                    phone: phone,
                    date: userState.tempData.date,
                    hour: userState.tempData.hour,
                    service: service.id,
                    createdFrom: 'whatsapp'
                });

                await msg.reply(`Sayın ${customerName},\n\nRandevunuz oluşturulmuştur.\n\n📅 Tarih: ${userState.tempData.date}\n⏰ Saat: ${userState.tempData.hour}\n💇 Hizmet: ${service.name}\n💰 Ücret: ${service.price}₺\n\n📍 Adres: ${CONFIG.location.address}\n\nSizi bekliyoruz. İyi günler dileriz.`);

                userState.state = 'IDLE';
                userState.tempData = {};
                await userState.save();

            } catch (error) {
                if (error.message.includes('dolu')) {
                    await msg.reply(`Sayın ${customerName},\n\nÜzgünüz, seçtiğiniz saat dolu hale gelmiştir.\n\nLütfen farklı bir saat seçiniz.`);
                    userState.state = 'SELECT_DATE';
                    await userState.save();
                } else {
                    await msg.reply(`Sayın ${customerName},\n\nBir hata oluştu. Lütfen tekrar deneyiniz.`);
                    userState.state = 'IDLE';
                    await userState.save();
                }
            }
            break;

        default:
            userState.state = 'IDLE';
            await userState.save();
            break;
    }
};

const initialize = () => {
    client.initialize();
};

// Export config for use in other modules
module.exports = { initialize, getQR, CONFIG };

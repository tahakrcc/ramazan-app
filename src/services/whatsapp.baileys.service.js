const { makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const useMongoDBAuthState = require('../utils/mongoAuthState');
const logger = require('../config/logger');
const Admin = require('../models/admin.model');
const Service = require('../models/service.model');
const Settings = require('../models/settings.model');
const Appointment = require('../models/appointment.model');
const ClosedDate = require('../models/closedDate.model');
const BotState = require('../models/botState.model');
const Feedback = require('../models/feedback.model');
const appointmentService = require('./appointment.service');
const { format, addDays } = require('date-fns');
// date-fns v3+ uses named exports from locale package
let trLocale;
try {
    // Try v3+ syntax first
    const locales = require('date-fns/locale');
    trLocale = locales.tr;
} catch (e) {
    // Fallback for older versions
    try {
        trLocale = require('date-fns/locale/tr');
    } catch (e2) {
        console.warn('Turkish locale not available, using default');
        trLocale = undefined;
    }
}

const CONFIG = {
    businessName: 'By Ramazan',
    location: {
        address: 'Movenpick Hotel -1 Kat - Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    },
    website: 'https://ramazan-app.onrender.com',
    phone: '905306978233'
};

let sock = null;
let status = 'INITIALIZING';
let qrCode = null;
let pairingCode = null;

// --- Helpers ---
const getActiveBarbers = async () => {
    try {
        return await Admin.find({ isActive: true }).select('name role');
    } catch (e) { return []; }
};

const getActiveServices = async () => {
    try {
        return await Service.find({ isActive: true });
    } catch (e) { return []; }
};

const getSettings = async () => {
    try {
        return await Settings.getSettings();
    } catch (e) {
        return { bookingRangeDays: 14, appointmentStartHour: 10, appointmentEndHour: 20 };
    }
};

// --- FUZZY MATCHING: Command aliases for flexible input ---
const COMMAND_ALIASES = {
    // Greetings
    'mrb': 'merhaba', 'mrhb': 'merhaba', 'meraba': 'merhaba', 'merhba': 'merhaba',
    'slm': 'selam', 'selamm': 'selam', 'selm': 'selam',

    // Appointment
    'rndv': 'randevu', 'randevuu': 'randevu', 'rndvu': 'randevu', 'randvu': 'randevu',
    'rndvm': 'randevum', 'randevumm': 'randevum',

    // Navigation
    'gri': 'geri', 'gerı': 'geri', 'ger': 'geri',
    'ipt': 'iptal', 'ıptal': 'iptal', 'iptalım': 'iptal', 'iptl': 'iptal',
    'vazgec': 'vazgeç', 'vazgc': 'vazgeç',

    // Confirmation
    'evt': 'evet', 'evett': 'evet', 'evvet': 'evet', 'eet': 'evet',
    'hyr': 'hayır', 'hayir': 'hayır', 'hayr': 'hayır',
    'onyla': 'onay', 'onayla': 'onay', 'ony': 'onay',
    'tmm': 'tamam', 'tmam': 'tamam', 'tamamm': 'tamam',

    // Info
    'knm': 'konum', 'konumm': 'konum', 'konm': 'konum',
    'adrs': 'adres', 'adress': 'adres',
    'blg': 'bilgi', 'bilgı': 'bilgi', 'blgi': 'bilgi',

    // Complaint
    'skyt': 'şikayet', 'sikayet': 'şikayet', 'şkayet': 'şikayet', 'şikyet': 'şikayet',
    'onr': 'öneri', 'onerı': 'öneri', 'oneri': 'öneri',

    // Days
    'bugn': 'bugün', 'bugun': 'bugün', 'bgn': 'bugün',
    'yrn': 'yarın', 'yarin': 'yarın', 'yarn': 'yarın'
};

// Normalize text: apply aliases and fix common typos
const normalizeText = (text) => {
    let normalized = text.toLocaleLowerCase('tr-TR').trim();

    // Check if the whole word is an alias
    if (COMMAND_ALIASES[normalized]) {
        return COMMAND_ALIASES[normalized];
    }

    // Check each word in the text
    const words = normalized.split(/\s+/);
    const normalizedWords = words.map(word => COMMAND_ALIASES[word] || word);

    return normalizedWords.join(' ');
};

// Send notification to admin
const notifyAdmin = async (message) => {
    try {
        const adminJid = `${CONFIG.phone}@s.whatsapp.net`;
        if (sock) {
            await sock.sendMessage(adminJid, { text: message });
            logger.info(`Admin notification sent: ${message.substring(0, 50)}...`);
        }
    } catch (e) {
        logger.error('Failed to notify admin:', e);
    }
};

const parseDateInput = (input) => {
    const lower = input.toLocaleLowerCase('tr-TR');
    const today = new Date();
    if (lower.includes('bugün')) return format(today, 'yyyy-MM-dd');
    if (lower.includes('yarın')) return format(addDays(today, 1), 'yyyy-MM-dd');
    return null;
};

// --- Main Initialization ---
const initialize = async () => {
    try {
        logger.info('Initializing WhatsApp Service...');

        const { state, saveCreds } = await useMongoDBAuthState();

        sock = makeWASocket({
            printQRInTerminal: false,
            auth: state,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            console.log(`[WA] Connection Update: ${connection || 'connecting'} | QR: ${!!qr} | Registered: ${!!state.creds?.registered}`);

            // QR CODE LOGIC (Reverted directly to QR)
            if (qr) {
                console.log('[WA] QR received. Status: QR_READY');
                qrCode = qr;
                pairingCode = null;
                status = 'QR_READY';
                logger.info('WhatsApp QR Code generated');
            }

            if (connection === 'close') {
                const error = lastDisconnect?.error;
                const statusCode = error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                logger.error(`Connection Closed. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    logger.warn('Logged out. Clearing session...');
                    try {
                        const mongoose = require('mongoose');
                        await mongoose.connection.db.collection('authstates').deleteMany({});
                        logger.info('Session cleared. Restarting service to generate new code...');
                        // Re-initialize after clearing to prompt for new code immediately
                        setTimeout(initialize, 1000);
                        return; // Exit this handler to prevent double init
                    } catch (e) { logger.error('Clear session error', e); }
                    pairingCode = null;
                    qrCode = null;
                }

                if (shouldReconnect) {
                    status = 'INITIALIZING';
                    // Reconnect logic
                    const delay = statusCode === 428 ? 5000 : 2000; // Longer delay for "Precondition Required"
                    setTimeout(initialize, delay);
                } else {
                    status = 'DISCONNECTED';
                }
            } else if (connection === 'open') {
                status = 'CONNECTED';
                qrCode = null;
                pairingCode = null;
                logger.info('WhatsApp Connected Successfully');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            // if (type !== 'notify') return; // Commented out to be safer
            console.log(`[WA] New message received. Type: ${type}`);
            for (const msg of messages) {
                if (!msg.key.fromMe) await handleMessage(msg);
            }
        });

    } catch (error) {
        logger.error('WhatsApp Initialization Error:', error);
        setTimeout(initialize, 5000); // Retry on fatal error
    }
};

// --- Message Handling (Simplified for brevity, keep existing flow if possible) ---
// Note: I will paste the original handleMessage here but simplified/cleaned if needed.
// For now, I'll keep the structure but ensure 'randevu' flow logs are present.

const handleMessage = async (msg) => {
    try {
        const remoteJid = msg.key.remoteJid;
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();

        if (!text) return;

        // Log incoming message for debugging
        logger.info(`Message from ${remoteJid}: ${text}`);

        if (text.toLowerCase() === 'ping') {
            await sock.sendMessage(remoteJid, { text: 'Pong!' });
        }

        // ... (Rest of logical flow would be here, assuming minimal changes needed for connection fix)
        // I will omit the full logic here to keep the file overwrite focused on CONNECTION logic.
        // BUT wait, I need to preserve the booking logic!
        // I will copy the existing booking logic manually below.

        await processBotLogic(remoteJid, text, msg);

    } catch (err) {
        logger.error('Message Handle Error:', err);
    }
};

// --- User Session Tracking for Booking Flow ---
const userSessions = {}; // { remoteJid: { step, barberId, barberName, date, hour, customerName, lastUpdated } }

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const getSession = (jid) => {
    const session = userSessions[jid];
    if (!session) return { step: 'IDLE' };

    // Check timeout
    if (Date.now() - session.lastUpdated > SESSION_TIMEOUT) {
        delete userSessions[jid];
        return { step: 'IDLE' };
    }
    return session;
};

const setSession = (jid, data) => {
    userSessions[jid] = {
        ...getSession(jid),
        ...data,
        lastUpdated: Date.now()
    };
};

const clearSession = (jid) => { delete userSessions[jid]; };

// --- Bot Logic with Booking Flow ---
const processBotLogic = async (remoteJid, text, msg) => {
    // Apply fuzzy matching normalization for flexible input recognition
    const lowerText = normalizeText(text);
    const phone = remoteJid.split('@')[0];

    // PRIORITY 0: Check if user is in AWAITING_FEEDBACK state (from BotState collection)
    try {
        const botState = await BotState.findOne({ phone });
        if (botState && botState.state === 'AWAITING_FEEDBACK') {
            // Parse feedback: "5 Harika kesimdi" or just "5"
            const feedbackMatch = text.trim().match(/^([1-5])\s*(.*)/s);

            if (feedbackMatch) {
                const rating = parseInt(feedbackMatch[1]);
                const comment = feedbackMatch[2]?.trim() || 'Puan verildi.';

                // Get last appointment for customer info
                const lastAppt = await Appointment.findOne({
                    phone: { $regex: phone.slice(-10) }
                }).sort({ date: -1, hour: -1 });

                // Save feedback
                await Feedback.create({
                    customerName: lastAppt?.customerName || 'Müşteri',
                    phone: phone,
                    rating: rating,
                    comment: comment,
                    barberId: lastAppt?.barberId,
                    barberName: lastAppt?.barberName,
                    source: 'whatsapp'
                });

                // Reset BotState
                await BotState.findOneAndUpdate({ phone }, { state: 'IDLE', context: {} });

                // Send thank you message with stars
                const stars = '⭐'.repeat(rating);
                await sock.sendMessage(remoteJid, {
                    text: `Teşekkürler! ${stars}\n\nYorumunuz kaydedildi. Bizi tercih ettiğiniz için teşekkür ederiz! 💈`
                });

                logger.info(`Feedback received from ${phone}: ${rating} stars`);
            } else {
                // Invalid format
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ Lütfen puanınızı 1-5 arası bir sayı ile başlatın.\n\nÖrnek: *5 Harika kesim!*\n\nVeya sadece puan: *4*`
                });
            }
            return; // Stop processing, feedback handled
        }
    } catch (err) {
        logger.error('BotState check error:', err);
        // Continue with normal flow if error
    }


    // PRIORITY 1: GLOBAL RESET COMMANDS (Run before session checks)
    const session = getSession(remoteJid);
    const globalKeywords = ['merhaba', 'selam', 'hi', 'başla', 'menu', 'menü', 'randevu', 'randevum', 'konum', 'bilgi', 'şikayet', 'sikayet', 'öneri'];

    // Check if user is trying to run a global command while in an active session
    if (session.step !== 'IDLE' && globalKeywords.some(w => lowerText.includes(w))) {
        // Allow cancellation or back
        if (lowerText === 'iptal' || lowerText === 'vazgeç' || lowerText === 'geri' || lowerText === 'önceki') {
            // Pass through to specific handlers below
        } else {
            // Block interruption
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Şu an devam eden bir randevu işleminiz var.\n\nİşlemi tamamlamak için lütfen istenen bilgiyi girin.\n❌ İptal etmek için *iptal* yazın.`
            });
            return;
        }
    }

    // Normal global command handling (ONLY if IDLE)
    if (session.step === 'IDLE' && globalKeywords.some(w => lowerText === w || lowerText.startsWith(w + ' '))) {
        clearSession(remoteJid);
    }

    // Cancel command - reset flow anytime
    if (lowerText === 'iptal' || lowerText === 'vazgeç') {
        clearSession(remoteJid);
        await sock.sendMessage(remoteJid, { text: '❌ İşlem iptal edildi. Yeni bir işlem için "Randevu" yazabilirsiniz.' });
        return;
    }

    // Back command - go to previous step
    if (lowerText === 'geri' || lowerText === 'önceki') {
        const stepOrder = ['IDLE', 'AWAITING_BARBER', 'AWAITING_DATE', 'AWAITING_HOUR', 'AWAITING_NAME', 'CONFIRMING'];
        const currentIndex = stepOrder.indexOf(session.step);

        if (currentIndex <= 1) {
            // Already at start or AWAITING_BARBER, restart
            clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '⬅️ Başa döndünüz. Yeni işlem için "Randevu" yazabilirsiniz.' });
            return;
        }

        const prevStep = stepOrder[currentIndex - 1];
        setSession(remoteJid, { step: prevStep });

        // Show appropriate message for previous step
        if (prevStep === 'AWAITING_BARBER') {
            // Restore barbers from session or fetch fresh and store
            let barbers = session.tempBarbers;
            if (!barbers || barbers.length === 0) {
                barbers = await getActiveBarbers();
                // We must update session with this new list so index matches when user selects
                setSession(remoteJid, { tempBarbers: barbers.map(b => ({ _id: b._id.toString(), name: b.name })) });
            }

            await sock.sendMessage(remoteJid, {
                text: `⬅️ Berber seçimine döndünüz.\n\n*Aktif Berberlerimiz:*\n${barbers.map((b, i) => `${i + 1}️⃣ ${b.name === 'Admin' ? 'Ramazan' : b.name}`).join('\n')}\n\n👆 Lütfen berberin numarasını veya ismini yazın.`
            });
        } else if (prevStep === 'AWAITING_DATE') {
            const today = format(new Date(), 'yyyy-MM-dd');
            const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
            await sock.sendMessage(remoteJid, {
                text: `⬅️ Tarih seçimine döndünüz.\n\n📅 Hangi gün?\n\n1️⃣ Bugün (${today})\n2️⃣ Yarın (${tomorrow})\n\nYazınız: *Bugün*, *Yarın* veya tarih`
            });
        } else if (prevStep === 'AWAITING_HOUR') {
            // Fetch real available slots from DB
            let availableHours = [];
            try {
                availableHours = await appointmentService.getAvailableSlots(session.date, session.barberId);
            } catch (err) {
                logger.error('Error fetching slots on back:', err);
            }

            if (availableHours.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `⬅️ Saat seçimine döndünüz ama bu tarihte boş saat kalmamış.\n\nLütfen başka bir tarih seçiniz ("geri" yazarak).`
                });
            } else {
                await sock.sendMessage(remoteJid, {
                    text: `⬅️ Saat seçimine döndünüz.\n\n⏰ *Müsait Saatler:*\n${availableHours.join(', ')}\n\nÖrnek: *14* veya *14:00*`
                });
            }
        } else if (prevStep === 'AWAITING_NAME') {
            await sock.sendMessage(remoteJid, {
                text: `⬅️ İsim girişine döndünüz.\n\n👤 Lütfen *adınızı ve soyadınızı* yazın:`
            });
        }
        return;
    }

    // --- BOOKING FLOW STATES ---

    // Step: Waiting for Barber Selection
    if (session.step === 'AWAITING_BARBER') {
        // Use stored barbers from session if available (to match index), otherwise fetch fresh
        const barbers = session.tempBarbers || await getActiveBarbers();

        let matchedBarber = null;
        // Handle "1.", "1)" inputs
        const cleanNumber = lowerText.replace(/[^0-9]/g, '');
        const selectionIndex = parseInt(cleanNumber) - 1;

        if (cleanNumber && !isNaN(selectionIndex) && selectionIndex >= 0 && selectionIndex < barbers.length) {
            matchedBarber = barbers[selectionIndex];
        } else {
            // Text search
            matchedBarber = barbers.find(b => {
                const dbName = b.name.toLocaleLowerCase('tr-TR');
                // Special alias for Ramazan = Admin
                if (dbName === 'admin' && (lowerText === 'ramazan' || lowerText.includes('ramazan'))) return true;
                return dbName === lowerText || lowerText.includes(dbName);
            });
        }

        if (matchedBarber) {
            try {
                // Ensure _id is a string
                const barberId = matchedBarber._id ? String(matchedBarber._id) : null;

                if (!barberId) {
                    logger.error('Barber ID is missing:', matchedBarber);
                    await sock.sendMessage(remoteJid, { text: '⚠️ Bir hata oluştu. Lütfen tekrar deneyin.' });
                    return;
                }

                setSession(remoteJid, {
                    step: 'AWAITING_DATE',
                    barberId: barberId,
                    barberName: matchedBarber.name
                });

                // Get booking range from settings
                const settings = await getSettings();
                const maxDays = settings.bookingRangeDays || 14;

                // Build date options
                let dateOptions = [];
                for (let i = 0; i < Math.min(maxDays, 7); i++) {
                    const d = addDays(new Date(), i);
                    const dateStr = format(d, 'yyyy-MM-dd');
                    // Safely handle locale - if undefined, just show date without day name
                    let dayName;
                    if (i === 0) {
                        dayName = 'Bugün';
                    } else if (i === 1) {
                        dayName = 'Yarın';
                    } else {
                        try {
                            dayName = trLocale
                                ? format(d, 'dd/MM (EEEE)', { locale: trLocale })
                                : format(d, 'dd/MM (EEE)');
                        } catch (localeErr) {
                            dayName = format(d, 'dd/MM');
                        }
                    }
                    dateOptions.push(`${i + 1}️⃣ ${dayName} (${dateStr})`);
                }

                const displayBarberName = matchedBarber.name === 'Admin' ? 'Ramazan' : matchedBarber.name;
                await sock.sendMessage(remoteJid, {
                    text: `✅ *${displayBarberName}* seçildi.\n\n📅 *Lütfen Bir Tarih Seçiniz:*\n\n${dateOptions.join('\n')}\n\n👆 Numara veya tarih yazabilirsiniz.\n\n⬅️ Geri için "geri" yazın.`
                });

                logger.info(`Barber selected: ${displayBarberName} (${barberId}) for ${remoteJid}`);
            } catch (err) {
                logger.error('Error in barber selection:', err);
                await sock.sendMessage(remoteJid, { text: '⚠️ Bir hata oluştu. Lütfen tekrar deneyin veya "iptal" yazın.' });
            }
        } else {
            // Need fresh barbers list for display if not in session, but we defined const barbers above
            await sock.sendMessage(remoteJid, {
                text: `⚠️ "${text}" geçerli bir seçim değil.\n\nLütfen listeden bir berber seçin (Numara veya İsim):\n${barbers.map((b, i) => `${i + 1}️⃣ ${b.name === 'Admin' ? 'Ramazan' : b.name}`).join('\n')}\n\n(İptal için "iptal" yazın)`
            });
        }
        return;
    }

    // Step: Waiting for Date Selection
    if (session.step === 'AWAITING_DATE') {
        let selectedDate = null;
        const settings = await getSettings();
        const maxDays = settings.bookingRangeDays || 7;
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const maxDateStr = format(addDays(today, maxDays - 1), 'yyyy-MM-dd');

        // Check if input is a number (1-maxDays)
        const numInput = parseInt(lowerText);
        if (!isNaN(numInput) && numInput >= 1 && numInput <= maxDays) {
            selectedDate = format(addDays(today, numInput - 1), 'yyyy-MM-dd');
        } else if (lowerText.includes('bugün')) {
            selectedDate = todayStr;
        } else if (lowerText.includes('yarın')) {
            selectedDate = format(addDays(today, 1), 'yyyy-MM-dd');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
            const inputDate = text.trim();

            // FIRST: Validate that it's a real date (not 2026-01-80)
            const [year, month, day] = inputDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const isValidDate = dateObj.getFullYear() === year &&
                dateObj.getMonth() === month - 1 &&
                dateObj.getDate() === day;

            if (!isValidDate) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ *${inputDate}* geçerli bir tarih değil.\n\nLütfen geçerli bir tarih giriniz.\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            // Validate: not in the past
            if (inputDate < todayStr) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ Geçmiş bir tarih seçemezsiniz.\n\nLütfen bugün veya ileri bir tarih seçiniz.\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            // Validate: not too far in the future
            if (inputDate > maxDateStr) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ En fazla ${maxDays} gün sonrasına randevu alabilirsiniz.\n\nMaximum tarih: ${maxDateStr}\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            selectedDate = inputDate;
        }

        if (selectedDate) {
            // Check if this date is closed
            const isClosed = await ClosedDate.findOne({ date: selectedDate });
            if (isClosed) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ *${selectedDate}* tarihi tatil/kapalı günü olarak belirlenmiştir.\n\nLütfen başka bir tarih seçiniz.\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            setSession(remoteJid, { step: 'AWAITING_HOUR', date: selectedDate });

            // Fetch REAL availability from database
            let availableHours = [];
            try {
                availableHours = await appointmentService.getAvailableSlots(selectedDate, getSession(remoteJid).barberId);
            } catch (err) {
                logger.error('Error fetching slots:', err);
                availableHours = [];
            }

            if (availableHours.length === 0) {
                // Reset step back to AWAITING_DATE so user can pick another date
                setSession(remoteJid, { step: 'AWAITING_DATE' });
                await sock.sendMessage(remoteJid, {
                    text: `📅 *${selectedDate}* tarihinde maalesef boş randevu saati kalmamıştır.\n\nLütfen başka bir tarih seçiniz.\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            await sock.sendMessage(remoteJid, {
                text: `📅 *${selectedDate}* tarihi seçildi.\n\n⏰ *Müsait Saatler:*\n${availableHours.join(', ')}\n\nLütfen bir saat yazın (Örn: 14 veya 14:00)\n\n⬅️ Geri için "geri" yazın.`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Geçersiz tarih formatı.\n\nLütfen şu şekilde yazın:\n- *Bugün*\n- *Yarın*\n- veya *YYYY-AA-GG* formatında\n\n⬅️ Geri için "geri" yazın.`
            });
        }
        return;
    }

    // Step: Waiting for Hour Selection
    if (session.step === 'AWAITING_HOUR') {
        let hour = null;

        // 1. Try HH:MM format
        const matchColon = text.match(/^(\d{1,2})[:\.](\d{2})$/);
        // 2. Try single number (HH) format (e.g. "10", "14")
        const matchSingle = text.match(/^(\d{1,2})$/);

        if (matchColon) {
            hour = `${matchColon[1].padStart(2, '0')}:${matchColon[2]}`;
        } else if (matchSingle) {
            hour = `${matchSingle[1].padStart(2, '0')}:00`;
        }

        if (hour) {
            // Validate availability one last time
            const slots = await appointmentService.getAvailableSlots(session.date, session.barberId);
            if (!slots.includes(hour)) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ *${hour}* saati maalesef doludur veya seçilemez.\n\nLütfen listedeki boş saatlerden birini seçiniz:\n${slots.join(', ')}\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            setSession(remoteJid, { step: 'AWAITING_NAME', hour });

            await sock.sendMessage(remoteJid, {
                text: `⏰ *${hour}* saati seçildi.\n\n👤 Lütfen *adınızı ve soyadınızı* yazın:\n\n⬅️ Geri için "geri" yazın.`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Geçersiz saat formatı.\n\nLütfen saati şu şekillerde yazabilirsiniz:\n- *14:00*\n- *14*\n\n⬅️ Geri için "geri" yazın.`
            });
        }
        return;
    }

    // Step: Waiting for Customer Name
    if (session.step === 'AWAITING_NAME') {
        if (text.length >= 2) {
            setSession(remoteJid, { step: 'CONFIRMING', customerName: text });
            const s = getSession(remoteJid);

            const displayName = s.barberName === 'Admin' ? 'Ramazan' : s.barberName;
            await sock.sendMessage(remoteJid, {
                text: `📋 *Randevu Özeti:*\n\n👤 Ad: ${s.customerName}\n✂️ Berber: ${displayName}\n📅 Tarih: ${s.date}\n⏰ Saat: ${s.hour}\n\n✅ Onaylamak için *EVET* yazın.\n❌ İptal için *İPTAL* yazın.`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Lütfen geçerli bir isim girin.\n\n⬅️ Geri için "geri" yazın.`
            });
        }
        return;
    }

    // Step: Confirmation
    if (session.step === 'CONFIRMING') {
        if (lowerText === 'evet' || lowerText === 'onay' || lowerText === 'tamam') {
            const s = getSession(remoteJid);

            try {
                // Extract phone from remoteJid (e.g., "905551234567@s.whatsapp.net" -> "905551234567")
                const phone = remoteJid.split('@')[0];

                // Create appointment via service
                await appointmentService.createAppointment({
                    customerName: s.customerName,
                    phone: phone,
                    date: s.date,
                    hour: s.hour,
                    barberId: s.barberId,
                    barberName: s.barberName,
                    service: 'WhatsApp Randevusu',
                    createdFrom: 'whatsapp'
                });

                const displayName = s.barberName === 'Admin' ? 'Ramazan' : s.barberName;
                await sock.sendMessage(remoteJid, {
                    text: `🎉 *Randevunuz başarıyla oluşturuldu!*\n\n👤 ${s.customerName}\n✂️ ${displayName}\n📅 ${s.date} - ${s.hour}\n\n📍 Adres: ${CONFIG.location.address}\n\nBizi tercih ettiğiniz için teşekkürler! 💈`
                });

                // Notify admin about new appointment
                await notifyAdmin(`🆕 *Yeni WhatsApp Randevusu!*\n\n👤 Müşteri: ${s.customerName}\n📱 Tel: ${phone}\n✂️ Berber: ${s.barberName}\n📅 Tarih: ${s.date}\n⏰ Saat: ${s.hour}`);

                clearSession(remoteJid);
            } catch (err) {
                logger.error('Appointment creation error:', err);
                await sock.sendMessage(remoteJid, {
                    text: `❌ Randevu oluşturulurken bir hata oluştu: ${err.message}\n\nLütfen tekrar deneyin veya bizi arayın.`
                });
                clearSession(remoteJid);
            }
        } else {
            await sock.sendMessage(remoteJid, {
                text: `Onaylamak için *EVET*, iptal için *İPTAL* yazın.`
            });
        }
        return;
    }

    // Step: Complaint/Feedback
    if (session.step === 'AWAITING_COMPLAINT') {
        // Send to admin
        await notifyAdmin(`📩 *Yeni Şikayet/Öneri*\n\nKimden: ${remoteJid.split('@')[0]}\nMesaj: ${text}`);

        await sock.sendMessage(remoteJid, {
            text: `✅ Mesajınız yetkililere iletilmiştir.\n\nGeri bildiriminiz için teşekkür ederiz. 🙏`
        });
        clearSession(remoteJid);
        return;
    }

    // Step: Cancel Confirmation
    if (session.step === 'AWAITING_CANCEL_CONFIRM') {
        if (lowerText === 'evet' || lowerText === 'onay') {
            try {
                await Appointment.findByIdAndUpdate(session.cancelAppointmentId, { status: 'cancelled' });
                await sock.sendMessage(remoteJid, {
                    text: `✅ Randevunuz başarıyla iptal edilmiştir.\n\n📅 Yeni randevu için "Randevu" yazabilirsiniz.`
                });

                // Notify admin
                await notifyAdmin(`❌ *Randevu İptal Edildi*\n\nID: ${session.cancelAppointmentId}\nTelefon: ${remoteJid.split('@')[0]}`);
            } catch (err) {
                logger.error('Cancel save error:', err);
                await sock.sendMessage(remoteJid, { text: '⚠️ İptal işlemi sırasında bir hata oluştu.' });
            }
            clearSession(remoteJid);
        } else if (lowerText === 'hayır' || lowerText === 'vazgeç') {
            await sock.sendMessage(remoteJid, { text: '👍 İptal işlemi vazgeçildi. Randevunuz geçerlidir.' });
            clearSession(remoteJid);
        } else {
            await sock.sendMessage(remoteJid, { text: '⚠️ Lütfen *EVET* veya *HAYIR* yazın.' });
        }
        return;
    }


    // --- MAIN MENU COMMANDS (when not in a flow) ---

    // Greeting Handler
    const greetings = ['merhaba', 'selam', 'hi', 'iyi günler', 'kolay gelsin', 'meraba'];
    if (greetings.some(g => lowerText.includes(g))) {
        clearSession(remoteJid);
        await sock.sendMessage(remoteJid, {
            text: `Merhaba! 👋 Hoş geldiniz.\n\nSize nasıl yardımcı olabilirim?\n\n📅 *Randevu almak için:* "Randevu" yazın\n📋 *Randevumu sorgula:* "Randevum" yazın\n📍 *Konum bilgisi için:* "Konum" yazın\n❓ *Bilgi için:* "Bilgi" yazın\n📣 *Şikayet/Öneri için:* "Şikayet" yazın`
        });
        return;
    }

    // --- MY APPOINTMENT QUERY ---
    if (lowerText === 'randevum' || lowerText.includes('randevum ne zaman') || lowerText.includes('randevularım')) {
        const phone = remoteJid.split('@')[0];
        const today = format(new Date(), 'yyyy-MM-dd');

        try {
            // Find future appointments for this phone
            const appointments = await Appointment.find({
                phone: phone,
                status: 'confirmed',
                date: { $gte: today }
            }).sort({ date: 1, hour: 1 });

            if (appointments.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `📋 *Randevu Sorgulaması*\n\nAktif randevunuz bulunmamaktadır.\n\n📅 Yeni randevu için "Randevu" yazın.`
                });
            } else {
                let msg = `📋 *Randevularınız:*\n\n`;
                appointments.forEach((apt, i) => {
                    const barberDisplay = apt.barberName === 'Admin' ? 'Ramazan' : apt.barberName;
                    msg += `${i + 1}️⃣ 📅 ${apt.date} ⏰ ${apt.hour}\n   ✂️ ${barberDisplay}\n\n`;
                });
                msg += `❌ İptal için "randevumu iptal et" yazın.`;
                await sock.sendMessage(remoteJid, { text: msg });
            }
        } catch (err) {
            logger.error('Appointment query error:', err);
            await sock.sendMessage(remoteJid, { text: '⚠️ Randevu sorgulanırken bir hata oluştu.' });
        }
        return;
    }

    // --- CANCEL MY APPOINTMENT ---
    if (lowerText.includes('randevumu iptal') || lowerText.includes('randevu iptal') || lowerText === 'iptalim') {
        const phone = remoteJid.split('@')[0];
        const today = format(new Date(), 'yyyy-MM-dd');

        try {
            // Find the next upcoming appointment
            const appointment = await Appointment.findOne({
                phone: phone,
                status: 'confirmed',
                date: { $gte: today }
            }).sort({ date: 1, hour: 1 });

            if (!appointment) {
                await sock.sendMessage(remoteJid, {
                    text: `📋 İptal edilecek aktif randevunuz bulunmamaktadır.`
                });
                return;
            }

            const barberDisplay = appointment.barberName === 'Admin' ? 'Ramazan' : appointment.barberName;

            // Set session for confirmation
            setSession(remoteJid, {
                step: 'AWAITING_CANCEL_CONFIRM',
                cancelAppointmentId: appointment._id.toString()
            });

            await sock.sendMessage(remoteJid, {
                text: `❓ *Randevu İptal Onayı*\n\n📅 ${appointment.date} ⏰ ${appointment.hour}\n✂️ ${barberDisplay}\n👤 ${appointment.customerName}\n\nBu randevuyu iptal etmek istediğinize emin misiniz?\n\n✅ *EVET* yazın onaylamak için\n❌ *HAYIR* yazın vazgeçmek için`
            });
        } catch (err) {
            logger.error('Cancel appointment error:', err);
            await sock.sendMessage(remoteJid, { text: '⚠️ Randevu iptal edilirken bir hata oluştu.' });
        }
        return;
    }

    // Appointment Start Handler
    if (lowerText.includes('randevu') && !lowerText.includes('randevum')) {
        const barbers = await getActiveBarbers();
        if (barbers.length === 0) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Şu an aktif berber bulunmamaktadır. Lütfen daha sonra tekrar deneyin.' });
            return;
        }

        // Store the exact list presented to the user to ensure index matches
        // IMPORTANT: Store _id as string to prevent ObjectId serialization issues
        setSession(remoteJid, {
            step: 'AWAITING_BARBER',
            tempBarbers: barbers.map(b => ({ _id: b._id.toString(), name: b.name }))
        });

        await sock.sendMessage(remoteJid, {
            text: `Randevu işlemlerine başlayalım. ✂️\n\n*Aktif Berberlerimiz:*\n${barbers.map((b, i) => `${i + 1}️⃣ ${b.name === 'Admin' ? 'Ramazan' : b.name}`).join('\n')}\n\n👆 Lütfen berberin numarasını yazın.\n\n⬅️ İptal için "iptal" yazın.`
        });
        return;
    }

    // Location Handler
    if (lowerText.includes('konum') || lowerText.includes('adres') || lowerText.includes('yer')) {
        await sock.sendMessage(remoteJid, {
            text: `📍 *Adresimiz:*\n${CONFIG.location.address}\n\n🗺️ *Harita Konumu:*\n${CONFIG.location.mapsLink}`
        });
        return;
    }

    // Info Handler
    if (lowerText.includes('bilgi') || lowerText.includes('hakkında') || lowerText.includes('info')) {
        const services = await getActiveServices();
        const barbers = await getActiveBarbers();
        let infoText = `ℹ️ *${CONFIG.businessName} Hakkında*\n\n`;
        infoText += `📍 *Adres:* ${CONFIG.location.address}\n`;
        infoText += `🌐 *Website:* ${CONFIG.website}\n`;
        infoText += `📞 *Telefon:* ${CONFIG.phone}\n\n`;
        if (barbers.length > 0) {
            infoText += `✂️ *Berberlerimiz:*\n${barbers.map(b => `• ${b.name === 'Admin' ? 'Ramazan' : b.name}`).join('\n')}\n\n`;
        }
        if (services.length > 0) {
            infoText += `💇 *Hizmetlerimiz:*\n${services.map(s => `• ${s.name} - ${s.price}₺`).join('\n')}`;
        }
        await sock.sendMessage(remoteJid, { text: infoText });
        return;
    }

    // Complaint Handler
    if (lowerText.includes('şikayet') || lowerText.includes('sikayet') || lowerText.includes('öneri')) {
        setSession(remoteJid, { step: 'AWAITING_COMPLAINT' });
        await sock.sendMessage(remoteJid, {
            text: `📣 *Şikayet ve Önerileriniz bizim için değerli.*\n\nLütfen mesajınızı tek bir parça halinde yazınız, yetkililere iletilecektir:`
        });
        return;
    }

    // Default Fallback (only for DMs, not groups)
    if (!msg.key.participant) {
        await sock.sendMessage(remoteJid, {
            text: `Anlayamadım. 🤖\n\nLütfen aşağıdaki komutlardan birini deneyin:\n• *Randevu* - Randevu almak için\n• *Konum* - Adres bilgisi için\n• *Şikayet* - Şikayet/Öneri iletmek için`
        });
    }
};



const requestPairing = async (phone) => {
    if (!sock) throw new Error('Socket not initialized');

    // Ensure phone format (basic cleaning)
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    console.log(`[WA] Requesting pairing code for: ${cleanPhone}`);

    try {
        const code = await sock.requestPairingCode(cleanPhone);
        pairingCode = code;
        qrCode = null;
        status = 'PAIRING_CODE_READY';
        console.log('--------------------------------------------------');
        console.log('✅ PAIRING CODE GENERATED:', code);
        logger.info(`WhatsApp Pairing Code: ${code}`);
        return code;
    } catch (error) {
        logger.error('Pairing request failed:', error);
        throw error;
    }
};

const getStatus = async () => {
    return { status, qr: qrCode, pairingCode };
};

const logout = async () => {
    try {
        if (sock) {
            await sock.logout();
        }
        const mongoose = require('mongoose');
        await mongoose.connection.db.collection('authstates').deleteMany({});
        pairingCode = null;
        qrCode = null;
        status = 'DISCONNECTED';
        // Auto restart?
        setTimeout(initialize, 3000);
        return true;
    } catch (error) {
        logger.error('Logout failed:', error);
        return false;
    }
};

// Public sendMessage function for external use (reminders, notifications, etc.)
const sendMessage = async (phone, message) => {
    if (!sock) throw new Error('WhatsApp not connected');

    // Ensure phone format
    const jid = phone.includes('@') ? phone : `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: message });
    logger.info(`Message sent to ${jid}`);
};

module.exports = { initialize, getStatus, logout, requestPairing, sendMessage };

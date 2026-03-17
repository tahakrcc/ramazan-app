const { makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const useMongoDBAuthState = require('../utils/mongoAuthState');
const logger = require('../config/logger');
const Admin = require('../models/admin.model');
const Service = require('../models/service.model');
const Settings = require('../models/settings.model');
const Appointment = require('../models/appointment.model');
const ClosedDate = require('../models/closedDate.model');
const BotState = require('../models/botState.model');
const Feedback = require('../models/feedback.model');
const Complaint = require('../models/complaint.model');
const appointmentService = require('./appointment.service');
const dateUtils = require('../utils/date');
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
    website: 'https://byramazan.com/',
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

// Convert number to emoji digits (e.g. 10 → 1️⃣0️⃣)
const numToEmoji = (num) => {
    const emojiDigits = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    return String(num).split('').map(d => emojiDigits[parseInt(d)] || d).join('');
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
    const today = dateUtils.getTurkeyNow();
    if (lower.includes('bugün')) return dateUtils.getTurkeyTodayString();
    if (lower.includes('yarın')) return format(addDays(today, 1), 'yyyy-MM-dd');
    return null;
};

// --- Main Initialization ---
const initialize = async (forceFresh = false) => {
    try {
        logger.info(`Initializing WhatsApp Service... (forceFresh: ${forceFresh})`);

        // We only forcefully clean the auth state if we are explicitly requested to (logout/405 recovery)
        if (forceFresh) {
            try {
                const mongoose = require('mongoose');
                if (mongoose.connection.readyState === 1) {
                    await mongoose.connection.db.collection('authstates').deleteMany({});
                    logger.info('Purged old auth states for a fresh start');
                    // Added a small delay to ensure DB operations settle before Baileys reads the authstate
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (e) {
                logger.error('Failed to purge auth states before init', e);
            }
        }

        const { state, saveCreds } = await useMongoDBAuthState();

        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            printQRInTerminal: false,
            auth: state,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            logger: require('pino')({ level: 'silent' }),
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
                        setTimeout(() => initialize(true), 1000);
                        return; // Exit this handler to prevent double init
                    } catch (e) { logger.error('Clear session error', e); }
                    pairingCode = null;
                    qrCode = null;
                }

                if (shouldReconnect) {
                    status = 'INITIALIZING';
                    // Reconnect logic
                    // If 405 error, we should probably clear the session as it might be corrupted
                    if (statusCode === 405) {
                        logger.warn('405 Error encountered. Session might be corrupted. Forcing fresh start...');
                        setTimeout(() => initialize(true), 10000);
                        return;
                    }

                    const delay = statusCode === 428 ? 10000 : 10000;
                    setTimeout(() => initialize(false), delay);
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
        setTimeout(() => initialize(false), 5000); // Retry on fatal error
    }
};

// --- Message Handling (Simplified for brevity, keep existing flow if possible) ---
// Note: I will paste the original handleMessage here but simplified/cleaned if needed.
// For now, I'll keep the structure but ensure 'randevu' flow logs are present.

// --- Per-user message queue to prevent race conditions ---
const userMessageQueues = {}; // { remoteJid: Promise }

const handleMessage = async (msg) => {
    try {
        const remoteJid = msg.key.remoteJid;
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();

        if (!text) return;

        // Queue messages per user: wait for previous message to finish before processing next
        const previousTask = userMessageQueues[remoteJid] || Promise.resolve();
        const currentTask = previousTask.then(async () => {
            try {
                logger.info(`Message from ${remoteJid}: ${text}`);

                if (text.toLowerCase() === 'ping') {
                    await sock.sendMessage(remoteJid, { text: 'Pong!' });
                }

                await processBotLogic(remoteJid, text, msg);
            } catch (err) {
                logger.error('Message Handle Error:', err);
            }
        });

        userMessageQueues[remoteJid] = currentTask;

        // Clean up queue reference after completion to prevent memory leak
        currentTask.finally(() => {
            if (userMessageQueues[remoteJid] === currentTask) {
                delete userMessageQueues[remoteJid];
            }
        });

    } catch (err) {
        logger.error('Message Queue Error:', err);
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

    // --- SMART PHONE EXTRACTION (Fix for LID/Wrong Numbers) ---
    // 1. Try to get phone from participant if available
    // 2. If it's still a long ID (LID/UUID), check if we have a saved mapping in BotState.
    // 3. If NO mapping, STOP and ask user for real phone.

    // FIX: Split by ':' to remove Device AD (Agent Device) ID. 
    // Example: 123456789:1@s.whatsapp.net -> 123456789
    let rawPhone = remoteJid.split('@')[0].split(':')[0];

    // Check if JID is a LID (Linked Identity)
    const isLid = remoteJid.includes('@lid');

    // STRICT LID HANDLING:
    // We strictly use the LID from the JID as the key for database lookup.
    // We do NOT attempt to extract phone from 'participant' anymore because it is unreliable 
    // and causes "key mismatch" (sometimes looking up LID, sometimes Phone) in the 'data.lids' array.


    let phone = rawPhone;

    // CHECK FOR LID OR LONG ID
    // Logic: If it is a LID (any length) OR it looks like a long ID (>12 digits)
    if (isLid || phone.length >= 13) {

        // Check if we already know this user's real phone
        // Search in both single 'lid' field and 'lids' array using REGEX to match "12345" against "12345:1"
        // This ensures backward compatibility with old records that have device ID suffix.
        const lidRegex = new RegExp(`^${phone}(:|$)`);

        const existingState = await BotState.findOne({
            $or: [
                { 'data.lid': { $regex: lidRegex } },
                { 'data.lids': { $regex: lidRegex } }
            ]
        });

        if (existingState && existingState.phone && existingState.phone.length < 13) {
            // Found a mapping! Use the real phone.
            phone = existingState.phone;
            logger.info(`LID Resolved via DB: ${rawPhone} -> ${phone}`);
        } else {
            // UNKNOWN LID - We need to ask the user.

            // First, check if they are ALREADY answering the phone query
            const session = getSession(remoteJid);
            if (session.step === 'AWAITING_PHONE_INPUT') {
                // Determine if input is a valid phone number
                let cleanInput = lowerText.replace(/\D/g, '');

                // NORMALIZE PHONE NUMBER to 90 format
                // 0532 123 45 67 (11 digits) -> 905321234567
                // 532 123 45 67 (10 digits) -> 905321234567
                // 90532 123 45 67 (12 digits) -> 905321234567

                if (cleanInput.length === 11 && cleanInput.startsWith('0')) {
                    cleanInput = '9' + cleanInput;
                } else if (cleanInput.length === 10) {
                    cleanInput = '90' + cleanInput;
                }

                // Validate (Should be around 12 digits now for TR numbers, but allow slight var)
                if (cleanInput.length >= 10 && cleanInput.length <= 15) {
                    // SAVE MAPPING (Supports multiple devices/LIDs for same phone)
                    await BotState.findOneAndUpdate(
                        { phone: cleanInput }, // Unique key is the REAL phone
                        {
                            $set: {
                                phone: cleanInput,
                                updatedAt: new Date()
                            },
                            $addToSet: { 'data.lids': rawPhone } // Add checking LID to valid list
                        },
                        { upsert: true, new: true }
                    );

                    await sock.sendMessage(remoteJid, { text: `✅ Numaranız kaydedildi: ${cleanInput}\n\nŞimdi işleminize devam edebilirsiniz. "Randevu" yazarak başlayabilirsiniz.` });
                    clearSession(remoteJid);
                    return; // Stop here, let them restart cleanly next msg
                } else {
                    await sock.sendMessage(remoteJid, { text: `⚠️ Lütfen geçerli bir telefon numarası giriniz (Örn: 05551234567).` });
                    return;
                }
            }

            // If not answering yet, prompt them
            setSession(remoteJid, { step: 'AWAITING_PHONE_INPUT' });
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Numaranız sistemde gizli görünüyor.\n\nİşlem yapabilmek için lütfen **telefon numaranızı** yazar mısınız?\n(Örn: 0532 123 45 67)`
            });
            return; // STOP FLOW HERE
        }
    }


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
    // FIXED: Skip check if we are waiting for a name (allow any name input)
    if (session.step !== 'IDLE' && session.step !== 'AWAITING_NAME' && globalKeywords.some(w => lowerText === w || lowerText.startsWith(w + ' '))) {
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
            // Rebuild full date list
            const settings = await getSettings();
            const maxDays = settings.bookingRangeDays || 14;
            const closedWeekDays = settings.closedWeekDays || [0];
            const closedDates = await ClosedDate.find().select('date').lean();
            const closedDateSet = new Set(closedDates.map(cd => cd.date));

            let dateOptions = [];
            let optionCounter = 0;
            const turkeyNow = dateUtils.getTurkeyNow();
            for (let i = 0; i < maxDays; i++) {
                const d = addDays(turkeyNow, i);
                const dayOfWeek = d.getDay();
                if (closedWeekDays.includes(dayOfWeek)) continue;
                const dateStr = format(d, 'yyyy-MM-dd');
                if (closedDateSet.has(dateStr)) continue;
                let dayName;
                if (i === 0) dayName = 'Bugün';
                else if (i === 1) dayName = 'Yarın';
                else {
                    try {
                        dayName = trLocale ? format(d, 'dd/MM (EEEE)', { locale: trLocale }) : format(d, 'dd/MM (EEE)');
                    } catch (e) { dayName = format(d, 'dd/MM'); }
                }
                optionCounter++;
                dateOptions.push({ number: optionCounter, label: `${numToEmoji(optionCounter)} ${dayName} (${dateStr})`, date: dateStr });
            }

            setSession(remoteJid, { step: prevStep, dateOptions });

            await sock.sendMessage(remoteJid, {
                text: `⬅️ Tarih seçimine döndünüz.\n\n📅 *Lütfen Bir Tarih Seçiniz:*\n\n${dateOptions.map(opt => opt.label).join('\n')}\n\n👆 Numara yazarak seçim yapabilirsiniz.`
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
                const closedWeekDays = settings.closedWeekDays || [0]; // Default: Sunday closed

                // Fetch specific closed dates from DB
                const closedDates = await ClosedDate.find().select('date').lean();
                const closedDateSet = new Set(closedDates.map(cd => cd.date));

                // Build date options (skip closed week days AND specific closed dates)
                let dateOptions = [];
                let optionCounter = 0;
                const turkeyNow = dateUtils.getTurkeyNow();
                for (let i = 0; i < maxDays; i++) {
                    const d = addDays(turkeyNow, i);
                    const dayOfWeek = d.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

                    // Skip if this day of week is closed
                    if (closedWeekDays.includes(dayOfWeek)) {
                        continue;
                    }

                    const dateStr = format(d, 'yyyy-MM-dd');

                    // Skip if this specific date is closed
                    if (closedDateSet.has(dateStr)) {
                        continue;
                    }

                    // Safely handle locale - if undefined, just show date without day name
                    let dayLabel;
                    if (i === 0) {
                        dayLabel = 'Bugün';
                    } else if (i === 1) {
                        dayLabel = 'Yarın';
                    } else {
                        try {
                            dayLabel = trLocale
                                ? format(d, 'd MMMM', { locale: trLocale })
                                : format(d, 'd MMM');
                        } catch (localeErr) {
                            dayLabel = format(d, 'dd/MM');
                        }
                    }
                    optionCounter++;
                    dateOptions.push({ number: optionCounter, label: `${optionCounter}- ${dayLabel}`, date: dateStr });
                }

                const displayBarberName = matchedBarber.name === 'Admin' ? 'Ramazan' : matchedBarber.name;

                // Store dateOptions in session for later use
                setSession(remoteJid, {
                    step: 'AWAITING_DATE',
                    barberId,
                    barberName: matchedBarber.name,
                    dateOptions: dateOptions
                });

                await sock.sendMessage(remoteJid, {
                    text: `✅ *${displayBarberName}* seçildi.\n\n📅 *Lütfen Bir Tarih Seçiniz:*\n\n${dateOptions.map(opt => opt.label).join('\n')}\n\n👆 Numara yazarak seçim yapabilirsiniz.\n\n⬅️ Geri için "geri" yazın.`
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
        const turkeyNow = dateUtils.getTurkeyNow();
        const todayStr = dateUtils.getTurkeyTodayString();
        const maxDateStr = format(addDays(turkeyNow, maxDays - 1), 'yyyy-MM-dd');

        const sessionDateOptions = session.dateOptions || [];

        // 1. Check ONLY for numerical index selection (e.g., "1", "2")
        if (!isNaN(parseInt(lowerText))) {
            const numInput = parseInt(lowerText);
            const matchedOption = sessionDateOptions.find(opt => opt.number === numInput);
            if (matchedOption) {
                selectedDate = matchedOption.date;
            }
        }
        // Manual date typing and keywords removed per user request

        if (selectedDate) {
            // Check if this date is closed
            const isClosed = await ClosedDate.findOne({ date: selectedDate });
            if (isClosed) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ *${selectedDate}* tarihi tatil/kapalı günü olarak belirlenmiştir.\n\nLütfen başka bir tarih seçiniz.\n\n⬅️ Geri için "geri" yazın.`
                });
                return;
            }

            // Check if day of week is closed (e.g., Sunday)
            const settings = await getSettings();
            const closedWeekDays = settings.closedWeekDays || [0];
            const selectedDateObj = new Date(selectedDate + 'T00:00:00');
            const dayOfWeek = selectedDateObj.getDay();

            if (closedWeekDays.includes(dayOfWeek)) {
                const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ *${dayNames[dayOfWeek]}* günleri açık değiliz.\n\nLütfen başka bir gün seçiniz.\n\n⬅️ Geri için "geri" yazın.`
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
            // Show the numbered list again on invalid input
            const sessionDateOpts = session.dateOptions || [];
            if (sessionDateOpts.length > 0) {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ Geçersiz seçim.\n\n📅 Lütfen aşağıdaki listeden numara yazarak seçim yapın:\n\n${sessionDateOpts.map(opt => opt.label).join('\n')}\n\n⬅️ Geri için "geri" yazın.`
                });
            } else {
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ Geçersiz seçim. Lütfen tekrar deneyin veya "geri" yazın.`
                });
            }
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
                // Use the confirmed phone number from session if available (though we didn't store it explicitly in session root, we have it in lookup)
                // Actually, relying on remoteJid here again is risky if it's a LID.
                // Better to strip from remoteJid again using the SAME logic or trust the flow.
                // Let's re-apply the cleanup logic to be safe, or just use `phone` from the top scope if it was available?
                // `processBotLogic` has `phone` variable at the top. But here we are inside the CONFIRMING block.
                // We should re-extract cleanly.

                // Use the resolved phone from the top of the function (which handles LID/BotState mapping)
                // Do NOT re-extract from remoteJid here, as it loses the mapping.
                // const phone is already available in scope.

                // Helper to format phone for display (e.g. +90 5XX ...)
                const formatPhoneDisplay = (p) => {
                    if (p.startsWith('90') && p.length === 12) {
                        return `+${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10)}`;
                    }
                    return p;
                };

                const formattedPhone = formatPhoneDisplay(phone);

                // Create appointment via service
                await appointmentService.createAppointment({
                    customerName: s.customerName,
                    phone: phone, // Store as raw digits (standard)
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
                await notifyAdmin(`🆕 *Yeni WhatsApp Randevusu!*\n\n👤 Müşteri: ${s.customerName}\n📱 Tel: ${formattedPhone}\n✂️ Berber: ${s.barberName}\n📅 Tarih: ${s.date}\n⏰ Saat: ${s.hour}`);

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
        const phone = remoteJid.split('@')[0];

        try {
            // Get last appointment for customer info
            const lastAppt = await Appointment.findOne({
                phone: { $regex: phone.slice(-10) }
            }).sort({ date: -1, hour: -1 });

            // Save complaint to database
            await Complaint.create({
                customerName: lastAppt?.customerName || 'WhatsApp Kullanıcısı',
                phone: phone,
                message: text,
                status: 'pending',
                source: 'whatsapp'
            });

            // Notify admin with phone number
            await notifyAdmin(`📩 *Yeni Şikayet/Öneri*\n\nTelefon: ${phone}\nİsim: ${lastAppt?.customerName || 'Bilinmiyor'}\nMesaj: ${text}`);

            await sock.sendMessage(remoteJid, {
                text: `✅ Mesajınız yetkililere iletilmiştir.\n\nGeri bildiriminiz için teşekkür ederiz. 🙏`
            });
            clearSession(remoteJid);
        } catch (err) {
            logger.error('Complaint save error:', err);
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Mesajınız iletilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.`
            });
            clearSession(remoteJid);
        }
        return;
    }

    // Step: Cancel Selection (Multiple Appointments)
    if (session.step === 'AWAITING_CANCEL_SELECTION') {
        const selectionIndex = parseInt(lowerText) - 1;
        const choices = session.tempAppointments || [];

        if (!isNaN(selectionIndex) && selectionIndex >= 0 && selectionIndex < choices.length) {
            const selectedAppt = choices[selectionIndex];
            const barberDisplay = selectedAppt.barberName === 'Admin' ? 'Ramazan' : selectedAppt.barberName;

            setSession(remoteJid, {
                step: 'AWAITING_CANCEL_CONFIRM',
                cancelAppointmentId: selectedAppt._id
            });

            await sock.sendMessage(remoteJid, {
                text: `❓ *Randevu İptal Onayı*\n\n📅 ${selectedAppt.date} ⏰ ${selectedAppt.hour}\n✂️ ${barberDisplay}\n\nBu randevuyu iptal etmek istediğinize emin misiniz?\n\n✅ *EVET* yazın onaylamak için\n❌ *HAYIR* yazın vazgeçmek için`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Geçersiz seçim. Lütfen listedeki numaralardan birini yazın (Örn: 1).\nVazgeçmek için "iptal" yazın.`
            });
        }
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
        } else if (lowerText === 'hayır' || lowerText === 'vazgeç' || lowerText === 'iptal') {
            await sock.sendMessage(remoteJid, { text: '👍 İptal işlemi vazgeçildi. Randevunuz korundu.' });
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
        // Use resolved 'phone' variable from top scope
        const today = dateUtils.getTurkeyTodayString();

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
        const today = dateUtils.getTurkeyTodayString();
        // Use the resolved 'phone' variable from the top scope

        try {
            // Find ALL future appointments for this phone
            const appointments = await Appointment.find({
                phone: phone,
                status: 'confirmed',
                date: { $gte: today }
            }).sort({ date: 1, hour: 1 });

            if (appointments.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `📋 İptal edilecek aktif randevunuz bulunmamaktadır.`
                });
                return;
            }

            // If only one appointment, proceed with single flow
            if (appointments.length === 1) {
                const appointment = appointments[0];
                const barberDisplay = appointment.barberName === 'Admin' ? 'Ramazan' : appointment.barberName;

                setSession(remoteJid, {
                    step: 'AWAITING_CANCEL_CONFIRM',
                    cancelAppointmentId: appointment._id.toString()
                });

                await sock.sendMessage(remoteJid, {
                    text: `❓ *Randevu İptal Onayı*\n\n📅 ${appointment.date} ⏰ ${appointment.hour}\n✂️ ${barberDisplay}\n👤 ${appointment.customerName}\n\nBu randevuyu iptal etmek istediğinize emin misiniz?\n\n✅ *EVET* yazın onaylamak için\n❌ *HAYIR* yazın vazgeçmek için`
                });
            } else {
                // Multiple appointments - Ask for selection
                setSession(remoteJid, {
                    step: 'AWAITING_CANCEL_SELECTION',
                    tempAppointments: appointments.map(a => ({
                        _id: a._id.toString(),
                        date: a.date,
                        hour: a.hour,
                        barberName: a.barberName
                    }))
                });

                let msg = `❓ *Hangi randevuyu iptal etmek istersiniz?*\n\n`;
                appointments.forEach((apt, i) => {
                    const barberDisplay = apt.barberName === 'Admin' ? 'Ramazan' : apt.barberName;
                    msg += `${i + 1}️⃣ ${apt.date} - ${apt.hour} (${barberDisplay})\n`;
                });
                msg += `\n👆 Lütfen numara yazın (Örn: 1)\n❌ İptal için "vazgeç" yazın.`;

                await sock.sendMessage(remoteJid, { text: msg });
            }

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
        setTimeout(() => initialize(true), 3000);
        return true;
    } catch (error) {
        logger.error('Logout failed:', error);
        return false;
    }
};

// Public sendMessage function for external use (reminders, notifications, etc.)
const sendMessage = async (phone, message) => {
    if (!sock) {
        logger.warn('Cannot send message: Socket not initialized');
        return false;
    }

    try {
        // Ensure proper JID format
        let jid = phone;
        if (!jid.includes('@')) {
            jid = `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        }

        await sock.sendMessage(jid, { text: message });
        return true;
    } catch (error) {
        logger.error(`Send Message Error (to ${phone}):`, error);
        return false;
    }
};

module.exports = {
    initialize,
    requestPairing,
    getStatus,
    logout,
    sendMessage,
    // Test helper
    getSock: () => sock
};

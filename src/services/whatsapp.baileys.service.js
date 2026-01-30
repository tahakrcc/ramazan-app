const { makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const useMongoDBAuthState = require('../utils/mongoAuthState');
const logger = require('../config/logger');
const Admin = require('../models/admin.model');
const Service = require('../models/service.model');
const Settings = require('../models/settings.model');
const appointmentService = require('./appointment.service');
const { format, addDays } = require('date-fns');

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
    // FIX: Use Turkish locale for correct case conversion (İ -> i, I -> ı)
    const lowerText = text.toLocaleLowerCase('tr-TR').trim();

    // PRIORITY 1: GLOBAL RESET COMMANDS (Run before session checks)
    const session = getSession(remoteJid);
    const globalKeywords = ['merhaba', 'selam', 'hi', 'başla', 'menu', 'menü', 'randevu', 'konum', 'bilgi'];

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
            const barbers = await getActiveBarbers();
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
            const availableHours = ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'];
            await sock.sendMessage(remoteJid, {
                text: `⬅️ Saat seçimine döndünüz.\n\n⏰ Hangi saat?\n\n${availableHours.join(', ')}\n\nÖrnek: *14:30*`
            });
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
        const barbers = await getActiveBarbers();

        let matchedBarber = null;
        const selectionIndex = parseInt(lowerText) - 1;

        if (!isNaN(selectionIndex) && selectionIndex >= 0 && selectionIndex < barbers.length) {
            matchedBarber = barbers[selectionIndex];
        } else {
            matchedBarber = barbers.find(b => {
                const nameToCheck = b.name === 'Admin' ? 'ramazan' : b.name.toLocaleLowerCase('tr-TR');
                return nameToCheck === lowerText;
            });
        }

        if (matchedBarber) {
            setSession(remoteJid, {
                step: 'AWAITING_DATE',
                barberId: matchedBarber._id.toString(),
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
                const dayName = i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : format(d, 'dd/MM (EEEE)', { locale: require('date-fns/locale/tr') });
                dateOptions.push(`${i + 1}️⃣ ${dayName} (${dateStr})`);
            }

            await sock.sendMessage(remoteJid, {
                text: `✅ *${matchedBarber.name}* seçildi.\n\n📅 *Lütfen Bir Tarih Seçiniz:*\n\n${dateOptions.join('\n')}\n\n👆 (Listeden numara veya tarih yazabilirsiniz)`
            });
        } else {
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
        const maxDays = Math.min(settings.bookingRangeDays || 14, 7);

        // Check if input is a number (1-7)
        const numInput = parseInt(lowerText);
        if (!isNaN(numInput) && numInput >= 1 && numInput <= maxDays) {
            selectedDate = format(addDays(new Date(), numInput - 1), 'yyyy-MM-dd');
        } else if (lowerText.includes('bugün')) {
            selectedDate = format(new Date(), 'yyyy-MM-dd');
        } else if (lowerText.includes('yarın')) {
            selectedDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
            selectedDate = text.trim();
        }

        if (selectedDate) {
            setSession(remoteJid, { step: 'AWAITING_HOUR', date: selectedDate });

            // Generate dynamic hours from settings
            const startHour = settings.appointmentStartHour || 9; // Default 9:00
            const endHour = settings.appointmentEndHour || 20;    // Default 20:00
            let availableHours = [];

            for (let h = startHour; h < endHour; h++) {
                availableHours.push(`${h.toString().padStart(2, '0')}:00`);
                availableHours.push(`${h.toString().padStart(2, '0')}:30`);
            }

            await sock.sendMessage(remoteJid, {
                text: `📅 *${selectedDate}* tarihi seçildi.\n\n⏰ Lütfen aşağıdaki saatlerden birini seçiniz:\n\n${availableHours.join(', ')}\n\n(Veya farklı bir saat yazabilirsiniz)`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Geçersiz tarih formatı.\n\nLütfen şu şekilde yazın:\n- *Bugün*\n- *Yarın*\n- veya *YYYY-AA-GG* formatında (örn: 2026-01-30)`
            });
        }
        return;
    }

    // Step: Waiting for Hour Selection
    if (session.step === 'AWAITING_HOUR') {
        const hourMatch = text.match(/(\d{1,2})[:\.](\d{2})/);
        if (hourMatch) {
            const hour = `${hourMatch[1].padStart(2, '0')}:${hourMatch[2]}`;
            setSession(remoteJid, { step: 'AWAITING_NAME', hour });

            await sock.sendMessage(remoteJid, {
                text: `⏰ *${hour}* saati seçildi.\n\n👤 Lütfen *adınızı ve soyadınızı* yazın:`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Geçersiz saat formatı.\n\nLütfen saat:dakika şeklinde yazın. Örnek: *14:30*`
            });
        }
        return;
    }

    // Step: Waiting for Customer Name
    if (session.step === 'AWAITING_NAME') {
        if (text.length >= 2) {
            setSession(remoteJid, { step: 'CONFIRMING', customerName: text });
            const s = getSession(remoteJid);

            await sock.sendMessage(remoteJid, {
                text: `📋 *Randevu Özeti:*\n\n👤 Ad: ${s.customerName}\n✂️ Berber: ${s.barberName}\n📅 Tarih: ${s.date}\n⏰ Saat: ${s.hour}\n\n✅ Onaylamak için *EVET* yazın.\n❌ İptal için *İPTAL* yazın.`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ Lütfen geçerli bir isim girin.`
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

                await sock.sendMessage(remoteJid, {
                    text: `🎉 *Randevunuz başarıyla oluşturuldu!*\n\n👤 ${s.customerName}\n✂️ ${s.barberName}\n📅 ${s.date} - ${s.hour}\n\n📍 Adres: ${CONFIG.location.address}\n\nBizi tercih ettiğiniz için teşekkürler! 💈`
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

    // --- MAIN MENU COMMANDS (when not in a flow) ---

    // Greeting Handler
    const greetings = ['merhaba', 'selam', 'hi', 'iyi günler', 'kolay gelsin', 'meraba'];
    if (greetings.some(g => lowerText.includes(g))) {
        clearSession(remoteJid);
        await sock.sendMessage(remoteJid, {
            text: `Merhaba! 👋 Hoş geldiniz.\n\nSize nasıl yardımcı olabilirim?\n\n📅 *Randevu almak için:* "Randevu" yazın\n📍 *Konum bilgisi için:* "Konum" yazın\n❓ *Bilgi için:* "Bilgi" yazın`
        });
        return;
    }

    // Appointment Start Handler
    if (lowerText.includes('randevu')) {
        const barbers = await getActiveBarbers();
        if (barbers.length === 0) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Şu an aktif berber bulunmamaktadır. Lütfen daha sonra tekrar deneyin.' });
            return;
        }

        setSession(remoteJid, { step: 'AWAITING_BARBER' });
        await sock.sendMessage(remoteJid, {
            text: `Randevu işlemlerine başlayalım. ✂️\n\n*Aktif Berberlerimiz:*\n${barbers.map((b, i) => `${i + 1}️⃣ ${b.name === 'Admin' ? 'Ramazan' : b.name}`).join('\n')}\n\n👆 Lütfen randevu almak istediğiniz *berberin numarasını* (1, 2...) yazın veya ismini yazın.`
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

    // Default Fallback (only for DMs, not groups)
    if (!msg.key.participant) {
        await sock.sendMessage(remoteJid, {
            text: `Anlayamadım. 🤖\n\nLütfen aşağıdaki komutlardan birini deneyin:\n• *Randevu* - Randevu almak için\n• *Konum* - Adres bilgisi için`
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

module.exports = { initialize, getStatus, logout, requestPairing };

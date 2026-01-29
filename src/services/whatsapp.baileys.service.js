const { makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const useMongoDBAuthState = require('../utils/mongoAuthState');
const logger = require('../config/logger');
const Admin = require('../models/admin.model');
const Service = require('../models/service.model');
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

const parseDateInput = (input) => {
    const lower = input.toLowerCase();
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
const userSessions = {}; // { remoteJid: { step, barberId, barberName, date, hour, customerName } }

const getSession = (jid) => userSessions[jid] || { step: 'IDLE' };
const setSession = (jid, data) => { userSessions[jid] = { ...getSession(jid), ...data }; };
const clearSession = (jid) => { delete userSessions[jid]; };

// --- Bot Logic with Booking Flow ---
const processBotLogic = async (remoteJid, text, msg) => {
    const lowerText = text.toLowerCase().trim();
    const session = getSession(remoteJid);

    // Cancel command - reset flow anytime
    if (lowerText === 'iptal' || lowerText === 'vazgeç') {
        clearSession(remoteJid);
        await sock.sendMessage(remoteJid, { text: '❌ İşlem iptal edildi. Yeni bir işlem için "Randevu" yazabilirsiniz.' });
        return;
    }

    // --- BOOKING FLOW STATES ---

    // Step: Waiting for Barber Selection
    if (session.step === 'AWAITING_BARBER') {
        const barbers = await getActiveBarbers();
        const matchedBarber = barbers.find(b => b.name.toLowerCase() === lowerText);

        if (matchedBarber) {
            setSession(remoteJid, {
                step: 'AWAITING_DATE',
                barberId: matchedBarber._id.toString(),
                barberName: matchedBarber.name
            });

            const today = format(new Date(), 'yyyy-MM-dd');
            const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
            const dayAfter = format(addDays(new Date(), 2), 'yyyy-MM-dd');

            await sock.sendMessage(remoteJid, {
                text: `✅ *${matchedBarber.name}* seçildi.\n\n📅 Hangi gün randevu almak istersiniz?\n\n1️⃣ Bugün (${today})\n2️⃣ Yarın (${tomorrow})\n3️⃣ ${dayAfter}\n\nYazınız: *Bugün*, *Yarın* veya tarih (örn: ${dayAfter})`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ "${text}" isimli bir berber bulunamadı.\n\nLütfen listeden bir berber seçin:\n${barbers.map(b => `- ${b.name}`).join('\n')}\n\n(İptal için "iptal" yazın)`
            });
        }
        return;
    }

    // Step: Waiting for Date Selection
    if (session.step === 'AWAITING_DATE') {
        let selectedDate = null;

        if (lowerText.includes('bugün') || lowerText === '1') {
            selectedDate = format(new Date(), 'yyyy-MM-dd');
        } else if (lowerText.includes('yarın') || lowerText === '2') {
            selectedDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        } else if (lowerText === '3') {
            selectedDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
            selectedDate = text.trim();
        }

        if (selectedDate) {
            setSession(remoteJid, { step: 'AWAITING_HOUR', date: selectedDate });

            // Get available hours (simple version - all hours)
            const availableHours = ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'];

            await sock.sendMessage(remoteJid, {
                text: `📅 *${selectedDate}* tarihi seçildi.\n\n⏰ Hangi saati tercih edersiniz?\n\n${availableHours.join(', ')}\n\nÖrnek: *14:30*`
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
            text: `Randevu işlemlerine başlayalım. ✂️\n\n*Aktif Berberlerimiz:*\n${barbers.map(b => `• ${b.name}`).join('\n')}\n\n👆 Lütfen randevu almak istediğiniz *berberin ismini* yazın.`
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

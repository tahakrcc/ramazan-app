const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const logger = require('../config/logger');
const BotState = require('../models/botState.model');
const Feedback = require('../models/feedback.model');
const Complaint = require('../models/complaint.model');
const Appointment = require('../models/appointment.model');
const Settings = require('../models/settings.model');
const Service = require('../models/service.model');
const Admin = require('../models/admin.model'); // Added Admin (Barber)
const appointmentService = require('./appointment.service'); // Added Service
const useMongoDBAuthState = require('../utils/mongoAuthState');
const { format, addDays, startOfDay, endOfDay, parseISO, isValid } = require('date-fns');
const { tr } = require('date-fns/locale');

// Static config for absolute fallbacks, but we use DB settings mostly
const CONFIG = {
    businessName: 'By Ramazan',
    location: {
        address: 'Movenpick Hotel -1 Kat - Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    },
    website: 'https://ramazan-app.onrender.com'
};

let sock;
let qrCode = null;
let status = 'INITIALIZING';

// --- Helpers ---

const getActiveBarbers = async () => {
    try {
        // Find admins/barbers who are active.
        // Assuming we want to show everyone with role 'BARBER' or 'ADMIN' as an option?
        // Or strictly 'BARBER'? Let's show all for now or filter by role logic if needed.
        // Let's exclude 'STAFF' if they are receptionists only. But user said "2. berber".
        return await Admin.find({ isActive: true }).select('name role');
    } catch (e) { return []; }
};

const parseDateInput = (input) => {
    const lower = input.toLowerCase();
    const today = new Date();
    if (lower.includes('bugün')) return format(today, 'yyyy-MM-dd');
    if (lower.includes('yarın')) return format(addDays(today, 1), 'yyyy-MM-dd');
    if (lower.includes('ptesi') || lower.includes('pazartesi')) { /* Todo: smart day parsing */ }
    return null;
};

const getActiveServices = async () => {
    try {
        return await Service.find({ isActive: true });
    } catch (e) { return []; }
};

const initialize = async () => {
    try {
        const { state, saveCreds } = await useMongoDBAuthState();

        sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                qrCode = qr;
                status = 'QR_READY';
                logger.info('WhatsApp QR Code generated');
            }
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    status = 'INITIALIZING';
                    initialize();
                } else {
                    status = 'DISCONNECTED';
                }
            } else if (connection === 'open') {
                status = 'CONNECTED';
                qrCode = null;
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.key.fromMe && m.type === 'notify') {
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                    if (!text) return;

                    const sender = msg.key.remoteJid;
                    const phone = sender.replace(/\D/g, '');
                    const pushName = msg.pushName || "Değerli Müşterimiz";

                    // --- STATE MACHINE ---
                    let botState = await BotState.findOne({ phone });
                    if (!botState) botState = await BotState.create({ phone, state: 'IDLE' });

                    const lowerText = text.toLowerCase();

                    // --- GLOBAL CANCEL ---
                    if (['iptal', 'vazgeç', 'başa dön'].some(k => lowerText.includes(k))) {
                        await BotState.deleteOne({ phone });
                        await sock.sendMessage(sender, { text: "✅ İşlem iptal edildi.\n\nYardımcı olabileceğimiz başka bir konu var mı?\n- Randevu al\n- Adres tarifi" });
                        return;
                    }

                    // --- STATE HANDLERS ---

                    if (botState.state === 'AWAITING_BARBER') {
                        const barbers = await getActiveBarbers();
                        const choice = parseInt(text.trim());

                        if (isNaN(choice) || choice < 1 || choice > barbers.length) {
                            await sock.sendMessage(sender, { text: "❌ Lütfen geçerli bir numara giriniz." });
                            return;
                        }

                        const selectedBarber = barbers[choice - 1];

                        botState.state = 'AWAITING_DATE';
                        botState.data = { ...botState.data, barberId: selectedBarber._id, barberName: selectedBarber.name };
                        await botState.save();

                        await sock.sendMessage(sender, { text: `✂️ *${selectedBarber.name}* seçildi.\n\n📅 Hangi gün istersiniz? (Bugün, Yarın)` });
                        return;
                    }

                    if (botState.state === 'AWAITING_DATE') {
                        const date = parseDateInput(lowerText);
                        if (!date) {
                            await sock.sendMessage(sender, { text: "📅 Tarihi anlayamadım. Lütfen 'Bugün' veya 'Yarın' yazınız." });
                            return;
                        }

                        // Use Centralized Service Logic for Availability
                        // Pass barberId if we have it
                        const barberId = botState.data?.barberId;
                        const availableSlots = await appointmentService.getAvailableSlots(date, barberId);

                        if (availableSlots.length === 0) {
                            await sock.sendMessage(sender, { text: `😔 ${text} için tüm saatler dolu.` });
                            return;
                        }

                        botState.state = 'AWAITING_TIME';
                        botState.data = { ...botState.data, date, availableSlots }; // Preserve existing data (barberId)
                        await botState.save();

                        await sock.sendMessage(sender, { text: `📅 *${text}* müsait saatler:\n${availableSlots.join(', ')}\n\nLütfen saat seçiniz (Örn: 14:00):` });
                        return;
                    }

                    if (botState.state === 'AWAITING_TIME') {
                        let selectedTime = text.trim();
                        if (selectedTime.match(/^\d{1,2}$/)) selectedTime += ":00";
                        if (selectedTime.match(/^\d{1,2}\.\d{2}$/)) selectedTime = selectedTime.replace('.', ':');
                        if (selectedTime.match(/^\d:\d{2}$/)) selectedTime = "0" + selectedTime;

                        if (!botState.data.availableSlots.includes(selectedTime)) {
                            await sock.sendMessage(sender, { text: "❌ Geçersiz veya dolu saat. Lütfen listeden seçiniz." });
                            return;
                        }

                        // Ask for Service
                        const services = await getActiveServices();
                        if (services.length === 0) {
                            // FAST TRACK: No services defined, create default
                            const apptData = {
                                customerName: pushName,
                                phone: phone,
                                date: botState.data.date,
                                hour: selectedTime,
                                service: 'Standart',
                                createdFrom: 'whatsapp',
                                barberId: botState.data.barberId,
                                barberName: botState.data.barberName
                            };

                            try {
                                await appointmentService.createAppointment(apptData);
                                await BotState.deleteOne({ phone });

                                // Clean Success Message
                                let msg = `✅ *Randevu Onaylandı!*\n\n📅 ${botState.data.date} - ${selectedTime}`;
                                if (botState.data.barberName) msg += `\n✂️ ${botState.data.barberName}`;
                                msg += `\n\nTeşekkürler!`;

                                await sock.sendMessage(sender, { text: msg });
                            } catch (e) { await sock.sendMessage(sender, { text: "Hata: " + e.message }); }
                            return;
                        }

                        botState.state = 'AWAITING_SERVICE';
                        botState.data = { ...botState.data, hour: selectedTime };
                        await botState.save();

                        const serviceList = services.map((s, i) => `${i + 1}. ${s.name} (${s.price}TL)`).join('\n');
                        await sock.sendMessage(sender, { text: `✂️ *Hizmet Seçiniz:*\n\n${serviceList}\n\nLütfen numara yazınız (Örn: 1).` });
                        return;
                    }

                    if (botState.state === 'AWAITING_SERVICE') {
                        const services = await getActiveServices();
                        const choice = parseInt(text.trim());

                        if (isNaN(choice) || choice < 1 || choice > services.length) {
                            await sock.sendMessage(sender, { text: "❌ Lütfen geçerli bir numara giriniz." });
                            return;
                        }

                        const selectedService = services[choice - 1];
                        // Retrieve stored data
                        const { date, hour, barberId, barberName } = botState.data;

                        try {
                            // Use Service for Creation
                            await appointmentService.createAppointment({
                                customerName: pushName,
                                phone: phone,
                                date: date,
                                hour: hour,
                                service: selectedService.name,
                                serviceId: selectedService.id,
                                createdFrom: 'whatsapp',
                                barberId: barberId,
                                barberName: barberName
                            });

                            await BotState.deleteOne({ phone });

                            let msg = `✅ *Randevu Onaylandı!*\n\n📅 ${date} - ${hour}\n✂️ ${selectedService.name}`;
                            if (barberName) msg += `\n👤 ${barberName}`;
                            msg += `\n\nTeşekkürler, bekliyoruz!`;

                            await sock.sendMessage(sender, { text: msg });
                        } catch (err) {
                            await sock.sendMessage(sender, { text: "⚠️ " + err.message });
                        }
                        return;
                    }

                    if (botState.state === 'AWAITING_COMPLAINT') {
                        await Complaint.create({ customerName: pushName, phone, message: text, source: 'whatsapp' });
                        await BotState.deleteOne({ phone });
                        await sock.sendMessage(sender, { text: "✅ Şikayetiniz alındı. Yetkililerimiz en kısa sürede size ulaşacaktır." });
                        return;
                    }

                    if (botState.state === 'AWAITING_FEEDBACK') {
                        const match = text.match(/([1-5])/);
                        if (match) {
                            await Feedback.create({ customerName: pushName, phone, rating: parseInt(match[0]), comment: text.replace(match[0], '').trim() || "Puan", isApproved: false });
                            await BotState.deleteOne({ phone });
                            await sock.sendMessage(sender, { text: "✅ Teşekkürler!" });
                        }
                        return;
                    }


                    // --- IDLE COMMANDS ---

                    // 1. Complaint
                    if (lowerText.includes('şikayet')) {
                        botState.state = 'AWAITING_COMPLAINT';
                        await botState.save();
                        await sock.sendMessage(sender, { text: "📝 Lütfen şikayetinizi veya önerinizi yazınız:" });
                        return;
                    }

                    // 2. Price List
                    if (lowerText.includes('fiyat')) {
                        const services = await getActiveServices();
                        const list = services.map(s => `🔹 ${s.name}: ${s.price} TL`).join('\n');
                        await sock.sendMessage(sender, { text: `💰 *Fiyat Listemiz:*\n\n${list}` });
                        return;
                    }

                    // 3. Models
                    if (lowerText.includes('model')) {
                        await sock.sendMessage(sender, { text: "📸 *Modellerimiz:*\nİnstagram'da: https://instagram.com/byramazan" });
                        return;
                    }

                    // 4. Booking
                    if (lowerText.includes('randevu') && !lowerText.includes('iptal') && !lowerText.includes('ne zaman')) {
                        // Check if Multi-Barber
                        const barbers = await getActiveBarbers();

                        if (barbers.length > 1) {
                            // Multiple barbers: Ask user
                            botState.state = 'AWAITING_BARBER';
                            await botState.save();

                            const barberList = barbers.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
                            await sock.sendMessage(sender, { text: `✂️ *Hangi Berber?*\n\n${barberList}\n\nLütfen numara yazınız (Örn: 1).` });
                        } else {
                            // Single barber (or 0, default to null): Skip to Date
                            botState.state = 'AWAITING_DATE';
                            // If exactly 1, auto-assign
                            if (barbers.length === 1) {
                                botState.data = { barberId: barbers[0]._id, barberName: barbers[0].name };
                            }
                            await botState.save();
                            await sock.sendMessage(sender, { text: "📅 Hangi gün? (Bugün, Yarın)" });
                        }
                        return;
                    }

                    // 5. Query / Cancel
                    if (lowerText.includes('ne zaman')) {
                        const today = new Date().toISOString().split('T')[0];
                        const apps = await Appointment.find({ phone, status: 'confirmed', date: { $gte: today } });
                        if (apps.length === 0) await sock.sendMessage(sender, { text: "Gelecek randevunuz yok." });
                        else await sock.sendMessage(sender, { text: `📅 Randevularınız:\n${apps.map(a => `- ${a.date} ${a.hour} ${a.barberName ? '(' + a.barberName + ')' : ''}`).join('\n')}` });
                        return;
                    }

                    if (lowerText.includes('iptal')) {
                        const today = new Date().toISOString().split('T')[0];
                        const app = await Appointment.findOne({ phone, status: 'confirmed', date: { $gte: today } }).sort({ date: 1 });
                        if (app) {
                            if (app.barberId) {
                                // Maybe notify barber? For now just cancel.
                            }
                            app.status = 'cancelled';
                            await app.save();
                            await sock.sendMessage(sender, { text: "✅ Randevunuz iptal edildi." });
                        } else {
                            await sock.sendMessage(sender, { text: "İptal edilecek randevu bulunamadı." });
                        }
                        return;
                    }

                    // 6. Default Menu
                    if (lowerText.includes('selam') || lowerText.includes('merhaba') || lowerText.includes('yardım')) {
                        await sock.sendMessage(sender, {
                            text: `👋 Merhaba ${pushName}!\n\nAsistanınız hazır. Ne yapmak istersiniz?\n\n📅 *Randevu Al* ("Randevu" yazın)\n💰 *Fiyatlar* ("Fiyat" yazın)\n📸 *Modeller* ("Model" yazın)\n📝 *Şikayet/Öneri* ("Şikayet" yazın)\n❓ *Randevum Ne Zaman?*`
                        });
                    }

                }
            } catch (error) {
                logger.error('Error handling message:', error);
            }
        });

    } catch (error) {
        logger.error('WhatsApp Initialization Error:', error);
        status = 'ERROR';
    }
};

const getStatus = async () => { return { status, qr: qrCode }; };
const sendMessage = async (phone, message) => {
    if (status !== 'CONNECTED' || !sock) return false;
    try {
        let formattedPhone = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(formattedPhone, { text: message });
        return true;
    } catch (e) { return false; }
};
const logout = async () => { /* ... same ... */ };

module.exports = { initialize, getStatus, sendMessage, logout, CONFIG };

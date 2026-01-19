const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const BotState = require('../models/botState.model');
const Feedback = require('../models/feedback.model');

const CONFIG = {
    businessName: 'By Ramazan',
    workingHours: { start: 9, end: 20 },
    location: {
        address: 'Movenpick Hotel -1 Kat - Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    },
    website: 'https://ramazan-app.onrender.com'
};

let sock;
let qrCode = null;
let status = 'INITIALIZING';

const initialize = async () => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

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
                    try {
                        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
                    } catch (e) { }
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
                    const phone = sender.replace(/\D/g, ''); // Raw phone for DB match

                    // 1. Check Bot State (Waiting for Feedback?)
                    const botState = await BotState.findOne({ phone });

                    if (botState && botState.state === 'AWAITING_FEEDBACK') {
                        // Logic: Look for first number 1-5
                        const match = text.match(/([1-5])/);

                        if (match) {
                            const rating = parseInt(match[0]);
                            const comment = text.replace(match[0], '').trim() || "Puan bırakıldı";

                            // Create Feedback
                            await Feedback.create({
                                customerName: "WhatsApp Kullanıcısı", // Can be updated if we look up Appointment by phone later
                                phone: phone,
                                rating: rating,
                                comment: comment,
                                source: 'whatsapp',
                                isApproved: false
                            });

                            // Clear State
                            await BotState.deleteOne({ phone });

                            await sock.sendMessage(sender, { text: "✅ Değerli yorumunuz için teşekkür ederiz! Web sitemizde yayınlanmak üzere onaya gönderildi." });
                            return; // Stop processing other rules
                        } else {
                            // Invalid format? Maybe just ignore or ask again.
                            // For a natural flow, if they type something unrelated, maybe we should just clear state or ask clarify?
                            // Let's assume if it doesn't match, we treat it as normal text unless it's very short.
                            // Better: Reply asking for rating.
                            // await sock.sendMessage(sender, { text: "Lütfen 1 ile 5 arasında bir puan veriniz. Örn: '5 Çok beğendim'" });
                            // return; 
                        }
                    }

                    // 2. Normal Auto-Reply Rules
                    const lowerText = text.toLowerCase();
                    if (lowerText.includes('adres') || lowerText.includes('yer') || lowerText.includes('nerede')) {
                        await sock.sendMessage(sender, {
                            text: `📍 *Adresimiz:*\n${CONFIG.location.address}\n\n🗺️ *Harita:* ${CONFIG.location.mapsLink}`
                        });
                    }
                    else if (lowerText.includes('randevu') || lowerText.includes('saat')) {
                        await sock.sendMessage(sender, {
                            text: `📅 *Randevu Almak İçin:*\nWeb sitemizi ziyaret edebilirsiniz: ${CONFIG.website}\n\nÇalışma Saatlerimiz: ${CONFIG.workingHours.start}:00 - ${CONFIG.workingHours.end}:00`
                        });
                    }
                    else if (lowerText.includes('merhaba') || lowerText.includes('selam')) {
                        await sock.sendMessage(sender, {
                            text: `👋 Merhaba! *${CONFIG.businessName}* asistanıyım.\n\nSize nasıl yardımcı olabilirim?\n- 📍 Adres tarifi alabilirim\n- 📅 Randevu bilgisi verebilirim`
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

const getStatus = async () => {
    return { status, qr: qrCode };
};

const sendMessage = async (phone, message) => {
    if (status !== 'CONNECTED' || !sock) return false;
    try {
        let formattedPhone = phone.replace(/[^0-9]/g, '');
        if (!formattedPhone.endsWith('@s.whatsapp.net')) formattedPhone += '@s.whatsapp.net';
        await sock.sendMessage(formattedPhone, { text: message });
        return true;
    } catch (error) {
        logger.error(`Error sending message to ${phone}:`, error);
        return false;
    }
};

const logout = async () => {
    try {
        if (sock) {
            await sock.logout();
            sock.end(undefined);
            sock = null;
        }
        status = 'INITIALIZING';
        qrCode = null;
        try { fs.rmSync('auth_info_baileys', { recursive: true, force: true }); } catch (e) { }
        initialize();
        return true;
    } catch (error) { return false; }
};

module.exports = { initialize, getStatus, sendMessage, logout, CONFIG };

const mongoose = require('mongoose');
const BotState = require('./src/models/botState.model');
require('dotenv').config();

async function checkBotStates() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const states = await BotState.find({ 
            $or: [
                { 'data.lid': { $exists: true } },
                { 'data.lids': { $exists: true } }
            ]
        }).limit(20);

        console.log(`Found ${states.length} states with LID mapping:`);
        states.forEach(s => {
            console.log(`Phone: ${s.phone}, LID: ${s.data.lid}, LIDs: ${JSON.stringify(s.data.lids)}`);
        });

        // Check for long phone numbers (>12)
        const longPhones = await BotState.find({ 
            phone: { $regex: /^.{13,}$/ } 
        });
        console.log(`\nFound ${longPhones.length} states with phone length >= 13:`);
        longPhones.forEach(s => {
            console.log(`Phone: ${s.phone}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
}

checkBotStates();

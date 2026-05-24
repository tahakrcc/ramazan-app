require('dotenv').config();
const mongoose = require('mongoose');
const BotState = require('./src/models/botState.model');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const doc = await BotState.findOneAndUpdate(
            { phone: '905525424632' },
            { 
                $set: { phone: '905525424632', updatedAt: new Date() },
                $addToSet: { 'data.lids': '3182570823827' }
            },
            { upsert: true, new: true }
        );
        console.log('CREATED:', doc);
        const states = await BotState.find({});
        console.log('TOTAL:', states.length);
        process.exit(0);
    } catch(e) {
        console.error('ERROR:', e);
        process.exit(1);
    }
}
run();

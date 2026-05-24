require('dotenv').config();
const mongoose = require('mongoose');
const BotState = require('./src/models/botState.model');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const regex = new RegExp('^3182570823827(:|$)');
        const doc = await BotState.findOne({ 'data.lids': { $regex: regex } });
        console.log('FOUND:', !!doc);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();

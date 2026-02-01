const mongoose = require('mongoose');
const Appointment = require('./src/models/appointment.model');
require('dotenv').config();

const fixIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const indexes = await Appointment.collection.indexes();
        console.log('Current Indexes:', indexes);

        // Name of the index to drop (Mongoose default naming)
        // likely "date_1_hour_1_barberId_1"
        const indexName = "date_1_hour_1_barberId_1";

        const exists = indexes.find(i => i.name === indexName);
        if (exists) {
            console.log(`Dropping index: ${indexName}`);
            await Appointment.collection.dropIndex(indexName);
            console.log('Index dropped.');
        } else {
            console.log('Index not found (maybe named differently? check list above)');
            // Try to find by key
            const byKey = indexes.find(i => i.key.date === 1 && i.key.hour === 1 && i.key.barberId === 1);
            if (byKey) {
                console.log(`Dropping index by key: ${byKey.name}`);
                await Appointment.collection.dropIndex(byKey.name);
            }
        }

        console.log('Please restart the application to recreate the index with PartialFilterExpression (after applying code changes).');

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

fixIndex();

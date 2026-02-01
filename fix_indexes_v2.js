const mongoose = require('mongoose');
const Appointment = require('./src/models/appointment.model');
require('dotenv').config();

const fixIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const indexes = await Appointment.collection.indexes();
        console.log('Current Indexes:', indexes);

        const indexesToDrop = ["date_1_hour_1", "date_1_hour_1_barberId_1"];

        for (const indexName of indexesToDrop) {
            const exists = indexes.find(i => i.name === indexName);
            if (exists) {
                console.log(`Dropping index: ${indexName}`);
                await Appointment.collection.dropIndex(indexName);
                console.log('Index dropped.');
            } else {
                console.log(`Index ${indexName} not found.`);
            }
        }

        console.log('Indexes cleaned up. Restart app to apply new schematic index.');

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

fixIndex();

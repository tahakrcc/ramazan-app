const mongoose = require('mongoose');
const Appointment = require('./src/models/appointment.model');
require('dotenv').config();

const fixIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const collection = mongoose.connection.collection('appointments');
        const indexes = await collection.indexes();
        console.log('Current Indexes:', indexes);

        // Find the unique index on date/hour/barberId
        const indexName = indexes.find(idx => idx.key.date === 1 && idx.key.hour === 1 && idx.key.barberId === 1)?.name;

        if (indexName) {
            console.log(`Dropping index: ${indexName}...`);
            await collection.dropIndex(indexName);
            console.log('Index dropped.');
        } else {
            console.log('Index not found, might be named differently or not exist.');
        }

        console.log('Re-creating index from Model definition...');
        // Mongoose syncIndexes will create it
        await Appointment.syncIndexes();

        // Verify
        const newIndexes = await collection.indexes();
        console.log('New Indexes:', newIndexes);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
};

fixIndex();

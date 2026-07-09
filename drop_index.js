require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        await mongoose.connection.db.collection('botstates').dropIndex('updatedAt_1');
        console.log('INDEX DROPPED!');
    } catch(e) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
});

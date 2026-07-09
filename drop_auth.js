const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin:SiFCNnMTDL4NfchP@admin.k2ibf6q.mongodb.net/ramazan-app';

async function listAndClear() {
    try {
        await mongoose.connect(uri);
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        
        // Find if authstates or similar exists
        const authCol = collections.find(c => c.name.toLowerCase().includes('auth'));
        if (authCol) {
            console.log(`Found collection: ${authCol.name}`);
            const result = await mongoose.connection.db.collection(authCol.name).deleteMany({});
            console.log(`Deleted ${result.deletedCount} documents from ${authCol.name}.`);
        } else {
            console.log('No auth collection found.');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

listAndClear();

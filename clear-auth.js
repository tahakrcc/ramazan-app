require('dotenv').config();
const mongoose = require('mongoose');

// Define Schema manually to ensure it hits the right collection
const AuthStateSchema = new mongoose.Schema({
    _id: String,
    value: Object
});
const AuthState = mongoose.models.AuthState || mongoose.model('AuthState', AuthStateSchema);

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('Connected to DB. Clearing AuthStates...');
    const result = await AuthState.deleteMany({});
    console.log(`Deleted ${result.deletedCount} auth states.`);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

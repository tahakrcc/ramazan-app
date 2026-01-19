const { proto } = require('@whiskeysockets/baileys');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');

// Define Schema
const AuthStateSchema = new mongoose.Schema({
    _id: String, // Key (e.g., 'creds', 'app-state-sync-key-...')
    value: Object // The actual data
});

const AuthState = mongoose.models.AuthState || mongoose.model('AuthState', AuthStateSchema);

const useMongoDBAuthState = async (collectionName = 'auth_info_baileys') => {
    // Helper to read data
    const readData = async (type, id) => {
        const key = `${type}-${id}`;
        try {
            const doc = await AuthState.findById(key);
            if (doc && doc.value) {
                return JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver);
            }
        } catch (error) {
            console.error('Error reading auth state:', error);
        }
        return null;
    };

    // Helper to write data
    const writeData = async (data, type, id) => {
        const key = `${type}-${id}`;
        try {
            await AuthState.findByIdAndUpdate(
                key,
                { value: JSON.parse(JSON.stringify(data, BufferJSON.replacer)) },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error writing auth state:', error);
        }
    };

    // Helper to remove data
    const removeData = async (type, id) => {
        const key = `${type}-${id}`;
        try {
            await AuthState.findByIdAndDelete(key);
        } catch (error) {
            console.error('Error removing auth state:', error);
        }
    };

    // Initial credentials
    const creds = (await readData('creds', 'main')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(type, id);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) {
                                tasks.push(writeData(value, type, id));
                            } else {
                                tasks.push(removeData(type, id));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds', 'main')
    };
};

module.exports = useMongoDBAuthState;

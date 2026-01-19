const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['ADMIN'],
        default: 'ADMIN'
    }
}, {
    timestamps: true
});

// Middleware to hash password before saving
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password') && !this.isNew) {
        return next();
    }

    // Since we pass 'password' to the model but schema expects 'passwordHash',
    // we need to handle this manually if we want to support 'password' field in constructor.
    // However, the schema doesn't have 'password' field, so 'this.password' might be undefined
    // unless we use a virtual or just set it on the document.

    // Better approach: Check if we have a direct password or if it was passed loosely.
    // Given createAdmin.js passes {password: ...}, let's assume we need to handle it.
    // But Mongoose strict mode might strip 'password'.

    // Let's modify the schema to include a virtual for password.
});

adminSchema.virtual('password')
    .set(function (password) {
        this._password = password;
        this.passwordHash = bcrypt.hashSync(password, 10);
    })
    .get(function () {
        return this._password;
    });

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;

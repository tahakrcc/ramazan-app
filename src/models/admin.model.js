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

// Virtual for password
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

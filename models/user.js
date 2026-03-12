const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    // Uyum için 'username' yerine 'name' kullanıldı (routes/auth.js ile uyumlu)
    name: {
        type: String,
        required: [true, 'Lütfen adınızı ve soyadınızı girin'],
        trim: true
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        default: function() { return new mongoose.Types.ObjectId().toString(); }
    },
    email: {
        type: String,
        required: [true, 'Lütfen e-posta adresi girin'],
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'Geçerli bir e-posta adresi girin']
    },
    password: {
        type: String,
        required: [true, 'Lütfen bir şifre girin'],
        minlength: 6,
        select: false
    },
    languages: [{
        type: String
    }],
    // Track last login time and accumulated usage (in seconds)
    lastLogin: {
        type: Date,
        default: null
    },
    usageSeconds: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true, versionKey: false });

// Şifre kaydetmeden önce hashleme (Middleware)
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    // Hash gücü: 12 (package-lock.json uyumu için)
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Şifre karşılaştırma metodu
UserSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
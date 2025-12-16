// No changes needed as the require path is already normalized to lowercase.
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user'); // User modelini dahil ettik
const authMiddleware = require('../authMiddleware');

const router = express.Router();

// JWT oluşturma fonksiyonu
const signToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

// Başarılı kimlik doğrulamasında yanıt gönderme — safe user object + bilingual messages
const createSendToken = (userDoc, statusCode, res) => {
    const token = signToken(userDoc._id);

    const user = userDoc.toObject ? userDoc.toObject() : {...userDoc };
    if (user.password) delete user.password;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: { user },
        message: { tr: 'İşlem başarılı', en: 'Operation successful' }
    });
};

// 1. Kayıt Olma (Register) - POST /api/auth/register
router.post('/register', async(req, res, next) => {
    try {
        const { name, email, password, confirmPassword, languages } = req.body;
        console.log('[REGISTER] Incoming request body:', { name, email, password: password ? '***' : null, confirmPassword: confirmPassword ? '***' : null, languages });

        // Basic validation
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: { tr: 'Eksik alanlar: name, email veya password', en: 'Missing fields: name, email or password' } });
        }

        // Normalize email: trim and lowercase
        const normalizedEmail = email.trim().toLowerCase();
        console.log('[REGISTER] Normalized email:', normalizedEmail);
        if (!normalizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: { tr: 'Geçerli bir e-posta adresi girin', en: 'Please enter a valid email address' } });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: { tr: 'Şifreler eşleşmiyor', en: 'Passwords do not match' } });
        }

        // Check if user already exists (explicit check before creating)
        let existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            console.log('[REGISTER] User with email already exists:', normalizedEmail);
            return res.status(400).json({ error: { tr: 'Bu e-posta adresi zaten kullanımda.', en: 'This email is already in use' } });
        }

        const newUser = await User.create({
            name,
            username: `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            email: normalizedEmail,
            password,
            languages,
        });
        console.log('[REGISTER] User created successfully:', newUser._id);

        createSendToken(newUser, 201, res);

    } catch (err) {
        console.error('Register error:', err && err.stack ? err.stack : err);
        if (err && (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000))) {
            const kv = err.keyValue || {};
            // Prefer field-specific friendly messages
            if (kv.username) {
                const payload = { error: { tr: 'Bu kullanıcı adı zaten kullanımda.', en: 'This username is already in use' } };
                if (process.env.NODE_ENV === 'development') payload.details = { code: err.code, keyValue: kv, raw: err.message };
                return res.status(400).json(payload);
            }
            if (kv.email) {
                const payload = { error: { tr: 'Bu e-posta adresi zaten kullanımda.', en: 'This email is already in use' } };
                if (process.env.NODE_ENV === 'development') payload.details = { code: err.code, keyValue: kv, raw: err.message };
                return res.status(400).json(payload);
            }
            // Generic duplicate key fallback
            const payload = { error: { tr: 'Zaten var olan bir kayıtla çakışma (duplicate key)', en: 'Duplicate key conflict' } };
            if (process.env.NODE_ENV === 'development') payload.details = { code: err.code, keyValue: kv, raw: err.message };
            return res.status(400).json(payload);
        }
        return res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err && err.message ? err.message : String(err) });
    }
});

// 2. Giriş Yapma (Login) - POST /api/auth/login
router.post('/login', async(req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: { tr: 'Lütfen e-posta ve şifre girin', en: 'Please provide email and password' } });
        }

        // Şifresi ile birlikte kullanıcıyı bul
        const user = await User.findOne({ email }).select('+password');

        if (!user || !(await user.correctPassword(password, user.password))) {
            return res.status(401).json({ error: { tr: 'Geçersiz e-posta veya şifre', en: 'Invalid email or password' } });
        }

        // Update lastLogin timestamp for admin reporting
        try {
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });
        } catch (e) {
            console.warn('Could not update lastLogin for user', user._id, e && e.message);
        }

        createSendToken(user, 200, res);

    } catch (err) {
        return res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// GET /api/auth/me - current user profile (requires Bearer token)
router.get('/me', authMiddleware, async(req, res, next) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı', message: { tr: 'Kullanıcı bulunamadı', en: 'User not found' } });
        return res.json({ status: 'success', data: { user } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
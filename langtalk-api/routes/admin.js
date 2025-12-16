const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Room = require('../models/room');
const crypto = require('crypto');

// Simple admin auth middleware: checks x-admin-secret header, admin_secret query, or admin_auth cookie matches env ADMIN_SECRET
function parseCookie(req, name) {
    const header = req.get('cookie') || req.headers.cookie || '';
    const parts = header.split(';').map(p => p.trim());
    for (const p of parts) {
        const [k, ...v] = p.split('=');
        if (k === name) return decodeURIComponent(v.join('='));
    }
    return null;
}

function adminAuth(req, res, next) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
        // For safety, do not allow access when ADMIN_SECRET is not configured
        return res.status(403).json({ error: { tr: 'Admin anahtarı yapılandırılmamış', en: 'Admin secret not configured' } });
    }
    const provided = req.get('x-admin-secret') || req.query.admin_secret || parseCookie(req, 'admin_auth');
    if (!provided) return res.status(401).json({ error: { tr: 'Yetkisiz', en: 'Unauthorized' } });
    if (provided !== secret) return res.status(403).json({ error: { tr: 'Geçersiz admin anahtarı', en: 'Invalid admin key' } });
    next();
}

// List users (no password)
router.get('/users', adminAuth, async(req, res) => {
    try {
        const users = await User.find({}).select('-password').lean();
        res.json({ status: 'success', results: users.length, data: { users } });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Login endpoint - sets an HttpOnly cookie when admin secret matches
router.post('/login', async(req, res) => {
    try {
        const body = req.body || {};
        const provided = body.secret || req.get('x-admin-secret') || req.query.admin_secret;
        const secret = process.env.ADMIN_SECRET;
        if (!secret) return res.status(500).json({ error: { tr: 'Sunucu yapılandırması eksik', en: 'Server misconfigured' } });
        if (!provided) return res.status(400).json({ error: { tr: 'Secret gerekli', en: 'Secret required' } });
        if (provided !== secret) return res.status(403).json({ error: { tr: 'Geçersiz admin anahtarı', en: 'Invalid admin key' } });
        // set cookie; HttpOnly for safety
        res.cookie('admin_auth', provided, { httpOnly: true, sameSite: 'lax' });
        return res.json({ status: 'success' });
    } catch (err) {
        return res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Logout endpoint - clears cookie
router.post('/logout', adminAuth, async(req, res) => {
    try {
        res.clearCookie('admin_auth');
        return res.json({ status: 'success' });
    } catch (err) {
        return res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Delete user by id
router.delete('/users/:id', adminAuth, async(req, res) => {
    try {
        const id = req.params.id;
        await User.findByIdAndDelete(id);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Reset a user's password (admin)
router.post('/users/:id/reset-password', adminAuth, async(req, res) => {
    try {
        const id = req.params.id;
        const { password } = req.body || {};
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: { tr: 'Geçerli bir şifre girin (en az 6 karakter)', en: 'Provide a valid password (min 6 chars)' } });
        }
        const user = await User.findById(id).select('+password');
        if (!user) return res.status(404).json({ error: { tr: 'Kullanıcı bulunamadı', en: 'User not found' } });
        user.password = password;
        await user.save();
        res.json({ status: 'success', message: { tr: 'Şifre güncellendi', en: 'Password updated' } });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Patch user fields (usageSeconds, lastLogin) — admin can adjust usage/time data
router.patch('/users/:id', adminAuth, async(req, res) => {
    try {
        const id = req.params.id;
        const { usageSeconds, lastLogin } = req.body || {};
        const update = {};
        if (typeof usageSeconds === 'number') update.usageSeconds = usageSeconds;
        if (lastLogin) update.lastLogin = new Date(lastLogin);
        if (!Object.keys(update).length) return res.status(400).json({ error: { tr: 'Güncellenecek alan yok', en: 'No fields to update' } });
        const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
        if (!user) return res.status(404).json({ error: { tr: 'Kullanıcı bulunamadı', en: 'User not found' } });
        res.json({ status: 'success', data: { user } });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Generate a temporary password and set it for the user, return plaintext to admin (private)
router.post('/users/:id/generate-temp-password', adminAuth, async(req, res) => {
    try {
        const id = req.params.id;
        const buf = crypto.randomBytes(9);
        const temp = buf.toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B').replace(/=+$/, '');
        const password = 'T-' + temp;

        const user = await User.findById(id).select('+password');
        if (!user) return res.status(404).json({ error: { tr: 'Kullanıcı bulunamadı', en: 'User not found' } });
        user.password = password;
        await user.save();

        res.json({ status: 'success', tempPassword: password, message: { tr: 'Geçici şifre oluşturuldu', en: 'Temporary password generated' } });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// List rooms
router.get('/rooms', adminAuth, async(req, res) => {
    try {
        const rooms = await Room.find({}).lean();
        res.json({ status: 'success', results: rooms.length, data: { rooms } });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// Delete room
router.delete('/rooms/:id', adminAuth, async(req, res) => {
    try {
        const id = req.params.id;
        await Room.findByIdAndDelete(id);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

module.exports = router;
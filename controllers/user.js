const mongoose = require('mongoose');
const User = require('../models/user');

exports.getMe = async(req, res, next) => {
    try {
        // req.user.userId, authMiddleware'den gelir. Şifresiz çekilir.
        const user = await User.findById(req.user.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json({ status: 'success', data: { user } });
    } catch (err) {
        // Hata yönetimi server.js'teki genel hata middleware'ine bırakıldı
        next(err);
    }
};

// GET /api/users — list users (public)
exports.listUsers = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { q, limit = 50, page = 1 } = req.query;
        const filter = {};
        if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];

        const skip = Math.max(0, (Number(page) - 1) * Number(limit));
        const users = await User.find(filter).select('name email languages createdAt').limit(Number(limit)).skip(skip).sort({ createdAt: -1 });

        res.json({ status: 'success', results: users.length, data: { users } });
    } catch (err) {
        next(err);
    }
};

// GET /api/users/:id
exports.getUserById = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { id } = req.params;
        const user = await User.findById(id).select('name email languages createdAt');
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı', message: { tr: 'Kullanıcı bulunamadı', en: 'User not found' } });

        res.json({ status: 'success', data: { user } });
    } catch (err) {
        next(err);
    }
};
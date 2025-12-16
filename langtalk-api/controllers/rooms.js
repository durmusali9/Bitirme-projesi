const mongoose = require('mongoose');
const Room = require('../models/room');

exports.createRoom = async(req, res, next) => {
    try {
        // Tüm alanlar frontend'den alınıyor
        const { name, language, level, topic, description } = req.body;

        if (!name || !language) return res.status(400).json({ error: 'Oda adı ve dil bilgisi gereklidir.' });
        if (!level) return res.status(400).json({ error: 'Seviye bilgisi gereklidir.' });
        if (!description || description.trim().length === 0) return res.status(400).json({ error: 'Oda açıklaması gereklidir.' });

        const room = await Room.create({
            name,
            owner: req.user.userId,
            members: [req.user.userId],
            language,
            level,
            topic: topic || '',
            description: description.trim()
        });
        return res.status(201).json(room);
    } catch (err) {
        return next(err);
    }
};

// GET /api/rooms  — list rooms (filters: language, level, topic)
exports.getAllRooms = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { language, level, topic, limit = 50, page = 1 } = req.query;
        const filter = {};
        if (language) filter.language = language;
        if (level) filter.level = level;
        if (topic) filter.topic = new RegExp(topic, 'i');

        const skip = Math.max(0, (Number(page) - 1) * Number(limit));
        const rooms = await Room.find(filter)
            .populate('owner', 'name email')
            .limit(Number(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        return res.json({ status: 'success', results: rooms.length, data: { rooms } });
    } catch (err) {
        return next(err);
    }
};

// GET /api/rooms/:roomId
exports.getRoomById = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { roomId } = req.params;
        const room = await Room.findById(roomId).populate('owner', 'name email');
        if (!room) return res.status(404).json({ error: 'Oda bulunamadı', message: { tr: 'Oda bulunamadı', en: 'Room not found' } });
        return res.json({ status: 'success', data: { room } });
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/rooms/:roomId
exports.updateRoom = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { roomId } = req.params;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Oda bulunamadı', message: { tr: 'Oda bulunamadı', en: 'Room not found' } });

        if (room.owner.toString() !== req.user.userId) return res.status(403).json({ error: 'Sadece sahibi güncelleyebilir', message: { tr: 'Sadece oda sahibi güncelleyebilir', en: 'Only owner can modify the room' } });

        const allowed = ['name', 'language', 'level', 'topic', 'description'];
        allowed.forEach((key) => {
            if (req.body[key] !== undefined) room[key] = req.body[key];
        });

        await room.save();
        return res.json({ status: 'success', data: { room } });
    } catch (err) {
        return next(err);
    }
};

// DELETE /api/rooms/:roomId
exports.deleteRoom = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { roomId } = req.params;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Oda bulunamadı', message: { tr: 'Oda bulunamadı', en: 'Room not found' } });

        if (room.owner.toString() !== req.user.userId) return res.status(403).json({ error: 'Sadece sahibi silebilir', message: { tr: 'Sadece oda sahibi silebilir', en: 'Only owner can delete the room' } });

        await room.remove();
        return res.json({ status: 'success', message: { tr: 'Oda silindi', en: 'Room deleted' } });
    } catch (err) {
        return next(err);
    }
};

// POST /api/rooms/:roomId/join  — join self
exports.joinRoom = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { roomId } = req.params;
        const userId = req.user.userId;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Oda bulunamadı', message: { tr: 'Oda bulunamadı', en: 'Room not found' } });

        if (room.members.some((m) => m.toString() === userId)) {
            // Zaten üye ise hata dönme, yine oda bilgisini dön
            return res.json({ status: 'success', message: { tr: 'Zaten odadasınız', en: 'Already in room' }, data: { room } });
        }

        if (!room.members.some((m) => m.toString() === userId)) {
            room.members.push(userId);
        }
        await room.save();
        return res.json({ status: 'success', message: { tr: 'Odaya katıldınız', en: 'Joined the room' }, data: { room } });
    } catch (err) {
        return next(err);
    }
};

// POST /api/rooms/:roomId/leave  — leave self
exports.leaveRoom = async(req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB bağlantısı yok / Database not connected', message: { tr: 'Veritabanına bağlanılamıyor', en: 'Database connection is not available' } });

        const { roomId } = req.params;
        const userId = req.user.userId;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Oda bulunamadı', message: { tr: 'Oda bulunamadı', en: 'Room not found' } });

        room.members = room.members.filter((m) => m.toString() !== userId);
        await room.save();
        return res.json({ status: 'success', message: { tr: 'Odadan ayrıldınız', en: 'Left the room' }, data: { room } });
    } catch (err) {
        return next(err);
    }
};

exports.myRooms = async(req, res, next) => {
    try {
        // Düzeltme: owner populate alanını 'username' yerine 'name' olarak güncelledik
        const rooms = await Room.find({ members: req.user.userId })
            .populate('owner', 'name email');
        return res.json(rooms);
    } catch (err) {
        return next(err);
    }
};

exports.addMember = async(req, res, next) => {
    try {
        const { roomId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        // req.user.userId, authMiddleware tarafından atanan string'dir.
        if (room.owner.toString() !== req.user.userId) return res.status(403).json({ error: 'Only owner can add members' });

        // Mongoose'un $addToSet operatörünü kullanmak daha iyi olsa da, orijinal mantık korunmuştur.
        if (!room.members.some((m) => m.toString() === userId)) {
            room.members.push(userId);
            await room.save();
        }

        return res.json(room);
    } catch (err) {
        return next(err);
    }
};
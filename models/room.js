const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Frontend'den gelen ek alanlar eklendi:
    language: { type: String, required: true, trim: true },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    topic: { type: String, trim: true },
    description: { type: String, maxlength: 300, trim: true },
    // Son aktivite zamanı - otomatik silme için kullanılır
    lastActivity: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Room', roomSchema);
const jwt = require('jsonwebtoken');

/**
 * Socket auth middleware for socket.io
 * Usage: io.use(socketAuth);
 * 
 * Lazy-loads User model to avoid circular require issues at startup.
 */
module.exports = async function socketAuth(socket, next) {
    try {
        const token = socket.handshake.auth && socket.handshake.auth.token ||
            (socket.handshake.headers && socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(' ')[1]);

        if (!token) return next(new Error('Authentication error: token required'));

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return next(new Error('Authentication error: invalid token'));
        }

        if (!payload || !payload.userId) return next(new Error('Authentication error: invalid token payload'));

        // Lazy-load User model (avoids circular require during server startup)
        let User;
        try {
            User = require('../models/user');
        } catch (err) {
            console.error('Failed to load User model:', err && err.message ? err.message : err);
            return next(new Error('Authentication error: server misconfiguration'));
        }

        try {
            const user = await User.findById(payload.userId).select('-password');
            if (!user) return next(new Error('Authentication error: user not found'));
            socket.user = user;
            return next();
        } catch (err) {
            console.error('Socket auth DB lookup failed:', err && err.message ? err.message : err);
            return next(new Error('Authentication error: db lookup failed'));
        }
    } catch (err) {
        console.error('Socket auth failure:', err && err.stack ? err.stack : err);
        return next(new Error('Authentication error'));
    }
};
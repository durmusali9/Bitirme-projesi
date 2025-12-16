const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const socketAuth = require('./lib/socketAuth');
const path = require('path');
const adminRouter = require('./routes/admin');

// Socket authenticator - require a valid JWT in handshake (auth.token)
io.use(socketAuth);

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // index.html 'public' klasöründe olmalı

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/admin', adminRouter);

// Serve admin UI
// Serve admin UI only when admin cookie/header is present; otherwise redirect to login
app.get('/admin', (req, res) => {
    const secret = process.env.ADMIN_SECRET;
    const providedHeader = req.get('x-admin-secret') || req.query.admin_secret;
    const cookieHeader = req.get('cookie') || '';
    const hasCookie = cookieHeader.includes('admin_auth=');
    if (!secret) {
        return res.status(403).send('Admin secret not configured on server');
    }
    if (providedHeader === secret || hasCookie) {
        return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    }
    return res.redirect('/admin-login');
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Socket.IO bağlantısı
io.on('connection', (socket) => {
    const uid = socket.user ? (socket.user._id || socket.user.id) : null;
    const uname = socket.user ? (socket.user.name || socket.user.email) : 'anonymous';
    console.log('Bir kullanıcı bağlandı:', socket.id, 'user:', uid || 'none');

    // Emit a welcome message including the user object (if authenticated)
    socket.emit('welcome', { message: 'connected', user: socket.user ? { id: socket.user._id, name: socket.user.name, email: socket.user.email } : null });

    // Tüm bağlı soket'lerin bilgisini topla ve gönder
    const broadcastActiveUsers = () => {
        const activeUsers = Array.from(io.sockets.sockets.values()).map(s => {
            if (s.user) {
                return {
                    id: s.user._id || s.user.id,
                    name: s.user.name || s.user.email,
                    email: s.user.email,
                    socketId: s.id
                };
            }
            return null;
        }).filter(u => u !== null);

        // Tüm clientlere aktif kullanıcıları gönder
        io.emit('active_users', { users: activeUsers, count: activeUsers.length });
    };

    // Yeni kullanıcı bağlandı, listeyi güncelle
    broadcastActiveUsers();

    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
        // Kullanıcı ayrılınca listeyi günncelle
        broadcastActiveUsers();
    });

    // Odaya katıl event'i
    socket.on('join_room', (data) => {
        if (!data.roomId) return;

        socket.join(`room_${data.roomId}`);
        console.log(`${uname} katıldı: ${data.roomName || data.roomId}`);

        // Oda üyelerine bildir
        io.to(`room_${data.roomId}`).emit('user_joined', {
            roomId: data.roomId,
            user: {
                id: socket.user ? socket.user._id : null,
                name: socket.user ? socket.user.name : 'Anonim'
            }
        });
    });

    // Oda'dan ayrıl event'i
    socket.on('leave_room', (data) => {
        if (!data.roomId) return;

        socket.leave(`room_${data.roomId}`);
        console.log(`${uname} ayrıldı: ${data.roomName || data.roomId}`);

        // Oda üyelerine bildir
        io.to(`room_${data.roomId}`).emit('user_left', {
            roomId: data.roomId,
            user: {
                id: socket.user ? socket.user._id : null,
                name: socket.user ? socket.user.name : 'Anonim'
            }
        });
    });

    // Mesaj gönder event'i
    socket.on('send_message', (message) => {
        if (!message.roomId || !message.text) return;

        console.log(`Mesaj (${message.roomName}): ${message.text.substring(0, 50)}`);

        // Oda üyelerine mesaj gönder
        io.to(`room_${message.roomId}`).emit('receive_message', {
            roomId: message.roomId,
            text: message.text,
            sender: {
                id: message.sender.id || (socket.user ? socket.user._id : null),
                name: message.sender.name || (socket.user ? socket.user.name : 'Anonim')
            },
            timestamp: new Date()
        });
    });
});

// Hata yönetimi
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({ error: message });
});

async function connectToDatabase() {
    // prefer primary MONGODB_URI, fall back to MONGODB_URI_LOCAL (if provided) when explicitly requested
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri && process.env.MONGODB_URI_LOCAL) {
        console.warn('MONGODB_URI not set — falling back to MONGODB_URI_LOCAL for local/dev: ' + process.env.MONGODB_URI_LOCAL);
        mongoUri = process.env.MONGODB_URI_LOCAL;
    }
    if (!mongoUri) {
        console.warn('MONGODB_URI is not set. Please configure it in .env');
        return;
    }
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
        console.log('Connected to MongoDB');
    } catch (err) {
        // Helpful error hints for common DNS / Atlas SRV problems
        const msg = (err && err.message) ? err.message : String(err);
        console.error('MongoDB connection failed:', msg);
        if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
            console.error('DNS lookup failed for MongoDB host. If you are using MongoDB Atlas SRV, ensure your environment has working DNS resolution and the URI is correct.');
        }
        if (mongoUri && mongoUri.includes('mongodb.net') && !process.env.MONGODB_URI_LOCAL) {
            console.warn('You can set MONGODB_URI_LOCAL in your .env to a local MongoDB instance (mongodb://127.0.0.1:27017/your-db) to run tests without Atlas DNS.');
        }
        throw err;
    }
}

const PORT = process.env.PORT || 4000;

console.log('Starting HTTP server...');
server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on :${PORT}`));

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

if (process.env.NODE_ENV !== 'test') {
    const maxRetries = 5;
    let attempt = 0;

    const tryConnect = async() => {
        attempt += 1;
        try {
            await connectToDatabase();
        } catch (err) {
            console.error(`MongoDB connection attempt ${attempt} failed:`, err && err.message ? err.message : err);
            if (attempt < maxRetries) {
                const backoff = Math.min(5000 * attempt, 30000);
                console.log(`Retrying DB connection in ${backoff}ms...`);
                setTimeout(tryConnect, backoff);
            } else {
                console.warn('Max MongoDB connection attempts reached — continuing without DB.');
            }
        }
    };

    setImmediate(tryConnect);
}

module.exports = { app, io };
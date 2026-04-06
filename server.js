const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('MONGODB_URI from env:', process.env.MONGODB_URI);

const Room = require('./models/room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const socketAuth = require('./lib/socketAuth');
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

// Boş odaları temizle - 5 dakika kimse yoksa sil
const EMPTY_ROOM_TIMEOUT = 5 * 60 * 1000; // 5 dakika

async function cleanupEmptyRooms() {
    try {
        if (mongoose.connection.readyState !== 1) return;

        const tenMinutesAgo = new Date(Date.now() - EMPTY_ROOM_TIMEOUT);

        // Son aktivitesi 10 dakikadan eski olan ve, güncel olarak hiç üyesi olmayan odaları sil
        const result = await Room.deleteMany({
            lastActivity: { $lt: tenMinutesAgo },
            members: { $size: 0 }
        });

        if (result.deletedCount > 0) {
            console.log(`\n🧹 ${result.deletedCount} boş oda silindi (10 dakika kimse yoktu)\n`);
        }
    } catch (err) {
        console.error('Oda temizleme hatası:', err.message);
    }
}

// Her 5 dakikada bir boş odaları kontrol et ve sil
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

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

    socket.on('disconnect', async() => {
        console.log('Kullanıcı ayrıldı:', socket.id);

        // Bağlı olduğu tüm oda kanallarından kullanıcının üyeliğini temizle
        try {
            const joinedRooms = Array.from(socket.rooms).filter(roomName => roomName.startsWith('room_'));
            for (const roomName of joinedRooms) {
                const roomId = roomName.replace(/^room_/, '');
                if (mongoose.connection.readyState === 1 && socket.user) {
                    await Room.findByIdAndUpdate(
                        roomId, {
                            $pull: { members: socket.user._id || socket.user.id },
                            lastActivity: new Date()
                        }, { new: true }
                    );
                }

                io.to(roomName).emit('user_left', {
                    roomId,
                    user: {
                        id: uid,
                        name: uname
                    }
                });
            }
        } catch (err) {
            console.error('Disconnect sırasında oda üyeliği temizleme hatası:', err.message);
        }

        // Kullanıcı ayrılınca aktif kullanıcı listesini güncelle
        broadcastActiveUsers();
    });

    // Odaya katıl event'i
    socket.on('join_room', (data) => {
        if (!data.roomId) return;

        socket.join(`room_${data.roomId}`);
        console.log(`${uname} katıldı: ${data.roomName || data.roomId}`);

        // Oda aktivitesini ve üyelerini güncelle
        if (mongoose.connection.readyState === 1 && socket.user) {
            Room.findByIdAndUpdate(
                data.roomId, {
                    $addToSet: { members: socket.user._id || socket.user.id },
                    lastActivity: new Date()
                }, { new: true }
            ).catch(err => console.error('Oda bilgisi güncellenemiyor:', err.message));
        }

        // Oda üyelerine bildir
        io.to(`room_${data.roomId}`).emit('user_joined', {
            roomId: data.roomId,
            socketId: socket.id,
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

        // Oda aktivitesini ve üyelerini güncelle
        if (mongoose.connection.readyState === 1 && socket.user) {
            Room.findByIdAndUpdate(
                data.roomId, {
                    $pull: { members: socket.user._id || socket.user.id },
                    lastActivity: new Date()
                }, { new: true }
            ).then(updatedRoom => {
                const memberCount = updatedRoom && updatedRoom.members ? updatedRoom.members.length : 0;

                // Oda üyelerine bildir (memberCount ile)
                io.to(`room_${data.roomId}`).emit('user_left', {
                    roomId: data.roomId,
                    memberCount: memberCount,
                    user: {
                        id: socket.user ? socket.user._id : null,
                        name: socket.user ? socket.user.name : 'Anonim'
                    }
                });
            }).catch(err => {
                console.error('Oda bilgisi güncellenemiyor:', err.message);

                // Hata olsa bile user_left event'ini gönder
                io.to(`room_${data.roomId}`).emit('user_left', {
                    roomId: data.roomId,
                    user: {
                        id: socket.user ? socket.user._id : null,
                        name: socket.user ? socket.user.name : 'Anonim'
                    }
                });
            });
        }
    });

    // Mesaj gönder event'i
    socket.on('send_message', (message) => {
        if (!message.roomId || !message.text) return;

        console.log(`Mesaj (${message.roomName}): ${message.text.substring(0, 50)}`);

        // Oda aktivitesini güncelle
        if (mongoose.connection.readyState === 1) {
            Room.findByIdAndUpdate(message.roomId, { lastActivity: new Date() }, { new: true })
                .catch(err => console.error('Oda aktivitesi güncellenemiyor:', err.message));
        }

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

    // WebRTC sinyalizasyon event'leri
    socket.on('signal_offer', (data) => {
        if (!data || !data.targetSocketId || !data.sdp || !data.roomId) return;
        io.to(data.targetSocketId).emit('signal_offer', {
            fromSocketId: socket.id,
            roomId: data.roomId,
            userId: socket.user ? socket.user._id : null,
            userName: socket.user ? socket.user.name : 'Anonim',
            sdp: data.sdp
        });
    });

    socket.on('signal_answer', (data) => {
        if (!data || !data.targetSocketId || !data.sdp || !data.roomId) return;
        io.to(data.targetSocketId).emit('signal_answer', {
            fromSocketId: socket.id,
            roomId: data.roomId,
            sdp: data.sdp
        });
    });

    socket.on('signal_ice', (data) => {
        if (!data || !data.targetSocketId || !data.candidate || !data.roomId) return;
        io.to(data.targetSocketId).emit('signal_ice', {
            fromSocketId: socket.id,
            roomId: data.roomId,
            candidate: data.candidate
        });
    });
});

// Hata yönetimi
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({ error: message });
});

let isMongoConnected = false;

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

    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
        try {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 3000,
                connectTimeoutMS: 3000,
                socketTimeoutMS: 3000
            });
            console.log('Connected to MongoDB');
            isMongoConnected = true;
            return;
        } catch (err) {
            retries++;
            const msg = (err && err.message) ? err.message : String(err);
            console.error(`MongoDB connection attempt ${retries} failed: ${msg}`);

            if (retries >= maxRetries) {
                console.error('MongoDB connection failed after ' + maxRetries + ' attempts. Server will continue without database.');
                console.warn('Some features may not work properly without MongoDB.');
                isMongoConnected = false;
                // Don't throw - let server continue
                return;
            }

            // Wait before retrying
            const waitTime = 2000 * retries;
            console.log(`Retrying DB connection in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

const PORT = process.env.PORT || 4000;

// Connect to MongoDB before starting server
connectToDatabase().then(() => {
    console.log('Starting HTTP server...');
    server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on :${PORT}`));
}).catch((err) => {
    console.error('Failed to connect to MongoDB, starting server anyway:', err);
    console.log('Starting HTTP server...');
    server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on :${PORT}`));
});

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
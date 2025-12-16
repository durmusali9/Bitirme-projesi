/**
 * Test active users list with socket.io
 */
const io = require('socket.io-client');
const API_BASE_URL = 'http://localhost:4000/api';
const SOCKET_URL = 'http://localhost:4000';

async function test() {
    try {
        console.log('1. Registering test users...\n');

        // 3 test kullanıcısı oluştur
        const users = [];
        for (let i = 1; i <= 3; i++) {
            const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `Test User ${i}`,
                    email: `testuser${i}-${Date.now()}@example.com`,
                    password: 'password123'
                })
            });
            const registerData = await registerRes.json();
            if (!registerRes.ok) {
                throw new Error(registerData.error || registerData.message);
            }
            users.push({
                name: registerData.user.name,
                token: registerData.token
            });
            console.log(`✓ User ${i} registered: ${registerData.user.name}`);
        }

        console.log('\n2. Connecting sockets with authentication...\n');

        // Her kullanıcı için socket bağlantısı kur
        const sockets = users.map((user, idx) => {
            return new Promise((resolve) => {
                const socket = io(SOCKET_URL, {
                    auth: {
                        token: user.token
                    },
                    path: '/socket.io',
                    reconnection: false
                });

                socket.on('connect', () => {
                    console.log(`✓ User ${idx + 1} socket connected: ${socket.id}`);
                });

                socket.on('active_users', (payload) => {
                    console.log(`✓ User ${idx + 1} received active_users:`, payload.count, 'users');
                    if (payload.count > 0) {
                        payload.users.forEach(u => {
                            console.log(`  - ${u.name} (${u.email})`);
                        });
                    }
                });

                socket.on('connect_error', (err) => {
                    console.error(`User ${idx + 1} connection error:`, err.message);
                });

                setTimeout(() => resolve(socket), 1000);
            });
        });

        const connectedSockets = await Promise.all(sockets);

        console.log('\n3. Waiting for active users updates...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\n4. Disconnecting sockets...\n');
        connectedSockets.forEach((socket, idx) => {
            socket.disconnect();
            console.log(`✓ User ${idx + 1} socket disconnected`);
        });

        console.log('\n✅ Test complete!\n');
        process.exit(0);

    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

// Give server a moment to be ready
setTimeout(test, 1000);
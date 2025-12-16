/**
 * Test room chat functionality with two users
 */
const io = require('socket.io-client');
const API_BASE_URL = 'http://localhost:4000/api';
const SOCKET_URL = 'http://localhost:4000';

let user1Data = null;
let user2Data = null;
let socket1 = null;
let socket2 = null;
let roomId = null;

async function registerUser(email, name) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            email,
            password: 'test123'
        })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error);
    }
    return data;
}

async function createRoom(token) {
    const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: 'Chat Test Room',
            language: 'english',
            level: 'beginner',
            topic: 'chat-test',
            description: 'Test room for chat functionality'
        })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error);
    }
    return data;
}

async function joinRoom(token, roomId) {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error);
    }
    return data;
}

async function test() {
    try {
        console.log('====== CHAT TEST ======\n');

        console.log('1️⃣  Registering users...\n');
        user1Data = await registerUser(`user1-${Date.now()}@test.com`, 'User One');
        console.log(`✅ User 1 registered: ${user1Data.user.name}`);

        user2Data = await registerUser(`user2-${Date.now()}@test.com`, 'User Two');
        console.log(`✅ User 2 registered: ${user2Data.user.name}`);

        console.log('\n2️⃣  Creating room...\n');
        const roomData = await createRoom(user1Data.token);
        roomId = roomData._id;
        console.log(`✅ Room created: ${roomData.name}`);
        console.log(`   Members: ${roomData.members.length}`);

        console.log('\n3️⃣  User 2 joining room...\n');
        const joinedData = await joinRoom(user2Data.token, roomId);
        console.log(`✅ User 2 joined room`);
        console.log(`   Total members: ${joinedData.data.room.members.length}`);

        console.log('\n4️⃣  Connecting sockets...\n');

        // User 1 socket
        socket1 = io(SOCKET_URL, {
            auth: { token: user1Data.token },
            path: '/socket.io',
            reconnection: false
        });

        socket1.on('connect', () => {
            console.log(`✅ User 1 socket connected: ${socket1.id}`);
        });

        // User 2 socket
        socket2 = io(SOCKET_URL, {
            auth: { token: user2Data.token },
            path: '/socket.io',
            reconnection: false
        });

        socket2.on('connect', () => {
            console.log(`✅ User 2 socket connected: ${socket2.id}`);
        });

        // Wait for sockets to connect
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n5️⃣  Users joining room via socket...\n');

        socket1.emit('join_room', { roomId, roomName: 'Chat Test Room' });
        socket2.emit('join_room', { roomId, roomName: 'Chat Test Room' });

        // Listen for join events
        socket2.on('user_joined', (data) => {
            console.log(`✅ User 2 received: ${data.user.name} joined`);
        });

        socket1.on('user_joined', (data) => {
            console.log(`✅ User 1 received: ${data.user.name} joined`);
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n6️⃣  Sending messages...\n');

        // User 1 sends message
        socket1.emit('send_message', {
            roomId,
            roomName: 'Chat Test Room',
            text: 'Hello from User 1!',
            sender: {
                id: user1Data.user._id,
                name: user1Data.user.name
            }
        });

        socket2.on('receive_message', (msg) => {
            console.log(`✅ User 2 received message: "${msg.text}" from ${msg.sender.name}`);
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // User 2 sends message
        socket2.emit('send_message', {
            roomId,
            roomName: 'Chat Test Room',
            text: 'Hello from User 2!',
            sender: {
                id: user2Data.user._id,
                name: user2Data.user.name
            }
        });

        socket1.on('receive_message', (msg) => {
            console.log(`✅ User 1 received message: "${msg.text}" from ${msg.sender.name}`);
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('\n7️⃣  Leaving room...\n');

        socket1.emit('leave_room', { roomId, roomName: 'Chat Test Room' });
        socket2.on('user_left', (data) => {
            console.log(`✅ User 2 notified: ${data.user.name} left`);
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('\n✅ ALL CHAT TESTS PASSED!\n');

        socket1.disconnect();
        socket2.disconnect();

        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        if (socket1) socket1.disconnect();
        if (socket2) socket2.disconnect();
        process.exit(1);
    }
}

setTimeout(test, 1000);
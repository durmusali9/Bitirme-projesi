/**
 * Test room creation and rendering
 */
const API_BASE_URL = 'http://localhost:4000/api';

async function test() {
    try {
        console.log('1. Testing GET /api/rooms...\n');
        const roomsRes = await fetch(`${API_BASE_URL}/rooms`);
        const roomsData = await roomsRes.json();
        console.log('✓ Rooms fetched:', roomsData.results, 'rooms');
        console.log(roomsData.data.rooms.map(r => ({
            name: r.name,
            language: r.language,
            level: r.level,
            description: r.description
        })));

        console.log('\n2. Testing user registration...\n');
        const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: `test${Date.now()}@example.com`,
                password: 'password123'
            })
        });
        const registerData = await registerRes.json();
        if (!registerRes.ok) {
            throw new Error(registerData.error || registerData.message);
        }
        console.log('✓ User registered:', registerData.user.name);
        console.log('  Token:', registerData.token.substring(0, 20) + '...');

        const token = registerData.token;

        console.log('\n3. Testing room creation...\n');
        const newRoomRes = await fetch(`${API_BASE_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: 'Almanca Senaryo Pratiği',
                language: 'german',
                level: 'intermediate',
                topic: 'scenario',
                description: 'Gerçek hayat senaryolarında Almanca konuşma pratiği yapıyoruz. Restoran, otel, dükkân gibi ortamlarda gerekli diyalogları öğreniyoruz.'
            })
        });
        const newRoomData = await newRoomRes.json();
        if (!newRoomRes.ok) {
            throw new Error(newRoomData.error || JSON.stringify(newRoomData));
        }
        console.log('✓ Room created successfully:');
        console.log('  Name:', newRoomData.name);
        console.log('  Language:', newRoomData.language);
        console.log('  Level:', newRoomData.level);
        console.log('  Description:', newRoomData.description);
        console.log('  ID:', newRoomData._id);

        console.log('\n4. Verifying room appears in list...\n');
        const verifyRes = await fetch(`${API_BASE_URL}/rooms`);
        const verifyData = await verifyRes.json();
        console.log('✓ Total rooms now:', verifyData.results);
        const createdRoom = verifyData.data.rooms.find(r => r._id === newRoomData._id);
        if (createdRoom) {
            console.log('✓ New room found in list!');
            console.log('  Name:', createdRoom.name);
            console.log('  Members:', createdRoom.members.length);
        } else {
            console.log('✗ New room not found in list');
        }

        console.log('\n5. Testing joining the room...\n');
        const joinRes = await fetch(`${API_BASE_URL}/rooms/${newRoomData._id}/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const joinData = await joinRes.json();
        if (!joinRes.ok) {
            throw new Error(joinData.error || JSON.stringify(joinData));
        }
        console.log('✓ Joined room successfully');
        console.log('  Total members now:', joinData.data.room.members.length);

        console.log('\n✅ All tests passed!\n');

    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

test();
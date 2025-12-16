/**
 * Integration test: Rooms + Active Users
 */
const API_BASE_URL = 'http://localhost:4000/api';

async function integrationTest() {
    try {
        console.log('====== INTEGRATION TEST ======\n');

        console.log('1️⃣  Testing Rooms API...\n');
        const roomsRes = await fetch(`${API_BASE_URL}/rooms`);
        const roomsData = await roomsRes.json();
        console.log(`✅ GET /api/rooms: ${roomsData.results} rooms`);
        roomsData.data.rooms.slice(0, 3).forEach(r => {
            console.log(`   - ${r.name} (${r.language}, ${r.level})`);
        });

        console.log('\n2️⃣  Testing User Registration...\n');
        const email = `test${Date.now()}@example.com`;
        const regRes = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Integration Test User',
                email: email,
                password: 'password123'
            })
        });
        const regData = await regRes.json();
        if (!regRes.ok) {
            throw new Error(regData.error);
        }
        console.log(`✅ User registered: ${regData.user.name}`);
        console.log(`   Email: ${regData.user.email}`);
        console.log(`   Token: ${regData.token.substring(0, 30)}...`);

        const token = regData.token;

        console.log('\n3️⃣  Testing Room Creation...\n');
        const newRoomRes = await fetch(`${API_BASE_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: 'Integration Test Room',
                language: 'german',
                level: 'intermediate',
                topic: 'integration-test',
                description: 'This is a test room created by integration test'
            })
        });
        const newRoomData = await newRoomRes.json();
        if (!newRoomRes.ok) {
            throw new Error(newRoomData.error);
        }
        console.log(`✅ Room created: ${newRoomData.name}`);
        console.log(`   Language: ${newRoomData.language}`);
        console.log(`   Level: ${newRoomData.level}`);
        console.log(`   ID: ${newRoomData._id}`);

        console.log('\n4️⃣  Verifying Room in List...\n');
        const verifyRes = await fetch(`${API_BASE_URL}/rooms`);
        const verifyData = await verifyRes.json();
        const createdRoom = verifyData.data.rooms.find(r => r._id === newRoomData._id);
        if (createdRoom) {
            console.log(`✅ Room found in list: ${createdRoom.name}`);
            console.log(`   Members: ${createdRoom.members.length}`);
            console.log(`   Description: ${createdRoom.description}`);
        } else {
            console.error('❌ Room not found in list!');
        }

        console.log('\n5️⃣  Testing Join Room...\n');
        const joinRes = await fetch(`${API_BASE_URL}/rooms/${newRoomData._id}/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const joinData = await joinRes.json();
        if (!joinRes.ok) {
            throw new Error(joinData.error);
        }
        console.log(`✅ Joined room successfully`);
        console.log(`   Members now: ${joinData.data.room.members.length}`);

        console.log('\n✅ ALL TESTS PASSED!\n');

    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }
}

integrationTest();
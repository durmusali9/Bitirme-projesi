require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/user');

(async() => {
    try {
        const uri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('✓ Connected');

        // Tüm rooms'u sil
        console.log('\nDeleting all rooms...');
        const roomResult = await Room.deleteMany({});
        console.log(`✓ Deleted ${roomResult.deletedCount} rooms`);

        // Tüm users'ı sil
        console.log('\nDeleting all users...');
        const userResult = await User.deleteMany({});
        console.log(`✓ Deleted ${userResult.deletedCount} users`);

        // Yeni admin user oluştur
        console.log('\nCreating admin user...');
        const adminUser = new User({
            name: 'Admin',
            email: 'admin@langtalk.com',
            password: 'password123'
        });
        const savedAdmin = await adminUser.save();
        console.log(`✓ Created admin user: ${savedAdmin._id}`);

        console.log('\n✓ Clean complete!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('✗ ERROR:', err && err.message ? err.message : err);
        process.exit(1);
    }
})();
/**
 * Clean reset: Drop all users and recreate indexes, add example rooms
 */
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

        const db = mongoose.connection.db;
        const users = db.collection('users');

        // Drop all indexes on users collection (except _id)
        console.log('\nDropping indexes...');
        try {
            const indexes = await users.indexes();
            for (const idx of indexes) {
                if (idx.name !== '_id_') {
                    await users.dropIndex(idx.name);
                    console.log(`  ✓ Dropped ${idx.name}`);
                }
            }
        } catch (e) {
            console.log('  (No indexes to drop or error:', e.message, ')');
        }

        // Delete all documents
        console.log('\nDeleting all users...');
        const deleteResult = await users.deleteMany({});
        console.log(`  ✓ Deleted ${deleteResult.deletedCount} documents`);

        // Recreate index with sparse flag
        console.log('\nRecreating email index...');
        await users.createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('  ✓ Created unique sparse index on email');

        // Create example user for rooms
        console.log('\nCreating example user for rooms...');
        const adminUser = new User({
            name: 'Admin',
            email: 'admin@langtalk.com',
            password: 'password123'
        });
        const savedAdmin = await adminUser.save();
        console.log(`  ✓ Created admin user: ${savedAdmin._id}`);

        // Delete all rooms
        console.log('\nDeleting all rooms...');
        const roomDeleteResult = await Room.deleteMany({});
        console.log(`  ✓ Deleted ${roomDeleteResult.deletedCount} rooms`);

        // Show final state
        console.log('\nFinal state:');
        const count = await users.countDocuments();
        console.log(`  Total users: ${count}`);
        const roomCount = await Room.countDocuments();
        console.log(`  Total rooms: ${roomCount}`);
        const finalIndexes = await users.indexes();
        console.log(`  User indexes: ${JSON.stringify(finalIndexes.map(i => i.name))}`);

        console.log('\n✓ Clean reset complete!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('✗ ERROR:', err && err.message ? err.message : err);
        process.exit(1);
    }
})();
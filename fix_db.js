/**
 * Fix DB script: Clean duplicate emails and recreate proper index
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

async function fixDatabase() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('MONGODB_URI not set in .env');
            process.exit(1);
        }
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('✓ Connected');

        const db = mongoose.connection.db;
        const users = db.collection('users');

        // Step 1: List current indexes
        console.log('\n--- Step 1: Current indexes ---');
        const currentIndexes = await users.indexes();
        console.log(JSON.stringify(currentIndexes, null, 2));

        // Step 2: Remove email index if exists
        console.log('\n--- Step 2: Dropping old email indexes ---');
        try {
            await users.dropIndex('email_1');
            console.log('✓ Dropped email_1');
        } catch (e) {
            console.log('  (email_1 not found, skip)');
        }

        // Step 3: Remove any documents with null or empty email
        console.log('\n--- Step 3: Removing invalid documents (null/empty email) ---');
        const deleteResult = await users.deleteMany({ $or: [{ email: null }, { email: '' }, { email: { $exists: false } }] });
        console.log(`✓ Deleted ${deleteResult.deletedCount} invalid documents`);

        // Step 4: List all current documents
        console.log('\n--- Step 4: Remaining documents ---');
        const allUsers = await users.find({}).toArray();
        console.log(`Total users: ${allUsers.length}`);
        allUsers.forEach((u, i) => {
            console.log(`  ${i + 1}. ${u.email} (id: ${u._id})`);
        });

        // Step 5: Check for duplicate emails
        console.log('\n--- Step 5: Checking for duplicate emails ---');
        const emailCounts = await users.aggregate([
            { $group: { _id: '$email', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();
        if (emailCounts.length > 0) {
            console.log(`⚠ Found ${emailCounts.length} duplicate emails:`);
            emailCounts.forEach(dup => console.log(`  ${dup._id}: ${dup.count} documents`));
            // Remove duplicates: keep first, delete rest
            for (const dup of emailCounts) {
                const docs = await users.find({ email: dup._id }).sort({ _id: 1 }).toArray();
                const keep = docs[0];
                const remove = docs.slice(1).map(d => d._id);
                console.log(`    Keeping ${keep._id}, removing ${remove.length} duplicates`);
                if (remove.length > 0) {
                    await users.deleteMany({ _id: { $in: remove } });
                }
            }
        } else {
            console.log('✓ No duplicate emails found');
        }

        // Step 6: Create proper unique sparse index
        console.log('\n--- Step 6: Creating proper email index ---');
        await users.createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('✓ Created unique sparse email index');

        // Step 7: Final check
        console.log('\n--- Step 7: Final indexes ---');
        const finalIndexes = await users.indexes();
        console.log(JSON.stringify(finalIndexes, null, 2));

        console.log('\n✓ Database fix complete!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err && err.stack ? err.stack : err);
        process.exit(1);
    }
}

fixDatabase();
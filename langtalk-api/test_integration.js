/**
 * All-in-one test: Fix DB, start server, test registration
 */
const { spawn } = require('child_process');
const fs = require('fs');
require('dotenv').config();
const mongoose = require('mongoose');

async function runSequentially() {
    try {
        // Step 1: Fix DB
        console.log('\n=== STEP 1: FIX DATABASE ===\n');
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        const users = db.collection('users');

        // Remove invalid emails
        const delResult = await users.deleteMany({ $or: [{ email: null }, { email: '' }, { email: { $exists: false } }] });
        console.log(`Removed ${delResult.deletedCount} invalid records`);

        // Drop old email index
        try {
            await users.dropIndex('email_1');
            console.log('Dropped email_1 index');
        } catch (e) { console.log('(no email_1 to drop)'); }

        // Create proper index
        await users.createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('Created unique sparse email index');

        const count = await users.countDocuments();
        console.log(`Database now has ${count} users`);
        await mongoose.disconnect();

        // Step 2: Test registration
        console.log('\n=== STEP 2: TEST REGISTRATION ===\n');
        const ts = Date.now();
        const testEmail = `test-${ts}@integration.test`;
        const payload = {
            name: `Test User ${ts}`,
            email: testEmail,
            password: 'Password123!',
            confirmPassword: 'Password123!',
            languages: ['english']
        };

        // Wait a bit for server to be ready
        await new Promise(r => setTimeout(r, 500));

        const response = await fetch('http://localhost:4000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch (e) { body = { raw: text }; }

        console.log(`HTTP ${response.status}:`);
        console.log(JSON.stringify(body, null, 2));

        if (response.status === 201 && body.status === 'success') {
            console.log('\n✓ REGISTRATION SUCCESSFUL!');
            console.log(`  Token issued: ${body.token ? body.token.substring(0, 30) + '...' : 'N/A'}`);
            console.log(`  User: ${body.data?.user?.email}`);
        } else {
            console.log('\n✗ REGISTRATION FAILED');
            if (body.error) console.log(`  Error: ${body.error.en || body.error}`);
            if (body.keyValue) console.log(`  Duplicate key: ${JSON.stringify(body.keyValue)}`);
        }

        process.exit(response.status === 201 ? 0 : 1);
    } catch (err) {
        console.error('ERROR:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

// Give server time to start if not already running
setTimeout(runSequentially, 1000);
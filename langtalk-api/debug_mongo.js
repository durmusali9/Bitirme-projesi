const fs = require('fs');
const path = require('path');
(async function() {
    try {
        const dotenv = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        const m = dotenv.match(/MONGODB_URI=(.+)/);
        if (!m) {
            console.error('MONGODB_URI not found in .env');
            process.exit(2);
        }
        const uri = m[1].trim();
        const mongoose = require('mongoose');
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB');
        const db = mongoose.connection.db;
        const users = db.collection('users');
        const idx = await users.indexes();
        console.log('USERS_INDEXES:');
        console.log(JSON.stringify(idx, null, 2));
        const count = await users.countDocuments();
        console.log('USERS_COUNT:', count);
        const sample = await users.findOne({});
        console.log('SAMPLE_USER:');
        console.log(JSON.stringify(sample, null, 2));
        await mongoose.disconnect();
        process.exit(0);
    } catch (e) {
        console.error('ERROR', e && e.stack ? e.stack : e);
        process.exit(1);
    }
})();
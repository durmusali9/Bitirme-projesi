require('dotenv').config();
let fetch;
try {
    fetch = globalThis.fetch;
} catch (e) {
    try {
        fetch = require('node-fetch');
    } catch (e2) {
        console.error('fetch not available; try: npm install node-fetch');
        process.exit(1);
    }
}
(async function() {
    try {
        const API = (process.env.API_BASE || 'http://localhost:4000').replace(/\/$/, '') + '/api';
        const secret = process.env.ADMIN_SECRET;
        if (!secret) {
            console.error('ADMIN_SECRET not set in .env');
            process.exit(2);
        }

        console.log('=== Temp Password Feature Test ===\n');

        console.log('1) Admin login...');
        const loginRes = await fetch(API + '/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }) });
        const setCookie = loginRes.headers.get('set-cookie') || '';
        const cookie = setCookie ? setCookie.split(';')[0] : `admin_auth=${encodeURIComponent(secret)}`;
        console.log('  ✓ Admin logged in');

        console.log('\n2) Create test user...');
        const ts = Date.now();
        const email = `temp-pwd-test-${ts}@example.test`;
        const regRes = await fetch(API + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'TempPwd Test ' + ts,
                email,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                languages: ['english']
            })
        });
        const regJson = await regRes.json();
        const userId = regJson.data && regJson.data.user && regJson.data.user._id;
        console.log('  ✓ Test user created:', userId);

        console.log('\n3) Generate temporary password...');
        const genRes = await fetch(API + '/admin/users/' + userId + '/generate-temp-password', {
            method: 'POST',
            headers: { 'cookie': cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const genText = await genRes.text();
        let genJson = null;
        try { genJson = JSON.parse(genText); } catch (e) { genJson = { raw: genText }; }
        console.log('  Status:', genRes.status);
        console.log('  Response:', genJson);

        if (!genJson.tempPassword) {
            console.error('  ✗ No temp password in response!');
            process.exit(1);
        }
        const tempPassword = genJson.tempPassword;
        console.log('  ✓ Temp password generated (format: ' + tempPassword.substring(0, 3) + '...)');

        console.log('\n4) Test login with new temp password...');
        const loginNewRes = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: tempPassword })
        });
        const loginNewJson = await loginNewRes.json();
        console.log('  Status:', loginNewRes.status);
        if (loginNewRes.status === 200 && loginNewJson.token) {
            console.log('  ✓ Login successful with temp password!');
        } else {
            console.log('  Response:', loginNewJson);
            console.error('  ✗ Failed to login with temp password');
            process.exit(1);
        }

        console.log('\n5) Clean up: delete test user...');
        const delRes = await fetch(API + '/admin/users/' + userId, { method: 'DELETE', headers: { 'cookie': cookie } });
        console.log('  ✓ Test user deleted');

        console.log('\n✅ Temp password feature test PASSED');
        process.exit(0);
    } catch (err) {
        console.error('ERROR in test flow:', err && err.stack ? err.stack : err);
        process.exit(1);
    }
})();
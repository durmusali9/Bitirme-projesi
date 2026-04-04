require('dotenv').config();
const fetch = globalThis.fetch || require('node-fetch');
(async function() {
    try {
        const API = (process.env.API_BASE || 'http://localhost:4000').replace(/\/$/, '') + '/api';
        const secret = process.env.ADMIN_SECRET;
        if (!secret) {
            console.error('ADMIN_SECRET not set in .env');
            process.exit(2);
        }

        console.log('1) Ensure server health...');
        try {
            const h = await fetch(API.replace(/\/api$/, '') + '/api/health');
            console.log('  health status', h.status);
        } catch (e) { console.error('  health check failed:', e.message); }

        console.log('\n2) Login as admin (POST /api/admin/login)');
        const loginRes = await fetch(API + '/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }) });
        const loginText = await loginRes.text();
        let loginJson = null;
        try { loginJson = JSON.parse(loginText); } catch (e) { loginJson = { raw: loginText }; }
        console.log('  login status', loginRes.status, loginJson);
        const setCookie = loginRes.headers.get('set-cookie') || '';
        const cookie = setCookie ? setCookie.split(';')[0] : `admin_auth=${encodeURIComponent(secret)}`;
        console.log('  using cookie:', cookie);

        console.log('\n3) Create a test user via /api/auth/register');
        const ts = Date.now();
        const email = `admin-test-${ts}@example.test`;
        const regPayload = { name: 'Admin Test ' + ts, email, password: 'Password123!', confirmPassword: 'Password123!', languages: ['english'] };
        const regRes = await fetch(API + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(regPayload) });
        const regText = await regRes.text();
        let regJson = null;
        try { regJson = JSON.parse(regText); } catch (e) { regJson = { raw: regText }; }
        console.log('  register status', regRes.status, regJson);

        console.log('\n4) List users via /api/admin/users');
        const usersRes = await fetch(API + '/admin/users', { headers: { 'cookie': cookie } });
        const usersJson = await usersRes.json();
        console.log('  users status', usersRes.status, usersJson && usersJson.results, 'users');

        // find our test user
        const users = (usersJson && usersJson.data && usersJson.data.users) || [];
        const mine = users.find(u => u.email === email);
        if (!mine) {
            console.warn('  Test user not found in users list; printing first 5 users:');
            console.log(users.slice(0, 5));
        } else { console.log('  Found test user id:', mine._id); }

        if (mine) {
            console.log('\n5) Delete test user via /api/admin/users/:id');
            const delRes = await fetch(API + '/admin/users/' + mine._id, { method: 'DELETE', headers: { 'cookie': cookie } });
            console.log('  delete status', delRes.status, await delRes.text());
        }

        console.log('\n6) Logout admin (POST /api/admin/logout)');
        const lo = await fetch(API + '/admin/logout', { method: 'POST', headers: { 'cookie': cookie } });
        console.log('  logout status', lo.status, await lo.text());

        console.log('\n✅ Admin flow test finished.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR in test flow:', err && err.stack ? err.stack : err);
        process.exit(1);
    }
})();
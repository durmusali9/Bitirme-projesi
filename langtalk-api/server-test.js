process.env.NODE_ENV = 'test';

const http = require('http');
const { app } = require('./server');

const server = app.listen(0, async() => {
    const port = server.address().port;
    const options = {
        host: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json && json.status === 'ok') {
                    console.log('health OK');
                    // verify rooms and users endpoints (they may return 503 when DB disconnected, which is acceptable)
                    const check = (path, cb) => {
                        const opts = { host: '127.0.0.1', port, path, method: 'GET' };
                        const r = http.request(opts, (s) => {
                            let d = '';
                            s.on('data', (chunk) => (d += chunk));
                            s.on('end', () => cb(null, s.statusCode, d));
                        });
                        r.on('error', (e) => cb(e));
                        r.end();
                    };

                    check('/api/rooms', (err, code) => {
                        if (err) return process.exit(5);
                        // Accept 200 OK or 503 Service Unavailable (if DB unreachable)
                        if (![200, 503].includes(code)) return process.exit(6);
                        check('/api/users', (err2, code2) => {
                            if (err2) return process.exit(7);
                            if (![200, 503].includes(code2)) return process.exit(8);
                            // Now test auth register/login flows (if DB available)
                            const randomEmail = `test+${Date.now()}@example.com`;
                            const creds = { name: 'Test User', email: randomEmail, password: 'TestPass123', confirmPassword: 'TestPass123', languages: ['en'] };

                            const postJson = (path, body, cb) => {
                                const opts = { host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json' } };
                                const r = http.request(opts, (s) => {
                                    let d = '';
                                    s.on('data', (chunk) => (d += chunk));
                                    s.on('end', () => cb(null, s.statusCode, d));
                                });
                                r.on('error', (e) => cb(e));
                                r.write(JSON.stringify(body));
                                r.end();
                            };

                            // Try register
                            postJson('/api/auth/register', creds, (err3, code3, body3) => {
                                if (err3) return process.exit(9);

                                // If DB unreachable, service may return 503 or 500 due to buffering/timeouts — skip auth checks
                                const body3lc = String(body3 || '').toLowerCase();
                                if (code3 === 503 || (code3 === 500 && (body3lc.includes('buffering') || body3lc.includes('connection')))) {
                                    console.log('auth endpoints skipped (DB unavailable)');
                                    process.exit(0);
                                }

                                if (code3 !== 201 && code3 !== 400 && code3 !== 409) {
                                    console.error('/api/auth/register returned unexpected status', code3, body3);
                                    return process.exit(10);
                                }

                                // If registration succeeded (201) or user already exists (400/409), try login
                                postJson('/api/auth/login', { email: creds.email, password: creds.password }, (err4, code4, body4) => {
                                    if (err4) return process.exit(11);
                                    if (code4 !== 200) {
                                        console.error('/api/auth/login returned unexpected status', code4, body4);
                                        return process.exit(12);
                                    }

                                    let json4;
                                    try {
                                        json4 = JSON.parse(body4);
                                    } catch (e) {
                                        console.error('login returned non-json', body4);
                                        return process.exit(13);
                                    }

                                    const token = json4 && (json4.token || (json4.data && json4.data.token));
                                    if (!token) {
                                        console.error('login response missing token', body4);
                                        return process.exit(14);
                                    }

                                    // check /api/auth/me with the returned token
                                    const optsMe = { host: '127.0.0.1', port, path: '/api/auth/me', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } };
                                    const rme = http.request(optsMe, (sme) => {
                                        let dme = '';
                                        sme.on('data', (chunk) => (dme += chunk));
                                        sme.on('end', () => {
                                            if (sme.statusCode !== 200) {
                                                console.error('/api/auth/me returned unexpected status', sme.statusCode, dme);
                                                return process.exit(15);
                                            }

                                            try {
                                                const parsed = JSON.parse(dme);
                                                if (parsed && parsed.status === 'success' && parsed.data && parsed.data.user) {
                                                    console.log('auth OK');
                                                    return process.exit(0);
                                                }
                                                console.error('/api/auth/me returned unexpected body', dme);
                                                return process.exit(16);
                                            } catch (e) {
                                                console.error('/api/auth/me returned non-json', dme);
                                                return process.exit(17);
                                            }
                                        });
                                    });
                                    rme.on('error', (e) => {
                                        console.error('request to /api/auth/me failed', e && e.message ? e.message : e);
                                        return process.exit(18);
                                    });
                                    rme.end();
                                });
                            });
                        });
                    });
                    return;
                }
                console.error('Unexpected health body:', data);
                process.exit(2);
            } catch (err) {
                console.error('Health endpoint returned non-json:', data);
                process.exit(3);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Request failed:', err && err.message ? err.message : err);
        process.exit(4);
    });

    req.end();
});
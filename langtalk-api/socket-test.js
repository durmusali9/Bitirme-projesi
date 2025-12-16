process.env.NODE_ENV = 'test';

const http = require('http');
const { app } = require('./server');
const { Server: IOServer } = require('socket.io');
const ioClient = require('socket.io-client');

const server = app.listen(0, async() => {
    const port = server.address().port;
    console.log('Socket test server listening on port', port);

    // attach a socket.io server to the ephemeral server and reuse socketAuth
    const io = new IOServer(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    io.use(require('./lib/socketAuth'));
    io.on('connection', (s) => {
        s.emit('welcome', { message: 'connected', user: s.user ? { id: s.user._id, name: s.user.name, email: s.user.email } : null });
    });

    // HTTP helpers
    const doRequest = (opts, body, cb) => {
        const r = http.request(opts, (res) => {
            let d = '';
            res.on('data', (c) => d += c);
            res.on('end', () => cb(null, res.statusCode, d));
        });
        r.on('error', cb);
        if (body) {
            r.write(JSON.stringify(body));
        }
        r.end();
    };

    const randomEmail = `socket-test+${Date.now()}@example.com`;
    const creds = { name: 'Socket Tester', email: randomEmail, password: 'TestPass123', confirmPassword: 'TestPass123', languages: ['english'] };

    // register
    const registerOpts = { host: '127.0.0.1', port, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } };
    doRequest(registerOpts, creds, (err, code, body) => {
        if (err) {
            console.error('Register request failed:', err && err.message ? err.message : err);
            process.exit(1);
        }

        const bodylc = String(body || '').toLowerCase();
        if (code === 503 || (code === 500 && (bodylc.includes('buffering') || bodylc.includes('connection')))) {
            console.log('DB not available — skipping socket auth test');
            process.exit(0);
        }

        if (![201, 400, 409].includes(code)) {
            console.error('Unexpected status from register:', code, body);
            return process.exit(2);
        }

        // login
        const loginOpts = { host: '127.0.0.1', port, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } };
        doRequest(loginOpts, { email: creds.email, password: creds.password }, (err2, code2, body2) => {
            if (err2) {
                console.error('Login request failed:', err2 && err2.message ? err2.message : err2);
                return process.exit(3);
            }

            if (code2 !== 200) {
                console.error('Unexpected login status:', code2, body2);
                return process.exit(4);
            }

            let parsed;
            try { parsed = JSON.parse(body2); } catch (e) { console.error('Login response not JSON', body2); return process.exit(5); }
            const token = parsed && (parsed.token || (parsed.data && parsed.data.token));
            if (!token) { console.error('Login response missing token', body2); return process.exit(6); }

            // connect socket.io-client with token
            const client = ioClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'] });

            let gotWelcome = false;
            const timeout = setTimeout(() => {
                if (!gotWelcome) {
                    console.error('Socket did not receive welcome in time');
                    client.disconnect();
                    return process.exit(7);
                }
            }, 8000);

            client.on('connect_error', (err) => {
                console.error('Socket connect_error:', err && err.message ? err.message : err);
                clearTimeout(timeout);
                client.disconnect();
                return process.exit(8);
            });

            client.on('welcome', (payload) => {
                gotWelcome = true;
                clearTimeout(timeout);
                console.log('Socket welcome payload:', payload);
                if (payload && payload.user && payload.user.email === creds.email) {
                    console.log('socket auth OK');
                    client.disconnect();
                    return process.exit(0);
                }
                client.disconnect();
                return process.exit(9);
            });
        });
    });
});
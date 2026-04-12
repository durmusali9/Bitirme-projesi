process.env.NODE_ENV = 'test';

const http = require('http');
const { app } = require('../server');
const { chromium } = require('playwright');

const server = app.listen(0, async() => {
    const port = server.address().port;
    console.log('E2E test server listening on port', port);

    const check = (path, method = 'GET', body = null) => new Promise((resolve, reject) => {
        const opts = { host: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json' } };
        const req = http.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ code: res.statusCode, body: d }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });

    // quick register via API to ensure DB exists
    const email = `e2e-${Date.now()}@example.com`;
    const creds = { name: 'E2E Tester', email, password: 'E2Epass123', confirmPassword: 'E2Epass123', languages: ['english'] };

    try {
        const reg = await check('/api/auth/register', 'POST', creds);
        const bodyLc = String(reg.body || '').toLowerCase();
        if (reg.code === 503 || (reg.code === 500 && (bodyLc.includes('buffering') || bodyLc.includes('connection')))) {
            console.log('DB not available — skipping E2E auth test');
            process.exit(0);
        }

        if (![201, 400, 409].includes(reg.code)) {
            console.error('Unexpected register status', reg.code, reg.body);
            return process.exit(2);
        }
    } catch (err) {
        console.error('API register failed', err && err.message ? err.message : err);
        return process.exit(3);
    }

    // Start Playwright to test the UI flows against this server
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${port}`);

        // open register modal
        await page.click('#registerBtn');
        await page.waitForSelector('#registerForm');

        await page.fill('#registerName', 'E2E Tester');
        await page.fill('#registerEmail', email);
        await page.fill('#registerPassword', 'E2Epass123');
        await page.fill('#registerConfirmPassword', 'E2Epass123');

        await page.click('#registerForm button[type="submit"]');

        // wait a bit for the UI to react and store token
        await page.waitForTimeout(1500);

        const token = await page.evaluate(() => localStorage.getItem('token'));
        if (!token) {
            console.error('UI did not store token in localStorage');
            await browser.close();
            return process.exit(4);
        }

        console.log('E2E UI register/login stored token — OK');
        await browser.close();
        process.exit(0);
    } catch (err) {
        console.error('Playwright test failed', err && err.message ? err.message : err);
        if (browser) await browser.close();
        return process.exit(5);
    }
});
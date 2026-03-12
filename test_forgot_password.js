#!/usr/bin/env node

const http = require('http');

async function testForgotPassword() {
    console.log('🧪 Testing forgot password endpoint...\n');

    const postData = JSON.stringify({
        email: 'dillidurmusali6@gmail.com'
    });

    const options = {
        hostname: 'localhost',
        port: 4000,
        path: '/api/auth/forgot-password',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('✅ Response Status:', res.statusCode);
            try {
                const json = JSON.parse(data);
                console.log('📝 Response:');
                console.log(JSON.stringify(json, null, 2));
                console.log('\n✨ Test completed!');
            } catch (e) {
                console.log('📝 Response (raw):', data);
            }
        });
    });

    req.on('error', (err) => {
        console.error('❌ Error:', err.message);
    });

    console.log('📧 Sending request to POST /api/auth/forgot-password');
    console.log('Email: dillidurmusali6@gmail.com\n');

    req.write(postData);
    req.end();
}

testForgotPassword();
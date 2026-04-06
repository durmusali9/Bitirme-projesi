#!/usr/bin/env node

const http = require('http');

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

    console.log('\n📧 Testing Forgot Password Endpoint\n');
    console.log('✅ Response Status:', res.statusCode);
    console.log('Headers:', res.headers);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('\n📝 Response Data:');
            console.log(JSON.stringify(json, null, 2));

            if (res.statusCode === 200) {
                console.log('\n✨ Success! Password reset email request processed.');
                console.log('📧 Check server logs for test email preview URL');
            }
        } catch (e) {
            console.log('\n📝 Response (raw):');
            console.log(data);
        }
    });
});

req.on('error', (err) => {
    console.error('\n❌ Connection Error:', err.message);
    process.exit(1);
});

console.log('Sending request...');
req.write(postData);
req.end();
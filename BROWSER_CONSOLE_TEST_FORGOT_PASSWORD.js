// Test by pasting in browser console and running

// First, register a test user
async function registerTestUser() {
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'testuser123',
            email: 'test@example.com',
            password: 'Test@1234'
        })
    });
    const data = await res.json();
    console.log('Register response:', data);
    return data;
}

// Test forgot password
async function testForgotPassword() {
    const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'test@example.com'
        })
    });
    const data = await res.json();
    console.log('Forgot password response:', data);
    return data;
}

// Usage:
// 1. registerTestUser().then(() => testForgotPassword())
// 2. Or just testForgotPassword() if user exists
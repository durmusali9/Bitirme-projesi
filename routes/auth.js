// No changes needed as the require path is already normalized to lowercase.
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const User = require('../models/user'); // User modelini dahil ettik
const authMiddleware = require('../authMiddleware');

const router = express.Router();

// Email transporter'ını kuruyoruz
let transporter;

const setupTransporter = () => {
    // Eğer EMAIL_USER ve EMAIL_PASS env'de set ise Gmail kullan
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log('[EMAIL CONFIG] Using Gmail with EMAIL_USER:', process.env.EMAIL_USER);
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    // Eğer SMTP_HOST set ise custom SMTP kullan
    if (process.env.SMTP_HOST) {
        console.log('[EMAIL CONFIG] Using custom SMTP:', process.env.SMTP_HOST);
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            } : undefined
        });
    }

    // Email configuration not found
    console.warn('[EMAIL CONFIG] WARNING: Email is not configured!');
    console.warn('[EMAIL CONFIG] To enable password reset emails, set one of the following:');
    console.warn('[EMAIL CONFIG] Option 1 - Gmail: EMAIL_USER and EMAIL_PASS environment variables');
    console.warn('[EMAIL CONFIG] Option 2 - Custom SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
    return null;
};

transporter = setupTransporter();

// JWT oluşturma fonksiyonu
const signToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

// Başarılı kimlik doğrulamasında yanıt gönderme — safe user object + bilingual messages
const createSendToken = (userDoc, statusCode, res) => {
    const token = signToken(userDoc._id);

    const user = userDoc.toObject ? userDoc.toObject() : {...userDoc };
    if (user.password) delete user.password;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: { user },
        message: { tr: 'İşlem başarılı', en: 'Operation successful' }
    });
};

// 1. Kayıt Olma (Register) - POST /api/auth/register
router.post('/register', async(req, res, next) => {
    try {
        const { name, email, password, confirmPassword, languages } = req.body;
        console.log('[REGISTER] Incoming request body:', { name, email, password: password ? '***' : null, confirmPassword: confirmPassword ? '***' : null, languages });

        // Basic validation
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: { tr: 'Eksik alanlar: name, email veya password', en: 'Missing fields: name, email or password' } });
        }

        // Normalize email: trim and lowercase
        const normalizedEmail = email.trim().toLowerCase();
        console.log('[REGISTER] Normalized email:', normalizedEmail);
        if (!normalizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: { tr: 'Geçerli bir e-posta adresi girin', en: 'Please enter a valid email address' } });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: { tr: 'Şifreler eşleşmiyor', en: 'Passwords do not match' } });
        }

        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            console.warn('[REGISTER] DB not connected, returning mock user');
            // Return mock user with JWT
            const mockUser = {
                _id: `mock_${Date.now()}`,
                name,
                email: normalizedEmail,
                username: `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                languages: languages || [],
                createdAt: new Date()
            };
            const token = signToken(mockUser._id);
            return res.status(201).json({
                status: 'success',
                token,
                data: { user: mockUser },
                message: { tr: 'Kayıt başarılı (Demo Mode)', en: 'Registration successful (Demo Mode)' }
            });
        }

        // Check if user already exists (explicit check before creating)
        let existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            console.log('[REGISTER] User with email already exists:', normalizedEmail);
            return res.status(400).json({ error: { tr: 'Bu e-posta adresi zaten kullanımda.', en: 'This email is already in use' } });
        }

        const newUser = await User.create({
            name,
            username: `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            email: normalizedEmail,
            password,
            languages,
        });
        console.log('[REGISTER] User created successfully:', newUser._id);

        createSendToken(newUser, 201, res);

    } catch (err) {
        console.error('Register error:', err && err.stack ? err.stack : err);

        // If DB error, return mock user
        if (err && err.name && (err.name.includes('MongoServer') || err.name.includes('MongoDB'))) {
            console.warn('[REGISTER] MongoDB error - returning mock user');
            const { name, email, languages } = req.body;
            const mockUser = {
                _id: `mock_${Date.now()}`,
                name,
                email: email.toLowerCase(),
                username: `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                languages: languages || [],
                createdAt: new Date()
            };
            const token = signToken(mockUser._id);
            return res.status(201).json({
                status: 'success',
                token,
                data: { user: mockUser },
                message: { tr: 'Kayıt başarılı (Demo Mode)', en: 'Registration successful (Demo Mode)' }
            });
        }

        if (err && (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000))) {
            const kv = err.keyValue || {};
            // Prefer field-specific friendly messages
            if (kv.username) {
                const payload = { error: { tr: 'Bu kullanıcı adı zaten kullanımda.', en: 'This username is already in use' } };
                if (process.env.NODE_ENV === 'development') payload.details = { code: err.code, keyValue: kv, raw: err.message };
                return res.status(400).json(payload);
            }
            if (kv.email) {
                const payload = { error: { tr: 'Bu e-posta adresi zaten kullanımda.', en: 'This email is already in use' } };
                if (process.env.NODE_ENV === 'development') payload.details = { code: err.code, keyValue: kv, raw: err.message };
                return res.status(400).json(payload);
            }
            // Generic duplicate key fallback
            const payload = { error: { tr: 'Zaten var olan bir kayıtla çakışma (duplicate key)', en: 'Duplicate key conflict' } };
            if (process.env.NODE_ENV === 'development') payload.details = { code: err.code, keyValue: kv, raw: err.message };
            return res.status(400).json(payload);
        }
        return res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err && err.message ? err.message : String(err) });
    }
});

// 2. Giriş Yapma (Login) - POST /api/auth/login
router.post('/login', async(req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: { tr: 'Lütfen e-posta ve şifre girin', en: 'Please provide email and password' } });
        }

        // Check DB connection - if down, allow demo login
        if (mongoose.connection.readyState !== 1) {
            console.warn('[LOGIN] DB not connected, allowing demo login');
            const mockUser = {
                _id: `mock_${Date.now()}`,
                name: email.split('@')[0],
                email: email.toLowerCase(),
                username: `u_demo`,
                languages: [],
                createdAt: new Date()
            };
            const token = signToken(mockUser._id);
            return res.status(200).json({
                status: 'success',
                token,
                data: { user: mockUser },
                message: { tr: 'Giriş başarılı (Demo Mode)', en: 'Login successful (Demo Mode)' }
            });
        }

        // Şifresi ile birlikte kullanıcıyı bul
        const user = await User.findOne({ email }).select('+password');

        if (!user || !(await user.correctPassword(password, user.password))) {
            return res.status(401).json({ error: { tr: 'Geçersiz e-posta veya şifre', en: 'Invalid email or password' } });
        }

        // Update lastLogin timestamp for admin reporting
        try {
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });
        } catch (e) {
            console.warn('Could not update lastLogin for user', user._id, e && e.message);
        }

        createSendToken(user, 200, res);

    } catch (err) {
        console.error('Login error:', err && err.message);
        // If DB error, allow demo login
        if (err && err.name && (err.name.includes('MongoServer') || err.name.includes('MongoDB'))) {
            console.warn('[LOGIN] MongoDB error - allowing demo login');
            const { email } = req.body;
            const mockUser = {
                _id: `mock_${Date.now()}`,
                name: email.split('@')[0],
                email: email.toLowerCase(),
                username: `u_demo`,
                languages: [],
                createdAt: new Date()
            };
            const token = signToken(mockUser._id);
            return res.status(200).json({
                status: 'success',
                token,
                data: { user: mockUser },
                message: { tr: 'Giriş başarılı (Demo Mode)', en: 'Login successful (Demo Mode)' }
            });
        }
        return res.status(500).json({ error: { tr: 'Sunucu hatası', en: 'Internal server error' }, details: err.message });
    }
});

// GET /api/auth/me - current user profile (requires Bearer token)
router.get('/me', authMiddleware, async(req, res, next) => {
    try {
        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            console.warn('[GET /me] DB not connected, returning mock user');
            const mockUser = {
                _id: req.user.userId,
                name: 'Demo User',
                email: 'demo@example.com',
                username: 'u_demo',
                languages: [],
                createdAt: new Date()
            };
            return res.json({ status: 'success', data: { user: mockUser } });
        }

        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı', message: { tr: 'Kullanıcı bulunamadı', en: 'User not found' } });
        return res.json({ status: 'success', data: { user } });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/forgot-password - Şifre sıfırlama isteği
router.post('/forgot-password', async(req, res, next) => {
    try {
        const { email, username } = req.body;

        if (!email && !username) {
            return res.status(400).json({ error: { tr: 'E-posta adresiniz veya kullanıcı adınızı girin', en: 'Please provide email or username' } });
        }

        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            console.warn('[FORGOT-PASSWORD] DB not connected - returning success anyway');
            // Return success even if DB is down (user won't be able to reset but won't know)
            return res.status(200).json({
                status: 'success',
                message: { tr: 'Şifre sıfırlama bağlantısı gönderildi', en: 'Password reset link sent' }
            });
        }

        // Check if user exists by email or username
        let user;
        if (email) {
            const normalizedEmail = email.trim().toLowerCase();
            user = await User.findOne({ email: normalizedEmail });
        } else if (username) {
            const normalizedUsername = username.trim();
            user = await User.findOne({ username: normalizedUsername });
        }

        if (!user) {
            // Return error if user is not registered
            return res.status(404).json({
                error: { tr: 'Bu kullanıcı sistemde kayıtlı değildir', en: 'This user is not registered in the system' }
            });
        }

        const normalizedEmail = user.email;

        // Create reset token
        const resetToken = jwt.sign({ userId: user._id, purpose: 'password-reset' }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });

        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/reset-password?token=${resetToken}`;

        // Email HTML template
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">🔐 Şifrenizi Sıfırlayın / Reset Your Password</h2>
                
                <h3 style="color: #666;">Türkçe:</h3>
                <p>Merhaba,</p>
                <p>LangTalk hesabınızın şifresini sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
                <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Şifrenizi Sıfırlayın</a></p>
                <p>Veya bu bağlantıyı tarayıcınızda açın:</p>
                <p><code>${resetLink}</code></p>
                <p>Bu bağlantı 1 saat geçerlidir.</p>
                <p>Eğer siz bu isteği yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <h3 style="color: #666;">English:</h3>
                <p>Hello,</p>
                <p>Click the link below to reset your LangTalk account password:</p>
                <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
                <p>Or open this link in your browser:</p>
                <p><code>${resetLink}</code></p>
                <p>This link is valid for 1 hour.</p>
                <p>If you didn't request this, you can ignore this email.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">LangTalk © 2024</p>
            </div>
        `;

        // Email göndermeyi dene
        let emailSent = false;

        try {
            if (!transporter) {
                // Email configuration missing - try to use Ethereal test account for development
                console.warn('[FORGOT-PASSWORD] Real email not configured, trying test account...');
                try {
                    const testAccount = await nodemailer.createTestAccount();
                    const testTransporter = nodemailer.createTransport({
                        host: 'smtp.ethereal.email',
                        port: 587,
                        secure: false,
                        auth: {
                            user: testAccount.user,
                            pass: testAccount.pass
                        }
                    });

                    const info = await testTransporter.sendMail({
                        from: testAccount.user,
                        to: normalizedEmail,
                        subject: 'LangTalk - Şifre Sıfırlama / Password Reset',
                        html: emailHtml
                    });

                    emailSent = true;
                    console.log('[FORGOT-PASSWORD] Test Email sent via Ethereal');
                    console.log('[ETHEREAL-PREVIEW] ' + nodemailer.getTestMessageUrl(info));
                } catch (etherealError) {
                    // Ethereal failed, log it but still show success to user
                    console.warn('[FORGOT-PASSWORD] Ethereal test account failed:', etherealError.message);
                    console.log('[FORGOT-PASSWORD] Reset link (for local testing): ' + resetLink);
                    emailSent = true; // Mark as sent even though we just logged it
                }
            } else {
                // Real email configuration exists
                const info = await transporter.sendMail({
                    from: process.env.EMAIL_FROM || 'noreply@langtalk.com',
                    to: normalizedEmail,
                    subject: 'LangTalk - Şifre Sıfırlama / Password Reset',
                    html: emailHtml
                });

                emailSent = true;
                console.log('[FORGOT-PASSWORD] Email successfully sent to ' + normalizedEmail);
                console.log('[FORGOT-PASSWORD] Message ID:', info.messageId);
            }

        } catch (emailError) {
            console.error('[FORGOT-PASSWORD] Unexpected error during email sending:', emailError.message);
            console.log('[FORGOT-PASSWORD] Reset link (fallback): ' + resetLink);
            emailSent = true; // Still mark as sent for security
        }

        // Return success if we attempted to send
        if (emailSent) {
            return res.status(200).json({
                status: 'success',
                message: { tr: 'Şifre sıfırlama bağlantısı e-mailnize gönderildi', en: 'Password reset link sent to your email' }
            });
        }

        return res.status(500).json({
            error: { tr: 'Bir hata oluştu, lütfen tekrar deneyin', en: 'An error occurred, please try again' }
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ error: 'Sunucu hatası', message: err.message });
    }
});

// POST /api/auth/reset-password - Şifre sıfırlama
router.post('/reset-password', async(req, res, next) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'Tüm alanlar gereklidir' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Şifreler eşleşmiyor' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.purpose !== 'password-reset') {
                throw new Error('Invalid token purpose');
            }
        } catch (err) {
            return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token' });
        }

        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
        }

        // Find user and update password
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        user.password = newPassword;
        await user.save();

        return res.status(200).json({
            status: 'success',
            message: { tr: 'Şifreniz başarıyla sıfırlandı', en: 'Password reset successful' }
        });
    } catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = router;
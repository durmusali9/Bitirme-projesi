const express = require('express');
const authMiddleware = require('../authMiddleware');
const userController = require('../controllers/user');
const router = express.Router();

// List users (public)
router.get('/', userController.listUsers);

// Giriş yapmış kullanıcının kendi profilini görmesi: GET /api/users/me
router.get('/me', authMiddleware, userController.getMe);

// Get user by id
router.get('/:id', userController.getUserById);

module.exports = router;
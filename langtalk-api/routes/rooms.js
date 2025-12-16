const express = require('express');
const authMiddleware = require('../authMiddleware');
const roomController = require('../controllers/rooms');

const router = express.Router();

// List all rooms (public) - GET /api/rooms
router.get('/', roomController.getAllRooms);


// Create room - POST /api/rooms
router.post('/', authMiddleware, roomController.createRoom);

// Kullanıcının odalarını listeleme: GET /api/rooms/my-rooms
router.get('/my-rooms', authMiddleware, roomController.myRooms);

// Join room (self) - POST /api/rooms/:roomId/join
router.post('/:roomId/join', authMiddleware, roomController.joinRoom);

// Leave room (self) - POST /api/rooms/:roomId/leave
router.post('/:roomId/leave', authMiddleware, roomController.leaveRoom);

// Odaya üye ekleme (owner adds another user): PATCH /api/rooms/:roomId/add
router.patch('/:roomId/add', authMiddleware, roomController.addMember);

// Get single room - GET /api/rooms/:roomId
router.get('/:roomId', roomController.getRoomById);

// Update room - PATCH /api/rooms/:roomId
router.patch('/:roomId', authMiddleware, roomController.updateRoom);

// Delete room - DELETE /api/rooms/:roomId
router.delete('/:roomId', authMiddleware, roomController.deleteRoom);

// Kullanıcının odalarını listeleme: GET /api/rooms/my-rooms
router.get('/my-rooms', authMiddleware, roomController.myRooms);

// Odaya üye ekleme (owner adds another user): PATCH /api/rooms/:roomId/add
router.patch('/:roomId/add', authMiddleware, roomController.addMember);

module.exports = router;
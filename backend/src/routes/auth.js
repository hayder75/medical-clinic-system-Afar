const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

// Public routes
router.get('/login-users', authController.getLoginUsers);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/change-password', authMiddleware, authController.changePassword);

// Admin only routes
router.patch('/toggle-status/:userId', authMiddleware, roleGuard(['ADMIN']), authController.toggleUserStatus);

module.exports = router;
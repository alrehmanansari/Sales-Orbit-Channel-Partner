const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { register, login, verifyOTP, resendOTP, getMe, changePassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getNotifications, markRead, markAllRead, getUnreadCount
} = require('../controllers/notificationController');

router.use(authenticate);

router.get('/',             getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all',     markAllRead);
router.put('/:id/read',     markRead);

module.exports = router;

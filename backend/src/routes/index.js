const express = require('express');
const router = express.Router();

router.use('/auth',          require('./auth'));
router.use('/accounts',      require('./accounts'));
router.use('/notifications', require('./notifications'));
router.use('/tickets',       require('./tickets'));
router.use('/dashboard',     require('./dashboard'));
router.use('/users',         require('./users'));

module.exports = router;

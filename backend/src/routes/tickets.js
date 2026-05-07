const express = require('express');
const router = express.Router();
const { authenticate, requireInternal } = require('../middleware/auth');
const {
  listTickets, createTicket, getTicket, updateTicketStatus, exportTickets
} = require('../controllers/ticketController');

router.use(authenticate);

router.get('/',        listTickets);
router.post('/',       createTicket);
router.get('/export',  exportTickets);
router.get('/:id',     getTicket);
router.put('/:id/status', requireInternal, updateTicketStatus);

module.exports = router;

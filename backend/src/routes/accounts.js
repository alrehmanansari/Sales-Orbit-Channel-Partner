const express = require('express');
const router = express.Router();
const { authenticate, requireInternal } = require('../middleware/auth');
const { bulkUpload } = require('../middleware/upload');
const {
  listAccounts, getAccount, createAccount,
  updateAccount, bulkUploadAccounts, exportAccounts, deleteAccount
} = require('../controllers/accountController');
const { getNotes, createNote, getAuditLog } = require('../controllers/noteController');

// All account routes require authentication
router.use(authenticate);

router.get('/',         listAccounts);
router.post('/',        createAccount);
router.get('/export',   exportAccounts);
router.post('/bulk',    bulkUpload.single('file'), bulkUploadAccounts);
router.get('/:id',      getAccount);
router.put('/:id',      updateAccount);
router.delete('/:id',   deleteAccount);

// Notes & audit within account
router.get('/:accountId/notes',     getNotes);
router.post('/:accountId/notes',    createNote);
router.get('/:accountId/audit',     getAuditLog);

module.exports = router;

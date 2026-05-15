const express = require('express');
const router = express.Router();
const { authenticate, requireInternal, requireManagement } = require('../middleware/auth');
const {
  listUsers, getUser, createUser, updateUser, listPartners, listSpecialists, listSalesTeam
} = require('../controllers/userController');

router.use(authenticate);

// Any authenticated user can access these dropdown lists (partners need them for add-account form)
router.get('/partners',    listPartners);
router.get('/specialists', listSpecialists);
router.get('/sales-team',  listSalesTeam);

// Full user CRUD — management only
router.get('/',    requireManagement, listUsers);
router.post('/',   requireManagement, createUser);
router.get('/:id', requireInternal, getUser);
router.put('/:id', requireManagement, updateUser);

module.exports = router;

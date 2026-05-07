const express = require('express');
const router = express.Router();
const { authenticate, requireInternal, requireManagement } = require('../middleware/auth');
const {
  listUsers, getUser, createUser, updateUser, listPartners, listSpecialists
} = require('../controllers/userController');

router.use(authenticate);

// Any internal user can browse partner / specialist lists (for dropdowns)
router.get('/partners',    requireInternal, listPartners);
router.get('/specialists', requireInternal, listSpecialists);

// Full user CRUD — management only
router.get('/',    requireManagement, listUsers);
router.post('/',   requireManagement, createUser);
router.get('/:id', requireInternal, getUser);
router.put('/:id', requireManagement, updateUser);

module.exports = router;

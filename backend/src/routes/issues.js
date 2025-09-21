// src/routes/issues.js
const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const ctrl   = require('../controllers/issueController');

router.get('/',     auth, ctrl.list);
router.get('/:id',  auth, ctrl.getOne);
router.post('/',    auth, ctrl.create);
router.patch('/:id',auth, ctrl.update);

module.exports = router;

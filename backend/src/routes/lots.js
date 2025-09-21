const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/lotsController');

router.get('/rig/:rigId', auth, ctrl.listByRig);

router.get('/history', auth, (req, res, next) => {
  req.query.rig_id = req.query.rig_id || req.query.rigId;
  return ctrl.daily(req, res, next);
});


module.exports = router;

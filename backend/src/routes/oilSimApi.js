// backend/src/routes/oilSimApi.js
const router = require('express').Router();
const { simAuth, simRequireAnyRole } = require('../middlewares/simAuth');
const ctrl = require('../controllers/oilSimController');
const simCtrl = require('../controllers/simulatorController');

// ---- Auth (login) เฉพาะ admin + production ----
router.post('/auth/login', simCtrl.loginWithRoles(['admin', 'production']));

// ---- ทุก endpoint ใต้ /api/oil-sim ต้องมีโทเคนและเป็น role ที่อนุญาต ----
router.use(simAuth, simRequireAnyRole('admin', 'production'));

router.get('/rigs',           ctrl.listRigs);
router.post('/readings/bulk', ctrl.bulkGenerate);

module.exports = router;

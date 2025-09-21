// backend/src/routes/simulator_api.js
const express = require('express');
const router = express.Router();

const sim = require('../controllers/simulatorController');
const { simAuth, simRequireAnyRole } = require('../middlewares/simAuth');

// ---- Auth (vessel sim): admin + captain ----
router.post('/auth/login', sim.login);

// ---- ทุก endpoint ต่อไปนี้ต้องเป็น admin หรือ captain ----
router.use(simAuth, simRequireAnyRole('admin', 'captain'));

router.get('/vessels', sim.listVessels);
router.get('/rigs',     sim.listRigs);
router.get('/lots',     sim.listLotsByRig);

router.patch('/vessels/:id', sim.updateVesselStatus);

router.post('/voyages/start',      sim.startVoyage);
router.post('/voyages/:id/arrive', sim.arriveVoyage);
router.get('/voyages/active',      sim.getActiveVoyage);

router.post('/positions', sim.postPosition);

module.exports = router;

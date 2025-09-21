// backend/server.js (หรือไฟล์ที่คุณเรียก app.listen)
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
dotenv.config();

const { requireAuth, requireAnyRole } = require('./middlewares/requireAuth');
const authMiddleware = require('./middlewares/authMiddleware');
// const ipAllowlist = require('./middlewares/ipAllowlist'); // <-- ไม่จำเป็นถ้าจะเปิดทุก IP

const authRoutes      = require('./routes/auth');
const adminUsers      = require('./routes/adminUsers');
const vesselRoutes    = require('./routes/vessels');
const issueRoutes     = require('./routes/issues');
const readingsRoutes  = require('./routes/readings');
const shipmentsRoutes = require('./routes/shipments');
const rigsRoutes      = require('./routes/rigs');
const lotsRoutes      = require('./routes/lots');
const debugRoutes     = require('./routes/debug');
const oilSimApi       = require('./routes/oilSimApi');
const oilSimStatic    = require('./routes/oilSimStatic');
const simApi          = require('./routes/simulator_api');
const simStatic       = require('./routes/simulator_ui');

const app = express();

// ✅ เปิด CORS กว้าง ๆ เพื่อกัน origin แปลก ๆ (โดยเฉพาะถ้ามีหน้าอื่นยิง API ข้ามโดเมน)
app.use(cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', true);

// ✅ ใส่ก่อนทุก route ที่ใช้ req.user
app.use(authMiddleware);

// public
app.use('/api/auth',  authRoutes);
app.use('/api/debug', debugRoutes);

// protected
app.use('/api/admin/users', requireAuth, requireAnyRole('admin','manager'), adminUsers);
app.use('/api/readings',    readingsRoutes);
app.use('/api/shipments',   shipmentsRoutes);
app.use('/api/vessels',     vesselRoutes);
app.use('/api/issues',      issueRoutes);
app.use('/api/rigs',        rigsRoutes);
app.use('/api/lots',        lotsRoutes);

// ✅ Oil simulator (ไม่มีการล็อก IP)
app.use('/api/oil-sim', oilSimApi);
app.use('/oil-sim',     oilSimStatic);

// ✅ Vessel simulator (เอา ipAllowlist ออก)
app.use('/api/sim', simApi);
app.use('/sim',     simStatic);

// health check (ทดสอบจากเครื่องอื่นได้)
app.get('/healthz', (_req, res) => res.send('ok'));

const PORT = process.env.PORT || 8000;
// ✅ สำคัญ: ฟังทุกอินเตอร์เฟซ
app.listen(PORT, '0.0.0.0', () => console.log('API on :', PORT));

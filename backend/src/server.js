// src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/auth');
const oilRoutes = require('./routes/oil');
const vesselRoutes = require('./routes/vessels');
const issueRoutes = require('./routes/issues');
const corsOptions = {
  origin: 'http://localhost:5173', // Vite frontend
  credentials: true
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/oil', oilRoutes);
app.use('/api/vessels', vesselRoutes);
app.use('/api/issues', issueRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

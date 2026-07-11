import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { initFirebase } from './config/firebase.js';
import authRoutes from './routes/auth.js';
import rulesRoutes from './routes/rules.js';
import alertsRoutes from './routes/alerts.js';
import devicesRoutes from './routes/devices.js';
import { startEmailScanner } from './services/gmail/scanner.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Initialize connection services
let dbConnected = false;
let firebaseInitialized = false;

try {
  await connectDB();
  dbConnected = true;
} catch (error) {
  console.error('MongoDB initialization failed:', error.message);
}

try {
  const firebaseApp = initFirebase();
  firebaseInitialized = firebaseApp !== null;
} catch (error) {
  console.error('Firebase initialization failed:', error.message);
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      firebase: firebaseInitialized ? 'initialized' : 'failed/not_configured'
    }
  });
});

// Serve Android App Links verification file
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.prioritymailguardian",
      "sha256_cert_fingerprints": ["D0:BE:92:C5:B8:5B:88:56:76:00:D2:FD:3E:69:00:DD:DE:D1:8C:D5:19:98:3F:7E:C2:3C:1F:C7:24:30:27:43"]
    }
  }]);
});

// Auth Routes
app.use('/api/auth', authRoutes);

// Rules & Alerts Routes
app.use('/api/rules', rulesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/devices', devicesRoutes);

// Basic route test
app.get('/', (req, res) => {
  res.send('PriorityMail Guardian API is running.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);

  // Start background email scanner daemon
  if (dbConnected) {
    startEmailScanner();
  } else {
    console.warn('Email scanner not started: MongoDB is not connected.');
  }
});

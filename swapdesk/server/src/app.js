import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import swapRequestRoutes from './routes/swapRequestRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked origin'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SwapDesk API is running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/swap-requests', swapRequestRoutes);
app.use('/api/workflow', workflowRoutes);

app.use((err, req, res, next) => {
  console.error(err.message);

  res.status(err.message === 'CORS blocked origin' ? 403 : 500).json({
    success: false,
    message: err.message === 'CORS blocked origin'
      ? 'Origin not allowed'
      : 'Internal server error'
  });
});

export default app;

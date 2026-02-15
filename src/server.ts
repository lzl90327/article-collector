import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import config from './config';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (Placeholder for now)
// import workflowRoutes from './api/routes/workflow';
// app.use('/api/workflows', workflowRoutes);

export const startServer = () => {
  return new Promise<void>((resolve, reject) => {
    app.listen(PORT, () => {
      logger.info(`✅ HTTP Server running on port ${PORT}`);
      resolve();
    }).on('error', (err) => {
      logger.error('❌ HTTP Server failed to start', err);
      reject(err);
    });
  });
};

export default app;

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

// Request Logger
app.use((req, res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
import mindflowRouter from './api/routes/mindflow';
app.use('/api/mindflow', mindflowRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('[HTTP ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

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

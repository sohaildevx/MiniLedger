import cors from 'cors';
import express from 'express';
import { config } from './config';
import { authRouter } from './routes/auth';
import { loansRouter } from './routes/loans';
import { errorHandler, notFoundHandler } from './middleware/error';
import { ensureUploadDir, uploadDir } from './uploads';

/**
 * The app is built by a factory rather than being created at import time, so
 * tests can construct an instance without binding a port.
 */
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');

  // CORS_ORIGIN="*" allows any origin, which is what you want in dev so the
  // Expo app (and the simulator's random bundle URL) can call the API.
  app.use(cors({ origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'miniledger-api', time: new Date().toISOString() });
  });

  // Serves uploaded receipt photos: <Image source={{ uri: API_URL + loan.receipt_path }} />
  ensureUploadDir();
  app.use('/uploads', express.static(uploadDir, { fallthrough: false }));

  app.use('/auth', authRouter);
  app.use('/loans', loansRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

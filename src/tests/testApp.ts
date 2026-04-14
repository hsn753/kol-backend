import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import kolsRouter from '../routes/kols';
import campaignsRouter from '../routes/campaigns';
import scriptsRouter from '../routes/scripts';
import paymentsRouter from '../routes/payments';
import auditRouter from '../routes/audit';
import walletRouter from '../routes/wallet';

export function createTestApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/kols', kolsRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/scripts', scriptsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/wallet', walletRouter);
  return app;
}

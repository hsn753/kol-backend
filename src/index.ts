import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { migrate } from './db/migrate';
import { startScheduler } from './jobs/scriptScheduler';
import kolsRouter from './routes/kols';
import campaignsRouter from './routes/campaigns';
import scriptsRouter from './routes/scripts';
import paymentsRouter from './routes/payments';
import auditRouter from './routes/audit';
import walletRouter from './routes/wallet';
import tokenLookupRouter from './routes/tokenLookup';
import tradesRouter from './routes/trades';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet());
const allowedOrigins = [
  FRONTEND_URL,
  'https://mm-dashboard-plum.vercel.app',
  'http://localhost:5173',
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(morgan('combined'));

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/kols', kolsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/token', tokenLookupRouter);
app.use('/api/trades', tradesRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

async function main() {
  await migrate();
  startScheduler();
  app.listen(PORT, () => console.log(`✅ KOL backend running on port ${PORT}`));
}

main().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});

import { Router } from 'express';
import { generateDevnetWallet } from '../services/solana';

const router = Router();

router.post('/generate', async (_req, res) => {
  try {
    const wallet = await generateDevnetWallet();
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

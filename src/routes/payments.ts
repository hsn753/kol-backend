import { Router } from 'express';
import { pool } from '../db/pool';
import { batchUSDCPay } from '../services/solana';

const router = Router();

router.post('/batch', async (req, res) => {
  const { payments } = req.body as { payments: Array<{ kol_id: string; wallet: string; amount: number }> };
  if (!Array.isArray(payments) || !payments.length) return res.status(400).json({ error: 'payments array required' });

  try {
    const paymentInputs = payments.map((p) => ({ wallet: p.wallet, amount: p.amount }));
    const results = await batchUSDCPay(paymentInputs);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const p = payments[i];
      await pool.query(`
        INSERT INTO payments (kol_id, wallet, amount, tx_hash, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [p.kol_id, r.wallet, r.amount, r.txHash || null, r.error ? 'failed' : 'confirmed']);

      if (!r.error) {
        await pool.query('UPDATE kols SET status=$1 WHERE id=$2', ['paid', p.kol_id]);
      }

      const { rows: kolRows } = await pool.query('SELECT handle FROM kols WHERE id=$1', [p.kol_id]);
      const handle = kolRows[0]?.handle || 'unknown';
      await pool.query(`
        INSERT INTO audit_log (action, kol_handle, detail, tx_hash)
        VALUES ('payment', $1, $2, $3)
      `, [handle, `USDC payout $${r.amount}${r.error ? ' — FAILED: ' + r.error : ''}`, r.txHash || null]);
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/history', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, k.handle as kol_handle
      FROM payments p
      LEFT JOIN kols k ON k.id = p.kol_id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

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

      const { rows: kolRows } = await pool.query(
        'SELECT k.handle, k.campaign_id, c.name as campaign_name FROM kols k LEFT JOIN campaigns c ON c.id=k.campaign_id WHERE k.id=$1',
        [p.kol_id]
      );
      const kol = kolRows[0];
      const handle = kol?.handle || 'unknown';
      const campaignId = kol?.campaign_id || null;
      const campaignName = kol?.campaign_name || null;

      await pool.query(`
        INSERT INTO payments (kol_id, kol_handle, wallet, amount, tx_hash, status, campaign_id, campaign_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [p.kol_id, handle, r.wallet, r.amount, r.txHash || null, r.error ? 'failed' : 'confirmed', campaignId, campaignName]);

      if (!r.error) {
        await pool.query('UPDATE kols SET status=$1 WHERE id=$2', ['paid', p.kol_id]);
      }

      await pool.query(`
        INSERT INTO audit_log (action, kol_handle, campaign_name, detail, tx_hash)
        VALUES ('payment', $1, $2, $3, $4)
      `, [handle, campaignName, `USDC payout $${r.amount}${r.error ? ' — FAILED: ' + r.error : ''}`, r.txHash || null]);
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/history', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.wallet, p.amount, p.tx_hash, p.status, p.created_at,
        COALESCE(p.kol_handle, k.handle) as kol_handle,
        COALESCE(p.campaign_name, c.name) as campaign_name,
        p.campaign_id
      FROM payments p
      LEFT JOIN kols k ON k.id = p.kol_id
      LEFT JOIN campaigns c ON c.id = p.campaign_id
      ORDER BY p.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

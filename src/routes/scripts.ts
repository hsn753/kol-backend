import { Router } from 'express';
import { pool } from '../db/pool';
import { distributeScripts } from '../jobs/scriptScheduler';

const router = Router();

router.post('/distribute', async (req, res) => {
  const { slot } = req.body as { slot?: 'am' | 'pm' };
  const s = slot || 'am';
  try {
    await distributeScripts(s);
    res.json({ ok: true, slot: s });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/log', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sl.*, k.handle as kol_handle, c.name as campaign_name
      FROM script_logs sl
      LEFT JOIN kols k ON k.id = sl.kol_id
      LEFT JOIN campaigns c ON c.id = sl.campaign_id
      ORDER BY sl.sent_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

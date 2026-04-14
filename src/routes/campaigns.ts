import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req, res) => {
  const { name, ticker, cashtag, start_date, end_date, script_template } = req.body;
  try {
    await pool.query(`UPDATE campaigns SET status='inactive' WHERE status='active'`);
    const { rows } = await pool.query(`
      INSERT INTO campaigns (name, ticker, cashtag, start_date, end_date, script_template)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [name, ticker, cashtag, start_date, end_date, script_template]);
    await pool.query(`INSERT INTO audit_log (action, campaign_name, detail) VALUES ('campaign_created', $1, 'New campaign created — previous campaign set to inactive')`, [name]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req, res) => {
  const { name, ticker, cashtag, start_date, end_date, script_template, status } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE campaigns SET name=$1, ticker=$2, cashtag=$3, start_date=$4, end_date=$5, script_template=$6, status=$7
      WHERE id=$8 RETURNING *
    `, [name, ticker, cashtag, start_date, end_date, script_template, status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/assign', async (req, res) => {
  const { kol_ids } = req.body as { kol_ids: string[] };
  try {
    for (const kid of kol_ids) {
      await pool.query('UPDATE kols SET campaign_id=$1 WHERE id=$2', [req.params.id, kid]);
    }
    res.json({ ok: true, assigned: kol_ids.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

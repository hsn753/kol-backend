import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT k.*, c.name as campaign_name 
      FROM kols k LEFT JOIN campaigns c ON c.id = k.campaign_id
      ORDER BY k.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req, res) => {
  const { handle, wallet, rate, campaign_id, script_schedule, telegram_username } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO kols (handle, wallet, rate, campaign_id, script_schedule, telegram_username, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [handle, wallet, rate, campaign_id || null, script_schedule || 'am + pm', telegram_username || null]);
    await pool.query(`INSERT INTO audit_log (action, kol_handle, detail) VALUES ('kol_added', $1, 'KOL added to roster')`, [handle]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', async (req, res) => {
  const { handle, wallet, rate, campaign_id, script_schedule, status, telegram_username } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE kols SET handle=$1, wallet=$2, rate=$3, campaign_id=$4, script_schedule=$5, status=$6, telegram_username=$7
      WHERE id=$8 RETURNING *
    `, [handle, wallet, rate, campaign_id || null, script_schedule, status, telegram_username || null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'KOL not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM kols WHERE id=$1 RETURNING handle', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'KOL not found' });
    await pool.query(`INSERT INTO audit_log (action, kol_handle, detail) VALUES ('kol_removed', $1, 'KOL removed from roster')`, [rows[0].handle]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

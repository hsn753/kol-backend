import { Router } from 'express';
import { pool } from '../db/pool';
import { sendTelegramDM } from '../services/telegram';

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

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE kols SET campaign_id=NULL WHERE campaign_id=$1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM campaigns WHERE id=$1 RETURNING name', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found' });
    await pool.query(`INSERT INTO audit_log (action, campaign_name, detail) VALUES ('campaign_deleted', $1, 'Campaign deleted')`, [rows[0].name]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/assign', async (req, res) => {
  const { kol_ids } = req.body as { kol_ids: string[] };
  try {
    const campRes = await pool.query('SELECT * FROM campaigns WHERE id=$1', [req.params.id]);
    const campaign = campRes.rows[0];
    const results: { kol: string; telegram: string; ok: boolean; error?: string }[] = [];
    for (const kid of kol_ids) {
      await pool.query('UPDATE kols SET campaign_id=$1 WHERE id=$2', [req.params.id, kid]);
      const kolRes = await pool.query('SELECT handle, telegram_username FROM kols WHERE id=$1', [kid]);
      const kol = kolRes.rows[0];
      if (kol?.telegram_username && campaign) {
        const msg = `Hey @${kol.handle}! You've been assigned to campaign *${campaign.name}* ($${campaign.ticker}). Check your dashboard for the script schedule.`;
        const tg = await sendTelegramDM(kol.telegram_username, msg);
        results.push({ kol: kol.handle, telegram: kol.telegram_username, ok: tg.ok, error: tg.error });
      }
    }
    res.json({ ok: true, assigned: kol_ids.length, telegram: results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/unassign', async (req, res) => {
  const { kol_id } = req.body as { kol_id: string };
  try {
    await pool.query('UPDATE kols SET campaign_id=NULL WHERE id=$1 AND campaign_id=$2', [kol_id, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

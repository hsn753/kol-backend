import cron from 'node-cron';
import { pool } from '../db/pool';
import { sendTelegramDM, buildScript } from '../services/telegram';

async function distributeScripts(slot: 'am' | 'pm') {
  const client = await pool.connect();
  try {
    const { rows: kols } = await client.query(`
      SELECT k.id, k.handle, k.wallet, k.telegram_username, k.script_schedule,
             c.name as campaign_name, c.ticker, c.cashtag, c.script_template, c.id as campaign_id
      FROM kols k
      JOIN campaigns c ON c.id = k.campaign_id
      WHERE c.status = 'active'
        AND (k.script_schedule = 'am + pm' OR k.script_schedule = $1)
    `, [`${slot} only`]);

    for (const kol of kols) {
      const angle = slot === 'am' ? 'morning momentum + chart' : 'evening summary + holder growth';
      const script = buildScript(kol.script_template, {
        handle: kol.handle,
        cashtag: kol.cashtag,
        ticker: kol.ticker,
        angle,
      });

      let status = 'sent';
      let error = null;

      if (kol.telegram_username) {
        const result = await sendTelegramDM(kol.telegram_username, script);
        if (!result.ok) {
          status = 'failed';
          error = result.error;
        }
      } else {
        status = 'skipped';
        error = 'No telegram username';
      }

      await client.query(`
        INSERT INTO script_logs (kol_id, campaign_id, script_text, send_method, slot, status)
        VALUES ($1, $2, $3, 'tg_dm', $4, $5)
      `, [kol.id, kol.campaign_id, script, slot, status]);

      await client.query(`
        INSERT INTO audit_log (action, kol_handle, campaign_name, detail)
        VALUES ('script_sent', $1, $2, $3)
      `, [kol.handle, kol.campaign_name, `${slot.toUpperCase()} script — ${status}${error ? ': ' + error : ''}`]);
    }

    console.log(`[scheduler] ${slot.toUpperCase()} scripts dispatched to ${kols.length} KOLs`);
  } catch (err) {
    console.error(`[scheduler] Error during ${slot} distribution:`, err);
  } finally {
    client.release();
  }
}

export function startScheduler() {
  cron.schedule('0 8 * * *', () => distributeScripts('am'), { timezone: 'America/New_York' });
  cron.schedule('0 18 * * *', () => distributeScripts('pm'), { timezone: 'America/New_York' });
  console.log('✅ Script scheduler started (8AM + 6PM EST)');
}

export { distributeScripts };

import { pool } from './pool';

const schema = `
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  cashtag TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  script_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE,
  wallet TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 0,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  script_schedule TEXT NOT NULL DEFAULT 'am + pm',
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS script_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  script_text TEXT NOT NULL,
  send_method TEXT NOT NULL DEFAULT 'tg_dm',
  slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  kol_handle TEXT,
  campaign_name TEXT,
  detail TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const alterations = `
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS kol_handle TEXT;
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS campaign_name TEXT;
`;

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(schema);
    await client.query(alterations);
    console.log('✅ DB migrations complete');
  } finally {
    client.release();
  }
}

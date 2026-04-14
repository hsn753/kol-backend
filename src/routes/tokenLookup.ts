import { Router } from 'express';
import https from 'https';

const router = Router();

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'kol-backend/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function formatMcap(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

router.get('/:mint', async (req, res) => {
  const { mint } = req.params;

  try {
    const raw = await httpsGet(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
    const data = JSON.parse(raw) as Array<{
      baseToken?: { symbol?: string; name?: string; address?: string };
      priceUsd?: string;
      fdv?: number;
      marketCap?: number;
      priceChange?: { h24?: number };
    }>;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'Token not found on DexScreener' });
    }

    const pair = data[0];
    const ticker = pair.baseToken?.symbol ?? 'UNKNOWN';
    const name = pair.baseToken?.name ?? ticker;
    const price = pair.priceUsd ? `$${Number(pair.priceUsd).toPrecision(4)}` : '—';
    const mcapRaw = pair.marketCap ?? pair.fdv ?? 0;
    const mcap = mcapRaw > 0 ? formatMcap(mcapRaw) : '—';
    const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24.toFixed(2)}%` : '—';

    res.json({ mint, ticker, name, price, mcap, change24h });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

import { Router } from 'express';
import axios from 'axios';

const router = Router();

function formatMcap(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

router.get('/:mint', async (req, res) => {
  const { mint } = req.params;

  try {
    const [priceRes, metaRes] = await Promise.all([
      axios.get(`https://price.jup.ag/v6/price?ids=${mint}`),
      axios.get(`https://tokens.jup.ag/token/${mint}`),
    ]);

    const priceData = priceRes.data as { data?: Record<string, { price: number }> };
    const meta = metaRes.data as {
      symbol?: string;
      name?: string;
      extensions?: { coingeckoId?: string };
    };

    if (!meta?.symbol) {
      return res.status(404).json({ error: 'Token not found on Jupiter' });
    }

    const price = priceData?.data?.[mint]?.price ?? 0;
    const ticker = meta.symbol;
    const name = meta.name ?? ticker;

    let mcap = '—';
    let change24h = '—';

    if (meta?.extensions?.coingeckoId) {
      try {
        const cgRes = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${meta.extensions.coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false`
        );
        const cg = cgRes.data as {
          market_data?: {
            market_cap?: { usd?: number };
            price_change_percentage_24h?: number;
          };
        };
        if (cg?.market_data?.market_cap?.usd) mcap = formatMcap(cg.market_data.market_cap.usd);
        if (cg?.market_data?.price_change_percentage_24h !== undefined) {
          change24h = `${cg.market_data.price_change_percentage_24h.toFixed(2)}%`;
        }
      } catch { /* coingecko optional */ }
    }

    res.json({
      mint,
      ticker,
      name,
      price: price > 0 ? `$${price.toPrecision(4)}` : '—',
      mcap,
      change24h,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

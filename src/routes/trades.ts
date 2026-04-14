import { Router } from 'express';
import https from 'https';

const router = Router();

function rpcPost(body: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.mainnet-beta.solana.com',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

router.get('/:mint', async (req, res) => {
  const { mint } = req.params;

  try {
    const pairsRaw = await new Promise<string>((resolve, reject) => {
      https.get(
        `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`,
        { headers: { 'User-Agent': 'kol-backend/1.0' } },
        (r) => { let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => resolve(d)); }
      ).on('error', reject);
    });

    const pairs = JSON.parse(pairsRaw) as Array<{ pairAddress?: string }>;
    if (!pairs?.length || !pairs[0].pairAddress) {
      return res.status(404).json({ error: 'No pair found for this token' });
    }
    const pairAddress = pairs[0].pairAddress;

    const sigsRaw = await rpcPost({
      jsonrpc: '2.0', id: 1,
      method: 'getSignaturesForAddress',
      params: [pairAddress, { limit: 20 }],
    });
    const sigsData = JSON.parse(sigsRaw) as {
      result: Array<{ signature: string; blockTime?: number; err: unknown }>;
    };

    const sigs = (sigsData.result ?? []).filter((s) => !s.err).slice(0, 15);
    if (!sigs.length) return res.json([]);

    const txBatch = sigs.map((s, i) => ({
      jsonrpc: '2.0', id: i + 1,
      method: 'getTransaction',
      params: [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    }));

    const txsRaw = await rpcPost(txBatch);
    const txsData = JSON.parse(txsRaw) as Array<{
      result: {
        blockTime?: number;
        transaction?: {
          message?: {
            accountKeys?: Array<{ pubkey: string }>;
          };
        };
        meta?: {
          preTokenBalances?: Array<{ mint: string; uiTokenAmount: { uiAmount: number | null } }>;
          postTokenBalances?: Array<{ mint: string; uiTokenAmount: { uiAmount: number | null } }>;
          fee?: number;
          preBalances?: number[];
          postBalances?: number[];
          err: unknown;
        };
      } | null;
    }>;

    const trades = txsData
      .filter((t) => t.result && !t.result.meta?.err)
      .map((t, i) => {
        const tx = t.result!;
        const sig = sigs[i]?.signature ?? '';
        const blockTime = tx.blockTime ?? sigs[i]?.blockTime ?? 0;
        const keys = tx.transaction?.message?.accountKeys ?? [];
        const maker = keys[0]?.pubkey ?? 'unknown';

        const pre = tx.meta?.preTokenBalances ?? [];
        const post = tx.meta?.postTokenBalances ?? [];

        const targetMint = mint;
        const preAmt = pre.find((b) => b.mint === targetMint)?.uiTokenAmount?.uiAmount ?? 0;
        const postAmt = post.find((b) => b.mint === targetMint)?.uiTokenAmount?.uiAmount ?? 0;
        const diff = postAmt - preAmt;

        const solPre = tx.meta?.preBalances?.[0] ?? 0;
        const solPost = tx.meta?.postBalances?.[0] ?? 0;
        const solDiff = Math.abs(solPre - solPost) / 1e9;
        const amountUsd = solDiff * 145;

        const type = diff > 0 ? 'buy' : 'sell';

        return {
          signature: sig,
          maker: maker.slice(0, 6) + '...' + maker.slice(-4),
          type,
          amountUsd: Math.round(amountUsd),
          timestamp: blockTime,
          tx: sig.slice(0, 6) + '...' + sig.slice(-3),
        };
      })
      .filter((t) => t.amountUsd > 0);

    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

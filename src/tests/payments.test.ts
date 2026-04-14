import request from 'supertest';
import { createTestApp } from './testApp';

jest.mock('../db/pool', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../services/solana', () => ({
  batchUSDCPay: jest.fn(),
  generateDevnetWallet: jest.fn(),
}));

import { pool } from '../db/pool';
import { batchUSDCPay, generateDevnetWallet } from '../services/solana';

const mockQuery = pool.query as jest.Mock;
const mockBatchPay = batchUSDCPay as jest.Mock;
const mockGenWallet = generateDevnetWallet as jest.Mock;

const app = createTestApp();

beforeEach(() => jest.clearAllMocks());

describe('POST /api/payments/batch', () => {
  it('processes batch payments successfully', async () => {
    mockBatchPay.mockResolvedValueOnce([
      { wallet: 'WalletA', amount: 800, txHash: 'abc123' },
      { wallet: 'WalletB', amount: 1200, txHash: 'def456' },
    ]);
    mockQuery.mockResolvedValue({ rows: [{ handle: '@kol1' }] });

    const res = await request(app).post('/api/payments/batch').send({
      payments: [
        { kol_id: 'kol-1', wallet: 'WalletA', amount: 800 },
        { kol_id: 'kol-2', wallet: 'WalletB', amount: 1200 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].txHash).toBe('abc123');
    expect(res.body.results[1].txHash).toBe('def456');
  });

  it('returns 400 when payments array is missing', async () => {
    const res = await request(app).post('/api/payments/batch').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('payments array required');
  });

  it('returns 400 when payments array is empty', async () => {
    const res = await request(app).post('/api/payments/batch').send({ payments: [] });
    expect(res.status).toBe(400);
  });

  it('handles partial failures (some tx fail, some succeed)', async () => {
    mockBatchPay.mockResolvedValueOnce([
      { wallet: 'WalletA', amount: 800, txHash: 'abc123' },
      { wallet: 'WalletB', amount: 1200, error: 'insufficient funds' },
    ]);
    mockQuery.mockResolvedValue({ rows: [{ handle: '@kol1' }] });

    const res = await request(app).post('/api/payments/batch').send({
      payments: [
        { kol_id: 'kol-1', wallet: 'WalletA', amount: 800 },
        { kol_id: 'kol-2', wallet: 'WalletB', amount: 1200 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.results[0].txHash).toBe('abc123');
    expect(res.body.results[1].error).toBe('insufficient funds');
  });

  it('returns 500 when Solana service throws', async () => {
    mockBatchPay.mockRejectedValueOnce(new Error('RPC connection timeout'));
    const res = await request(app).post('/api/payments/batch').send({
      payments: [{ kol_id: 'kol-1', wallet: 'WalletA', amount: 800 }],
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('RPC connection timeout');
  });

  it('handles single payment correctly', async () => {
    mockBatchPay.mockResolvedValueOnce([
      { wallet: 'WalletA', amount: 2000, txHash: 'single123' },
    ]);
    mockQuery.mockResolvedValue({ rows: [{ handle: '@bigkol' }] });

    const res = await request(app).post('/api/payments/batch').send({
      payments: [{ kol_id: 'kol-1', wallet: 'WalletA', amount: 2000 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('rejects non-array payments field', async () => {
    const res = await request(app).post('/api/payments/batch').send({ payments: 'not-an-array' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/payments/history', () => {
  it('returns payment history', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: '1', kol_handle: '@cryptomoon', wallet: 'WalletA', amount: 800, tx_hash: 'abc123', status: 'confirmed', created_at: new Date().toISOString() },
      ],
    });
    const res = await request(app).get('/api/payments/history');
    expect(res.status).toBe(200);
    expect(res.body[0].kol_handle).toBe('@cryptomoon');
  });

  it('returns empty array when no payments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/payments/history');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/payments/history');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/wallet/generate', () => {
  it('generates a Solana devnet wallet', async () => {
    mockGenWallet.mockResolvedValueOnce({
      publicKey: 'BXNbR5WGzjhJRza4WRqNQ5ebcpF4JNFKqHTiqXJLzxcd',
      secretKey: [1, 2, 3],
    });
    const res = await request(app).post('/api/wallet/generate');
    expect(res.status).toBe(200);
    expect(res.body.publicKey).toHaveLength(44);
    expect(Array.isArray(res.body.secretKey)).toBe(true);
  });

  it('returns 500 if Solana throws', async () => {
    mockGenWallet.mockRejectedValueOnce(new Error('Keypair generation failed'));
    const res = await request(app).post('/api/wallet/generate');
    expect(res.status).toBe(500);
  });
});

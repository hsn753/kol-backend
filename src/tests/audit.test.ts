import request from 'supertest';
import { createTestApp } from './testApp';

jest.mock('../db/pool', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from '../db/pool';
const mockQuery = pool.query as jest.Mock;

const app = createTestApp();

const sampleLogs = [
  { id: '1', action: 'kol_added', kol_handle: '@cryptomoon', campaign_name: 'aspen launch', detail: 'KOL added', tx_hash: null, created_at: '2026-04-14T08:00:00Z' },
  { id: '2', action: 'payment', kol_handle: '@degenalpha', campaign_name: 'aspen launch', detail: 'USDC payout $800', tx_hash: 'abc123', created_at: '2026-04-14T07:55:00Z' },
  { id: '3', action: 'script_sent', kol_handle: '@solkingg', campaign_name: 'aspen launch', detail: 'AM script sent', tx_hash: null, created_at: '2026-04-14T08:01:00Z' },
];

beforeEach(() => jest.clearAllMocks());

describe('GET /api/audit', () => {
  it('returns full audit log', async () => {
    mockQuery.mockResolvedValueOnce({ rows: sampleLogs });
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('includes tx_hash in payment entries', async () => {
    mockQuery.mockResolvedValueOnce({ rows: sampleLogs });
    const res = await request(app).get('/api/audit');
    const paymentEntry = res.body.find((l: { action: string }) => l.action === 'payment');
    expect(paymentEntry.tx_hash).toBe('abc123');
  });

  it('returns null tx_hash for non-payment entries', async () => {
    mockQuery.mockResolvedValueOnce({ rows: sampleLogs });
    const res = await request(app).get('/api/audit');
    const addedEntry = res.body.find((l: { action: string }) => l.action === 'kol_added');
    expect(addedEntry.tx_hash).toBeNull();
  });

  it('returns empty array when log is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection lost'));
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('connection lost');
  });

  it('logs contain all required fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: sampleLogs });
    const res = await request(app).get('/api/audit');
    const log = res.body[0];
    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('action');
    expect(log).toHaveProperty('kol_handle');
    expect(log).toHaveProperty('created_at');
  });
});

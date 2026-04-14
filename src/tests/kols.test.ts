import request from 'supertest';
import { createTestApp } from './testApp';

jest.mock('../db/pool', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from '../db/pool';
const mockQuery = pool.query as jest.Mock;

const app = createTestApp();

const sampleKOL = {
  id: 'uuid-1',
  handle: '@cryptomoon',
  wallet: '7Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  rate: 800,
  campaign_id: null,
  script_schedule: 'am + pm',
  status: 'pending',
  telegram_username: 'cryptomoon',
  created_at: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/kols', () => {
  it('returns list of KOLs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleKOL] });
    const res = await request(app).get('/api/kols');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].handle).toBe('@cryptomoon');
  });

  it('returns empty array when no KOLs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/kols');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));
    const res = await request(app).get('/api/kols');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('DB connection failed');
  });
});

describe('POST /api/kols', () => {
  it('creates a KOL with valid data', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleKOL] }) // INSERT
      .mockResolvedValueOnce({ rows: [] });           // audit_log
    const res = await request(app).post('/api/kols').send({
      handle: '@cryptomoon',
      wallet: '7Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      rate: 800,
      script_schedule: 'am + pm',
      telegram_username: 'cryptomoon',
    });
    expect(res.status).toBe(201);
    expect(res.body.handle).toBe('@cryptomoon');
  });

  it('accepts KOL without telegram_username', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleKOL, telegram_username: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/kols').send({
      handle: '@anon',
      wallet: '3Pxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      rate: 500,
    });
    expect(res.status).toBe(201);
  });

  it('accepts KOL without campaign_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleKOL] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/kols').send({
      handle: '@nocampaign',
      wallet: '9Rxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      rate: 1000,
    });
    expect(res.status).toBe(201);
  });

  it('returns 500 on DB insert failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('unique constraint violated'));
    const res = await request(app).post('/api/kols').send({
      handle: '@cryptomoon',
      wallet: '7Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      rate: 800,
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('unique constraint');
  });

  it('rejects empty body gracefully', async () => {
    mockQuery.mockRejectedValueOnce(new Error('null value in column'));
    const res = await request(app).post('/api/kols').send({});
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/kols/:id', () => {
  it('updates an existing KOL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleKOL, status: 'paid' }] });
    const res = await request(app).put('/api/kols/uuid-1').send({
      handle: '@cryptomoon',
      wallet: '7Hxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      rate: 900,
      script_schedule: 'am + pm',
      status: 'paid',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  it('returns 404 for unknown KOL id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/kols/uuid-nonexistent').send({
      handle: '@x', wallet: 'abc', rate: 0, script_schedule: 'am only', status: 'pending',
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('KOL not found');
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'));
    const res = await request(app).put('/api/kols/uuid-1').send({
      handle: '@x', wallet: 'abc', rate: 0, script_schedule: 'am only', status: 'pending',
    });
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/kols/:id', () => {
  it('deletes an existing KOL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ handle: '@cryptomoon' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/kols/uuid-1');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 for nonexistent KOL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/kols/uuid-ghost');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('KOL not found');
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('FK constraint'));
    const res = await request(app).delete('/api/kols/uuid-1');
    expect(res.status).toBe(500);
  });
});

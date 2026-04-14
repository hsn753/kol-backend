import request from 'supertest';
import { createTestApp } from './testApp';

jest.mock('../db/pool', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from '../db/pool';
const mockQuery = pool.query as jest.Mock;

const app = createTestApp();

const sampleCampaign = {
  id: 'camp-uuid-1',
  name: 'aspen launch',
  ticker: 'ASPEN',
  cashtag: '$ASPEN',
  start_date: '2026-04-14',
  end_date: '2026-04-21',
  script_template: 'Hey {{handle}}, post {{cashtag}} today.',
  status: 'active',
  created_at: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/campaigns', () => {
  it('returns campaign list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sampleCampaign] });
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('aspen launch');
  });

  it('returns empty array when no campaigns', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(500);
  });
});

describe('POST /api/campaigns', () => {
  it('creates a campaign', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleCampaign] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/campaigns').send({
      name: 'aspen launch',
      ticker: 'ASPEN',
      cashtag: '$ASPEN',
      start_date: '2026-04-14',
      end_date: '2026-04-21',
      script_template: 'Hey {{handle}}, post {{cashtag}} today.',
    });
    expect(res.status).toBe(201);
    expect(res.body.ticker).toBe('ASPEN');
  });

  it('returns 500 on DB failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('null value in column'));
    const res = await request(app).post('/api/campaigns').send({});
    expect(res.status).toBe(500);
  });

  it('preserves script_template exactly', async () => {
    const tmpl = 'Hey {{handle}}, shill {{cashtag}} with angle: {{angle}}';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...sampleCampaign, script_template: tmpl }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/campaigns').send({
      name: 'test', ticker: 'TEST', cashtag: '$TEST',
      start_date: '2026-04-14', end_date: '2026-04-21',
      script_template: tmpl,
    });
    expect(res.body.script_template).toBe(tmpl);
  });
});

describe('PUT /api/campaigns/:id', () => {
  it('updates campaign status to inactive', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sampleCampaign, status: 'inactive' }] });
    const res = await request(app).put('/api/campaigns/camp-uuid-1').send({
      ...sampleCampaign, status: 'inactive',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  it('returns 404 for nonexistent campaign', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/campaigns/ghost-id').send(sampleCampaign);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/campaigns/:id/assign', () => {
  it('assigns multiple KOLs to a campaign', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/campaigns/camp-uuid-1/assign')
      .send({ kol_ids: ['kol-1', 'kol-2'] });
    expect(res.status).toBe(200);
    expect(res.body.assigned).toBe(2);
  });

  it('assigns zero KOLs with empty array', async () => {
    const res = await request(app)
      .post('/api/campaigns/camp-uuid-1/assign')
      .send({ kol_ids: [] });
    expect(res.status).toBe(200);
    expect(res.body.assigned).toBe(0);
  });

  it('returns 500 on DB error during assign', async () => {
    mockQuery.mockRejectedValueOnce(new Error('FK constraint violated'));
    const res = await request(app)
      .post('/api/campaigns/camp-uuid-1/assign')
      .send({ kol_ids: ['bad-id'] });
    expect(res.status).toBe(500);
  });
});

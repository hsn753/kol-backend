import request from 'supertest';
import { createTestApp } from './testApp';

jest.mock('../db/pool', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

jest.mock('../services/telegram', () => ({
  sendTelegramDM: jest.fn(),
  buildScript: jest.fn((template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] || `{{${k}}}`)
  ),
}));

import { pool } from '../db/pool';
import { sendTelegramDM } from '../services/telegram';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;
const mockSendTG = sendTelegramDM as jest.Mock;

const app = createTestApp();

const fakeClient = {
  query: jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(fakeClient);
});

describe('POST /api/scripts/distribute', () => {
  it('distributes AM scripts', async () => {
    fakeClient.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'kol-1', handle: '@cryptomoon', wallet: 'WalletA',
          telegram_username: 'cryptomoon', script_schedule: 'am + pm',
          campaign_name: 'aspen launch', ticker: 'ASPEN', cashtag: '$ASPEN',
          script_template: 'Hey {{handle}}, shill {{cashtag}} — {{angle}}',
          campaign_id: 'camp-1',
        }],
      })
      .mockResolvedValue({ rows: [] });

    mockSendTG.mockResolvedValueOnce({ ok: true });

    const res = await request(app)
      .post('/api/scripts/distribute')
      .send({ slot: 'am' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.slot).toBe('am');
    expect(mockSendTG).toHaveBeenCalledTimes(1);
  });

  it('distributes PM scripts', async () => {
    fakeClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/scripts/distribute')
      .send({ slot: 'pm' });

    expect(res.status).toBe(200);
    expect(res.body.slot).toBe('pm');
  });

  it('defaults to AM when no slot provided', async () => {
    fakeClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/scripts/distribute')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.slot).toBe('am');
  });

  it('handles KOL with no telegram_username gracefully', async () => {
    fakeClient.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'kol-1', handle: '@anon', wallet: 'WalletA',
          telegram_username: null, script_schedule: 'am + pm',
          campaign_name: 'aspen launch', ticker: 'ASPEN', cashtag: '$ASPEN',
          script_template: 'Hey {{handle}}', campaign_id: 'camp-1',
        }],
      })
      .mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/scripts/distribute')
      .send({ slot: 'am' });

    expect(res.status).toBe(200);
    expect(mockSendTG).not.toHaveBeenCalled();
  });

  it('handles Telegram DM failure without crashing', async () => {
    fakeClient.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'kol-1', handle: '@cryptomoon', wallet: 'WalletA',
          telegram_username: 'cryptomoon', script_schedule: 'am + pm',
          campaign_name: 'aspen launch', ticker: 'ASPEN', cashtag: '$ASPEN',
          script_template: 'Hey {{handle}}', campaign_id: 'camp-1',
        }],
      })
      .mockResolvedValue({ rows: [] });

    mockSendTG.mockResolvedValueOnce({ ok: false, error: 'user blocked the bot' });

    const res = await request(app)
      .post('/api/scripts/distribute')
      .send({ slot: 'am' });

    expect(res.status).toBe(200);
  });

  it('returns 500 on DB connect failure', async () => {
    mockConnect.mockRejectedValueOnce(new Error('DB unavailable'));
    const res = await request(app).post('/api/scripts/distribute').send({ slot: 'am' });
    expect(res.status).toBe(500);
  });
});

describe('GET /api/scripts/log', () => {
  it('returns script log entries', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: '1', kol_handle: '@cryptomoon', campaign_name: 'aspen launch', slot: 'am', status: 'sent' }],
    });
    const res = await request(app).get('/api/scripts/log');
    expect(res.status).toBe(200);
    expect(res.body[0].kol_handle).toBe('@cryptomoon');
  });

  it('returns empty array when no logs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/scripts/log');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('query timeout'));
    const res = await request(app).get('/api/scripts/log');
    expect(res.status).toBe(500);
  });
});

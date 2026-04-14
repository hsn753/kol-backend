import request from 'supertest';
import { createTestApp } from './testApp';

const app = createTestApp();

describe('Health Check', () => {
  it('GET /health returns ok:true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await request(app).get('/nonexistent-route-xyz');
    expect(res.status).toBe(404);
  });

  it('responds with JSON content-type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

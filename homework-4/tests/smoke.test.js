'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');

describe('Notes API smoke test', () => {
  let app;

  beforeEach(() => {
    app = createApp(createDb());
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /notes returns seeded notes', async () => {
    const res = await request(app).get('/notes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notes)).toBe(true);
    expect(res.body.notes.length).toBeGreaterThan(0);
  });
});

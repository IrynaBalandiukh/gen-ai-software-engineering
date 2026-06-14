'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');

describe('Bug Fixes — Batch 001', () => {
  let app;

  beforeEach(() => {
    app = createApp(createDb());
  });

  describe('BUG-001: Pagination off-by-one fix', () => {
    test('page 1 returns the first batch of notes (ids 1-10)', async () => {
      const res = await request(app).get('/notes?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.notes).toHaveLength(10);
      expect(res.body.notes[0].id).toBe(1);
      expect(res.body.notes[9].id).toBe(10);
    });

    test('page 2 returns the next batch of notes (ids 11-12)', async () => {
      const res = await request(app).get('/notes?page=2&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
      expect(res.body.notes).toHaveLength(2);
      expect(res.body.notes[0].id).toBe(11);
      expect(res.body.notes[1].id).toBe(12);
    });

    test('page 3 returns empty array (out of range)', async () => {
      const res = await request(app).get('/notes?page=3&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(3);
      expect(res.body.notes).toHaveLength(0);
    });

    test('page boundaries are contiguous (no overlap, no gaps)', async () => {
      const resPage1 = await request(app).get('/notes?page=1&limit=5');
      const resPage2 = await request(app).get('/notes?page=2&limit=5');
      const resPage3 = await request(app).get('/notes?page=3&limit=5');

      const ids1 = resPage1.body.notes.map(n => n.id);
      const ids2 = resPage2.body.notes.map(n => n.id);
      const ids3 = resPage3.body.notes.map(n => n.id);

      expect(ids1).toEqual([1, 2, 3, 4, 5]);
      expect(ids2).toEqual([6, 7, 8, 9, 10]);
      expect(ids3).toEqual([11, 12]);
    });

    test('default page is 1, default limit is 10', async () => {
      const res = await request(app).get('/notes');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.notes).toHaveLength(10);
    });
  });

  describe('BUG-002: Incomplete input validation fix', () => {
    test('missing title returns 400 with error message', async () => {
      const res = await request(app)
        .post('/notes')
        .send({ body: 'Some body', owner: 'alice' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('required');
    });

    test('missing body returns 400 with error message', async () => {
      const res = await request(app)
        .post('/notes')
        .send({ title: 'Title', owner: 'alice' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('required');
    });

    test('missing owner returns 400 with error message', async () => {
      const res = await request(app)
        .post('/notes')
        .send({ title: 'Title', body: 'Some body' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('required');
    });

    test('missing all fields returns 400 with error message', async () => {
      const res = await request(app).post('/notes').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('required');
    });

    test('complete payload returns 201 with created note', async () => {
      const newNote = { title: 'Test Note', body: 'Test Body', owner: 'bob' };
      const res = await request(app).post('/notes').send(newNote);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(newNote.title);
      expect(res.body.body).toBe(newNote.body);
      expect(res.body.owner).toBe(newNote.owner);
    });

    test('created note can be retrieved via GET /notes/:id', async () => {
      const newNote = { title: 'Retrievable', body: 'Get me back', owner: 'charlie' };
      const createRes = await request(app).post('/notes').send(newNote);
      expect(createRes.status).toBe(201);
      const noteId = createRes.body.id;

      const getRes = await request(app).get(`/notes/${noteId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(noteId);
      expect(getRes.body.title).toBe(newNote.title);
    });

    test('created note appears in paginated list', async () => {
      const newNote = { title: 'In the list', body: 'See me on page', owner: 'dave' };
      const createRes = await request(app).post('/notes').send(newNote);
      expect(createRes.status).toBe(201);
      const createdId = createRes.body.id;

      const listRes = await request(app).get('/notes?page=2&limit=10');
      expect(listRes.status).toBe(200);
      const ids = listRes.body.notes.map(n => n.id);
      expect(ids).toContain(createdId);
    });
  });

  describe('SEC-001: SQL injection fix', () => {
    test('normal search returns matching notes', async () => {
      const res = await request(app).get('/search?q=Welcome');
      expect(res.status).toBe(200);
      expect(res.body.q).toBe('Welcome');
      expect(Array.isArray(res.body.notes)).toBe(true);
      expect(res.body.notes.length).toBeGreaterThan(0);
      expect(res.body.notes[0].title).toContain('Welcome');
    });

    test('search with empty query returns empty results', async () => {
      const res = await request(app).get('/search?q=NONEXISTENT_TERM_xyz');
      expect(res.status).toBe(200);
      expect(res.body.q).toBe('NONEXISTENT_TERM_xyz');
      expect(res.body.notes).toHaveLength(0);
    });

    test('SQL injection attempt (\' OR \'1\'=\'1) is treated as literal, returns no spurious results', async () => {
      const injectionPayload = "' OR '1'='1";
      const res = await request(app).get(`/search?q=${encodeURIComponent(injectionPayload)}`);
      expect(res.status).toBe(200);
      expect(res.body.q).toBe(injectionPayload);
      expect(res.body.notes).toHaveLength(0);
    });

    test('destructive payload (DROP TABLE) is treated as literal, does not drop table', async () => {
      const destructivePayload = "'; DROP TABLE notes; --";
      const res = await request(app).get(`/search?q=${encodeURIComponent(destructivePayload)}`);
      expect(res.status).toBe(200);
      expect(res.body.notes).toHaveLength(0);

      const checkRes = await request(app).get('/notes');
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.notes).toHaveLength(10);
    });

    test('parameterized query does not allow breaking out of LIKE pattern', async () => {
      const beforeRes = await request(app).get('/notes');
      const countBefore = beforeRes.body.notes.length;

      const injectionPayload = "' OR title LIKE '%";
      const res = await request(app).get(`/search?q=${encodeURIComponent(injectionPayload)}`);
      expect(res.status).toBe(200);
      expect(res.body.notes).toHaveLength(0);

      const afterRes = await request(app).get('/notes');
      const countAfter = afterRes.body.notes.length;
      expect(countAfter).toBe(countBefore);
    });

    test('search for substring still works after attempted injections', async () => {
      const newNote = { title: 'TestSearchable', body: 'Find me', owner: 'eve' };
      const createRes = await request(app).post('/notes').send(newNote);
      expect(createRes.status).toBe(201);

      const res = await request(app).get('/search?q=TestSearch');
      expect(res.status).toBe(200);
      expect(res.body.notes.length).toBeGreaterThan(0);
      expect(res.body.notes[0].title).toContain('TestSearch');
    });
  });
});

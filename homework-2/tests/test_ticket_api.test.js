const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const ticketRepository = require('../src/repositories/ticketRepository');
const errorHandler = require('../src/middleware/errorHandler');

const FIXTURES = path.join(__dirname, 'fixtures');

const validTicket = {
  customer_id: 'CUST001',
  customer_email: 'user@example.com',
  customer_name: 'Test User',
  subject: 'Test ticket subject',
  description: 'This is a detailed description of the test ticket that meets the minimum length',
};

beforeEach(() => ticketRepository.clear());

describe('POST /tickets', () => {
  it('returns 201 and a ticket with UUID id for valid body', async () => {
    const res = await request(app).post('/tickets').send(validTicket);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/tickets').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 with message mentioning customer_email for invalid email', async () => {
    const res = await request(app)
      .post('/tickets')
      .send({ ...validTicket, customer_email: 'notanemail' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('customer_email');
  });

  it('returns 201 with non-null category when auto_classify=true', async () => {
    const res = await request(app)
      .post('/tickets?auto_classify=true')
      .send({ ...validTicket, subject: 'Login issue', description: 'Cannot login to my account after password reset' });
    expect(res.status).toBe(201);
    expect(res.body.category).not.toBeNull();
  });
});

describe('GET /tickets', () => {
  it('returns 200 and empty array when store is empty', async () => {
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only tickets with status=new when filtering by status', async () => {
    await request(app).post('/tickets').send(validTicket);
    await request(app).post('/tickets').send(validTicket);
    const res = await request(app).get('/tickets?status=new');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(ticket => expect(ticket.status).toBe('new'));
  });
});

describe('GET /tickets/:id', () => {
  it('returns 200 and the ticket body for an existing ticket', async () => {
    const created = await request(app).post('/tickets').send(validTicket);
    const res = await request(app).get(`/tickets/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 for an unknown UUID', async () => {
    const res = await request(app).get('/tickets/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PUT /tickets/:id', () => {
  it('returns 200 and updated_at has changed after a valid update', async () => {
    const created = await request(app).post('/tickets').send(validTicket);
    await new Promise(r => setTimeout(r, 5));
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ ...validTicket, subject: 'Updated Subject' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Updated Subject');
    expect(res.body.updated_at).not.toBe(created.body.updated_at);
  });
});

describe('DELETE /tickets/:id', () => {
  it('returns 204 for an existing ticket', async () => {
    const created = await request(app).post('/tickets').send(validTicket);
    const res = await request(app).delete(`/tickets/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for an unknown UUID', async () => {
    const res = await request(app).delete('/tickets/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PUT /tickets/:id edge cases', () => {
  it('returns 400 for a body that fails validation', async () => {
    const created = await request(app).post('/tickets').send(validTicket);
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ ...validTicket, customer_email: 'bad-email' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown ticket id', async () => {
    const res = await request(app)
      .put('/tickets/00000000-0000-4000-8000-000000000000')
      .send(validTicket);
    expect(res.status).toBe(404);
  });
});

describe('POST /tickets/:id/auto-classify', () => {
  it('returns 200 with classification result for an existing ticket', async () => {
    const created = await request(app).post('/tickets').send({
      ...validTicket,
      subject: 'Login failed',
      description: 'Cannot access my account after password reset',
    });
    const res = await request(app).post(`/tickets/${created.body.id}/auto-classify`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      category: expect.any(String),
      priority: expect.any(String),
      confidence: expect.any(Number),
      reasoning: expect.any(String),
      keywords_found: expect.any(Array),
    });
  });

  it('returns 404 for an unknown ticket id', async () => {
    const res = await request(app).post('/tickets/00000000-0000-4000-8000-000000000000/auto-classify');
    expect(res.status).toBe(404);
  });
});

describe('GET /tickets with multiple filter params', () => {
  it('filters by priority', async () => {
    await request(app).post('/tickets').send({ ...validTicket, priority: 'high' });
    await request(app).post('/tickets').send({ ...validTicket, priority: 'low' });
    const res = await request(app).get('/tickets?priority=high');
    expect(res.status).toBe(200);
    res.body.forEach(t => expect(t.priority).toBe('high'));
  });

  it('filters by category', async () => {
    await request(app).post('/tickets').send({ ...validTicket, category: 'billing_question' });
    await request(app).post('/tickets').send({ ...validTicket, category: 'bug_report' });
    const res = await request(app).get('/tickets?category=billing_question');
    expect(res.status).toBe(200);
    res.body.forEach(t => expect(t.category).toBe('billing_question'));
  });

  it('filters by customer_id', async () => {
    await request(app).post('/tickets').send({ ...validTicket, customer_id: 'UNIQUE-001' });
    await request(app).post('/tickets').send({ ...validTicket, customer_id: 'OTHER-002' });
    const res = await request(app).get('/tickets?customer_id=UNIQUE-001');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].customer_id).toBe('UNIQUE-001');
  });
});

describe('POST /tickets/import format detection', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await request(app).post('/tickets/import');
    expect(res.status).toBe(400);
  });

  it('detects JSON format from application/json MIME type', async () => {
    const jsonBuffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.json'));
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', jsonBuffer, { filename: 'tickets.json', contentType: 'application/json' });
    expect(res.status).toBe(207);
    expect(res.body.successful).toBeGreaterThan(0);
  });

  it('detects XML format from application/xml MIME type', async () => {
    const xmlBuffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.xml'));
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', xmlBuffer, { filename: 'tickets.xml', contentType: 'application/xml' });
    expect(res.status).toBe(207);
    expect(res.body.successful).toBeGreaterThan(0);
  });

  it('falls back to filename extension when MIME type is octet-stream', async () => {
    const csvBuffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.csv'));
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', csvBuffer, { filename: 'tickets.csv', contentType: 'application/octet-stream' });
    expect(res.status).toBe(207);
    expect(res.body.successful).toBeGreaterThan(0);
  });

  it('returns 400 for unsupported file format', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from('some data'), { filename: 'tickets.txt', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });

  it('returns 207 with failed count when file content is malformed XML', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from('<tickets><ticket>Unclosed'), { filename: 'tickets.xml', contentType: 'application/xml' });
    expect(res.status).toBe(207);
    expect(res.body.successful).toBe(0);
    expect(res.body.failed).toBe(1);
  });
});

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('uses err.status when err.statusCode is absent', () => {
    errorHandler({ status: 422, message: 'Unprocessable' }, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(422);
  });

  it('defaults to 500 when the error has no status code', () => {
    errorHandler({ message: 'Something went wrong' }, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('omits stack trace when NODE_ENV is production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    errorHandler({ statusCode: 500, message: 'Prod error' }, mockReq, mockRes, mockNext);
    process.env.NODE_ENV = original;
    const body = mockRes.json.mock.calls[0][0];
    expect(body.stack).toBeUndefined();
  });

  it('always includes error, message, and details in the response body', () => {
    errorHandler({ statusCode: 400, message: 'Bad', details: [{ field: 'x' }] }, mockReq, mockRes, mockNext);
    const body = mockRes.json.mock.calls[0][0];
    expect(body.error).toBe(true);
    expect(body.message).toBe('Bad');
    expect(body.details).toEqual([{ field: 'x' }]);
  });
});

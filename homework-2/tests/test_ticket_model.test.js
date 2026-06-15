const { validate } = require('../src/validators/ticketValidator');
const ticketRepository = require('../src/repositories/ticketRepository');
const { createTicket } = require('../src/services/ticketService');

const minimalValid = {
  customer_id: 'CUST001',
  customer_email: 'user@example.com',
  customer_name: 'Test User',
  subject: 'Valid Subject',
  description: 'This is a valid description with enough characters',
};

describe('Ticket Validator', () => {
  it('passes for minimal valid ticket and applies defaults', () => {
    const { error, value } = validate(minimalValid);
    expect(error).toBeUndefined();
    expect(value.category).toBe('other');
    expect(value.priority).toBe('medium');
    expect(value.status).toBe('new');
    expect(value.tags).toEqual([]);
  });

  it('passes for full valid ticket with all optional fields', () => {
    const { error } = validate({
      ...minimalValid,
      category: 'technical_issue',
      priority: 'high',
      status: 'in_progress',
      assigned_to: 'agent1',
      tags: ['bug', 'urgent'],
      metadata: { source: 'web_form', browser: 'Chrome', device_type: 'desktop' },
    });
    expect(error).toBeUndefined();
  });

  it('errors when customer_email is missing', () => {
    const { customer_email, ...rest } = minimalValid;
    const { error } = validate(rest);
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('customer_email');
  });

  it('errors when customer_email is not a valid email format', () => {
    const { error } = validate({ ...minimalValid, customer_email: 'notanemail' });
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('customer_email');
  });

  it('errors when subject is empty string', () => {
    const { error } = validate({ ...minimalValid, subject: '' });
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('subject');
  });

  it('errors when subject exceeds 200 characters', () => {
    const { error } = validate({ ...minimalValid, subject: 'a'.repeat(201) });
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('subject');
  });

  it('errors when description is shorter than 10 characters', () => {
    const { error } = validate({ ...minimalValid, description: '123456789' });
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('description');
  });

  it('errors when category has an invalid enum value', () => {
    const { error } = validate({ ...minimalValid, category: 'invalid_value' });
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('category');
  });

  it('errors when priority has an invalid enum value', () => {
    const { error } = validate({ ...minimalValid, priority: 'invalid_value' });
    const fields = error.details.map(d => d.path[0]);
    expect(fields).toContain('priority');
  });
});

describe('Ticket Repository edge cases', () => {
  beforeEach(() => ticketRepository.clear());

  it('update returns undefined for an id that does not exist', () => {
    const result = ticketRepository.update('nonexistent-id', { subject: 'New' });
    expect(result).toBeUndefined();
  });

  it('findAll with no filters returns all tickets', () => {
    ticketRepository.create({ ...minimalValid, tags: [] });
    ticketRepository.create({ ...minimalValid, tags: [] });
    const all = ticketRepository.findAll();
    expect(all.length).toBe(2);
  });

  it('findAll filters by matching field value', () => {
    ticketRepository.create({ ...minimalValid, status: 'new', tags: [] });
    ticketRepository.create({ ...minimalValid, status: 'closed', tags: [] });
    const results = ticketRepository.findAll({ status: 'new' });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('new');
  });

  it('delete returns false for an id that does not exist', () => {
    const result = ticketRepository.delete('nonexistent-id');
    expect(result).toBe(false);
  });
});

describe('Ticket Service edge cases', () => {
  beforeEach(() => ticketRepository.clear());

  it('createTicket throws a 400 error for invalid data', async () => {
    await expect(createTicket({})).rejects.toMatchObject({ statusCode: 400 });
  });
});

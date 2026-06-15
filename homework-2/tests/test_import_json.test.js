const fs = require('fs');
const path = require('path');
const { parseJSON } = require('../src/parsers/jsonParser');

const FIXTURES = path.join(__dirname, 'fixtures');

describe('JSON Parser', () => {
  it('resolves with correct count from valid fixture (root array)', async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.json'));
    const tickets = await parseJSON(buffer);
    expect(Array.isArray(tickets)).toBe(true);
    expect(tickets.length).toBe(5);
  });

  it('resolves when JSON is wrapped in a tickets envelope object', async () => {
    const envelope = { tickets: [{ id: 1 }, { id: 2 }] };
    const buffer = Buffer.from(JSON.stringify(envelope));
    const tickets = await parseJSON(buffer);
    expect(tickets.length).toBe(2);
    expect(tickets[0].id).toBe(1);
  });

  it('rejects when JSON is malformed', async () => {
    const buffer = Buffer.from('{"broken": json');
    await expect(parseJSON(buffer)).rejects.toThrow();
  });

  it('rejects with descriptive error when root object has no tickets key', async () => {
    const buffer = Buffer.from(JSON.stringify({ notTickets: [] }));
    await expect(parseJSON(buffer)).rejects.toThrow(/tickets/i);
  });

  it('resolves with empty array for empty JSON array', async () => {
    const buffer = Buffer.from('[]');
    const tickets = await parseJSON(buffer);
    expect(tickets).toEqual([]);
  });
});

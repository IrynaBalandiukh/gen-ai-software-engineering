const fs = require('fs');
const path = require('path');
const { parseXML } = require('../src/parsers/xmlParser');

const FIXTURES = path.join(__dirname, 'fixtures');

describe('XML Parser', () => {
  it('resolves with correct ticket count from valid fixture', async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.xml'));
    const tickets = await parseXML(buffer);
    expect(Array.isArray(tickets)).toBe(true);
    expect(tickets.length).toBe(5);
  });

  it('every parsed ticket has a subject property', async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.xml'));
    const tickets = await parseXML(buffer);
    tickets.forEach(ticket => {
      expect(ticket).toHaveProperty('subject');
    });
  });

  it('returns an array of length 1 for a single-ticket XML (single-child guard)', async () => {
    const xml = '<tickets><ticket><subject>Hi</subject></ticket></tickets>';
    const buffer = Buffer.from(xml);
    const tickets = await parseXML(buffer);
    expect(Array.isArray(tickets)).toBe(true);
    expect(tickets.length).toBe(1);
  });

  it('rejects when XML is malformed', async () => {
    const buffer = Buffer.from('<tickets><ticket>Unclosed');
    await expect(parseXML(buffer)).rejects.toThrow();
  });

  it('rejects with descriptive error when root element is not <tickets>', async () => {
    const buffer = Buffer.from('<root><items/></root>');
    await expect(parseXML(buffer)).rejects.toThrow(/tickets/i);
  });
});

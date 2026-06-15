const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, 'fixtures');

describe('CSV Parser', () => {
  let parseCSV;

  beforeAll(() => {
    parseCSV = require('../src/parsers/csvParser').parseCSV;
  });

  it('resolves with correct row count from valid fixture', async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.csv'));
    const rows = await parseCSV(buffer);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(10);
  });

  it('every row has subject and customer_email keys', async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.csv'));
    const rows = await parseCSV(buffer);
    rows.forEach(row => {
      expect(row).toHaveProperty('subject');
      expect(row).toHaveProperty('customer_email');
    });
  });

  it('no row is null or undefined', async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, 'sample_tickets_valid.csv'));
    const rows = await parseCSV(buffer);
    rows.forEach(row => {
      expect(row).not.toBeNull();
      expect(row).not.toBeUndefined();
    });
  });

  it('rejects with an error message when the CSV stream emits an error', async () => {
    jest.resetModules();
    jest.doMock('csv-parser', () => {
      const { Transform } = require('stream');
      return () => new Transform({
        objectMode: true,
        transform(chunk, encoding, cb) {
          cb(new Error('Simulated CSV parse error'));
        },
      });
    });

    const { parseCSV: parseCSVMocked } = require('../src/parsers/csvParser');

    await expect(parseCSVMocked(Buffer.from('col\nval\n'))).rejects.toMatchObject({
      message: expect.any(String),
    });

    jest.resetModules();
    jest.unmock('csv-parser');
  });

  it('resolves with empty array when buffer contains only the header row', async () => {
    const buffer = Buffer.from('customer_id,customer_email,customer_name,subject,description\n');
    const rows = await parseCSV(buffer);
    expect(rows).toEqual([]);
  });

  it('parses rows with extra unknown columns without error', async () => {
    const buffer = Buffer.from(
      'customer_id,customer_email,customer_name,subject,description,extra_field\n' +
      'C001,test@example.com,Test User,Subject line,Description text,extra_value\n'
    );
    const rows = await parseCSV(buffer);
    expect(rows.length).toBe(1);
    expect(rows[0].extra_field).toBe('extra_value');
  });
});

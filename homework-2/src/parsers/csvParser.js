const { Readable } = require('stream');
const csvParser = require('csv-parser');

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const readable = Readable.from([buffer]);

    readable
      .pipe(csvParser())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve(rows);
      })
      .on('error', (err) => {
        reject({
          message: err.message,
          line: null,
        });
      });
  });
}

module.exports = {
  parseCSV,
};

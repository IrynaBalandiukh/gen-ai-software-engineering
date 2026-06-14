'use strict';

const Database = require('better-sqlite3');

/**
 * Creates an in-memory SQLite database, seeds a small schema, and returns the
 * connection. Using an in-memory DB keeps the sample app self-contained and
 * makes tests fully isolated (a fresh DB per call).
 *
 * @returns {import('better-sqlite3').Database}
 */
function createDb() {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE notes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT NOT NULL,
      body      TEXT NOT NULL,
      owner     TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insertUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  insertUser.run('admin', 's3cr3t');
  insertUser.run('iryna', 'password123');

  const insertNote = db.prepare('INSERT INTO notes (title, body, owner) VALUES (?, ?, ?)');
  // 12 seeded notes so pagination (page size 10) spans more than one page and is
  // therefore observable/testable.
  const seedNotes = [
    ['Welcome', 'First note', 'admin'],
    ['Groceries', 'Milk and eggs', 'iryna'],
    ['Ideas', 'Build an agent pipeline', 'iryna'],
    ['Books', 'Finish reading the SQL book', 'iryna'],
    ['Workout', 'Leg day on Monday', 'admin'],
    ['Recipes', 'Try the new pasta recipe', 'iryna'],
    ['Travel', 'Plan summer trip', 'admin'],
    ['Movies', 'Watch the documentary', 'iryna'],
    ['Meeting', 'Standup at 10am', 'admin'],
    ['Birthday', 'Buy a present', 'iryna'],
    ['Garden', 'Water the plants', 'admin'],
    ['Music', 'Practice guitar', 'iryna'],
  ];
  for (const [title, body, owner] of seedNotes) {
    insertNote.run(title, body, owner);
  }

  return db;
}

module.exports = { createDb };

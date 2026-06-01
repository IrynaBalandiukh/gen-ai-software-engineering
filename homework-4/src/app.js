'use strict';

const express = require('express');
const { createDb } = require('./db');

/**
 * Builds the Express application. The database connection is injected so tests
 * can supply a fresh, isolated in-memory DB per run.
 *
 * @param {import('better-sqlite3').Database} [db] - optional database connection
 * @returns {import('express').Express}
 */
function createApp(db = createDb()) {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * List notes with simple pagination.
   * Query params: page (1-based), limit.
   */
  app.get('/notes', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const rows = db
      .prepare('SELECT * FROM notes ORDER BY id LIMIT ? OFFSET ?')
      .all(limit, offset);

    res.json({ page, limit, notes: rows });
  });

  /**
   * Get a single note by id.
   */
  app.get('/notes/:id', (req, res) => {
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  });

  /**
   * Create a note.
   */
  app.post('/notes', (req, res) => {
    const { title, body, owner } = req.body || {};
    if (!title || !body || !owner) {
      return res.status(400).json({ error: 'title, body and owner are required' });
    }
    const info = db
      .prepare('INSERT INTO notes (title, body, owner) VALUES (?, ?, ?)')
      .run(title, body, owner);
    const created = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  });

  /**
   * Search notes by title substring.
   */
  app.get('/search', (req, res) => {
    const term = String(req.query.q || '');
    const rows = db
      .prepare("SELECT * FROM notes WHERE title LIKE '%' || ? || '%'")
      .all(term);
    res.json({ q: term, notes: rows });
  });

  /**
   * Login endpoint.
   */
  app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ ok: true, username: user.username });
  });

  return app;
}

module.exports = { createApp };

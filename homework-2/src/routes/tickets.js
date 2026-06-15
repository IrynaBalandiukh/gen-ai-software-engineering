const express = require('express');
const multer = require('multer');
const ticketService = require('../services/ticketService');
const ticketValidator = require('../validators/ticketValidator');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// POST /tickets - Create a new ticket
router.post('/', async (req, res, next) => {
  try {
    const auto_classify = req.query.auto_classify === 'true';
    const ticket = await ticketService.createTicket(req.body, { auto_classify });
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

// POST /tickets/import - Bulk import tickets
router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('No file provided');
      err.statusCode = 400;
      throw err;
    }

    const mimetype = req.file.mimetype.toLowerCase();
    let format;

    if (mimetype === 'text/csv' || mimetype === 'application/csv') {
      format = 'csv';
    } else if (mimetype === 'application/json') {
      format = 'json';
    } else if (mimetype === 'text/xml' || mimetype === 'application/xml') {
      format = 'xml';
    } else {
      const filename = req.file.originalname.toLowerCase();
      if (filename.endsWith('.csv')) {
        format = 'csv';
      } else if (filename.endsWith('.json')) {
        format = 'json';
      } else if (filename.endsWith('.xml')) {
        format = 'xml';
      } else {
        const err = new Error('Unsupported file format');
        err.statusCode = 400;
        throw err;
      }
    }

    const result = await ticketService.importTickets(req.file, format);
    res.status(207).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /tickets - List all tickets (with optional filters)
router.get('/', (req, res, next) => {
  try {
    const filters = {};

    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.priority) {
      filters.priority = req.query.priority;
    }
    if (req.query.category) {
      filters.category = req.query.category;
    }
    if (req.query.customer_id) {
      filters.customer_id = req.query.customer_id;
    }

    const tickets = ticketService.listTickets(filters);
    res.status(200).json(tickets);
  } catch (err) {
    next(err);
  }
});

// GET /tickets/:id - Get a specific ticket
router.get('/:id', (req, res, next) => {
  try {
    const ticket = ticketService.getTicket(req.params.id);
    res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
});

// PUT /tickets/:id - Update a ticket
router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = ticketValidator.validateForUpdate({
      ...req.body,
      id: req.params.id,
    });
    if (error) {
      const err = new Error(error.details.map(d => d.message).join(', '));
      err.statusCode = 400;
      throw err;
    }

    const ticket = await ticketService.updateTicket(req.params.id, value);
    res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
});

// DELETE /tickets/:id - Delete a ticket
router.delete('/:id', (req, res, next) => {
  try {
    ticketService.deleteTicket(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /tickets/:id/auto-classify - Auto-classify a ticket
router.post('/:id/auto-classify', async (req, res, next) => {
  try {
    const classification = await ticketService.classifyTicket(req.params.id);
    res.status(200).json(classification);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

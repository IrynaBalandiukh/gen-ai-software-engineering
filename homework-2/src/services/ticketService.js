const ticketRepository = require('../repositories/ticketRepository');
const { validate } = require('../validators/ticketValidator');
const { classify } = require('./classificationService');
const { parseCSV } = require('../parsers/csvParser');
const { parseJSON } = require('../parsers/jsonParser');
const { parseXML } = require('../parsers/xmlParser');

async function createTicket(data, options = {}) {
  const { error, value } = validate(data);

  if (error) {
    const errorMessage = error.details.map((d) => d.message).join('; ');
    const err = new Error(errorMessage);
    err.statusCode = 400;
    err.details = error.details;
    throw err;
  }

  let ticket = ticketRepository.create(value);

  if (options.auto_classify) {
    const classification = classify(value.subject, value.description, ticket.id);
    ticket = ticketRepository.update(ticket.id, {
      category: classification.category,
      priority: classification.priority,
      classification_meta: {
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        keywords_found: classification.keywords_found,
      },
    });
  }

  return ticket;
}

function getTicket(id) {
  const ticket = ticketRepository.findById(id);
  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  return ticket;
}

function listTickets(filters) {
  return ticketRepository.findAll(filters);
}

function updateTicket(id, changes) {
  getTicket(id);
  const updated = ticketRepository.update(id, changes);
  return updated;
}

function deleteTicket(id) {
  getTicket(id);
  ticketRepository.delete(id);
  return { deleted: true };
}

function normalizeImportRow(row) {
  const normalized = {};
  for (const [key, val] of Object.entries(row)) {
    normalized[key] = val === '' ? undefined : val;
  }
  if (normalized.tags !== undefined && !Array.isArray(normalized.tags)) {
    normalized.tags = normalized.tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  return normalized;
}

async function importTickets(file, format) {
  let parser;

  if (format === 'csv') {
    parser = parseCSV;
  } else if (format === 'json') {
    parser = parseJSON;
  } else if (format === 'xml') {
    parser = parseXML;
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  let rawRows;
  try {
    rawRows = await parser(file.buffer);
  } catch (parseErr) {
    return {
      total: 0,
      successful: 0,
      failed: 1,
      errors: [{ row: null, message: parseErr.message }],
      tickets: [],
    };
  }

  const successful = [];
  const failed = [];

  for (let index = 0; index < rawRows.length; index++) {
    const row = normalizeImportRow(rawRows[index]);
    const { error, value } = validate(row);

    if (error) {
      failed.push({
        row: index + 1,
        message: error.details.map((d) => d.message).join('; '),
      });
    } else {
      const ticket = ticketRepository.create(value);
      const classification = classify(value.subject, value.description, ticket.id);
      const updatedTicket = ticketRepository.update(ticket.id, {
        category: classification.category,
        priority: classification.priority,
        classification_meta: {
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          keywords_found: classification.keywords_found,
        },
      });
      successful.push(updatedTicket);
    }
  }

  return {
    total: rawRows.length,
    successful: successful.length,
    failed: failed.length,
    errors: failed,
    tickets: successful,
  };
}

async function classifyTicket(id) {
  const ticket = getTicket(id);
  const classification = classify(ticket.subject, ticket.description, ticket.id);

  ticketRepository.update(id, {
    category: classification.category,
    priority: classification.priority,
    classification_meta: {
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      keywords_found: classification.keywords_found,
    },
  });

  return classification;
}

module.exports = {
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  deleteTicket,
  importTickets,
  classifyTicket,
};

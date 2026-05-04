const { v4: uuidv4 } = require('uuid');

const store = new Map();

function create(ticketData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const ticket = {
    ...ticketData,
    id,
    created_at: now,
    updated_at: now,
  };
  store.set(id, ticket);
  return ticket;
}

function findById(id) {
  return store.get(id);
}

function findAll(filters = {}) {
  const tickets = Array.from(store.values());

  if (Object.keys(filters).length === 0) {
    return tickets;
  }

  return tickets.filter(ticket => {
    for (const [key, value] of Object.entries(filters)) {
      if (ticket[key] !== value) {
        return false;
      }
    }
    return true;
  });
}

function update(id, changes) {
  const ticket = store.get(id);
  if (!ticket) {
    return undefined;
  }

  const updated = {
    ...ticket,
    ...changes,
    updated_at: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

function deleteTicket(id) {
  return store.delete(id);
}

function clear() {
  store.clear();
}

module.exports = {
  create,
  findById,
  findAll,
  update,
  delete: deleteTicket,
  clear,
};

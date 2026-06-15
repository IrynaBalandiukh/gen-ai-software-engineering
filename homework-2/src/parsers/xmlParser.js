const xml2js = require('xml2js');

async function parseXML(buffer) {
  try {
    const text = buffer.toString('utf8');
    const result = await xml2js.parseStringPromise(text, {
      explicitArray: false,
      mergeAttrs: true,
    });

    if (!result.tickets) {
      throw new Error('XML must contain a <tickets> root element');
    }

    const ticketData = result.tickets.ticket;

    if (!ticketData) {
      return [];
    }

    if (Array.isArray(ticketData)) {
      return ticketData;
    }

    return [ticketData];
  } catch (err) {
    throw new Error(`Invalid XML: ${err.message}`);
  }
}

module.exports = {
  parseXML,
};

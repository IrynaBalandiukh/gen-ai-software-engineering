function log(ticketId, classificationResult) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'ticket_classified',
    ticket_id: ticketId,
    category: classificationResult.category,
    priority: classificationResult.priority,
    confidence: classificationResult.confidence,
    keywords_found: classificationResult.keywords_found,
  };

  console.log(JSON.stringify(logEntry));
}

module.exports = {
  log,
};

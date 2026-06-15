const classificationLogger = require('../utils/classificationLogger');

const CATEGORY_KEYWORDS = {
  account_access: [
    'login',
    'password',
    '2fa',
    'sign in',
    'sign out',
    'locked',
    'account',
    'authentication',
    'access denied',
  ],
  technical_issue: [
    'error',
    'crash',
    'bug',
    'not working',
    'broken',
    'exception',
    'timeout',
    'slow',
    'performance',
    'fail',
  ],
  billing_question: [
    'payment',
    'invoice',
    'charge',
    'refund',
    'subscription',
    'billing',
    'price',
    'cost',
    'receipt',
  ],
  feature_request: [
    'would like',
    'request',
    'suggest',
    'enhance',
    'add',
    'new feature',
    'improvement',
    'wish',
  ],
  bug_report: [
    'reproduce',
    'steps to reproduce',
    'expected',
    'actual',
    'regression',
    'defect',
    'version',
  ],
};

const PRIORITY_KEYWORDS = {
  urgent: ["can't access", 'critical', 'production down', 'security'],
  high: ['important', 'blocking', 'asap'],
  low: ['minor', 'cosmetic', 'suggestion'],
};

function classify(subject, description, ticketId = null) {
  const text = `${subject} ${description}`.toLowerCase();

  let categoryMatches = {};
  let keywordsFound = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let count = 0;
    const matchedKeywords = [];

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        count += 1;
        matchedKeywords.push(keyword);
      }
    }

    categoryMatches[category] = count;
    if (matchedKeywords.length > 0) {
      keywordsFound = keywordsFound.concat(matchedKeywords);
    }
  }

  let selectedCategory = 'other';
  let maxCount = 0;

  for (const [category, count] of Object.entries(categoryMatches)) {
    if (count > maxCount) {
      maxCount = count;
      selectedCategory = category;
    }
  }

  let selectedPriority = 'medium';
  const priorityOrder = ['urgent', 'high', 'low'];

  for (const priority of priorityOrder) {
    const keywords = PRIORITY_KEYWORDS[priority];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        selectedPriority = priority;
        break;
      }
    }
    if (selectedPriority !== 'medium') {
      break;
    }
  }

  const confidence = Math.min(maxCount / 5, 1.0);

  const result = {
    category: selectedCategory,
    priority: selectedPriority,
    confidence,
    reasoning: `Matched ${maxCount} category keywords and detected priority level "${selectedPriority}".`,
    keywords_found: keywordsFound,
  };

  if (ticketId) {
    classificationLogger.log(ticketId, result);
  }

  return result;
}

module.exports = {
  classify,
};

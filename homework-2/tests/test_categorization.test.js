const { classify } = require('../src/services/classificationService');

describe('Classification Service', () => {
  it('classifies "login failed" as account_access', () => {
    const result = classify('login failed', '');
    expect(result.category).toBe('account_access');
  });

  it('classifies "can\'t access" subject as urgent priority', () => {
    const result = classify("can't access", '');
    expect(result.priority).toBe('urgent');
  });

  it('classifies "payment refund" as billing_question', () => {
    const result = classify('payment refund', '');
    expect(result.category).toBe('billing_question');
  });

  it('classifies "app crashes on startup" as technical_issue', () => {
    const result = classify('app crashes on startup', '');
    expect(result.category).toBe('technical_issue');
  });

  it('classifies "suggest new feature" as feature_request', () => {
    const result = classify('suggest new feature', '');
    expect(result.category).toBe('feature_request');
  });

  it('classifies "steps to reproduce the bug" as bug_report', () => {
    const result = classify('steps to reproduce the bug', '');
    expect(result.category).toBe('bug_report');
  });

  it('returns other/medium/0 for unmatched input', () => {
    const result = classify('hello', 'hello world');
    expect(result.category).toBe('other');
    expect(result.priority).toBe('medium');
    expect(result.confidence).toBe(0);
  });

  it('urgent priority beats high priority when both keywords are present', () => {
    const result = classify('blocking production down', '');
    expect(result.priority).toBe('urgent');
  });

  it('confidence is always in the range [0, 1]', () => {
    const inputs = [
      ['hello', 'hello'],
      ['login password authentication account 2fa sign in sign out locked access denied', ''],
      ['error crash bug broken exception timeout slow performance fail not working', ''],
    ];
    for (const [subject, desc] of inputs) {
      const { confidence } = classify(subject, desc);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it('keywords_found is an array containing the matched strings', () => {
    const result = classify('login failed', 'account locked');
    expect(Array.isArray(result.keywords_found)).toBe(true);
    expect(result.keywords_found.length).toBeGreaterThan(0);
    expect(result.keywords_found).toContain('login');
  });
});

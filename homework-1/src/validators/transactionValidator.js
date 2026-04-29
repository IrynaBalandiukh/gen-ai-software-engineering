import cc from 'currency-codes';

const VALID_TYPES = new Set(['deposit', 'withdrawal', 'transfer']);
const VALID_STATUSES = new Set(['pending', 'completed', 'failed']);
const ACCOUNT_PATTERN = /^ACC-[A-Z0-9]{5}$/;

export function validateTransaction(req, res, next) {
  if (typeof req.body.fromAccount === 'string') req.body.fromAccount = req.body.fromAccount.toUpperCase();
  if (typeof req.body.toAccount === 'string') req.body.toAccount = req.body.toAccount.toUpperCase();
  if (typeof req.body.currency === 'string') req.body.currency = req.body.currency.toUpperCase();

  const { fromAccount, toAccount, amount, currency, type, status } = req.body;
  const errors = [];

  // Amount — two independent checks so both can fire (e.g. -1.234 triggers both)
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive number' });
  }
  if (typeof amount === 'number' && isFinite(amount)) {
    const parts = amount.toString().split('.');
    if (parts[1] && parts[1].length > 2) {
      errors.push({ field: 'amount', message: 'Amount cannot have more than 2 decimal places' });
    }
  }

  // Currency
  if (!currency || !cc.code(currency)) {
    errors.push({
      field: 'currency',
      message: 'Invalid currency code. Must be a valid ISO 4217 code (e.g. USD, EUR, GBP)',
    });
  }

  // Type
  if (!type || !VALID_TYPES.has(type)) {
    errors.push({ field: 'type', message: 'Invalid type. Must be one of: deposit, withdrawal, transfer' });
  } else {
    if ((type === 'withdrawal' || type === 'transfer') && !fromAccount) {
      errors.push({ field: 'fromAccount', message: 'fromAccount is required for withdrawals and transfers' });
    }
    if ((type === 'deposit' || type === 'transfer') && !toAccount) {
      errors.push({ field: 'toAccount', message: 'toAccount is required for deposits and transfers' });
    }
  }

  // Account format (runs for any provided value, independent of required checks)
  if (fromAccount && !ACCOUNT_PATTERN.test(fromAccount)) {
    errors.push({
      field: 'fromAccount',
      message: 'Invalid account number format. Expected ACC-XXXXX (e.g. ACC-A1B2C)',
    });
  }
  if (toAccount && !ACCOUNT_PATTERN.test(toAccount)) {
    errors.push({
      field: 'toAccount',
      message: 'Invalid account number format. Expected ACC-XXXXX (e.g. ACC-A1B2C)',
    });
  }

  // Optional status
  if (status !== undefined && !VALID_STATUSES.has(status)) {
    errors.push({ field: 'status', message: 'Invalid status. Must be one of: pending, completed, failed' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
  }

  next();
}

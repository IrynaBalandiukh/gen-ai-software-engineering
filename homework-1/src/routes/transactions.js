import { Router } from 'express';
import { randomUUID } from 'crypto';
import store from '../storage/store.js';
import { validateTransaction } from '../validators/transactionValidator.js';

const router = Router();

router.post('/', validateTransaction, (req, res) => {
  const {
    fromAccount = null,
    toAccount = null,
    amount,
    currency,
    type,
    status = 'completed',
  } = req.body;

  const transaction = {
    id: randomUUID(),
    fromAccount,
    toAccount,
    amount,
    currency,
    type,
    timestamp: new Date().toISOString(),
    status,
  };

  store.transactions.set(transaction.id, transaction);

  res.status(201).json({ success: true, data: transaction });
});

router.get('/', (req, res) => {
  const { accountId, type, from, to } = req.query;
  let transactions = Array.from(store.transactions.values());

  if (accountId) {
    transactions = transactions.filter(
      (tx) => tx.fromAccount === accountId || tx.toAccount === accountId,
    );
  }

  if (type) {
    if (!['deposit', 'withdrawal', 'transfer'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type filter — must be deposit, withdrawal, or transfer',
      });
    }
    transactions = transactions.filter((tx) => tx.type === type);
  }

  if (from) {
    const fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return res.status(400).json({ success: false, error: `Invalid from date: ${from}` });
    }
    transactions = transactions.filter((tx) => new Date(tx.timestamp) >= fromDate);
  }

  if (to) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, error: `Invalid to date: ${to}` });
    }
    toDate.setUTCHours(23, 59, 59, 999);
    transactions = transactions.filter((tx) => new Date(tx.timestamp) <= toDate);
  }

  res.json({ success: true, data: transactions });
});

router.get('/:id', (req, res) => {
  const transaction = store.transactions.get(req.params.id);
  if (!transaction) {
    return res.status(404).json({
      success: false,
      error: `Transaction with id "${req.params.id}" not found`,
    });
  }
  res.json({ success: true, data: transaction });
});

export default router;

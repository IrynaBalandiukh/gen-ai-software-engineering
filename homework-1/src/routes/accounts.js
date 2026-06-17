import { Router } from 'express';
import store from '../storage/store.js';

const router = Router();

router.get('/:accountId/balance', (req, res) => {
  const { accountId } = req.params;

  const relevant = Array.from(store.transactions.values()).filter(
    (tx) =>
      tx.status === 'completed' &&
      (tx.fromAccount === accountId || tx.toAccount === accountId),
  );

  if (relevant.length === 0) {
    return res.status(404).json({
      success: false,
      error: `No completed transactions found for account "${accountId}"`,
    });
  }

  // Accumulate per-currency balances
  const balances = {};
  for (const tx of relevant) {
    if (!balances[tx.currency]) balances[tx.currency] = 0;
    if (tx.toAccount === accountId) balances[tx.currency] += tx.amount;
    if (tx.fromAccount === accountId) balances[tx.currency] -= tx.amount;
  }

  // Round to 2 decimal places to avoid floating-point drift
  for (const cur of Object.keys(balances)) {
    balances[cur] = Math.round(balances[cur] * 100) / 100;
  }

  const currencies = Object.keys(balances);

  if (currencies.length === 1) {
    return res.json({
      success: true,
      data: { accountId, balance: balances[currencies[0]], currency: currencies[0] },
    });
  }

  res.json({
    success: true,
    data: {
      accountId,
      currencies: currencies.map((currency) => ({ currency, balance: balances[currency] })),
    },
  });
});

router.get('/:accountId/summary', (req, res) => {
  const { accountId } = req.params;

  const relevant = Array.from(store.transactions.values()).filter(
    (tx) => tx.fromAccount === accountId || tx.toAccount === accountId,
  );

  if (relevant.length === 0) {
    return res.status(404).json({
      success: false,
      error: `No transactions found for account "${accountId}"`,
    });
  }

  let totalDeposits = 0;
  let totalWithdrawals = 0;

  for (const tx of relevant) {
    const isIncoming =
      tx.type === 'deposit' || (tx.type === 'transfer' && tx.toAccount === accountId);
    const isOutgoing =
      tx.type === 'withdrawal' || (tx.type === 'transfer' && tx.fromAccount === accountId);

    if (isIncoming) totalDeposits += tx.amount;
    if (isOutgoing) totalWithdrawals += tx.amount;
  }

  const timestamps = relevant.map((tx) => tx.timestamp).sort((a, b) => new Date(a) - new Date(b));

  res.json({
    success: true,
    data: {
      accountId,
      totalDeposits: Math.round(totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      transactionCount: relevant.length,
      mostRecentTransaction: timestamps[timestamps.length - 1] ?? null,
    },
  });
});

export default router;

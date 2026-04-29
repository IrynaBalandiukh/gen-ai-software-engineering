import { randomUUID } from "crypto";

const transactions = new Map();

const seed = [
  {
    id: randomUUID(),
    fromAccount: null,
    toAccount: "ACC-10001",
    amount: 5000.0,
    currency: "USD",
    type: "deposit",
    timestamp: "2024-01-10T09:00:00.000Z",
    status: "completed",
  },
  {
    id: randomUUID(),
    fromAccount: "ACC-10001",
    toAccount: "ACC-10002",
    amount: 250.5,
    currency: "USD",
    type: "transfer",
    timestamp: "2024-01-15T14:30:00.000Z",
    status: "completed",
  },
  {
    id: randomUUID(),
    fromAccount: "ACC-10002",
    toAccount: null,
    amount: 75.0,
    currency: "USD",
    type: "withdrawal",
    timestamp: "2024-01-20T11:00:00.000Z",
    status: "completed",
  },
  {
    id: randomUUID(),
    fromAccount: null,
    toAccount: "ACC-10002",
    amount: 1000.0,
    currency: "EUR",
    type: "deposit",
    timestamp: "2024-02-01T10:00:00.000Z",
    status: "completed",
  },
  {
    id: randomUUID(),
    fromAccount: "ACC-10001",
    toAccount: "ACC-10003",
    amount: 500.0,
    currency: "USD",
    type: "transfer",
    timestamp: "2024-02-05T16:00:00.000Z",
    status: "pending",
  },
];

for (const tx of seed) {
  transactions.set(tx.id, tx);
}

export default { transactions };

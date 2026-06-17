import { randomUUID } from "crypto";
import { readFileSync } from "fs";

const { transactions: seedData } = JSON.parse(
  readFileSync(new URL("../../demo/sample-data.json", import.meta.url))
);

const transactions = new Map();

for (const tx of seedData) {
  const id = randomUUID();
  transactions.set(id, { ...tx, id });
}

export default { transactions };

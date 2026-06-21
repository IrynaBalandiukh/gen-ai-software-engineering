# Research Notes — context7 MCP Queries

These are the library lookups performed via the **context7 MCP** while building the
multi-agent banking pipeline (Task 2 / Agent 2). The pipeline's "chosen framework"
for monetary handling is **decimal.js**, which the spec mandates for all amounts.

---

## Query 1: Resolve the decimal.js library

- **Search:** `decimal.js` — "precise decimal arithmetic for monetary amounts,
  ROUND_HALF_UP rounding, parsing string amounts"
- **context7 library ID returned:** `/mikemcl/decimal.js` (809 code snippets,
  High source reputation, benchmark 88.96)
- **Applied:** Confirmed `/mikemcl/decimal.js` is the canonical TypeScript/JS
  arbitrary-precision decimal type. Used it as the single money type across every
  agent (`new Decimal(amount)`), never JS `number`/float, per the spec.

## Query 2: ROUND_HALF_UP rounding & decimal-place rounding API

- **Search:** "ROUND_HALF_UP rounding mode, set precision/rounding,
  toDecimalPlaces, comparing values with greaterThan, parsing string amounts"
- **context7 library ID:** `/mikemcl/decimal.js`
- **Applied:**
  - `Decimal.ROUND_HALF_UP` is the constant `4` and is decimal.js's **default**
    rounding mode. The Settlement Processor pins it explicitly with
    `Decimal.set({ rounding: Decimal.ROUND_HALF_UP })` so settlement rounding is
    deterministic regardless of global config.
  - Settled amounts are rounded to 2 decimal places with
    `new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)` (cash precision),
    e.g. TXN003's `9999.99` settles cleanly.
  - High-value detection compares on absolute value using decimal.js
    (`.abs().greaterThan(10000)`) instead of float comparison, so the `> $10,000`
    threshold in Fraud and Compliance is exact.

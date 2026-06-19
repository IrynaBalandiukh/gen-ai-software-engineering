# `AGENTS.md` — AI Agent Guidelines for Virtual Card Manager

> The spec at `homework-3/specification.md` is the source of truth for **what** to build and **what rules apply**. This file covers only what an AI agent needs in addition: defaults where the spec is silent, behavior rules for the agent itself, and explicit halt-and-ask triggers. **Read the spec first; this file does not repeat it.**

---

## 1. How to use this file

- Rules are **MUST / MUST NOT / SHOULD / SHOULD NOT**. MUST is non-negotiable. SHOULD is the default; override only with explicit justification in the PR description.
- When two rules conflict, the stricter wins and the conflict is itself a halt-and-ask trigger (§8).
- The spec wins over this file. If this file appears to contradict the spec, treat it as a bug and surface it.

---

## 2. Tech-stack defaults (the spec is intentionally stack-agnostic)

- **MUST** match the language/framework already established in the repo (inspect `pyproject.toml`, `package.json`, `go.mod` before scaffolding).
- **Greenfield default**: Python 3.12 + FastAPI + PostgreSQL + pytest, **or** TypeScript 5.x + NestJS + PostgreSQL + vitest. Pick one and commit.
- **PostgreSQL** is the assumed datastore; migrations via Alembic / Prisma / Liquibase, never hand-edited in deployed environments.
- **HTTP to partner**: a single library with explicit timeouts, retry, **and mTLS support** — never a default-config client.
- **Async work**: a durable queue (RabbitMQ, SQS, or Postgres-backed). **No fire-and-forget threads** for partner sync or audit emission.

---

## 3. Banking domain quick-rules

These are the highest-impact banking conventions. The agent applies them inline without opening the spec; the spec has the detail.

- **Money**: integer **minor units** + ISO-4217 currency code. Never floats — not in code, storage, transport, or logs. (Spec §4.)
- **IDs**: **UUIDv7** for every entity. Partner IDs are stored alongside, never substituted. (Spec §4.)
- **Time**: **UTC, ISO-8601** everywhere. Reads accept optional `as_of` for point-in-time. (Spec §4.)
- **State**: card state is a strict enum (`PENDING_ISSUANCE` / `ACTIVE` / `FROZEN` / `CLOSED`). No implicit transitions; illegal transitions return `409 invalid_state_transition`. (Spec §4, §5.2.)
- **Errors**: **RFC 7807 `application/problem+json`** with `type`, `title`, `status`, stable `code`, `correlation_id`, `detail`. (Spec §4.)
- **Logging**: field **allowlist**, not blocklist. Never log: **PAN, CVV, expiry, `Authorization` headers, raw partner request/response bodies**. (Spec §3.2, §4.)
- **Mutations**: every mutating endpoint requires an `Idempotency-Key`; replays within 24 h return the prior response. (Spec §4, T20.)

---

## 4. Code style

- **MUST** prefer editing existing files over creating new ones. **MUST NOT** create `*.md` / README files unless explicitly asked.
- **Naming**: functions and methods are verbs (`freeze_card`, not `card_freezer`); boolean variables read as predicates (`is_frozen`, `has_pending_partner_sync`); banking abbreviations (`PAN`, `KYC`, `OFAC`, `SCA`, `MCC`, `DPA`) are fine — others are not.
- **Comments**: one short line, only for non-obvious *why* (hidden constraint, workaround, invariant). No multi-paragraph docstrings, no `// removed because…` comments, no commented-out code.
- **Logging discipline**: structured JSON through the shared allowlist wrapper; never raw `console.log` / `print` debug calls in committed code. Include `correlation_id` on every log within a request scope.
- **File layout**: follow the `docs/flows/`, `docs/policy/`, `docs/partner/`, `docs/schema/`, `docs/state-machine/` split established by spec §6 task targets.

---

## 5. "Always prefer" — agent heuristics for choices the spec doesn't make

When the spec doesn't speak to a micro-decision, apply these defaults:

- **Always prefer idempotent writes** — design the replay path before the happy path.
- **Always prefer optimistic concurrency over last-write-wins** for state changes.
- **Always prefer typed errors over free-text strings** — new condition → new code in the existing namespace.
- **Always prefer cursor pagination over offset**.
- **Always prefer fail-closed for partner-dependent writes**, fail-open for reads of cached state.
- **Always prefer asynchronous reconciliation over synchronous partner round-trips** on the user-facing path when the latency budget is tight.
- **Always prefer auditing more, not less** — when unsure whether to audit, audit.
- **Always prefer the stricter data classification** when ambiguous. Confidential-that-should-be-Restricted is a leak; the reverse is just inconvenient.
- **Always prefer queue-on-failure over silent drop** for partner sync and audit emission.
- **Always derive partner idempotency keys deterministically from the inbound key** — never generate a new one server-side.

---

## 6. What every PR must contain

- **MUST** link the task ID (e.g. `T05`) and list which DoD checklist items are now ticked.
- **MUST** include a test that exercises the **edge-case row(s)** named in the task's DoD (e.g. "behavior matches §7.2 row 3" → a test for row 3).
- **MUST** include both the **happy path** and the **typed error** for every public endpoint touched.
- **MUST** include an **idempotency-replay** test for any new mutating endpoint: same key + same body → same response, no duplicate side effects, no duplicate audit entries.
- **MUST** make the mid-level objective's **"Verified when"** line pass end-to-end. If it doesn't, the feature is not done.

---

## 7. Security & Compliance: MUST NEVER

These are the rules whose violation has high blast radius. The agent does not relax these silently. Ever.

- **NEVER** store, log, cache, or transit **PAN, CVV, or full expiry**.
- **NEVER** edit, update, or delete a row in `audit_log`. It is append-only; corrections are new entries.
- **NEVER** suppress an audit emission to avoid a duplicate. Audit is at-least-once by design; dedup is a downstream concern.
- **NEVER** use long-lived shared secrets for service-to-service auth. mTLS + short-lived workload tokens only.
- **NEVER** introduce a "god admin" role that can mutate any card. Ops is read-only; mutations require break-glass + auto-expiry + alert.
- **NEVER** copy production data to non-production. Synthetic data only.
- **NEVER** disable signature, nonce, or timestamp checks on webhooks — even "just for local testing." Use a properly keyed test signer.
- **NEVER** invent new error codes outside the documented namespaces without flagging the addition for review.

---

## 8. Halt and ask

The agent stops, surfaces the question, and waits for confirmation when:

1. The task would put **PAN, CVV, or full expiry** anywhere in our environment (PCI scope expansion — spec §8.3).
2. The task asks to **disable, weaken, or skip** signature verification, audit emission, encryption, step-up auth, idempotency, or rate limiting — even temporarily.
3. The task adds a new actor type, a new audit `action` class, or a new field to `audit_log` (compliance checkpoint).
4. The task changes a retention period, the redaction allowlist, the rate-limit thresholds, or the step-up-required action list.
5. The task introduces a new partner sub-processor or a new partner integration (vendor risk — spec §3.7).
6. The task asks to mutate or delete data under a `legal_hold = true` flag.
7. Two MUST rules conflict for the task. Do not pick one silently.
8. The "Verified when" acceptance line cannot be expressed without ambiguity for the task as scoped.

When halting, the agent surfaces: *which rule blocks the task, which spec section it comes from, and what concrete information would unblock proceeding*.

---

## 9. Agent-behavior rules

- **Do not refactor unrelated code** while completing a task. Bug fixes don't need surrounding cleanup.
- **Do not introduce abstractions for a single caller.** Three similar lines beats a premature abstraction; wait for the third reuse.
- **Do not skip the partner-failure path** when implementing a happy-path flow. Both land in the same PR.
- **Do not stub audit emission** "to be added later." Audit is a first-class output, not instrumentation.
- **Do not assert on log strings** in tests. Assert on behavior or structured fields.
- **Do not use `time.sleep`** to wait for async work. Use deterministic test doubles or explicit signals.

---

## 10. Spec cross-walk (where to look)

| If the agent is unsure about… | Read in spec |
|---|---|
| What "done" means for a task | §6 task DoD |
| Performance budget for an operation | §3.1, §9 |
| Which data may be stored / logged / encrypted | §3.2 |
| Audit entry shape, retention, legal hold, tamper chain | §3.3 |
| Reliability and degradation behavior | §3.4 |
| Which regulatory regime applies (PCI, AML, OFAC, Reg E, GDPR, PSD2) | §3.5 |
| Step-up auth, PAM, AUDITOR role | §3.6 |
| Vendor / BaaS partner controls | §3.7 |
| Conventions on money, IDs, idempotency, time, state, errors | §4 |
| Card state machine + legal transitions | §5.2 |
| How a concurrency / partner / auth / compliance edge case resolves | §7.1 / §7.2 / §7.3 / §7.4 |
| How a feature is verified | §8.2, task DoD, M1–M6 "Verified when" |
| Whether a change needs human compliance review | §8.3 |
| How tasks tie back to objectives and NFRs | §10 Traceability |

---

When a rule in this file feels excessive for the work in front of you, that is the rule doing its job. The cost of asking is small; the cost of a quietly compromised regulated system is not.

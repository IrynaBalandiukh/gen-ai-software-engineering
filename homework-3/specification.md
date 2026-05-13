# Virtual Card Manager — Specification

> Ingest the information in this file, implement the Low-Level Tasks, and produce artifacts that satisfy the High-Level Objective and Mid-Level Objectives. The system operates in a regulated, BaaS-partner card-issuing model: the partner holds PAN/CVV; this service owns metadata, state, limits, history projection, and audit.

---

## 1. High-Level Objective

Enable an end-user, through a mobile or web client, to manage the full lifecycle of a virtual payment card — issue, freeze/unfreeze, set spending limits, view transactions, and permanently close — backed by a BaaS card-issuing partner, with a parallel internal read-only view for ops and compliance.

**Scope boundary**: In scope is the end-user lifecycle plus an ops/compliance read view and audit export. Out of scope: identity and authentication, the KYC engine itself, dispute and chargeback workflows, end-user notifications, and the card-authorization path (owned by the partner network).

---

## 2. Mid-Level Objectives

Each objective is **observable**: there is a state of the world that visibly changes when it succeeds.

- **M1 — Issuance**. An eligible end-user can request a virtual card and, on success, receives a usable card whose state is `ACTIVE` and whose metadata (token, last4, masked expiry, currency) is retrievable.
  - *Verified when:* a `PASSED`-KYC user issues a card and the response carries `state = ACTIVE`, a partner `card_token`, and a `last4`; replaying the same `Idempotency-Key` returns the original card without re-executing side effects.
  - *Key edge cases:* §7.2 (partner timeout / 5xx on issuance), §7.3 (cross-user issuance attempts).
  - *Perf budget:* p95 < 1.5 s write at the public edge (§3.1, §9.1); ≤ 3 issuances per user per 24 h (§9.3).
- **M2 — Freeze / Unfreeze**. An end-user can toggle a card between `ACTIVE` and `FROZEN`; new authorizations at the partner network reflect the change within the documented time-to-consistency budget.
  - *Verified when:* a freeze returns 2xx and a synthetic authorization attempted ≤ 2 s later is declined; a simultaneous duplicate freeze does not produce two audit entries.
  - *Key edge cases:* §7.1 (simultaneous freeze, webhook race), §7.2 (partner 5xx after local commit, lost / out-of-order webhooks).
  - *Perf budget:* p95 < 1.5 s write (§9.1); time-to-consistency ≤ 2 s end-to-end (§9.4); ≤ 10 freeze toggles per user per minute (§9.3).
- **M3 — Spending Limits**. An end-user can set or update daily, monthly, and per-transaction limits on a card; the partner enforces them at authorization time, and the change is auditable with an `effective_from` timestamp.
  - *Verified when:* a limit update returns 2xx with `effective_from`, partner mirror records the same value, and a simulated transaction over the limit is declined; an invalid cross-field combination (e.g. per-txn > daily) returns a typed validation error.
  - *Key edge cases:* §7.1 (simultaneous limit edits under optimistic concurrency), §7.2 (partial success at partner across limit fields).
  - *Perf budget:* p95 < 1.5 s write (§9.1); ≤ 20 limit changes per user per 24 h (§9.3).
- **M4 — Transaction History**. An end-user can read a paginated, filterable list of transactions for one of their cards; results are consistent with partner truth within the reconciliation window.
  - *Verified when:* a new partner-side transaction appears in our read within 60 s p95; cursors round-trip correctly and a tampered cursor returns a typed error.
  - *Key edge cases:* §7.2 (partner drift, lost or out-of-order clearing events).
  - *Perf budget:* p95 < 500 ms read at maximum page size 100 (§9.1, §9.2); reconciliation lag ≤ 60 s p95 (§3.1).
- **M5 — Termination**. An end-user can permanently close a card. After closure the card is non-transactable, non-reopenable, and remains readable for audit and history purposes.
  - *Verified when:* a closed card rejects every state-mutation attempt with a typed error; reads of the closed card and its history still succeed; partner-side close eventually converges.
  - *Key edge cases:* §7.1 (concurrent close vs. freeze), §7.2 (partner failure on close — outbound queue convergence).
  - *Perf budget:* p95 < 1.5 s write (§9.1); post-closure reads share the read-latency budget.
- **M6 — Ops & Compliance Read + Audit Export**. An authorized internal user can read any card and its history (no mutations) and export a redacted, signed audit slice for a given user and date range.
  - *Verified when:* an ops user with read scope can fetch any card and its history; the same user attempting a mutation is blocked at both route and data-access layers; an export covers exactly the requested in-scope range and is signed + redacted.
  - *Key edge cases:* §7.3 (ops mutation attempt, out-of-scope export range).
  - *Perf budget:* ops reads share the read-latency budget (§9.1); exports run asynchronously and do not violate synchronous read budgets; ≤ 5 exports per ops user per hour (§9.3).

---

## 3. Non-Functional & Policy Requirements

These are first-class requirements and are referenced by tasks via the `→ NFR-x` tag.

### 3.1 Performance (assumed FinTech-UX targets)

| Concern | Target | Justification |
|---|---|---|
| Read latency (single card, history page, limit read) | **p95 < 500 ms, p99 < 1000 ms** | Card apps feel "snappy" only when reads land sub-half-second; this is the mainstream bar for tier-1 banking apps. |
| Write latency (issue, freeze, set limit, close) | **p95 < 1500 ms, p99 < 3000 ms** | Writes include a partner round-trip; 1.5 s p95 keeps user-perceived freeze/limit changes "instant-ish" without forcing aggressive timeouts on the partner edge. |
| Time-to-consistency for freeze at the network | **≤ 2 s end-to-end** from our 2xx response to partner blocking new authorizations | Freeze is primarily a fraud-response tool; anything slower undermines the user's mental model that "freezing stops it." |
| Partner-truth reconciliation window for transactions | **≤ 60 s p95** between partner clearing event and our history reflecting it | Users typically refresh after a purchase; sub-minute keeps the support load down. |

All numbers are **assumed targets** for the purposes of this spec; they would be revalidated against real partner SLAs and observed user behavior.

### 3.2 Sensitive-Data Handling

- **PAN, CVV, and full expiry are never stored, logged, cached, or transited** through this service. The partner holds them.
- This service stores only: `card_token` (partner-issued reference), `last4`, masked expiry (`**/**`), currency, state, limits, audit metadata.
- Logging uses a **field allowlist**, not a redaction blocklist. New fields default to "do not log."
- Display of last4 / masked expiry to the user is permitted; display of anything beyond requires a direct partner-hosted reveal (out of scope).
- **Data classification**: every stored field is tagged at one of four levels — **Public / Internal / Confidential / Restricted**. Card tokens, `last4`, masked expiry, and `card_id` are **Restricted**; user-scoped IDs and limit values are **Confidential**; correlation IDs are **Internal**. Handling rules (logging, exports, replication, who-can-read) follow the classification.
- **Encryption at rest**: all stored data uses **AES-256 with KMS-managed keys**. Restricted fields use **envelope encryption** with per-row data keys. Backups inherit the same key hierarchy.
- **Encryption in transit**: **TLS 1.2 minimum, TLS 1.3 preferred** for all external traffic. **mTLS** for every call to the BaaS partner. Internal service-to-service traffic uses mTLS or an equivalent service-mesh mutual auth.
- **Key & secret management**: signing/encryption keys live in **KMS or HSM**; rotation cadence is **≤ 90 days** for data-encryption keys and **≤ 365 days** for long-lived signing keys. Partner credentials rotate **≤ 90 days** and are issued to runtime as short-lived material from a secrets manager.
- **Environment isolation**: production data — including tokens, last4, and audit entries — is **never** copied to non-production environments. Non-prod uses synthetic data only.

### 3.3 Audit & Retention

- Every state-changing action and every ops/compliance read writes one **append-only** entry to `audit_log`. **Failed authentications, scope rejections, and rate-limit blocks on sensitive routes are also audited** — forensics, not just success-path.
- Audit entries are immutable: there is no update or delete path; corrections are new entries that reference the original.
- **Tamper evidence**: each entry includes `prev_hash` and `entry_hash` forming a hash chain over `(actor_id, action, resource_id, correlation_id, before_state, after_state, occurred_at, prev_hash)`. The chain head is checkpointed daily to a WORM-style sink for independent verification.
- **Authoritative time**: `occurred_at` is set from a synchronized clock source (NTP-disciplined). Drift outside ±500 ms raises an ops alert; entries written during a drift window are flagged.
- **Schema versioning**: each entry carries a `schema_version`; schema changes are append-only (new optional fields only) and require a §8.3 compliance checkpoint.
- Retention is **7 years** for audit and transaction records, aligned with US banking record-retention norms.
- **Legal hold**: any record may be flagged `legal_hold = true` by an authorized compliance role, which **suspends retention-driven deletion indefinitely** for the flagged scope. Legal-hold set and release are themselves audited.
- PII in audit payloads is redacted at write time (allowlist applies).
- Each audit entry carries: `actor_id`, `actor_type` (USER / OPS / AUDITOR / SYSTEM), `action`, `resource_id`, `correlation_id`, `before_state`, `after_state`, `occurred_at`, `reason_code` (required for OPS mutations and cross-user reads), `schema_version`, `prev_hash`, `entry_hash`.
- **Audit-log access**: read access to `audit_log` is restricted to a dedicated **AUDITOR** role, separate from OPS. Reads of `audit_log` by AUDITOR are themselves audited into a separate `audit_of_audit` sink.

### 3.4 Reliability

- **99.95% monthly availability** for user-facing flows (≈ 21 minutes/month error budget).
- Reads of cached state must continue to succeed during partner degradation; partner-dependent writes may fail closed with a typed error.

### 3.5 Compliance & Regulatory Posture

This service operates as if subject to the following regulatory regimes; the spec encodes the postures required to keep the service in scope-minimized compliance.

- **PCI-DSS** (cards): the BaaS-partner model is chosen to target **SAQ-A or SAQ-D-Lite scope**, not full SAQ-D. We achieve this by never storing, logging, caching, or transiting PAN/CVV/full expiry and by using partner-issued tokens exclusively. Any change that would put PAN into our environment is a §8.3 compliance event.
- **BSA / AML**: the service exposes an **AML signal-emission hook** (internal event) on issuance, limit changes, and closures. Downstream AML systems consume the stream and may file SARs; this service does not file SARs but must not lose the signal.
- **OFAC / sanctions screening**: every issuance attempt passes through an **OFAC pre-check** before the partner call (see T23). Hits block issuance, write a typed `compliance.sanctions_hit` audit entry, and route the attempt to an ops queue. The user-facing error is intentionally **generic** (`compliance.review_required`) to avoid tipping off sanctioned parties.
- **Reg E** (US consumer protections): dispute filing is out of scope, but the spec **must not impede** it — every transaction record retains the fields a downstream dispute system would need (merchant, MCC, amount, authorization timestamp, network reference), and audit history is available to any future dispute workflow.
- **GDPR / CCPA**: end-users have a documented **DSAR (Subject Access Request) path** that exports the user's card and transaction footprint. **Right-to-erasure requests are evaluated against retention obligations**: where the 7-year banking-retention rule applies, erasure is denied with a documented legal basis; the request and outcome are audited (§7.4).
- **PSD2 SCA** (where applicable): **Strong Customer Authentication** is required for sensitive actions — issuance, limit increase, and closure. SCA is delegated to the auth layer (§5.1) but this service surfaces a typed `sca.required` outcome and accepts an SCA assertion on follow-up (see T21).
- **Data residency**: end-user and card data is stored in the region of the user's bank entity. Cross-region access is logged and audited.

### 3.6 Authentication & Access

- **Step-up authentication** is required on sensitive actions: card **issuance** (M1), any **limit increase** (M3 — decreases do not require step-up), card **closure** (M5), and **audit export** (M6). Step-up evidence (assertion id, factor type, freshness) is recorded on the audit entry. Requests without valid step-up return `sca.required` with the typed challenge.
- **Privileged access management (PAM) for ops**:
  - Every cross-user ops read or mutation requires a **`reason_code`** (free-text justification or linked ticket reference). Reads without a `reason_code` are rejected at the data-access layer.
  - **Break-glass access** (elevated ops scope outside normal duties) is **time-boxed (≤ 4 h)** and auto-expires; every break-glass session is escalation-alerted to a compliance reviewer and written to `audit_log` with `break_glass = true`.
  - Ops sessions enforce a **maximum idle timeout of 15 minutes** and an **absolute session lifetime of 8 hours**; mutations re-prompt for authentication beyond the idle window.
- **Service-to-service auth**: internal calls authenticate with mTLS + short-lived workload tokens; long-lived shared secrets are forbidden.
- **AUDITOR role**: read-only access to `audit_log` and to records flagged `legal_hold = true`. AUDITOR cannot read or write any operational table outside the audit surface.

### 3.7 Vendor & Third-Party Risk

The BaaS card-issuing partner is the single most material third party. Spec-level controls:

- **SOC 2 Type II review** of the partner is required **annually**; the report is reviewed by compliance and security before contract renewal. A failed or qualified SOC 2 is a §8.3 compliance event.
- **Sub-processor list**: the partner's sub-processors are tracked in `docs/partner/sub-processors.md` and reviewed each SOC 2 cycle. New sub-processors processing user or card data require compliance approval before they receive traffic.
- **Partner SLA & incident communication**: the partner SLA is referenced from `docs/partner/integration-contract.md` (T03). Partner-side incidents propagate to our ops within an agreed window; we acknowledge and mirror to user-facing status within our 99.95% error budget (§3.4).
- **Exit plan**: the integration contract documents a **partner-exit playbook** — how cards in flight would be migrated, how tokens would be re-issued, how audit history would be preserved. Reviewed annually with the partner relationship owner.
- **Data processing agreement (DPA)**: a current DPA with the partner is on file; renewal is tracked alongside SOC 2 review.

---

## 4. Implementation Notes (Builder & Agent Guardrails)

These conventions are non-negotiable. The spec is **stack-agnostic**; conventions hold regardless of language.

- **Money**: stored as integer **minor units** (cents) plus an **ISO-4217** currency code. Floats are forbidden for monetary values anywhere in code, storage, transport, or logs.
- **Identifiers**: all entity IDs are **UUIDv7** (time-sortable). External IDs from the partner are stored alongside, never substituted.
- **Idempotency**: every mutating endpoint requires an `Idempotency-Key` (UUID). Replays within 24 h return the prior response without re-executing side effects. Keys are scoped per `(user_id, route)`.
- **Time**: all timestamps are **UTC, ISO-8601** with second precision minimum. Reads accept an optional `as_of` parameter for point-in-time audit queries; default is "now."
- **State**: card state is a strict enum: `PENDING_ISSUANCE`, `ACTIVE`, `FROZEN`, `CLOSED`. Transitions go through the documented state machine (Section 5 ending context). Illegal transitions return `409 invalid_state_transition` with the current state in the problem detail.
- **Errors**: every error response is **RFC 7807 `application/problem+json`** with fields `type` (stable URI), `title`, `status`, `code` (stable typed code like `card.frozen`, `limit.exceeded_policy`, `partner.unavailable`), `correlation_id`, and `detail`. Correlation IDs propagate to partner calls.
- **Logging discipline**: structured JSON, field-allowlist enforced by a shared logger wrapper. Never log: PAN, CVV, expiry, Authorization headers, raw partner request/response bodies.
- **Partner calls**: every partner call carries a `correlation_id` and an `idempotency_key` derived from the inbound key when applicable. Retries are exponential with jitter; timeouts are explicit and per-endpoint.
- **Authorization model**: every mutation re-checks `(actor.user_id == card.owner_id)` server-side. Ops scope is read-only enforced at the route layer **and** at the data-access layer (defense in depth).
- **Webhook replay protection**: webhook handlers verify (a) signature, (b) a timestamp within a ±5 min window, and (c) a nonce / event-id not previously seen (replay cache TTL ≥ window). All three must pass; any failure is logged and audited as `webhook.rejected`.
- **Input canonicalization & output encoding**: inputs are decoded once and validated against a typed schema before any business logic. String fields used in identifiers or queries are Unicode-normalized (NFC) and length-bounded. Output to logs, audit entries, and exports is encoded per the consumer's expected format; raw user-supplied bytes never flow into logs.

---

## 5. Context

### 5.1 Beginning Context (assumed to exist)

- An **auth/session service** that authenticates requests and provides verified `user_id` and `scopes` on the request context. Treated as a black box.
- A **BaaS partner sandbox** with API credentials in a secrets manager; partner exposes endpoints for card create, freeze, unfreeze, limit update, close, transaction list, and a webhook for asynchronous state changes (e.g. fraud-driven freezes).
- An **empty card-domain data store** (no `cards`, `card_limits`, `transactions`, or `audit_log` tables yet).
- A **KYC status service** returning per-user status: `PASSED`, `PENDING`, or `FAILED`.

### 5.2 Ending Context (artifacts produced by the work)

- **Card-domain schema + migrations plan**: tables `cards`, `card_limits`, `transactions` (projection from partner), `audit_log`, `idempotency_keys`. Each table documented with columns, types, indexes, and rationale.
- **State machine + transition matrix** for card lifecycle, including which actor types may invoke each transition and which transitions are partner-driven vs. user-driven:

  ```
                ┌──────────────────┐
                │ PENDING_ISSUANCE │
                └────────┬─────────┘
                  partner ok│
                           ▼
                       ┌────────┐ user/partner ┌────────┐
                       │ ACTIVE │ ◄──────────► │ FROZEN │
                       └───┬────┘              └───┬────┘
                       user│                    user│
                           ▼                       ▼
                       ┌────────┐              ┌────────┐
                       │ CLOSED │ ◄────────────┤ CLOSED │
                       └────────┘              └────────┘
  ```
  Illegal transitions (e.g. `CLOSED → ACTIVE`) are explicitly rejected.

- **Partner integration contract**: for each partner call — purpose, when invoked, request/response shape (abstract), idempotency strategy, retry/backoff, timeout, failure semantics, and which webhook events may amend our state asynchronously.

---

## 6. Low-Level Tasks

Twenty tasks, grouped by capability. Each task carries a traceability tag (`→ M*`, `→ NFR-*`) and a **Definition of Done** checklist phrased so an implementer can tick it off.

> **Cross-cutting rule**: every task's DoD ties to a mid-level objective, an NFR, and — where applicable — an edge-case row in §7 and a performance budget in §3.1 / §9. A task is not "done" until the cited rows are demonstrably handled, not just acknowledged.

### Foundations

#### T01 — Card-domain schema definition
**Prompt**: Design the card-domain schema covering `cards`, `card_limits`, `transactions`, `audit_log`, and `idempotency_keys`. Document each table with columns, types, indexes, FK relationships, and rationale.
**Create/Update**: `docs/schema/card-domain.md`
**Tag**: → M1, M2, M3, M4, M5, M6, NFR-3.2, NFR-3.3
**Definition of Done**:
- [ ] All five tables documented with column-level types and nullability.
- [ ] No column stores PAN, CVV, or full expiry.
- [ ] Money columns use integer minor units + currency code column.
- [ ] All ID columns documented as UUIDv7.
- [ ] Indexes cover the documented read patterns from M4 and M6.
- [ ] `audit_log` is documented as append-only with no UPDATE or DELETE path.
- [ ] `audit_log` columns cover the full set required by §3.3: `prev_hash`, `entry_hash`, `schema_version`, `reason_code`, `legal_hold`, and the four actor types (`USER` / `OPS` / `AUDITOR` / `SYSTEM`).

#### T02 — Card lifecycle state machine
**Prompt**: Document the canonical state machine for card lifecycle including all legal transitions, the actor type(s) permitted for each, and partner-driven transitions arriving via webhook.
**Create/Update**: `docs/state-machine/card-lifecycle.md`
**Tag**: → M1, M2, M5, NFR-3.3
**Definition of Done**:
- [ ] All states from Section 5.2 represented.
- [ ] Each transition lists permitted actor types (USER, OPS, SYSTEM/partner).
- [ ] Illegal transitions enumerated with the typed error code returned.
- [ ] Partner-driven transitions (e.g. fraud freeze) are flagged separately.

#### T03 — Partner integration contract
**Prompt**: Document every partner call this service makes and every partner webhook it accepts. For each: purpose, trigger, idempotency strategy, timeout, retry policy, and how partial-failure cases are handled.
**Create/Update**: `docs/partner/integration-contract.md`
**Tag**: → M1, M2, M3, M4, M5, NFR-3.1, NFR-3.4, NFR-3.7
**Definition of Done**:
- [ ] Every partner call referenced in T04–T18 appears in the contract.
- [ ] Each call documents idempotency key derivation.
- [ ] Each call documents timeout in ms and retry backoff curve.
- [ ] Webhook events list expected order, deduplication strategy, and how out-of-order arrivals are handled.
- [ ] At least one partial-failure scenario is worked through end-to-end.

### Issuance (M1)

#### T04 — Eligibility check
**Prompt**: Specify the eligibility evaluation performed before any partner issuance call. Cover KYC status, duplicate-active-card policy, per-user issuance velocity, and the typed error codes returned for each failure mode.
**Create/Update**: `docs/flows/issuance-eligibility.md`
**Tag**: → M1, NFR-3.3
**Definition of Done**:
- [ ] KYC status check defined; only `PASSED` proceeds.
- [ ] Velocity rule documented: ≤ 3 issuance attempts per user per 24 h.
- [ ] Duplicate policy documented: at most N active cards per user (N stated).
- [ ] Each failure returns a distinct typed error code in the `card.*` namespace.
- [ ] Eligibility evaluation produces a single audit entry regardless of outcome.

#### T05 — Idempotent issuance call to partner
**Prompt**: Specify the issuance flow: validate request, persist `PENDING_ISSUANCE`, call partner with idempotency key, transition to `ACTIVE` on success, define error handling for partner failure modes.
**Create/Update**: `docs/flows/issuance-execute.md`
**Tag**: → M1, NFR-3.1, NFR-3.2, NFR-3.4, NFR-3.7
**Definition of Done**:
- [ ] State persisted as `PENDING_ISSUANCE` **before** the partner call.
- [ ] Partner idempotency key is deterministic from inbound `Idempotency-Key`.
- [ ] Success path transitions state to `ACTIVE` and stores `card_token`, `last4`, masked expiry, currency.
- [ ] Partner timeout / 5xx returns typed `partner.unavailable` and leaves card in `PENDING_ISSUANCE` with a documented retry policy.
- [ ] Replay of the same `Idempotency-Key` within 24 h returns the original response.
- [ ] Partner timeout / 5xx behavior matches §7.2 row 1 — user-visible result and audit content are identical to that row.
- [ ] Happy-path issuance meets the write-latency budget (p95 < 1.5 s) at the public edge — §9.1.

#### T06 — Issuance audit & emission
**Prompt**: Define the audit entry written on issuance and any internal event emission for downstream consumers (read-model projection, fraud, analytics).
**Create/Update**: `docs/flows/issuance-audit.md`
**Tag**: → M1, NFR-3.3
**Definition of Done**:
- [ ] Audit entry includes actor, action `card.issued`, resource_id, correlation_id, before/after state.
- [ ] PII fields redacted via allowlist.
- [ ] Internal event shape documented; emission is best-effort and does not block the user-facing response.

### Freeze / Unfreeze (M2)

#### T07 — State transition with optimistic locking
**Prompt**: Specify freeze and unfreeze as a single state-transition flow with optimistic concurrency control (row version or compare-and-set on `state`).
**Create/Update**: `docs/flows/freeze.md`
**Tag**: → M2, NFR-3.1
**Definition of Done**:
- [ ] Transition reads current state with a version, writes with `WHERE version = X` semantics.
- [ ] Concurrent conflicting writes return `409 stale_state` (no last-write-wins).
- [ ] No state change occurs if the requested target equals current state (no-op returns 200 with the existing record).
- [ ] Audit entry written on every actual transition.
- [ ] Concurrent-freeze and idempotent no-op behavior matches §7.1 rows 1 and 3.
- [ ] Local transition (excluding partner call) completes inside the service-internal p95 < 200 ms portion of the write budget — §9.1.

#### T08 — Partner sync + retry semantics for freeze
**Prompt**: Specify the partner-side mirror call for freeze/unfreeze, including how we converge if the partner call fails after our local commit.
**Create/Update**: `docs/flows/freeze-partner-sync.md`
**Tag**: → M2, NFR-3.1, NFR-3.4, NFR-3.7
**Definition of Done**:
- [ ] Local state commit precedes partner call; outbound queue used if partner is unreachable.
- [ ] Time-to-consistency budget (≤ 2 s) is documented and measurable.
- [ ] Drift between our state and partner state surfaces a reconciliation alert (not silently swallowed).
- [ ] Retry policy documented; max retry window stated.
- [ ] Partner-failure-after-local-commit behavior matches §7.2 row 2 — local `FROZEN` persists, outbound queue retries, reconciliation alert fires on persistent drift.
- [ ] Time-to-consistency is instrumented end-to-end and tested against §9.4; budget breach for > 1% of events over 5 min raises an alert.

#### T09 — Webhook reconciliation of partner-driven state
**Prompt**: Specify how partner-originated state changes (e.g. fraud freeze) arrive via webhook and are reconciled into our state.
**Create/Update**: `docs/flows/freeze-webhook-reconcile.md`
**Tag**: → M2, NFR-3.3, NFR-3.4
**Definition of Done**:
- [ ] Webhook signature verification documented.
- [ ] Idempotent processing keyed on partner event ID.
- [ ] Out-of-order arrivals handled via partner-supplied event timestamp.
- [ ] Resulting transition writes an audit entry with `actor_type = SYSTEM` and a partner event reference.
- [ ] Race with local write (webhook arriving first) handled per §7.1 row 4; out-of-order arrivals handled per §7.2 row 5; lost-webhook recovery handled per §7.2 row 4.

### Spending Limits (M3)

#### T10 — Limits data model & validation
**Prompt**: Define the data model for daily, monthly, and per-transaction limits, including validation rules (non-negative, currency match, daily ≤ monthly, per-txn ≤ daily).
**Create/Update**: `docs/flows/limits-model.md`
**Tag**: → M3, NFR-3.2
**Definition of Done**:
- [ ] Each limit stored as integer minor units + currency code.
- [ ] Cross-field validation documented and enumerated with typed error codes.
- [ ] An "unset" limit is explicit (e.g. `null` semantics) and documented distinctly from `0`.

#### T11 — Limit update with partner sync
**Prompt**: Specify the flow that updates limits locally and mirrors them at the partner; include effective_from semantics so the partner enforcement window is unambiguous.
**Create/Update**: `docs/flows/limits-update.md`
**Tag**: → M3, NFR-3.1, NFR-3.3
**Definition of Done**:
- [ ] `effective_from` recorded on the limit record.
- [ ] Partner call is idempotent on derived key.
- [ ] On partner failure, local state is rolled back or compensating audit entry is written (option documented).
- [ ] Audit entry includes before/after values per limit field.
- [ ] Partial-success at partner across limit fields handled per §7.2 row 3 — the compensating audit entry names exactly which fields the partner refused.

#### T12 — Rate limit on limit changes
**Prompt**: Specify the per-user rate limit on limit changes to prevent abuse and limit partner-side noise.
**Create/Update**: `docs/policy/rate-limits.md` (shared file; see T19)
**Tag**: → M3, NFR-3.1
**Definition of Done**:
- [ ] Documented limit (assumed target): ≤ 20 limit-change requests per user per 24 h.
- [ ] Exceeding returns typed `rate_limit.exceeded` with retry-after.
- [ ] Rate-limit decisions are logged but counted independently from audit entries.

### Transaction History (M4)

#### T13 — Cursor-paginated history with filters
**Prompt**: Specify a cursor-paginated transaction history read with filters for date range, status (cleared/pending/declined), and amount range.
**Create/Update**: `docs/flows/history-read.md`
**Tag**: → M4, NFR-3.1
**Definition of Done**:
- [ ] Cursor is opaque to the client and integrity-protected (signed).
- [ ] Default page size 25; max 100; over-max returns typed error.
- [ ] Deep-offset access is not exposed (cursor-only).
- [ ] Filters validated and documented; invalid filters return typed errors.
- [ ] Page response meets read-latency budget (p95 < 500 ms) at maximum page size 100 — §9.1, §9.2.

#### T14 — Partner-truth consistency & drift policy
**Prompt**: Specify how our transaction projection is kept consistent with partner truth, what the reconciliation window is, and what we do when drift is detected.
**Create/Update**: `docs/flows/history-reconcile.md`
**Tag**: → M4, NFR-3.1, NFR-3.4
**Definition of Done**:
- [ ] Reconciliation window stated (≤ 60 s p95).
- [ ] Drift detection rule documented (per-transaction hash or amount/status compare).
- [ ] Drift produces an ops-visible alert and a typed audit entry.
- [ ] Reads can optionally include a `consistency: best_effort | strict` flag (or equivalent documented choice).
- [ ] Reconciliation lag is exposed as a histogram metric and tested against the ≤ 60 s p95 SLO — §3.1, §9.1.

### Termination (M5)

#### T15 — Irreversible closure transition
**Prompt**: Specify closure as a terminal transition: explicit user confirmation required, post-closure reads still succeed, no transition out of `CLOSED` exists.
**Create/Update**: `docs/flows/closure.md`
**Tag**: → M5, NFR-3.3
**Definition of Done**:
- [ ] Closure requires an explicit confirmation field in the request (typed error if missing).
- [ ] State machine rejects any transition out of `CLOSED`.
- [ ] Partner-side close call follows the freeze pattern (idempotent, queued on failure).
- [ ] Audit entry includes the closure reason if supplied.
- [ ] Concurrent close vs. freeze resolved via optimistic concurrency per §7.1 — only the first transition into `CLOSED` writes an audit entry.

#### T16 — Post-closure read & retention behavior
**Prompt**: Specify post-closure read behavior — what fields remain visible to the user vs. only to ops — and how the 7-year retention policy is enforced.
**Create/Update**: `docs/flows/closure-retention.md`
**Tag**: → M5, M6, NFR-3.3
**Definition of Done**:
- [ ] User-visible fields after closure are listed explicitly.
- [ ] Ops-only fields after closure are listed explicitly.
- [ ] Retention enforcement mechanism described (no early purge path for `audit_log` and `transactions`).

### Ops & Compliance (M6)

#### T17 — Ops read view with scope check
**Prompt**: Specify the ops read endpoints with read-only enforcement at both the route layer and the data-access layer (defense in depth).
**Create/Update**: `docs/flows/ops-read.md`
**Tag**: → M6, NFR-3.2, NFR-3.3, NFR-3.6
**Definition of Done**:
- [ ] Ops scope required on every ops route; absence returns `403 forbidden_scope`.
- [ ] Data-access layer enforces read-only for `actor_type = OPS`; write attempts raise.
- [ ] Every ops read writes a `read` audit entry (yes — reads are audited for compliance).
- [ ] No PAN/full-expiry exposure path exists for ops, only the same masked fields as the end-user view.

#### T18 — Audit export (signed, redacted)
**Prompt**: Specify the audit export flow: given a `user_id` and date range, produce a signed, redacted export of card events and transactions.
**Create/Update**: `docs/flows/audit-export.md`
**Tag**: → M6, NFR-3.2, NFR-3.3, NFR-3.6
**Definition of Done**:
- [ ] Export is signed (mechanism documented).
- [ ] Redaction follows the same allowlist as logging.
- [ ] Export request itself is audited (`actor`, `range`, `correlation_id`).
- [ ] Export generation does not block ops reads; long-running flows use a job with status polling.
- [ ] Async export job does not contend with the synchronous read budget (§9.1); export endpoint enforces ≤ 5 per ops user per hour (§9.3).

### Cross-cutting Hardening

#### T19 — Per-user rate limits (shared policy)
**Prompt**: Define the global per-user rate-limit policy table that other flows reference (issuance, freeze, limit change).
**Create/Update**: `docs/policy/rate-limits.md`
**Tag**: → NFR-3.1, NFR-3.4
**Definition of Done**:
- [ ] Table documents each limited operation with its window and threshold (assumed targets).
- [ ] Exceed behavior consistent across operations: typed `rate_limit.exceeded` + `Retry-After`.
- [ ] Throttling decisions are observable (metric) and audited only when they block a user action.

#### T20 — Idempotency-key registry & replay rules
**Prompt**: Define the shared idempotency-key store and replay semantics referenced by all mutating flows.
**Create/Update**: `docs/policy/idempotency.md`
**Tag**: → NFR-3.1, NFR-3.3
**Definition of Done**:
- [ ] Key scope documented: `(user_id, route, key)`.
- [ ] Replay window: 24 h.
- [ ] Replay returns the stored response without re-executing side effects.
- [ ] Mismatched body on the same key returns typed `idempotency.conflict`.
- [ ] Keys are purged after the replay window plus a documented grace period.

#### T21 — Step-up authentication for sensitive actions
**Prompt**: Specify the step-up auth gate applied to issuance, limit increase, closure, and audit export. Cover the SCA-required outcome, the assertion handoff, and how step-up evidence is recorded on the audit entry.
**Create/Update**: `docs/policy/step-up-auth.md`
**Tag**: → M1, M3, M5, M6, NFR-3.5, NFR-3.6
**Definition of Done**:
- [ ] Sensitive-action list matches §3.6 exactly (issuance, limit increase, closure, audit export).
- [ ] Step-up returns typed `sca.required` with challenge details; the original request is **not** executed.
- [ ] Follow-up request carries the SCA assertion; assertion id, factor type, and freshness recorded on the audit entry.
- [ ] Limit *decrease* does **not** require step-up; only limit *increase* does.
- [ ] Behavior matches §7.4 row 5.

#### T22 — Legal hold mechanism & AUDITOR role
**Prompt**: Specify the legal-hold flag, who can set/release it, how it overrides retention, and how the AUDITOR role accesses held records separately from OPS.
**Create/Update**: `docs/policy/legal-hold-and-auditor.md`
**Tag**: → M6, NFR-3.3, NFR-3.5, NFR-3.6
**Definition of Done**:
- [ ] `legal_hold` flag documented at record level (scope: card, transaction, audit, user-aggregate).
- [ ] Set/release restricted to a documented compliance role and requires a `reason_code`.
- [ ] Retention-driven deletion paths skip records under hold; the flag itself is immutable while active.
- [ ] AUDITOR role documented with read-only access to `audit_log` and held records; AUDITOR reads written to a separate `audit_of_audit` sink.
- [ ] DSAR right-to-erasure conflicts handled per §7.4 row 2.

#### T23 — OFAC / sanctions screening at issuance
**Prompt**: Specify the sanctions pre-check executed before the partner issuance call; cover screening list source, hit handling, user-facing message, and the ops review queue.
**Create/Update**: `docs/flows/sanctions-screening.md`
**Tag**: → M1, NFR-3.3, NFR-3.5
**Definition of Done**:
- [ ] Screening occurs **before** the partner issuance call; pre-check failure short-circuits T05.
- [ ] Hit produces a typed `compliance.sanctions_hit` audit entry with the screening reference.
- [ ] User-facing error is the generic `compliance.review_required` — never `sanctions_hit`.
- [ ] Hits enter an ops review queue; ops review action is itself audited.
- [ ] Behavior matches §7.4 row 1.

---

## 7. Edge Cases & Failure Modes

Format: *scenario → expected user-visible behavior → audit/compliance implication.*

### 7.1 Concurrency

| Scenario | Expected behavior | Audit / compliance implication |
|---|---|---|
| Two simultaneous freeze requests for the same card | First wins; second returns `200` with current state (idempotent no-op) **or** `409 stale_state` if it carried a stale version. Card ends in `FROZEN`. | One audit entry written (the actual transition); the no-op or rejection is not audited as a state change. |
| Two simultaneous limit-change requests | Last successful write wins under optimistic concurrency; loser receives `409 stale_state` and must retry with refreshed version. | Both attempts are logged at request level; only the successful change writes an audit entry. |
| Retry storm with same `Idempotency-Key` | All replays within 24 h return the original response; no side effects re-executed. | No additional audit entries beyond the original. |
| Partner webhook arrives **before** our local write commits (race) | Webhook handler defers application using partner event timestamp; reconciliation converges on partner-supplied order. | Audit entry records `actor_type = SYSTEM` with partner event reference; ordering anomaly logged for ops review. |

### 7.2 Partner Failures

| Scenario | Expected behavior | Audit / compliance implication |
|---|---|---|
| Partner timeout on issuance | Card remains `PENDING_ISSUANCE`; user sees typed `partner.unavailable`; documented retry policy applies. | Audit entry records the attempt and the partner outcome (`timeout`). |
| Partner 5xx on freeze after our local commit | Local state is already `FROZEN`; outbound queue retries the partner mirror; reconciliation alert fires if drift persists beyond the window. | Audit entry on the local commit; reconciliation alert logged with correlation. |
| Partial success on limit update (some limit fields applied, some not) | Documented per-flow: either roll back all or persist a compensating audit entry naming exactly which fields the partner refused. | Audit entry captures before/after per field, including the failed fields. |
| Lost webhook (partner-driven freeze never reaches us) | Daily reconciliation detects drift; ops alert fires; system reconciles via partner truth, writing a `SYSTEM`-attributed audit entry. | Drift incident is itself auditable. |
| Out-of-order webhooks | Apply by partner timestamp; ignore strictly older events whose effect is already superseded. | Each accepted webhook produces an audit entry; ignored events logged but not audited as state changes. |

### 7.3 Authorization & Permission Boundaries

| Scenario | Expected behavior | Audit / compliance implication |
|---|---|---|
| User A attempts to act on User B's card | `403 forbidden_resource`; never reveal whether the card exists. | Logged at request level; not written to `audit_log` as a card event (no resource owned by actor). |
| Ops user attempts a mutation | Blocked at the route layer **and** at the data-access layer; returns `403 forbidden_scope`. | The blocked attempt itself writes an audit entry under `audit_log` because ops actions are always audited. |
| Expired or revoked session reaches a card route | Rejected by auth layer before card logic runs; typed auth error returned. | No card audit entry; auth layer's own audit applies. |
| Audit export requested with a range outside the ops user's scope | Export is filtered to the in-scope subset; if the filtered set is empty, an empty signed export is returned (not a 404). | Export request is audited with the requested range and the applied scope. |

### 7.4 Compliance & Regulatory Edge Cases

| Scenario | Expected behavior | Audit / compliance implication |
|---|---|---|
| OFAC sanctions hit on issuance pre-check | Issuance blocked; user sees generic `compliance.review_required` (no detail about the cause); attempt routed to ops queue. | `compliance.sanctions_hit` audit entry written with the screening reference; ops review action is itself audited. |
| Right-to-erasure request conflicts with retention | Erasure denied for fields under the 7-year retention obligation; allowed for fields outside that scope. Outcome + legal basis recorded. | Request and outcome audited; legal basis citation included in `detail`. |
| Failed authentication or scope rejection on a sensitive route | Returns the typed auth/scope error; the **attempt is audited** (forensics), not silently dropped. | Audit entry with `action = auth.rejected` or `scope.rejected`, plus `correlation_id`. |
| Break-glass ops elevation activated | Session is time-boxed (≤ 4 h) and auto-expires; compliance reviewer alerted in real time. | Activation, every action under elevation, and expiry written to `audit_log` with `break_glass = true`. |
| Step-up auth required but not provided | Returns typed `sca.required` with the challenge; the original request is **not executed**. | Audit entry records the gate, not the would-be action; success path waits for the SCA assertion on the follow-up call. |

---

## 8. Verification

### 8.1 Per-task Definition of Done
Every low-level task in Section 6 ends with an acceptance-criteria checklist. A task is "done" only when every box is satisfied; reviewers tick boxes during code review and link the PR back to the task ID.

### 8.2 Test Categories per Objective (documentation; no code in this homework)

| Objective | Unit tests | Integration tests | End-to-end tests |
|---|---|---|---|
| M1 Issuance | Eligibility branches, idempotency-key derivation, state-machine transition from `PENDING_ISSUANCE`. | Partner sandbox happy path; partner timeout & retry; replay of same key. | User issues card → reads it → sees correct `last4`, `state = ACTIVE`. |
| M2 Freeze/Unfreeze | Optimistic-locking compare-and-set; no-op when target equals current. | Partner sync success; partner failure leaves outbound queue entry; webhook reconciles drift. | Freeze → attempt simulated authorization → blocked within 2 s. |
| M3 Limits | Cross-field validation matrix (daily ≤ monthly, per-txn ≤ daily, currency match). | Partner mirror of each limit field; rollback on partial failure. | Set limit → see effective_from → simulate transaction over limit → declined. |
| M4 History | Cursor encoding/decoding; filter validation; page-size bounds. | Reconciliation drift detection; consistency flag behavior. | New transaction at partner → appears in history within 60 s. |
| M5 Termination | Confirmation field required; state machine rejects exits from `CLOSED`. | Partner close + outbound queue on failure; post-closure read shape. | Close card → attempt freeze → rejected with typed error. |
| M6 Ops & Audit Export | Scope-check on every ops route; read-only at data layer. | Audit-read entries written; export signing & redaction. | Ops user pulls export for a user → file is signed, redacted, and covers the requested range. |

### 8.3 Manual Compliance Review Checkpoints

The following gates require human compliance sign-off **before** the change reaches production:

- Enabling a new **card product type** (e.g. multi-currency variants).
- Changing the **rate-limit policy table** (Section 6 T19) defaults or thresholds.
- Modifying the **audit redaction allowlist**.
- Changing the **retention period** for any audited record.
- Adding any new field to `cards` or `transactions` that could be PII-adjacent.
- **Annual SOC 2 review** of the BaaS partner; any qualified or failed report.
- **Sub-processor change** at the partner (additions or material change in scope).
- **Encryption key rotation policy change** (cadence or key class).
- **Audit-log schema change** (new field, new actor type, new action class).
- **Step-up-auth-required action list change** (adding or removing sensitive actions).
- **Any change that would put PAN, CVV, or full expiry into our environment** (PCI scope expansion).

Each checkpoint is recorded with reviewer identity and timestamp and is itself appended to `audit_log` under `actor_type = OPS`.

---

## 9. Performance Expectations (Concrete)

Numbers labeled **assumed targets** are positioned for FinTech UX credibility; they would be validated against real partner SLAs and observed user behavior.

### 9.1 Latency budgets (restated and elaborated)

- Read endpoints (single card, history page, current limits): **p95 < 500 ms, p99 < 1000 ms** measured at the public edge.
- Write endpoints (issue, freeze, set limit, close): **p95 < 1500 ms, p99 < 3000 ms** measured at the public edge.
- Of the write budget, partner-call time is expected to consume the majority; service-internal work targets **p95 < 200 ms** independent of the partner.

### 9.2 Pagination rules (transaction history)

- **Cursor-based only**; no offset pagination exposed.
- **Default page size 25**, **maximum 100**; values above 100 return typed `pagination.page_too_large`.
- Cursors are **opaque and signed**; tampered cursors return `pagination.invalid_cursor`.
- Filters supported: date range (max 365 days per page request), status, amount range.

### 9.3 Rate limits per user (assumed targets)

| Operation | Window | Threshold | Justification |
|---|---|---|---|
| Card issuance | rolling 24 h | 3 | Bounds abuse and partner-side noise; aligned with typical FinTech onboarding. |
| Freeze toggle | rolling 1 min | 10 | Generous enough for legitimate fraud-response panic clicks; tight enough to prevent runaway. |
| Limit change | rolling 24 h | 20 | Real users adjust limits a handful of times per day at most. |
| Audit export (ops) | rolling 1 h | 5 | Ops bulk-export work is intentional and infrequent; rate cap prevents accidental floods. |

Exceeding any threshold returns `429` with typed `rate_limit.exceeded` and a `Retry-After` value.

### 9.4 Time-to-consistency for freeze

- **Target**: ≤ 2 s from our 2xx response to partner refusing new authorizations.
- **Measurement**: tracked as a histogram via a synthetic probe in non-prod; in prod, sampled correlation between our state change time and the next observed authorization decision in the projection.
- **Fallback**: if the budget is exceeded, the next user-facing read includes an inline "sync in progress" indicator (UX detail deferred); ops alert fires if budget is exceeded for > 1% of freeze events over 5 minutes.

---

## 10. Traceability Appendix

Every low-level task ties back to at least one mid-level objective and at least one non-functional concern.

| Task | Mid-level | NFR(s) | Edge-case bucket |
|---|---|---|---|
| T01 Schema | M1–M6 | 3.2, 3.3 | — |
| T02 State machine | M1, M2, M5 | 3.3 | 7.1 |
| T03 Partner contract | M1–M5 | 3.1, 3.4, 3.7 | 7.2 |
| T04 Eligibility | M1 | 3.3 | 7.3 |
| T05 Issuance execute | M1 | 3.1, 3.2, 3.4, 3.7 | 7.2 |
| T06 Issuance audit | M1 | 3.3 | — |
| T07 Freeze transition | M2 | 3.1 | 7.1 |
| T08 Freeze partner sync | M2 | 3.1, 3.4, 3.7 | 7.2 |
| T09 Freeze webhook | M2 | 3.3, 3.4 | 7.1, 7.2 |
| T10 Limits model | M3 | 3.2 | — |
| T11 Limits update | M3 | 3.1, 3.3 | 7.1, 7.2 |
| T12 Limit-change rate cap | M3 | 3.1 | — |
| T13 History read | M4 | 3.1 | — |
| T14 History reconcile | M4 | 3.1, 3.4 | 7.2 |
| T15 Closure transition | M5 | 3.3 | 7.1 |
| T16 Closure retention | M5, M6 | 3.3 | — |
| T17 Ops read view | M6 | 3.2, 3.3, 3.6 | 7.3 |
| T18 Audit export | M6 | 3.2, 3.3, 3.6 | 7.3 |
| T19 Rate-limit policy | (all writes) | 3.1, 3.4 | — |
| T20 Idempotency registry | (all writes) | 3.1, 3.3 | 7.1 |
| T21 Step-up auth | M1, M3, M5, M6 | 3.5, 3.6 | 7.4 |
| T22 Legal hold + AUDITOR | M6 | 3.3, 3.5, 3.6 | 7.4 |
| T23 Sanctions screening | M1 | 3.3, 3.5 | 7.4 |

This appendix is the single place to verify the rubric's "traceability from goals to tasks" requirement: every objective is served by at least three tasks, every NFR is enforced by at least three tasks, and every edge-case bucket is addressed by at least three tasks.

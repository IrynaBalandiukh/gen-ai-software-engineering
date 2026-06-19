# Homework 3 — Specification-Driven Design

## Student & task summary

- **Student Name**: Iryna Balandiukh
- **Date Submitted**: 13.05.2026
- **AI Tools Used**: Claude Code

**Task**: Design a layered specification package for a finance-oriented application. No implementation required; the graded artifact is the specification itself — how clearly the problem decomposes, how traceable requirements are from goals to tasks, and how well failure modes, verification, and non-functional expectations are anticipated.

**Domain chosen**: a **virtual card manager** for a regulated card-issuing service operating in a **BaaS (banking-as-a-service) partner model** — the partner holds PAN/CVV/full expiry; this service owns card metadata, state, limits, transaction history projection, and audit.

## Deliverables

| File | Purpose |
|---|---|
| `specification.md` | Layered spec — objectives, NFRs, implementation notes, context, 23 low-level tasks, edge cases, verification, performance, traceability |
| `AGENTS.md` | Vendor-neutral AI-agent guidelines: tech-stack defaults, banking quick-rules, code style, per-PR rules, MUST-NEVERs, halt-and-ask triggers |
| `CLAUDE.md` | Claude-Code-specific guidance: read-first pointers, FinTech-sensitive defaults, files-not-to-edit |
| `README.md` | This file — student summary, rationale, industry-practice cross-walk |

---

## Rationale

### Why this domain and the BaaS-partner model

A virtual card manager exercises every dimension the rubric scores on: it is a **regulated** product (PCI-DSS, BSA/AML, OFAC, Reg E, GDPR, PSD2 SCA), has a clear **stakeholder split** (end-user / ops-compliance), forces a **partner integration boundary** that drives non-trivial failure-mode design, and naturally produces an **audit-heavy** lifecycle.

The partner-issuing model was chosen specifically to **minimize PCI-DSS scope** (target SAQ-A / SAQ-D-Lite — spec §3.5). It makes "we never store PAN/CVV" structurally credible (§3.2), turns partner-failure paths into first-class design (§7.2 has 5 distinct rows), and gives vendor-risk practices a concrete home (§3.7: SOC 2, sub-processors, exit plan, DPA).

### Why a layered structure with 23 tasks

The rubric grades **traceability from goals to tasks** as a first-class criterion. Mid-level objectives (M1–M6) each carry inline *Verified when*, *Key edge cases*, and *Perf budget*; low-level tasks (T01–T23) each carry a `→ M*` / `→ NFR-*` tag and a Definition-of-Done checklist; §10 Traceability Appendix is the single place to verify "every objective, NFR, and edge-case bucket is covered by ≥3 tasks." Twenty-three tasks (not three) was chosen so every capability gets multiple slices (schema / state / flow / audit / partner-sync) and cross-cutting hardening (rate limits, idempotency, step-up auth, legal hold, sanctions) gets dedicated tasks rather than being smeared.

### Why these performance targets

Numbers in §3.1 and §9 are labeled **assumed targets**, picked for FinTech-UX credibility:

- **Reads p95 < 500 ms, writes p95 < 1500 ms** — tier-1 banking-app bar (Revolut/Cash-App feel, not legacy-bank).
- **Time-to-consistency for freeze ≤ 2 s** — freeze is a fraud-response tool, must feel like it works *now*.
- **Reconciliation lag ≤ 60 s p95** — users refresh shortly after a purchase; sub-minute keeps support load down.
- **99.95% monthly availability** — ≈ 21 min/month error budget; defensible without being absurd (intentionally not 99.99%).

Targets are framed as "assumed" so a real team can revise without restructuring the document.

### Why this verification depth

Verification appears at **three layers** so "verification is first-class" holds at every reading depth:

1. **Per-task DoD** (§6) — checklist an implementer ticks.
2. **Test-category matrix per objective** (§8.2) — unit/integration/E2E coverage as documentation.
3. **Manual compliance review checkpoints** (§8.3) — 11 gated changes that require human compliance sign-off.

Mid-level objectives each carry a *Verified when* line, so the acceptance test for a feature is visible without scrolling.

### Why three companion files

`specification.md` is the *what* (source of truth); `AGENTS.md` is the vendor-neutral *how* (defaults, heuristics, MUST-NEVERs); `CLAUDE.md` is the Claude-Code-specific *how* (read-first pointers, files-not-to-edit). Each file points up the hierarchy (CLAUDE → AGENTS → spec) so a session converges on the spec without re-stating it.

---

## Industry best practices — where they appear

Every FinTech / banking practice encoded in this package and the exact file/section that carries it.

### Compliance & regulatory posture

| Practice | Where |
|---|---|
| PCI-DSS scope minimization (SAQ-A / SAQ-D-Lite via BaaS) | spec §3.2, §3.5, §8.3 |
| BSA / AML signal-emission hook on issuance / limit / closure | spec §3.5 |
| OFAC sanctions screening + generic user-facing error | spec §3.5, §7.4 row 1, T23 |
| Reg E non-impediment (dispute-required fields preserved) | spec §3.5 |
| GDPR / CCPA DSAR + erasure-vs-retention reconciliation | spec §3.5, §7.4 row 2, T18, T22 |
| PSD2 SCA / step-up on sensitive consumer actions | spec §3.5, §3.6, §7.4 row 5, T21 |
| Data residency aligned to user's bank entity | spec §3.5 |
| 11 manual compliance review checkpoints | spec §8.3 |

### Audit & forensics

| Practice | Where |
|---|---|
| Append-only `audit_log`, no UPDATE / DELETE | spec §3.3, T01 |
| Tamper evidence via `prev_hash` / `entry_hash` + daily WORM checkpoint | spec §3.3, T01 |
| 7-year retention (US banking norms) | spec §3.3 |
| Legal-hold flag overriding retention indefinitely | spec §3.3, §7.4 row 2, T22 |
| NTP-disciplined `occurred_at` + drift alerting | spec §3.3 |
| Audit-log schema versioning + checkpoint on change | spec §3.3, §8.3 |
| Auditing of failed auth / scope rejection / rate-limit blocks | spec §3.3, §7.4 row 3 |
| `reason_code` required on ops mutations + cross-user reads | spec §3.3, §3.6, T22 |
| Dedicated AUDITOR role + audit-of-audit sink | spec §3.3, §3.6, T22 |

### Security & data handling

| Practice | Where |
|---|---|
| Never store / log / cache / transit PAN, CVV, full expiry | spec §3.2, §4, AGENTS.md §3 + §7 |
| 4-tier data classification (Public / Internal / Confidential / Restricted) | spec §3.2 |
| Field-allowlist logging (not blocklist) | spec §3.2, §4, AGENTS.md §4 |
| AES-256 at rest + envelope encryption for Restricted fields | spec §3.2 |
| TLS 1.2+ external, TLS 1.3 preferred, mTLS to partner | spec §3.2 |
| Key rotation ≤ 90 d (data) / ≤ 365 d (signing) / ≤ 90 d (partner) | spec §3.2 |
| Prod data never copied to non-prod (synthetic only) | spec §3.2, AGENTS.md §7 |
| Webhook replay protection (signature + ±5 min + nonce) | spec §4 |
| NFC input canonicalization + output encoding | spec §4 |
| Defense-in-depth: ops read-only at route AND data-access layer | spec §4, T17 |
| Step-up auth on issuance / limit increase / closure / export | spec §3.6, T21 |
| PAM: `reason_code`, break-glass ≤ 4 h, session idle/absolute timeouts | spec §3.6 |
| Service-to-service auth via mTLS + short-lived workload tokens | spec §3.6, AGENTS.md §7 |

### Vendor / third-party risk

| Practice | Where |
|---|---|
| Annual SOC 2 Type II review of BaaS partner | spec §3.7, §8.3 |
| Sub-processor list maintained + gated on change | spec §3.7, §8.3 |
| Partner SLA + incident-communication path | spec §3.7, T03 |
| Partner-exit playbook reviewed annually | spec §3.7 |
| DPA on file, renewed alongside SOC 2 | spec §3.7 |

### Engineering conventions (FinTech-flavored)

| Practice | Where |
|---|---|
| Money as integer minor units + ISO-4217 (no floats) | spec §4, T10, AGENTS.md §3 |
| UUIDv7 entity IDs; partner IDs stored alongside | spec §4, AGENTS.md §3 |
| UTC ISO-8601 timestamps + optional `as_of` reads | spec §4, AGENTS.md §3 |
| Strict state enum + documented transition matrix | spec §4, §5.2, T02 |
| `Idempotency-Key` required on every mutation, 24 h replay | spec §4, T20, AGENTS.md §3 |
| Optimistic concurrency (compare-and-set on version) | spec T07, §7.1 |
| RFC 7807 errors with stable typed codes + `correlation_id` | spec §4, AGENTS.md §3 |
| Cursor-based pagination (opaque, signed; max 100) | spec §9.2, T13 |
| Per-user rate limits + `Retry-After` | spec §9.3, T19, T12 |
| Reconciliation + drift alerting on partner-truth divergence | spec §7.2, T14 |
| Outbound queue for partner sync (no silent drop) | spec §7.2, T08, AGENTS.md §5 |

### Specification & process practices

| Practice | Where |
|---|---|
| Layered objectives with inline *Verified when* / edge cases / perf | spec §2 |
| Per-task DoD checklists | spec §6 |
| Test categories per objective (documentation, no code) | spec §8.2 |
| Edge cases as first-class section (4 buckets) | spec §7.1–7.4 |
| Perf budgets as concrete numbers + "assumed targets" framing | spec §3.1, §9 |
| Traceability appendix: every task → objective + NFR + edge-case | spec §10 |
| MUST-NEVER list for high-blast-radius rules | AGENTS.md §7 |
| 8 halt-and-ask triggers for AI agents | AGENTS.md §8, CLAUDE.md §2 |
| Files-not-to-edit list for AI agents | CLAUDE.md §3 |

# CLAUDE.md — Virtual Card Manager (spec project)

This is a FinTech / regulated-environment specification project. Treat every action as if it affects a real card-issuing system.

## 1. Read before changing anything

1. **`specification.md`** — the source of truth for *what* the system must do. Layers: high/mid-level objectives, NFRs (§3.1–3.7), implementation notes (§4), context (§5), low-level tasks (§6), edge cases (§7), verification (§8), performance (§9), traceability (§10).
2. **`AGENTS.md`** — the rules for *how* an agent must behave while building. Banking quick-rules (§3), code style (§4), always-prefer heuristics (§5), per-PR requirements (§6), MUST-NEVERs (§7), halt-and-ask triggers (§8).

If a request conflicts with either file, surface the conflict instead of resolving it silently.

## 2. FinTech-sensitive defaults (Claude-specific)

- **Never paste PAN, CVV, or full expiry into a prompt, a tool argument, a tool result, or a code sample.** If a user pastes any of these, refuse to echo or store the value and ask them to remove it. This is the project's highest-blast-radius rule.
- **When an instruction conflicts with `AGENTS.md` §7 MUST-NEVERs**, halt and surface the conflict — do not proceed with the work and "leave a TODO."
- **When an instruction would expand PCI scope, weaken audit, disable signature/idempotency/step-up checks, or touch `legal_hold` records**, halt per `AGENTS.md` §8 even if it looks like a small change.
- **Treat the partner (BaaS) as if it exists**: do not pretend partner calls succeed in code samples; respect the partner-failure paths documented in spec §7.2.
- **Do not invent regulatory facts**. If a request references a regulation not already in spec §3.5, ask before adding it.

## 3. Files Claude must not edit without an explicit ask

The following files are deliverables and represent agreed contracts; edits require an explicit instruction naming the file.

- `specification.md`
- `AGENTS.md`
- `CLAUDE.md` (this file)
- `README.md`
- Anything under `docs/policy/` (rate limits, idempotency, step-up auth, legal hold) — these encode compliance-review checkpoints and changes are §8.3 events
- Anything under `docs/schema/` describing append-only or retention-bound tables

For these files: read freely; propose diffs; do not write without confirmation.

## 4. Project layout

```
homework-3/
├── specification.md          # source of truth (spec)
├── AGENTS.md                 # agent behavior rules
├── CLAUDE.md                 # this file
├── README.md                 # student-facing summary
├── TASKS.md                  # homework brief (read-only)
└── specification-TEMPLATE-example.md   # reference template (read-only)
```

Planned per spec §6 task targets — **none of the paths below exist yet**; do not read or edit them without an explicit instruction to create them:

```
docs/
├── schema/card-domain.md            # T01
├── state-machine/card-lifecycle.md  # T02
├── partner/integration-contract.md  # T03
├── partner/sub-processors.md        # §3.7
├── flows/                           # T04–T18, T23
└── policy/                          # T19, T20, T21, T22
```

## 5. Preferred Claude behaviors in this repo

- **When adding a low-level task** to the spec, also update §10 Traceability *and* tag the task with the relevant `→ M*` and `→ NFR-*` references. Tasks without traceability are not done.
- **When adding an edge case**, place it in the right §7.x bucket (concurrency / partner / authz / compliance) *and* reference it from at least one task's DoD. Orphan edge cases are not done.
- **When adding a regulatory framework**, update §3.5 *and* check whether a new §8.3 compliance checkpoint is implied.
- **When adding or changing an NFR**, verify the closing claim of §10 still holds ("every NFR is enforced by at least three tasks") — fix tags if it doesn't.
- **When adding fields to `audit_log`**, halt and ask. This is a §8.3 compliance event by definition (spec §3.3 + AGENTS.md §8 trigger 3).
- **When asked to make the spec or AGENTS.md "shorter"**, cut duplication first, never required content. Verify the rubric items in `TASKS.md` still resolve.
- **Prefer the `Edit` tool** over `Write` for changes to existing files in this folder. Full rewrites lose review history and risk silently dropping content.

## 6. What this project does not have (and that's intentional)

- **No source code**. This homework is spec-only; do not scaffold a service. If a request seems to require running code, say so and confirm scope.
- **No live partner credentials, no real KMS, no production endpoints.** Anything that looks like one is hypothetical.
- **No test suite to run.** "Tests" in this project are described as documentation in spec §8.2 and as DoD checklists in §6 — not executable.

## 7. Last word

When a rule here feels heavy-handed for the task in front of you, that is the rule doing its job. The cost of asking is small.

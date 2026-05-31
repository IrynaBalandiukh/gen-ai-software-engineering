---
name: research-quality-measurement
description: >-
  Rubric for measuring the quality of bug-research findings. Defines the quality
  levels, the criteria that map a research document to a level, and the exact
  sections the verifier must write into verified-research.md.
applies_to:
  - agents/research-verifier.agent.md
---

# Skill: Research Quality Measurement

This skill defines **how the Bug Research Verifier rates the quality of a
research document** (`research/codebase-research.md`) and the format it must use
when writing `research/verified-research.md`.

The goal: a downstream **Bug Planner** must be able to trust the research enough
to plan fixes from it. Quality is therefore measured by **how verifiable and
accurate the research is**, not by how much was written.

---

## 1. What the verifier checks (evidence)

For every claim in the research document, the verifier confirms:

1. **Reference accuracy** — each `file:line` reference exists and points at the
   code the claim describes.
2. **Snippet fidelity** — quoted code matches the current source exactly
   (whitespace-insensitive, but otherwise verbatim).
3. **Claim correctness** — the described behaviour/defect is actually true in
   the code (the bug really exists where stated).
4. **Completeness** — every defect listed in `bug-context.md` is addressed by
   the research, with no unexplained gaps.
5. **Actionability** — the root cause and proposed direction are concrete enough
   for a planner to act on.

Each checked item is **Verified**, **Partially Verified**, or **Refuted**.

---

## 2. Quality levels

Map the evidence above to exactly one level. Use the **lowest** level whose
condition is met (i.e. a single critical discrepancy caps the score).

| Level  | Label         | Criteria                                                                                                                                        |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **L4** | **Excellent** | 100% of references and snippets verified; all claims correct; all `bug-context.md` defects covered; directly actionable.                        |
| **L3** | **Good**      | ≥ 90% references/snippets verified; all _defect-critical_ claims correct; at most minor, non-blocking discrepancies (e.g. a stale line number). |
| **L2** | **Fair**      | 70–89% verified, **or** one defect-critical claim is wrong/unsupported, **or** a listed defect is missing. Usable only after corrections.       |
| **L1** | **Poor**      | < 70% verified, multiple wrong claims, or fabricated references/snippets. Not safe to plan from.                                                |

**Defect-critical** = anything the Bug Planner needs to locate or fix a defect
(the file, the line region, the root cause). Cosmetic issues are non-critical.

---

## 3. Pass / fail rule

- **PASS** = level **L3 (Good)** or **L4 (Excellent)** — the Bug Planner may
  proceed.
- **FAIL** = level **L2** or **L1** — research must be corrected/re-run before
  planning. List the blocking discrepancies explicitly.

---

## 4. Required output format for `verified-research.md`

The verifier MUST write these sections, in this order:

```markdown
# Verified Research — <batch id>

## Verification Summary

- Result: PASS | FAIL
- Research Quality: L<n> <Label> (per research-quality-measurement skill)
- Scope: <files / defects reviewed>

## Verified Claims

| #   | Claim | Reference (file:line) | Snippet matches? | Status   |
| --- | ----- | --------------------- | ---------------- | -------- |
| 1   | ...   | src/app.js:34         | yes              | Verified |

## Discrepancies Found

- <each wrong line number, mismatched snippet, or unsupported claim; empty = "None">

## Research Quality Assessment

- Level: L<n> <Label>
- Reasoning: <why this level, tied to the criteria above and to the evidence>

## References

- <list every source file:line the verification relied on>
```

If there are no discrepancies, write **"None."** under that heading — do not omit
the section.

---

## 5. How to apply

1. Read `bug-context.md` and `research/codebase-research.md`.
2. Open every referenced file and check reference accuracy + snippet fidelity +
   claim correctness against the live source.
3. Tally the evidence, pick the level by the **lowest matching** criterion.
4. Decide PASS/FAIL and write `verified-research.md` in the format above.
5. Never invent a reference — if a claim can't be located, mark it **Refuted**
   and record it under Discrepancies.

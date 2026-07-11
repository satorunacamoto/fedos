# Secure Runtime Alpha 090 — Desktop Integration Completion Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO
implementation change of any kind. `src/` is untouched by this Stage
— no code, no comment, no field, no method, nothing. This document,
its own guard test, and a `README.md` entry are the entire
deliverable. This is Stage 4, the closing Stage, of the Alpha 087–090
Desktop Integration Review Arc.**

## 1. Why now

Alpha 086 fixed the Desktop/Identity Boundary (Option A: Desktop
constructs its own instance, independent of `createRuntime()`). Alpha
087 fixed Bootstrap Ownership (construct once and bootstrap once, at
Desktop startup; never explicitly destroy). Alpha 088 fixed Desktop
Lifetime (one instance held for the entire Desktop process, formally
distinct from Worker's own Request Lifetime). Alpha 089 fixed Runtime
Separation (Identity is never handed back into `createRuntime()`,
closing the `RuntimeOverrides` loophole explicitly). Together these
four Stages fully specify the Desktop Integration Boundary — the same
way Alpha 076–085 fully specified, then closed, the Observation
Framework. This Stage performs that same closing act for Desktop
Integration: confirms the four Decisions are mutually consistent,
declares the Design Phase complete, and freezes it until a real
Desktop Shell exists to implement against.

## 2. The four Desktop Integration Decisions

| # | Stage | Element | Decision |
|---|-------|---------|----------|
| 1 | Alpha 086 | Boundary | Desktop constructs and bootstraps its own `FedosRuntimeIdentity` instance directly — `new FedosRuntimeIdentity()` → `bootstrapIdentity()` — entirely independent of `createRuntime()`. `AppRuntime` gains no `identity` field. |
| 2 | Alpha 087 | Bootstrap Ownership | Desktop constructs exactly ONE instance at startup and calls `bootstrapIdentity()` exactly once, as part of that same startup sequence. No explicit destruction API exists or is added; the instance is simply released at process exit, or replaced (per the pre-existing Alpha 062 Decision) on an Identity switch. |
| 3 | Alpha 088 | Lifetime | That one instance is held for the ENTIRE remaining Desktop process lifetime — Application Lifetime — formally and permanently distinct from Worker's own per-request, millisecond-scale Request Lifetime, which never touches Identity at all. |
| 4 | Alpha 089 | Runtime Separation | `createRuntime()`, `RuntimeOverrides`, and `AppRuntime` are permanently forbidden from ever accepting, exposing, or becoming aware of Desktop's own bootstrapped `FedosRuntimeIdentity` instance, through any mechanism, closing the `RuntimeOverrides` back-door explicitly. |

## 3. Mutual consistency confirmation

The four Decisions form a single coherent chain, confirmed directly
against each other and against the underlying source cited across
Alpha 086–089:

- Decision 1 (Boundary) establishes that Desktop's own instance is
  entirely separate from anything `createRuntime()` produces.
- Decision 2 (Ownership) fixes exactly ONE creation event for that
  separate instance, at Desktop startup — consistent with Decision 1's
  own premise that no other file constructs it.
- Decision 3 (Lifetime) explains WHY Decision 1's separation is
  necessary in the first place: `FedosRuntimeIdentity`'s own
  idempotency design (Alpha 061) only pays off under a long-lived,
  Application-Lifetime instance, which `createRuntime()`'s own
  per-call/per-request construction structurally cannot provide — this
  is the SAME reasoning Alpha 059 already used to reject Worker as
  Authority, now confirmed to apply symmetrically to why Desktop's
  instance must stay independent of `createRuntime()` too.
- Decision 4 (Separation) closes the one mechanism (`RuntimeOverrides`)
  that could otherwise have let Decision 3's own long-lived instance
  leak back into Decision 1's supposedly-independent `createRuntime()`
  path, which would have silently undone Decisions 1 and 3 together
  the moment a future Stage added a single new override field.

No contradiction exists between any pair of the four. Each narrows the
same boundary from a different angle — WHERE (1), WHEN (2), HOW LONG
(3), and WHETHER IT EVER REJOINS `createRuntime()` (4, permanently no)
— and none reopens or weakens any Decision the other three depend on.

## 4. Completion Declaration

- **Desktop Integration Design Phase is hereby declared COMPLETE.**
- Alpha 086 through Alpha 089 are frozen as ONE integrated Desktop
  Integration Boundary — Boundary, Bootstrap Ownership, Lifetime, and
  Runtime Separation — all four Decisions remain in force, unchanged,
  and binding on any future Desktop Shell implementation.
- **No further Desktop Integration Review Stage may be added past
  this one.** The four-element enumeration in §2 is final. Any future
  work on Desktop Integration is IMPLEMENTATION against these four
  Decisions — building the actual Desktop Shell (CLI, GUI, Electron,
  or Tauri) — not a new Review Stage adding a fifth dimension.
- **Design stays frozen until a real Desktop Shell is implemented.**
  No code, type, or API is added on the strength of this Arc alone;
  the four Decisions exist purely as binding constraints a future
  Desktop Shell implementation must satisfy, exactly as the
  Observation Framework's own nine Decisions (Alpha 076–085) exist
  purely as constraints on a future Observation implementation.

## 5. Relationship to the Observation Framework's own Completion

This Stage's own Completion Declaration directly satisfies Alpha 085's
own Resumption Condition #1 ("a Desktop shell is implemented") — but
NOT by implementing that Shell. Alpha 085 required the Shell to be
IMPLEMENTED, not merely designed-for, before Observation resumes. This
Arc (Alpha 086–090) prepares the Desktop Integration boundary a future
Shell implementation will need, but explicitly stops short of building
that Shell — Observation therefore remains frozen (per Alpha 085) even
after this Arc's own completion, until an actual Desktop Shell exists
in this repository.

## 6. What this Arc (Alpha 087–090) does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, or `types.ts` — no code, no comment, no field,
  no method, on any of them, across all four Stages.
- Does **not** modify `worker.ts`, any `src/identity/*` file, Storage,
  Rust, `Cargo.toml`, or `package.json`.
- Does **not** modify anything related to the Observation Framework
  (Alpha 076–085) — that Framework remains frozen exactly as Alpha 085
  left it.
- Does **not** implement a Desktop Shell of any kind — CLI, GUI,
  Electron, or Tauri.
- Does **not** add a fifth Desktop Integration Review Stage, and
  forbids any future Stage from adding one under this Arc's own name.

## 7. See also

- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion.md`
- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`
- `docs/secure_runtime_alpha_088_desktop_lifetime_review.md`
- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`

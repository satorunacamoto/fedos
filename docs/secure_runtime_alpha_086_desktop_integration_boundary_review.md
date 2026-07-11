# Secure Runtime Alpha 086 — Desktop Integration Boundary Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO
implementation change of any kind. `src/` is untouched by this Stage
— no code, no comment, no field, no method, nothing. This document,
its own guard test, and a `README.md` entry are the entire
deliverable.**

## 1. Why now

Alpha 059 formally adopted Desktop Application startup as the
designated Bootstrap Authority for `bootstrapIdentity()`, explicitly
rejecting Worker on a concrete structural flaw: Worker constructs a
fresh `AppRuntime` via `createRuntime()` on every single request, so
tying Identity Bootstrap to that per-request construction would be
both wasteful and semantically wrong. Alpha 085 declared the
Observation Framework's Design Phase complete and named "a Desktop
shell is implemented" as its own Resumption Condition #1. Neither
Alpha 059 nor any Stage since has actually specified WHAT a Desktop
caller is permitted to know about, construct, or call on
`FedosRuntimeIdentity` — only WHO the Authority is (Alpha 059), never
the shape of the boundary between that Authority and this class. This
Stage fixes that boundary, and only that boundary.

## 2. Review target

How much of `FedosRuntimeIdentity` should a future Desktop Shell be
permitted to know about?

## 3. Premise, confirmed directly against the actual source

- `bootstrapIdentity()` has never been called from anywhere in this
  repository. This is not new to this Stage — it has been true, and
  explicitly recorded as true, in `fedos_runtime_identity.ts`'s own
  header comment since Alpha 058 ("this method exists but remains, as
  of this Stage, called by nothing anywhere in this repository") and
  remains unchanged through Alpha 085.
- No Desktop Shell exists in this repository in any form — no CLI, no
  GUI, no Electron shell, no Tauri shell. There is nothing to wire
  this boundary INTO yet; this Stage fixes the boundary's SHAPE in
  advance of that Shell's own eventual implementation, the same
  pattern the entire Observation Framework (Alpha 076–085) already
  used for a Consumer that does not yet exist.
- `createRuntime()`, read directly from `src/runtime/create_runtime.ts`,
  already constructs exactly ONE `FedosRuntimeIdentity` per call today:

  ```ts
  const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
  void runtimeIdentity;
  ```

  This instance is immediately discarded via `void` — it is NEVER
  attached to the `AppRuntime` object literal `createRuntime()`
  returns, and NEVER read anywhere else in this repository. This has
  been true since Alpha 057 and is unchanged by any Stage since,
  including this one.
- `AppRuntime` (`src/runtime/types.ts`) has no `identity` field of any
  kind. `fedos_runtime_identity.ts`'s own HARD GUARDRAILS section
  states this explicitly: `create_runtime.ts` "is the ONLY file in
  this repository that constructs a `FedosRuntimeIdentity`... never
  attached to the `AppRuntime` object literal... and never read by any
  other file."

## 4. The Boundary under consideration

Should a future Desktop caller construct `new FedosRuntimeIdentity()`
directly and call `bootstrapIdentity()` on it itself — entirely
independent of `createRuntime()` — or should it go through
`createRuntime()` and reach Identity from there?

## 5. Options compared

- **Option A.** `Desktop → new FedosRuntimeIdentity() →
  bootstrapIdentity()`, entirely independent of `createRuntime()`.
  Desktop never calls `createRuntime()` for Identity purposes at all —
  it constructs and bootstraps its own instance directly, and uses
  `createRuntime()` (if at all) for everything else `AppRuntime`
  already provides.

- **Option B.** `Desktop → createRuntime() → Identity retrieved from
  inside the Runtime`. Some future internal mechanism inside
  `createRuntime()` itself would bootstrap and expose Identity,
  without a dedicated public field.

- **Option C.** `Desktop → createRuntime() →
  runtime.identity.bootstrapIdentity()`. Adds a new `identity` field to
  the Public Runtime API (`AppRuntime`), exposing the
  `FedosRuntimeIdentity` instance directly through it.

- **Option D.** Add a dedicated Bootstrap Manager. Desktop calls only
  the Manager; the Manager owns `FedosRuntimeIdentity` construction and
  Bootstrap internally.

- **Option E.** Desktop is never given Identity Runtime construction
  responsibility at all — some other, unnamed owner is responsible for
  constructing it.

## 6. Evaluation

Eleven criteria, applied to all five options:

- **Option A — Independent construction.**
  - *責務分離 (separation of concerns):* Clean — Desktop's own startup
    sequence owns Identity Bootstrap end to end; `createRuntime()`
    owns everything else, unchanged.
  - *Desktop依存性 (Desktop dependency):* `FedosRuntimeIdentity` gains
    no dependency on Desktop; Desktop gains exactly one dependency, on
    `FedosRuntimeIdentity` itself — the narrowest possible surface.
  - *Runtime純粋性 (Runtime purity):* `createRuntime()` stays exactly
    the pure, synchronous, side-effect-free construction Alpha 056/057
    already fixed it to be — nothing about Option A touches it.
  - *Public API肥大化 (Public API bloat):* Zero — no new `AppRuntime`
    field, no new exported function.
  - *AppRuntime変更量 (AppRuntime change volume):* Zero.
  - *Identity Layer独立性 (Identity Layer independence):* Strongest of
    the five — Identity Bootstrap is reachable through exactly the
    same five public methods `FedosRuntimeIdentity` already exposes,
    with no new indirection layer.
  - *Workerとの整合 (Worker consistency):* Fully consistent — Worker
    keeps calling `createRuntime()` exactly as it does today, never
    touching Identity; Desktop's own separate `FedosRuntimeIdentity`
    instance is invisible to, and unaffected by, Worker's per-request
    `createRuntime()` churn.
  - *Desktop寿命との整合 (Desktop lifetime consistency):* Strong — a
    Desktop process is long-lived, matching `FedosRuntimeIdentity`'s
    own idempotent, construct-once-bootstrap-once design (Alpha 061)
    far better than tying its lifetime to any per-call `createRuntime()`
    construction.
  - *Protocol非依存性 (Protocol independence):* Unaffected —
    `FedosRuntimeIdentity` already reaches the Identity Layer through
    `resolveFedosIdentityProvider()`, with no protocol assumption of
    its own; Option A changes nothing here.
  - *テスト容易性 (testability):* Strongest — `new FedosRuntimeIdentity()`
    is already directly constructible and already covered by the full
    Alpha 058–085 test arc with no additional seam needed.
  - *YAGNI:* Best score — introduces no new type, field, or class for
    a Desktop Shell that does not exist yet, mirroring exactly the
    reasoning Alpha 085 already applied to Observation.

- **Option B — Internal Runtime retrieval.** Would require
  `createRuntime()` itself to bootstrap or expose Identity internally
  — directly reopening the question Alpha 056 already closed: Alpha
  056 formally rejected the Alpha 055 auto-fired Bootstrap call
  specifically because it broke `createRuntime()`'s own pure,
  synchronous construction contract, and Alpha 057 removed it. Option
  B does not merely risk that same problem; it IS that same problem,
  proposed again under a new name. Rejected — it contradicts an
  already-adopted Decision, not merely a preference.

- **Option C — `runtime.identity` Public API field.** Would require
  adding an `identity` field to `AppRuntime`, which directly
  contradicts TWO independent, currently-standing guardrails read
  verbatim from the actual source in §3: `create_runtime.ts`'s own
  Alpha 050–052 header comment ("`AppRuntime`'s own field set... is
  UNCHANGED — no `identity` field, no new Public Runtime API of any
  kind") and `fedos_runtime_identity.ts`'s own HARD GUARDRAILS
  ("`create_runtime.ts` is the ONLY file... that constructs a
  `FedosRuntimeIdentity`... never attached to the `AppRuntime` object
  literal... and never read by any other file"). Adopting Option C
  would not be a new design choice — it would be an amendment reversing
  two existing, explicitly-worded Decisions, entirely out of scope for
  a Review-Only Stage that forbids `AppRuntime`/`create_runtime.ts`
  changes of any kind. Rejected.

- **Option D — Bootstrap Manager.** Introduces an entirely new class
  purely to indirect a single caller (Desktop) to a single callee
  (`FedosRuntimeIdentity`) that already exposes exactly the method
  (`bootstrapIdentity()`) such a Manager would exist to call. No
  second caller exists or is anticipated — Worker was already
  structurally rejected as an Authority by Alpha 059, and no other
  candidate Authority has ever been proposed. A Manager adds Runtime
  complexity and a new maintained surface for zero present benefit —
  the same YAGNI failure mode Alpha 085 §5 already identified in
  Options A/B of that Stage's own comparison, recurring here in a
  different guise. Rejected.

- **Option E — No Desktop construction responsibility.** Directly
  contradicts Alpha 059's own Authority Decision, which named Desktop
  Application startup, specifically, as `bootstrapIdentity()`'s own
  caller. Someone must construct the instance whose `bootstrapIdentity()`
  Desktop is meant to call; per §3, `createRuntime()`'s own internal
  instance is unreachable and discarded, so no alternative owner
  exists anywhere in the current source. Option E does not name a
  replacement owner — it is a negative constraint, not an actionable
  path, and it conflicts with a standing Decision besides. Rejected.

## 7. Confirming three existing Decisions coexist without conflict

This Stage confirms, directly against the source quoted in §3, that
the following three separately-adopted Decisions are mutually
consistent and require no reconciliation:

1. **`createRuntime()` is Construct Only** (Alpha 056/057) — it
   assembles `AppRuntime` synchronously, with no Bootstrap call and no
   Identity retrieval of any kind; its own internal
   `FedosRuntimeIdentity` construction is discarded via `void`,
   confirmed verbatim in §3.
2. **`FedosRuntimeIdentity` is Construct Only** — its own constructor
   (per the HARD GUARDRAILS quoted in `fedos_runtime_identity.ts`)
   "takes NO arguments, reads NO `RuntimeEnv`, and performs NO
   environment classification of any kind"; constructing an instance
   never triggers Bootstrap — `bootstrapIdentity()` is a distinct,
   separately-invoked method, confirmed by the class body itself
   (`#bootstrapped` starts `false`; nothing in the constructor calls
   `#bootstrapIdentity()`).
3. **Desktop alone is the Bootstrap Authority** (Alpha 059) — no other
   caller of `bootstrapIdentity()` has ever been adopted; Worker was
   explicitly rejected.

These three Decisions coexist without conflict precisely BECAUSE
`createRuntime()`'s own internal `FedosRuntimeIdentity` instance (fact
1) is unreachable and useless to any caller outside `create_runtime.ts`
— so the only way Decision 3 can ever be exercised at all is for
Desktop to construct its OWN, separate instance (fact 2 confirms this
is safe: construction alone triggers nothing), independent of
`createRuntime()` entirely. The three Decisions do not merely avoid
contradicting each other; the first two, taken together, are what
FORCE Option A as the only coherent implementation of the third.

## 8. Decision

**Option A is adopted: Desktop constructs and owns its own
`FedosRuntimeIdentity` instance directly — `new FedosRuntimeIdentity()`
→ `bootstrapIdentity()` — entirely independent of `createRuntime()`.**

Concretely, once a real Desktop Shell is eventually implemented (per
Alpha 085's own Resumption Condition #1):

- Desktop knows `FedosRuntimeIdentity` and nothing more of the
  Identity Layer's own internals — not `FedosIdentityRegistry`, not
  `FedosIdentityService`, not `FedosIdentityResolver`, not
  `FedosIdentityProvider`, all of which stay entirely encapsulated
  behind `FedosRuntimeIdentity`'s own five public methods exactly as
  they are today.
- `AppRuntime` gains NO `identity` field — Public Runtime API stays
  exactly as it is.
- `createRuntime()` is not modified — it keeps constructing and
  discarding its own internal `FedosRuntimeIdentity` instance exactly
  as Alpha 050–057 left it; that instance remains permanently
  irrelevant to Desktop's own separate instance.
- Only Desktop calls `bootstrapIdentity()` — Worker still never does,
  consistent with Alpha 059's own rejection of Worker as Authority.

## 9. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts` — no
  code, no comment, no field, no method. `src/` is entirely untouched
  by this Stage.
- Does **not** modify `src/runtime/create_runtime.ts` or `AppRuntime`
  (`types.ts`).
- Does **not** add an `identity` field to the Public Runtime API.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify any Storage or Crypto file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** implement a Desktop Shell of any kind — CLI, GUI,
  Electron, or Tauri.
- Does **not** add a Bootstrap Manager or any other new class.

## 10. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
- `docs/secure_runtime_alpha_057_identity_bootstrap_removal.md`
- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion.md`

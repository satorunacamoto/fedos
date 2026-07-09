# FedOS Secure Runtime Alpha 006 — Runtime Mode Authority Review

**Status: REVIEW ONLY. No code change of any kind — Runtime
implementation, `FedosWasmLoader`, Worker, Rust, Cargo, package.json,
Diagnostics, and Production are all byte-for-byte unchanged. This
document reviews the two independent `NODE_ENV` classifiers Alpha 004
§1 first found and Alpha 005 explicitly left unmerged, and recommends
whether — and when — they should become one.**

## 1. The two systems, compared

```txt
FedosWasmLoader.#evaluateDevOnlyGate()          (fedos_wasm_loader.ts, Stage 929)
runtimeCapabilities()'s determineRuntimeMode()  (fedos_runtime_prototype_execution.ts, Stage 999/1001)
```

| | `#evaluateDevOnlyGate()` | `determineRuntimeMode()` |
|---|---|---|
| **Input** | `process.env.NODE_ENV`, read once, try/catch-wrapped | `process.env.NODE_ENV`, read once, try/catch-wrapped — the SAME variable, independently read |
| **Output** | `FedosWasmLoaderDevOnlyGateEvaluation { evaluated, developmentAllowed, reason: "DevelopmentRuntime" \| "ProductionRuntime" \| "UnknownRuntime" \| "PrototypeStillClosed" }` — four values, one of which (`PrototypeStillClosed`) means "never evaluated," not an environment | `FedosRuntimeMode = "Development" \| "Production" \| "Unknown"` — three values, always evaluated, no "not yet run" state |
| **Purpose** | An EXECUTION GATE — a real Fail-Closed decision point. `developmentAllowed` feeds directly into `importReadiness()`, which every one of the six-condition chain's later steps (`attemptDevOnlyJsGlueImport`/`attemptDevOnlyWasmInitialization`/`attemptDevOnlyRustVersionCall`) reads before doing anything real. | A PUBLIC REPORT — a read-only label attached to `RuntimeCapabilities`, computed AFTER the whole async reach attempt already resolved, purely for a caller to observe "what environment did this snapshot see." |
| **Fail-Closed relationship** | THIS IS the actual mechanism — if `developmentAllowed` is `false`, the entire reach chain (real `import()`, real `initSync`, real `module.version()`) never executes. | NOT a gate — nothing anywhere branches on `runtimeMode`; it cannot prevent or permit anything. Removing it entirely would not change what Runtime can reach, only what a caller can be told about it. |
| **Public API relationship** | NOT public — `#evaluateDevOnlyGate()` is a PRIVATE method; even its own reader, `devOnlyGateEvaluation()`, exists on `FedosWasmLoaderSkeleton`, which is NOT part of the `FedosWasmLoader` interface `createFedosWasmLoader()` returns, and is never wired into `AppRuntime`. | DIRECTLY public — `runtimeMode` is a field on `RuntimeCapabilities`, the return type of `AppRuntime.runtimeCapabilities()`, a real method any external caller of `createRuntime()`'s own object can invoke today. |

**Summary**: these are not two implementations of the same
responsibility — they are two DIFFERENT responsibilities that happen
to read the same one environment variable. One decides; the other
reports.

## 2. Authoritative-source candidates

| # | Option | Assessment |
|---|---|---|
| A | Loader-side authoritative — `runtimeMode` reads the Loader's own `devOnlyGateEvaluation()` | Requires a REAL contract change: `attemptDevOnlyRuntimeRustIntegration()` currently returns only `{ reachedRust, rustVersion }` (Stage 994, unmodified since) — it would need to ALSO return the gate evaluation, or `runtimeCapabilities()` would need to construct and inspect its own second `FedosWasmLoader` instance (violating its own "exactly one `attemptDevOnlyRuntimeRustIntegration()` call, no second Loader instance" guardrail, Stage 999). Not a naming change — a real behavioral one. |
| B | Runtime-side authoritative — the Loader's own gate calls into Runtime's classifier | INVERTS today's dependency direction: `fedos_runtime_prototype_execution.ts` currently imports FROM `fedos_wasm_loader.ts`, never the reverse. Making the Loader depend on a higher-level Runtime-layer function is backwards — the Loader is the lower-level, more foundational piece, and risks a circular import if the Runtime layer ever needs anything else Loader-side later. |
| C | Extract to a shared function | Correct DIRECTION (a third, shared module both files import — no inversion, no contract change) but is a REAL refactor: a new file, and both existing files' own import graphs change. With only ONE current consumer of the label (`runtimeCapabilities()`) and NO decision anywhere yet depending on it, this work has no immediate payoff. |
| D | Keep separate for now | Zero risk, zero refactor. The duplication is a hygiene concern, not a correctness one — verified: both classifiers read the SAME env var and, in any real, non-toggled-mid-call deployment, always agree. |

## 3. Recommendation — keep separate now, extract later

**Adopt Option D today; treat Option C as the pre-committed NEXT step,
triggered by any ONE of §4's conditions — never Option A or B.**

Reasoning:

- The Loader's gate and the Runtime's label are genuinely DIFFERENT
  layers by design: one is an EXECUTION GATE (foundational, decides
  what can happen), the other is a PUBLIC LABEL (informational,
  reports what a caller should be told). Collapsing them prematurely
  would conflate "what CAN happen" with "what SHOULD be reported" —
  legitimately separate concerns even though they read the same input
  today.
- No Production Runtime connection exists yet. Consolidating now would
  optimize for a caller (Production) that does not exist — this arc
  has consistently avoided building for hypothetical future
  requirements ahead of the Stage that actually needs them.
- Options A and B are each REJECTED outright, not merely deprioritized:
  A requires a real contract/behavior change disguised as a refactor;
  B inverts a dependency direction this codebase has never used and
  should not introduce casually.
- Option C is the right EVENTUAL answer, but doing it now — with one
  consumer, zero decisions depending on the label, and no imminent
  trigger — is exactly the kind of large-scale refactor Alpha 005
  already declined to rush into, and this Phase maintains that same
  discipline.

## 4. Conditions that should trigger future consolidation (Option C)

Any ONE of the following should be treated as the signal to extract a
shared classifier — not a hard deadline, but a real trigger, checked
before starting the next Stage that would otherwise depend on either
classifier independently:

1. **Before Production Runtime connection** — Production authorization
   needs ONE unambiguous, trusted source of "what environment is
   this," per Alpha 001's own "no implicit environment trust for
   Production authorization" principle. Two independently-computed
   answers at that point is a real risk, not just duplication (a
   future code change touching only one classifier could make them
   silently diverge).
2. **Before Worker connection** — a second execution context reading
   either classifier needs one single source to stay in sync with
   Runtime's own answer, not two.
3. **Before `RuntimeCapabilities` gains additional fields whose own
   value depends on environment** (e.g. a future `backend` field that
   behaves differently by environment) — consolidating BEFORE that
   avoids compounding today's single-field duplication into a
   multi-field one.
4. **Before Secure Storage or any new Crypto API branches on
   `runtimeMode` for a real decision** — today `runtimeMode` is PURELY
   informational; the moment anything DECIDES based on it, having two
   potentially-divergent sources becomes a genuine Fail-Closed risk,
   not merely a hygiene one.

## 5. Alpha 007 — recommended priority, ranked

None of §4's trigger conditions are imminent today — Production/Worker
connection, additional environment-dependent fields, and
environment-branching Storage/Crypto logic are all still several
Stages away. Accordingly:

1. **Crypto API Surface Review** (Alpha 001 §3 item 3, deferred through
   Alpha 002–006 while state-model hygiene was being resolved) — now
   the highest-value next step; the actual reason this whole
   foundation exists.
2. **`RuntimeCapabilities` `backend` field** (Alpha 002 §6 / Alpha 004
   §4) — only once the Backend Resolver has real content to report;
   still blocked on that, not yet ready regardless of ranking.
3. **RuntimeHealth Review** — worth reviewing once Crypto API Surface
   work reveals what, if anything, could meaningfully be "unhealthy";
   premature before that.
4. **Secure Storage Baseline Review** — needed before real key
   material exists; naturally sequenced after Crypto API Surface,
   since storage needs are shaped by what operations actually produce
   secrets.
5. **Runtime mode authority common function (Option C, §3)** —
   deliberately LAST for Alpha 007 specifically: none of §4's trigger
   conditions are yet imminent. Revisit once Production/Worker
   connection or an environment-dependent field is actually on the
   near-term roadmap, not before.

## 6. What this Phase does NOT do

- Does **not** change any Runtime implementation code.
- Does **not** change `FedosWasmLoader` (including `#evaluateDevOnlyGate()`).
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** change any Production code path.
- Does **not** extract a shared environment classifier (Option C) —
  named as the future step, not implemented this Phase.

## 7. See also

- `docs/secure_runtime_alpha_005_runtime_state_naming_cleanup.md`
  (Secure Runtime Alpha 005) — renamed `runtimeState` to `runtimeMode`
  and explicitly left the two classifiers unmerged, the decision this
  Phase reviews.
- `docs/secure_runtime_alpha_004_state_model_review.md` (Secure
  Runtime Alpha 004) §1 — first found the two-classifier duplication
  this Phase resolves the authority question for.
- `docs/secure_runtime_alpha_001_baseline.md` (Secure Runtime Alpha
  001) — the original "no implicit environment trust for Production
  authorization" principle §3/§4 both build on.

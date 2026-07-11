# Secure Runtime Alpha 087 — Desktop Bootstrap Ownership Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO
implementation change of any kind. `src/` is untouched by this Stage
— no code, no comment, no field, no method, nothing. This document,
its own guard test, and a `README.md` entry are the entire
deliverable. This is Stage 1 of the Alpha 087–090 Desktop Integration
Review Arc.**

## 1. Why now

Alpha 086 fixed the SHAPE of the Desktop/Identity boundary: Desktop
constructs and bootstraps its own `FedosRuntimeIdentity` instance
directly, independent of `createRuntime()` (Option A). It did not fix
WHEN that construction happens, or when — if ever — that instance is
discarded. This Stage answers exactly that: Desktop Bootstrap
Ownership — the timing of creation and destruction, not the boundary
itself (already fixed) and not the instance's lifetime duration
(Alpha 088's own topic).

## 2. Review target

When does Desktop create a `FedosRuntimeIdentity` instance, and when
does it destroy one?

## 3. Grounding in the actual source

- `FedosRuntimeIdentity`'s own constructor (confirmed directly from
  `fedos_runtime_identity.ts`'s own HARD GUARDRAILS) takes no
  arguments, reads no `RuntimeEnv`, and performs no environment
  classification — construction is a pure, synchronous, side-effect-
  free assembly of the three Identity Layer objects. It never calls
  `bootstrapIdentity()` on itself.
- `bootstrapIdentity()` (Alpha 058) is idempotent after a successful
  completion (Alpha 061) — `if (this.#isBootstrapped()) { return; }`
  as its own first statement. A failed attempt leaves `#bootstrapped`
  at `false`, so the very next call retries for real; there is no
  permanent lock-out.
- Alpha 062 (review only, no code change) formally rejected an
  in-place `resetIdentityBootstrap()`/`Registry.clear()`/`shutdown()`
  of any kind, adopting instead: "treat `FedosRuntimeIdentity` as a
  short-lived object; Identity switching means constructing a new
  instance." This is the ONLY existing Decision governing when a
  SECOND `FedosRuntimeIdentity` instance would ever need to exist —
  it is not the entire Desktop lifetime question (Alpha 088), but
  specifically the Identity-switching case.
- No `destroy()`, `dispose()`, `close()`, or equivalent method exists
  on `FedosRuntimeIdentity` anywhere in the actual source — there is
  no explicit destruction API of any kind to call.

## 4. Decision

**Desktop constructs exactly ONE `FedosRuntimeIdentity` instance at
Desktop startup, calls `bootstrapIdentity()` on it exactly once as
part of that same startup sequence, and never explicitly destroys
it.**

- **Creation timing:** at Desktop process startup, before or during
  the application's own initial window/UI setup — a single
  `new FedosRuntimeIdentity()` call, followed by a single
  `bootstrapIdentity()` call.
- **Re-creation timing (Identity switching only):** per the existing
  Alpha 062 Decision, if a user-driven Identity switch ever occurs, a
  NEW `FedosRuntimeIdentity` instance is constructed and the OLD one
  is discarded — the old instance is simply dropped, never explicitly
  reset. This Stage does not alter Alpha 062's own Decision; it
  confirms Bootstrap Ownership is consistent with it.
- **Destruction timing:** never explicit. Consistent with §3's
  confirmation that no destruction API exists anywhere in the actual
  source, Desktop never calls any `destroy()`/`shutdown()`/`dispose()`
  method — the instance is simply released for garbage collection,
  either at Desktop process exit or, per Alpha 062, at the moment a
  replacement instance is constructed for Identity switching.

## 5. Comparison

Evaluated against the nine criteria this Arc applies uniformly: 責務
(responsibility), Lifetime, Bootstrap Authority, Runtime純粋性 (Runtime
purity), Workerとの差 (difference from Worker), Protocol非依存性
(Protocol independence), Public API, YAGNI, テスト容易性 (testability).

- **責務:** Ownership of construction AND the single `bootstrapIdentity()`
  call belongs entirely to Desktop's own startup sequence — no other
  file or caller is involved, consistent with Alpha 086's Option A.
- **Lifetime:** Creation happens once, at startup; this Stage does not
  itself fix how long the resulting instance is then held — that is
  Alpha 088's own separate question.
- **Bootstrap Authority:** Unchanged from Alpha 059 — Desktop alone
  calls `bootstrapIdentity()`; this Stage fixes only WHEN Desktop does
  so (once, at startup), not WHO does it.
- **Runtime純粋性:** Unaffected — `createRuntime()` is not involved in
  Bootstrap Ownership at all, per Alpha 086.
- **Workerとの差:** Total — Worker never constructs, bootstraps, or
  destroys any `FedosRuntimeIdentity` of its own; this entire Decision
  applies to Desktop only.
- **Protocol非依存性:** Unaffected — construction and Bootstrap timing
  carry no protocol assumption of their own.
- **Public API:** Zero change — `bootstrapIdentity()`,
  `isBootstrapped()`, and `currentIdentity()` already exist exactly as
  needed; no new method is proposed.
- **YAGNI:** Satisfied — no new destruction API is introduced, since
  §3 confirms none is needed: idempotency (Alpha 061) already makes a
  hypothetical extra `bootstrapIdentity()` call safe, and Alpha 062
  already covers the one case (Identity switching) where a second
  instance is ever warranted.
- **テスト容易性:** Strongest — "construct once, bootstrap once, never
  explicitly destroy" is directly testable today, via the exact same
  public API this Arc has already exercised in every prior Stage's own
  guard test since Alpha 058.

## 6. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts` or any
  other `src/` file — no code, no comment, no field, no method.
- Does **not** modify `create_runtime.ts`, `types.ts`, `worker.ts`, any
  `src/identity/*` file, Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement a Desktop Shell of any kind.
- Does **not** add a destruction/reset/shutdown API of any kind — §3
  and §4 confirm none is needed.
- Does **not** alter the Alpha 062 Identity-switching Decision — it
  confirms consistency with it.

## 7. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`

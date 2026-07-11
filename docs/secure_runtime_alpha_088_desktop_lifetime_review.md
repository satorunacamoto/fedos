# Secure Runtime Alpha 088 — Desktop Lifetime Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO
implementation change of any kind. `src/` is untouched by this Stage
— no code, no comment, no field, no method, nothing. This document,
its own guard test, and a `README.md` entry are the entire
deliverable. This is Stage 2 of the Alpha 087–090 Desktop Integration
Review Arc.**

## 1. Why now

Alpha 087 fixed WHEN Desktop creates and (never explicitly) destroys
its own `FedosRuntimeIdentity` instance. It deliberately deferred the
question of how LONG that instance is then held. This Stage answers
that: confirming the instance is held for the entire remainder of the
Desktop process's own life, and formally distinguishing that from
Worker's own, structurally different, per-request lifetime.

## 2. Review target

Is `FedosRuntimeIdentity`, once constructed and bootstrapped by
Desktop (Alpha 087), held until Desktop itself terminates?

## 3. Grounding in the actual source

- `createRuntime()`, read directly from `src/runtime/create_runtime.ts`,
  is called ONCE PER REQUEST inside Worker's own request-handling path
  — this per-request construction is the SAME concrete structural flaw
  Alpha 059 already cited when it formally rejected Worker as
  `bootstrapIdentity()`'s own Authority: tying Identity Bootstrap to a
  lifetime that resets on every single request would mean re-running
  (or re-deciding whether to re-run) Bootstrap on every request, for
  no operational benefit — the SAME identity, resolved from the SAME
  Provider, would be redundantly re-fetched, or an idempotency guard
  would silently mask a fresh instance's own `#bootstrapped: false`
  starting state every time. `createRuntime()`'s own internal
  `FedosRuntimeIdentity` construction (Alpha 050–052, confirmed still
  present and still discarded via `void runtimeIdentity;` as of Alpha
  086 §3) is a NEW instance on every call — it never survives past the
  function call that created it.
- `FedosRuntimeIdentity`'s own idempotency guarantee (Alpha 061) is
  specifically designed around a SINGLE long-lived instance being
  reused: `#bootstrapped` starts `false`, flips to `true` exactly once
  on success, and every subsequent `bootstrapIdentity()` call on that
  SAME instance becomes a synchronous no-op. This guarantee has no
  value at all if the instance is discarded and replaced before a
  second call could ever be made — which is exactly Worker's own
  per-request `createRuntime()` pattern, and exactly why Worker was
  rejected as Authority.
- Alpha 086 §7 already established that Desktop constructs its own
  SEPARATE instance, entirely independent of `createRuntime()`'s own
  internal, discarded one — Desktop's own instance's lifetime is
  therefore governed ENTIRELY by whatever Desktop itself does with it,
  not by anything inside `createRuntime()`.

## 4. Decision

**Desktop holds its own `FedosRuntimeIdentity` instance — the one
constructed and bootstrapped once at startup, per Alpha 087 — for the
ENTIRE remaining lifetime of the Desktop process, until that process
terminates. This is formally, permanently distinct from a Request
Lifetime.**

- **Desktop Lifetime:** one instance, constructed once, alive from
  startup Bootstrap until process exit — potentially hours or days,
  spanning an unbounded number of the application's own internal
  operations, all of which reuse the SAME instance and read the SAME
  cached Descriptor (`currentIdentity()`) without re-triggering
  Bootstrap, thanks to the Alpha 061 idempotency guarantee.
- **Request Lifetime (Worker):** a NEW `AppRuntime`, and therefore a
  NEW, immediately-discarded `FedosRuntimeIdentity` (per
  `createRuntime()`'s own internal construction), on every single
  request — measured in milliseconds, never reused across requests,
  and — per Alpha 059/Alpha 086 — never bootstrapped or read for
  Identity purposes at all.
- These two lifetimes are not merely different in DURATION; they
  differ in KIND — Desktop's is Application Lifetime (one instance,
  many operations), Worker's is Request Lifetime (one instance per
  operation, if it existed at all, which it structurally does not for
  Identity purposes).

## 5. Comparison

- **責務:** Lifetime OWNERSHIP belongs entirely to Desktop's own
  process — no other file or caller extends or shortens it.
- **Lifetime:** Application Lifetime (Desktop) vs. Request Lifetime
  (Worker) — formally distinguished as two different KINDS of
  lifetime, not merely different durations of the same kind.
  `FedosRuntimeIdentity` is designed for, and only makes sense under,
  the former.
- **Bootstrap Authority:** Unaffected — still Desktop alone (Alpha
  059); this Stage confirms WHY Worker's own rejection was structurally
  sound (its lifetime is fundamentally incompatible with a
  construct-once/bootstrap-once/reuse-forever design).
- **Runtime純粋性:** Unaffected — `createRuntime()`'s own per-call
  construction and immediate discard of its OWN internal instance is
  untouched; Desktop's own separate, long-lived instance never
  interacts with it.
- **Workerとの差:** This Stage's own central finding — Application
  Lifetime vs. Request Lifetime, formally fixed as the reason Worker
  can never become a second Bootstrap Authority under the current
  architecture without a structural change entirely out of this Review
  Arc's own scope.
- **Protocol非依存性:** Unaffected.
- **Public API:** Zero change — no new field or method for tracking
  lifetime is introduced; `isBootstrapped()` already answers "has this
  instance completed Bootstrap," which is all a long-lived Desktop
  caller ever needs to know.
- **YAGNI:** Satisfied — no timer, no expiry, no session-length field,
  no lifetime-tracking construct of any kind is proposed; Desktop's
  own process lifetime IS the lifetime, needing no additional
  representation in code.
- **テスト容易性:** Strong — the idempotency guarantee (Alpha 061)
  already has direct test coverage confirming repeated calls on the
  SAME instance are cheap no-ops, which is the exact behavior a
  long-lived Desktop instance depends on; this Stage's own guard test
  reconfirms that guarantee under an explicitly Desktop-lifetime-styled
  scenario (many repeated calls simulating many application operations
  over one long-lived instance).

## 6. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts` or any
  other `src/` file — no code, no comment, no field, no method.
- Does **not** modify `create_runtime.ts`, `types.ts`, `worker.ts`, any
  `src/identity/*` file, Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement a Desktop Shell of any kind.
- Does **not** add a lifetime-tracking field, timer, or expiry
  mechanism of any kind.
- Does **not** reopen Alpha 059's own Worker-rejection Decision — it
  confirms and explains it further.

## 7. See also

- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`

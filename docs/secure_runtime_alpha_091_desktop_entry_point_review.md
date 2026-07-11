# Secure Runtime Alpha 091 — Desktop Entry Point Review

**Status: this Stage is DESIGN REVIEW ONLY. Implementation is
absolutely forbidden. `src/` is untouched by this Stage — no code, no
comment, no field, no method, nothing. This document, its own guard
test, and a `README.md` entry are the entire deliverable. This is
Stage 1 of the Alpha 091–095 Desktop Shell Integration Design Arc,
which builds directly on the completed Alpha 086–090 Desktop
Integration Design.**

## 1. Why now

Alpha 086 fixed that Desktop constructs its own `FedosRuntimeIdentity`
instance, independent of `createRuntime()`. Alpha 087 fixed WHEN
(once, at startup) and WHEN NOT (never explicitly destroyed). Neither
Stage named WHERE, concretely, within a hypothetical Desktop
Application's own code that single construction call should live.
This Stage answers exactly that, assuming a Desktop Application exists
— it does not, and this Stage does not build one.

## 2. Review target

Assuming a Desktop Application exists, what is the SINGLE location
that should ever construct a `FedosRuntimeIdentity`?

## 3. Options compared

- **A. `main()`.** The OS-level process entry point — argument
  parsing, window/process bootstrap, and everything else a native
  application's own entry function typically does.
- **B. `DesktopApp` constructor.** A hypothetical top-level
  application class's own constructor.
- **C. `Application bootstrap()`.** A dedicated, explicitly-named
  startup function separate from both `main()` and any class
  constructor, whose own sole job is performing the application's own
  startup sequence.
- **D. `createRuntime()`.** Already permanently forbidden — Alpha 086
  Option A and Alpha 089 (Runtime Separation) both already ruled this
  out; included here only for completeness of comparison.
- **E. Worker startup.** Already permanently forbidden — Alpha 059
  rejected Worker as Bootstrap Authority on a concrete structural
  flaw, and Alpha 088 confirmed Worker's own Request Lifetime is
  fundamentally incompatible with a construct-once/bootstrap-once
  design.

## 4. Evaluation

- **Option D (`createRuntime()`)** is rejected on the strength of two
  ALREADY-ADOPTED Decisions, not a fresh evaluation: Alpha 086 Option A
  and Alpha 089 both permanently forbid `createRuntime()` from ever
  constructing, receiving, or exposing Desktop's own Identity instance.
  Nothing in this Stage reopens either.
- **Option E (Worker startup)** is rejected for the same reason:
  already permanently forbidden by Alpha 059/Alpha 088. Worker has no
  equivalent of a single, long-lived "startup moment" in the first
  place — it is invoked per request — so the option is not merely
  undesirable, it does not coherently exist for Worker's own execution
  model.
- **Option B (`DesktopApp` constructor)** is rejected on a concrete
  language-level concern: `bootstrapIdentity()` (Alpha 058) is `async`
  — an object constructor cannot `await` it, meaning either the
  constructor would need to fire-and-forget the call (masking any
  rejection, directly contradicting `bootstrapIdentity()`'s own
  documented Fail-Open-caller-decides contract that lets a rejection
  propagate to its own caller) or the constructor would need to
  return before Bootstrap actually completes (silently defeating
  Alpha 092's own upcoming sequencing guarantee that Desktop readiness
  follows Bootstrap completion). This mirrors the SAME discipline
  `FedosRuntimeIdentity`'s own constructor already enforces on itself
  — construction performs no asynchronous work, no I/O, and no
  Bootstrap of its own — applied one level up, to whatever object
  Desktop uses to represent itself.
- **Option A (`main()`)** is rejected not on correctness grounds — it
  COULD technically house the call — but on separation-of-concerns
  grounds: `main()` conflates OS-level process entry (argv parsing,
  window/process creation, signal handling) with a specific domain
  concern (Identity Bootstrap). A call buried inside `main()` is not
  independently testable, not independently nameable, and not
  reusable if Desktop ever gains a second entry path (e.g., a
  background/headless mode).
- **Option C (`Application bootstrap()`)** is adopted: a dedicated,
  explicitly-named `async` function whose own sole responsibility is
  performing exactly the three-step sequence Alpha 092 formally fixes
  — construct, `bootstrapIdentity()`, ready. This mirrors the SAME
  naming and scoping discipline `createRuntime()` itself already
  established elsewhere in this codebase: one clearly-named function,
  one clearly-scoped setup responsibility, independently callable and
  independently testable, with `main()` reduced to calling it and
  `DesktopApp`'s own constructor never touching it at all.

## 5. Decision

**`Application bootstrap()` (Option C) is adopted as the single
location a future Desktop Application MUST use to construct its own
`FedosRuntimeIdentity` and call `bootstrapIdentity()`. `main()` and
`DesktopApp`'s own constructor MUST NOT perform this construction
directly. `createRuntime()` and Worker startup remain permanently
forbidden, per Alpha 086/088/089.**

## 6. What this Stage does NOT do

- Does **not** implement `bootstrap()`, `main()`, `DesktopApp`, or any
  other Desktop Shell construct of any kind — none of these classes or
  functions exist anywhere in this repository, and this Stage does not
  create them.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, any `src/identity/*`
  file, Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** modify the Public Runtime API in any way.
- Does **not** implement Bootstrap or Observation of any kind.
- Does **not** reopen Alpha 086's, Alpha 088's, or Alpha 089's own
  Decisions — it confirms and extends them.

## 7. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`
- `docs/secure_runtime_alpha_088_desktop_lifetime_review.md`
- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`

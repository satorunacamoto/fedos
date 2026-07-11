# Secure Runtime Alpha 093 — Ownership Review

**Status: this Stage is DESIGN REVIEW ONLY. Implementation is
absolutely forbidden. `src/` is untouched by this Stage — no code, no
comment, no field, no method, nothing. This document, its own guard
test, and a `README.md` entry are the entire deliverable. This is
Stage 3 of the Alpha 091–095 Desktop Shell Integration Design Arc.**

## 1. Why now

Alpha 089 already fixed that `createRuntime()` never owns Desktop's
own `FedosRuntimeIdentity`. That Decision addressed exactly one
candidate owner. This Stage completes the ownership review by
examining EVERY OTHER candidate a future reader might reasonably ask
about — Runtime, Worker, Storage, Provider, Resolver, and Registry —
and fixes, explicitly, that none of them ever owns a
`FedosRuntimeIdentity` reference.

## 2. Review target

Who owns a `FedosRuntimeIdentity` instance? Confirm Desktop is the
ONLY owner, and that Runtime, Worker, Storage, Provider, Resolver, and
Registry each do not.

## 3. Grounding in the actual source

- **Runtime (`AppRuntime`):** has no `identity` field among its thirty
  fields (confirmed directly against `types.ts` across Alpha 086 and
  Alpha 089's own review). `createRuntime()`'s own internal
  `FedosRuntimeIdentity` construction is immediately discarded via
  `void runtimeIdentity;` and never reachable from the object it
  returns.
- **Worker:** never constructs, imports, or references
  `FedosRuntimeIdentity` anywhere in `src/worker.ts` — confirmed
  directly, and consistent with Alpha 059/088's own finding that
  Worker's Request Lifetime is structurally incompatible with owning
  a long-lived Identity instance at all.
- **Storage:** `FedosRuntimeIdentity`'s own class body holds no
  reference to any `StorageBackend`, and no Storage file anywhere in
  `src/runtime/fedos_runtime_storage_backend.ts` or
  `fedos_runtime_storage_resolver.ts` references
  `FedosRuntimeIdentity` — the two subsystems have never been wired
  together in either direction.
- **Provider (`FedosIdentityProvider`):** the DEPENDENCY DIRECTION runs
  the opposite way — `FedosRuntimeIdentity`'s own constructor holds
  `this.#service = new FedosIdentityService(provider, this.#registry);`,
  meaning `FedosRuntimeIdentity` depends on (owns a path to) the
  Provider, through the Service — never the reverse. A Provider has no
  way to reach, and no reason to reach, the `FedosRuntimeIdentity`
  instance that happens to hold a Service that happens to hold it.
- **Resolver (`FedosIdentityResolver`):** likewise owned BY
  `FedosRuntimeIdentity` — `this.#resolver = new
  FedosIdentityResolver(this.#registry);` — constructed inside
  `FedosRuntimeIdentity`'s own constructor and held as one of its own
  three `readonly` fields. The Resolver has no reference back to the
  `FedosRuntimeIdentity` that constructed it.
- **Registry (`FedosIdentityRegistry`):** likewise owned BY
  `FedosRuntimeIdentity` — `this.#registry = new
  FedosIdentityRegistry();` — the FIRST of the three fields
  constructed, shared by both the Service and the Resolver
  constructed immediately after it. The Registry has no reference back
  to `FedosRuntimeIdentity` either.

## 4. Decision

**`FedosRuntimeIdentity` is owned EXCLUSIVELY by Desktop. Runtime
(`AppRuntime`/`createRuntime()`), Worker, Storage, Provider, Resolver,
and Registry each own NEITHER a `FedosRuntimeIdentity` reference NOR
any path to reach one. The dependency direction runs exclusively
Desktop → `FedosRuntimeIdentity` → {Registry, Service→Provider,
Resolver} — confirmed directly against the actual constructor body —
and never in reverse, for any of the six examined candidates.**

This is not a new constraint invented by this Stage — it is the
NATURAL consequence of `FedosRuntimeIdentity`'s own constructor
(unchanged since Alpha 050) combined with Alpha 089's own
`createRuntime()`-specific prohibition, examined here exhaustively
against every remaining candidate a future reader might otherwise
wonder about.

## 5. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, any `src/identity/*`
  file, Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** modify the Public Runtime API in any way.
- Does **not** implement a Desktop Shell, Bootstrap, or Observation of
  any kind.
- Does **not** reopen Alpha 089's own Decision — it extends the same
  reasoning to five additional candidates Alpha 089 did not itself
  examine.

## 6. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`
- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`
- `docs/secure_runtime_alpha_091_desktop_entry_point_review.md`
- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`

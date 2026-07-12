# Secure Runtime Alpha 111 — Identity Authority Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO code
change of any kind — no file under `src/` is touched. This document
and its own guard test are the entire deliverable. This is Stage 1 of
the Alpha 111–115 Identity Authority Design Arc, following the
completed Desktop Shell Foundation (Alpha 096–100), Public Identity
Source Foundation (Alpha 101–105), and Nostr Public Identity
Implementation (Alpha 106–110).**

## 1. Why now

Alpha 110 confirmed, precisely and empirically, that Desktop's own
Reader path and `FedosRuntimeIdentity`'s own Provider/Bootstrap path
are TWO COMPLETELY INDEPENDENT paths — configuring one has zero effect
on the other. That finding leaves an open governance question this
whole project has never formally settled: which ONE of these
components, if any, is the actual Identity AUTHORITY — the component
whose own answer to "what identity are we using right now" is
canonical? This Stage answers that question, before any future Stage
implements more identity-related wiring.

## 2. Review target

Read directly from the actual, already-built source, five candidates
for the sole Identity Authority:

- **A. Desktop** (`DesktopApplication`, `src/desktop/desktop_application.ts`).
- **B. Runtime** — specifically `FedosRuntimeIdentity`
  (`src/runtime/fedos_runtime_identity.ts`), NOT `AppRuntime`/`createRuntime()`,
  which Alpha 089 already permanently excludes from Identity entirely.
- **C. Provider** (`FedosIdentityProvider`, e.g. `NostrIdentityProvider`,
  `src/identity/fedos_nostr_identity_provider.ts`).
- **D. Reader** (`FedosPublicIdentityReader`, e.g.
  `NostrPublicIdentityReader`, `src/desktop/nostr_public_identity_reader.ts`).
- **E. A different Authority**, not yet built.

## 3. What each candidate actually holds, confirmed against the source

- **Desktop.** `DesktopApplication` holds THREE references —
  `#identity`, `#reader`, `#publicIdentity` — but no field of its own
  computes or persists "the current identity" independently of what
  `#identity` itself already holds. It is an OWNER/ORCHESTRATOR of
  state-holding objects, not itself a state holder for identity data.
- **Runtime (`FedosRuntimeIdentity`).** Holds `#descriptor:
  FedosIdentityDescriptor | null` and `#bootstrapped: boolean` — the
  ONLY two private fields anywhere in this entire system that persist
  a resolved identity outcome across multiple calls. `#completeBootstrap()`
  (Alpha 069) remains the sole writer of both, confirmed unchanged
  through every Stage since.
- **Provider** (e.g. `NostrIdentityProvider`). Holds only an injected
  `FedosNostrPublicIdentitySource` reference. `describeIdentity()`
  performs a fresh read-through to that Source on EVERY call — no
  field caches or persists a prior result. Stateless by construction.
- **Reader** (e.g. `NostrPublicIdentityReader`). Structurally
  IDENTICAL to Provider in this respect — holds only an injected
  Source reference, performs a fresh read-through on every call,
  caches nothing. Stateless by construction.
- **"Other."** No fifth candidate has ever been built anywhere in this
  repository.

## 4. Evaluation

- **責務分離 (separation of concerns):** Runtime wins decisively —
  `FedosRuntimeIdentity`'s entire reason for existing, since Alpha 050
  and refined continuously through Alpha 058–075, IS being the
  Bootstrap/state component. Desktop's own responsibility (Alpha 096)
  is deliberately kept thin — construction and lifecycle, not identity
  computation. Provider and Reader are both deliberately swappable
  read sources (Alpha 029/101), never intended to hold canonical
  state.
- **Runtime Separation (Alpha 089):** Does NOT conflict with choosing
  Runtime as Authority — Alpha 089 forbids `createRuntime()`/`AppRuntime`
  (the OUTER Runtime) from ever touching Identity; it says nothing
  about `FedosRuntimeIdentity` (the Identity Runtime) itself, which
  remains, as it always has been, entirely Desktop-constructed and
  Desktop-held (Alpha 086/096), never reachable through `AppRuntime`.
  Choosing Option B reinforces Alpha 089, rather than reopening it.
- **Desktop Ownership (Alpha 093):** Also compatible, not
  contradictory — Alpha 093 fixed WHO CONSTRUCTS `FedosRuntimeIdentity`
  (Desktop, exclusively). This Stage answers a DIFFERENT question: WHO
  HOLDS THE DATA once constructed. Desktop owning the OBJECT and
  Runtime being the DATA Authority are two independent facts that
  coexist without tension — Desktop still exclusively constructs and
  holds the ONE object that carries authority.
- **Protocol Independence:** `FedosRuntimeIdentity` itself contains
  zero protocol-specific code — it delegates entirely to whatever
  Provider is injected via `resolveFedosIdentityProvider()`. Provider
  and Reader, by contrast, are inherently protocol-specific in their
  concrete implementations (`Nostr...`) — exactly the layer that
  SHOULD change without the Authority itself changing.
- **将来の複数Provider対応 (future multi-Provider support):** Runtime's
  own Service/Registry/Resolver design (Alpha 031/041/043) already
  provides an aggregation point — `FedosIdentityRegistry` can hold
  multiple `FedosIdentityRecord`s, keyed by `id`. A future
  multi-Provider world naturally extends UNDER Runtime's own existing
  design, without requiring Authority to move.

## 5. Decision

**Option B — Runtime, specifically `FedosRuntimeIdentity` — is the
SOLE Identity Authority. `AppRuntime`/`createRuntime()` remain
permanently excluded per Alpha 089; Desktop, Provider, and Reader are
NOT Authorities, though Desktop remains the exclusive constructor and
holder of the `FedosRuntimeIdentity` instance that IS the Authority.**

- **A (Desktop) rejected:** an owner/orchestrator, not a state holder;
  elevating Desktop to Authority would blur Alpha 093's own
  object-ownership Decision with a distinct data-authority concept,
  and contradicts Desktop's own deliberately-thin design (Alpha 096).
- **C (Provider) rejected:** stateless and explicitly designed to be
  swappable (Alpha 029) — cannot be Authority without becoming
  something it was never designed to be.
- **D (Reader) rejected:** stateless, structurally identical to
  Provider, and per Alpha 102 permanently excluded from
  `FedosRuntimeIdentity` itself — making Reader Authority would create
  a SECOND, competing Authority, precisely the ambiguity this Stage
  exists to resolve.
- **E (other) rejected:** YAGNI — no concrete gap exists that
  `FedosRuntimeIdentity` does not already fill; every evaluation
  criterion in §4 is already satisfied by the existing component.

## 6. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `src/desktop/*`, or any `src/identity/*` file.
- Does **not** implement any new Authority component.
- Does **not** modify `create_runtime.ts`, `types.ts`, `src/worker.ts`,
  Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, GUI, or Observation of any kind.

## 7. See also

- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`
- `docs/secure_runtime_alpha_093_ownership_review.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_102_desktop_identity_reader.md`
- `docs/secure_runtime_alpha_105_integration_verification.md`
- `docs/secure_runtime_alpha_110_integration_verification.md`

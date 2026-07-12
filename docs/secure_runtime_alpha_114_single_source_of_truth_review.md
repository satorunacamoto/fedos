# Secure Runtime Alpha 114 — Single Source of Truth Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO code
change of any kind — no file under `src/` is touched. This document
and its own guard test are the entire deliverable. This is Stage 4 of
the Alpha 111–115 Identity Authority Design Arc.**

## 1. Why now

Alpha 111 named `FedosRuntimeIdentity` the Authority. Alpha 113 showed
that state is written in more than one place along the Authority path
— `FedosRuntimeIdentity`'s own `#descriptor` AND `FedosIdentityRegistry`.
This Stage examines every component the Identity Flow touches and
fixes, precisely, which ONE holds "current identity" as its own Single
Source of Truth, and which are Read Models or plain data shapes.

## 2. Every component examined

- **Desktop** (`DesktopApplication`).
- **Runtime** (`FedosRuntimeIdentity`).
- **Provider** (`FedosIdentityProvider`, e.g. `NostrIdentityProvider`).
- **Reader** (`FedosPublicIdentityReader`, e.g. `NostrPublicIdentityReader`).
- **Registry** (`FedosIdentityRegistry`).
- **Record** (`FedosIdentityRecord`).
- **Descriptor** (`FedosIdentityDescriptor`).
- **Snapshot** (`FedosNostrPublicIdentitySnapshot`).

## 3. Classification, grounded against the actual source

- **`FedosRuntimeIdentity` — STATE HOLDER, the Single Source of Truth
  for CURRENT identity.** Holds `#descriptor: FedosIdentityDescriptor
  | null` and `#bootstrapped: boolean`. `#completeBootstrap()` (Alpha
  069) is the ONLY place anywhere in this repository that ever writes
  either field. `currentIdentity()`/`isBootstrapped()` are the ONLY
  reads of them. This is THE answer to "what identity are we currently
  using."
- **`FedosIdentityRegistry` — STATE HOLDER, but a DIFFERENT, wider
  catalog, not a competing Source of Truth.** Holds its own internal
  collection of `FedosIdentityRecord`s via `register()`/`remove()`,
  read via `find()`/`list()`. Populated by the SAME Bootstrap flow
  that sets `#descriptor` (`FedosIdentityService.describeIdentity()`
  registers a Record into it, Alpha 042) — never independently, never
  out of step with it. Registry answers a BROADER question ("what
  identities have ever been registered") than `#descriptor`'s own
  narrower one ("what is the CURRENT identity right now") — the two
  never conflict because Registry is populated exclusively as a
  byproduct of the same flow that sets `#descriptor`.
- **Desktop (`DesktopApplication`) — NOT a state holder for identity
  data.** Holds `#identity`/`#reader`/`#publicIdentity` as
  REFERENCES/configuration, not as computed or persisted identity
  state of its own. `#publicIdentity` is configuration INPUT (what to
  statically configure the Reader with), never a resolved identity
  OUTPUT.
- **Provider (e.g. `NostrIdentityProvider`) — Read Model, stateless.**
  No field caches or persists a prior `describeIdentity()` result;
  every call re-reads its own injected Source fresh (confirmed Alpha
  111 §3).
- **Reader (e.g. `NostrPublicIdentityReader`) — Read Model, stateless.**
  Structurally identical to Provider in this respect (confirmed Alpha
  111 §3, Alpha 112).
- **`FedosIdentityService` — Read Model / orchestrator, stateless of
  its own.** Holds only injected `provider`/`registry` references;
  computes nothing persistent of its own — it delegates the read to
  Provider and the write to Registry, holding no field beyond those
  two references.
- **`FedosIdentityResolver` — pure Read Model.** Wraps Registry only;
  `findIdentity()`/`listIdentities()` are read-only projections of
  Registry's own state, holding no state of their own beyond the
  Registry reference itself.
- **`FedosIdentityRecord`/`FedosIdentityDescriptor`/`FedosNostrPublicIdentitySnapshot`
  — plain data shapes, not components at all.** None of the three is a
  class with behavior or identity of its own — each is a value,
  produced fresh by whatever component returns it, never itself
  "holding" anything across time. `Record` is what Registry stores;
  `Descriptor` is what Runtime/Provider/Service exchange;
  `Snapshot` is what Source/Reader exchange.

## 4. Decision

**`FedosRuntimeIdentity`'s own `#descriptor` field is the Single
Source of Truth for "current identity." `FedosIdentityRegistry` is a
separate, complementary, wider-scoped catalog, populated exclusively
as a byproduct of the same Bootstrap flow that sets `#descriptor` —
never a competing or independently-writable Source of Truth.
Everything else examined in §3 is either a Read Model (Service,
Resolver, Provider, Reader) or a plain data shape (Record, Descriptor,
Snapshot) with no state-holding role of its own. Desktop holds
references and configuration, never identity state itself.**

## 5. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `src/desktop/*`, or any `src/identity/*` file.
- Does **not** consolidate, merge, or otherwise change Registry's own
  relationship to `#descriptor` — both remain exactly as Alpha 042/069
  already left them.
- Does **not** modify `create_runtime.ts`, `types.ts`, `src/worker.ts`,
  Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, GUI, or Observation of any kind.

## 6. See also

- `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_111_identity_authority_review.md`
- `docs/secure_runtime_alpha_112_reader_provider_relationship_review.md`
- `docs/secure_runtime_alpha_113_identity_flow_review.md`

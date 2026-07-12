# Secure Runtime Alpha 142 — Root Hierarchy Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 2 of the Alpha 141–145 Deterministic Identity Root
Derivation Design Arc, following Alpha 141's own source-grounded
inventory.**

## 1. Why now

Alpha 141 confirmed the underlying primitive
(`derive_secret_handle_internal`, HKDF-SHA256 domain-separated) is
domain-agnostic and chain-composable — it can implement any hierarchy
shape with zero change to the primitive itself. What remains is
choosing the SHAPE: how many derivation levels, and what each level
means. This Stage compares five candidate shapes and adopts one.

## 2. The five options

- **Option A — Flat:** `Master Seed → Protocol Secret Key` directly.
  One derivation call per protocol key, keyed only by a protocol
  label.
- **Option B — Single Root layer:** `Master Seed → Protocol Root →
  Protocol Secret Key`. One intermediate root per protocol, derived
  once from the Master Seed, then further derived per key.
- **Option C — Application Root layer:** `Master Seed → Application
  Root → Protocol Root → Account/Device Key`. An extra intermediate
  node groups all protocol roots under one Application Root, itself a
  sibling of Identity Root / Storage Root / Wallet Root.
- **Option D — Identity-Root-only:** a single `Identity Root` node,
  with ALL protocols (Nostr, Session, ATProto, Storage, Wallet)
  derived as its children.
- **Option E — Independent seeds:** each protocol gets its OWN,
  separate Master Seed, with no shared root at all.

## 3. Comparison — 20 criteria

| # | Criterion | A (Flat) | B (Single Root) | C (App Root) | D (Identity-only) | E (Independent) |
|---|---|---|---|---|---|---|
| 1 | Domain Separation | Weak — one label per key, no intermediate boundary | Good — root boundary + key boundary | Best — root + application + protocol + account boundaries | Weak — one shared Identity boundary for unrelated concerns | Best (trivially — no shared material at all) |
| 2 | Protocol Independence | Weak — protocols share only Master Seed distance | Good — each Protocol Root is independent | Best — Protocol Roots independent AND grouped separately from Identity/Storage/Wallet | Poor — protocols conflated under "Identity" | Best (by construction, no sharing) |
| 3 | Multiple Accounts | Awkward — must fold index into a flat label | Workable — index at the key-derivation step | Best — Account index has its own fixed level | Workable, same as B | Workable per-protocol, but no cross-protocol account linkage |
| 4 | Device Keys | Awkward, same issue as #3 | Workable | Best — Device index has its own fixed level | Workable | Workable per-protocol only |
| 5 | Rotation | Poor — rotating one key needs a whole-seed-relative re-derivation path | Good — rotate at Protocol Root without touching Master Seed | Best — rotate at Account/Device level without touching Protocol Root | Good, same as B | Good per-protocol, but N independent rotation procedures |
| 6 | Versioning | Poor — no natural place to embed a schema version per level | Fair — one version context at Protocol Root | Best — version can be embedded at each level independently | Fair, same as B | Fair — each independent seed needs its own versioning |
| 7 | Recovery | Simple in theory, but fragile (see #9) | Good — recover via Master Seed + fixed labels | Best — same, with more parameterization for edge cases (rotated device, added account) | Good, same as B | Poor — user must back up N seeds, not one |
| 8 | Migration | Poor — flat labels are hard to extend without breaking old outputs | Fair | Best — a level can be added/versioned without disturbing sibling levels | Fair | Poor — migrating one protocol never helps another |
| 9 | Compromise Containment | Weak — HKDF gives forward security, but with only one label boundary, mistakes are cheaper to make | Good — Protocol Root breach isolated from Master Seed and sibling Protocol Roots | Best — Account Key breach isolated from Protocol Root; Protocol Root breach isolated from Master Seed and sibling roots | Fair — Identity Root breach affects all protocols under it at once | Best cryptographically, worst operationally (see #7) |
| 10 | Auditability | Poor — a single opaque label per key is hard to reason about in review | Fair | Best — each level is independently nameable, reviewable, and testable | Fair | Fair — N separate, smaller audits |
| 11 | Determinism | Same for all — HKDF-SHA256 is deterministic in every option, given identical inputs | identical | identical | identical | identical |
| 12 | Interoperability | Fair — flat labels can still target BIP32/NIP-06-style outputs | Good | Best — an Application Root cleanly separates "FedOS-specific" derivation from "protocol-standard" derivation beneath each Protocol Root | Fair — Identity conflation complicates protocol-standard interop | Good, but zero code reuse across protocols |
| 13 | Implementation Complexity | Lowest | Low | Highest (one more level, one more fixed domain layer) | Low | Medium (N independent implementations, but each simple) |
| 14 | Rust Boundary | Fits existing `derive_secret_handle_internal` with one call | Fits with two chained calls | Fits with three-to-four chained calls — no NEW primitive needed (Alpha 141 §3) | Fits with two chained calls | Fits, but needs N independent Master Seed Handles instead of one |
| 15 | Secret Exposure | Same for all — opaque-handle pattern (Alpha 141 §2.4/2.7) applies identically regardless of depth | identical | identical | identical | identical |
| 16 | Desktop Boundary | Same for all — Desktop only ever holds opaque Handles/indices (Alpha 141 §2.5) | identical | identical | identical | identical |
| 17 | Storage Boundary | Same for all — this Arc does not decide Storage's own persistence method (Alpha 144 §4) | identical | identical | identical | identical |
| 18 | Wallet Separation | Poor — Wallet has no dedicated node, folded into the flat label space | Fair — Wallet Root is a sibling Protocol Root | Best — Wallet Root is an explicit sibling of Application Root, never nested under Protocol Roots | Poor — Wallet Root, if added, sits oddly under "Identity" | Good (Wallet has its own seed), at the cost of #7 |
| 19 | Future Protocol Addition | Poor — every new protocol needs a brand-new flat label convention decided ad hoc | Fair — new Protocol Root added as a sibling | Best — new Protocol Root added under the SAME Application Root convention, no new top-level decision needed | Fair — new protocol added under Identity, same conflation as #2 | Poor — every new protocol needs an entirely new seed-management story |
| 20 | Backward Compatibility | Poor — flat labels are brittle to extend without breaking existing derivations | Fair | Best — an unused level can default to a fixed identity label, preserving old outputs when a level is later added | Fair | N/A — no shared hierarchy to break |

## 4. Decision

**Option C is ADOPTED.** It wins or ties on 15 of the 20 criteria
above, is the ONLY option that cleanly matches the Objective's own
diagram (`Identity Root` / `Storage Root` / `Wallet Root` as siblings
of an `Application Root` housing all present and future Protocol
Roots), and — per Alpha 141 §3 answer 1 — requires no new Rust
derivation primitive, only new `HkdfDomain`-style labels at each
level. Its only real cost, Implementation Complexity (#13), is a
one-time design cost, not a recurring one: each new protocol reuses
the SAME Application Root convention (#19) rather than inventing its
own.

## 5. Adopted hierarchy

```
Master Seed
    │
    ├── Identity Root
    ├── Storage Root
    ├── Wallet Root
    └── Application Root
           ├── Nostr Root
           ├── Session Root
           ├── ATProto Root
           └── (future) Protocol Root
```

`Identity Root`, `Storage Root`, `Wallet Root`, and `Application Root`
are FOUR SIBLING children of the Master Seed — none nested under
another. `Application Root` is the SOLE parent of every Protocol Root
(Nostr/Session/ATProto/future) — Protocol Roots are never derived
directly from the Master Seed. Account/Device-level keys (e.g. an
Account Key or Device Key under the Nostr Root) are a FIFTH level,
derived from their own Protocol Root — this level's own exact
parameterization is Alpha 143's own deliverable.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** fix the exact Domain Separation strings/context format
  — that is Alpha 143's own deliverable.
- Does **not** implement Master Seed generation, Root derivation, or
  any cryptography.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/vault_crypto_identity.md`
- `docs/secret_handle_api_shape.md`

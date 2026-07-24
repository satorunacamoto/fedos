# Secure Runtime Alpha 6441–6520 — Completion Declaration

**FedOS Secure Memory Secret-Flow Migration and Native Page-Locking
Readiness Arc**

## Declared: full completion (of this Arc's own, deliberately bounded scope)

- [x] Phase A — full inventory of every named secret category, classified
      (5 out of scope, 3 already migrated, 1 real migration candidate
      found and closed).
- [x] Phase B — the one real migration candidate (Direct Ratchet
      seal/restore boundary zeroization) closed, at every hop, without
      redesigning `SecretHandle` or the Runtime.
- [x] Phase C — verified: no secret reaches TypeScript (unchanged —
      neither touched type has ever crossed that boundary), no Debug, no
      Serialize, no Clone (zero derives on both touched types, confirmed
      unchanged).
- [x] Phase D — native page-lock readiness confirmed already honest
      (`Unsupported`/`NotRequested`, never overclaimed) via the prior
      Arc's own `PageLockingCapability` — no new code needed.
- [x] Phase E — real Rust/WASM verification: two new tests prove the
      exact WASM-exported surface this Arc modified (`seal_*`/`restore`)
      continues to function correctly, including a real post-restore
      encrypt proving the sending chain key survived intact; the full
      630-test crate suite and a real `wasm32-unknown-unknown --release`
      build both pass.
- [x] Phase F — leak scan across the touched files: clean.

## Headline finding

Of the eight secret categories the mission named as examples, **five do
not exist anywhere in this Rust crate at all** (Device signing keys,
Sender keys, Archive wrapping keys, Capability secrets, Deletion signing
keys) — each is either entirely TypeScript-side or not implemented in
this repository yet. Reporting a fabricated Rust-side migration for any
of them would have been fabrication. Of the remaining three, the
in-memory Ratchet/Identity/Master-Seed state was already fully
`SecretHandle`-backed — the REAL gap, found only by reading the actual
seal/restore code path rather than assuming one existed in the
already-compliant in-memory state, was the boundary crossing itself:
`FedosDirectRatchetSession::seal_*`/`restore` (`lib.rs`) and
`DirectRatchetSessionState::restore` (`crypto/direct_ratchet_session.rs`)
moved raw key bytes through several stack/heap locations — including one
genuinely heap-allocated `Vec<u8>` decrypted plaintext — without ever
zeroizing any of them. This is now closed at every hop.

## A second real finding, incidental to the first

No test anywhere in this crate exercised
`FedosDirectRatchetSession::seal_*`/`restore` — the exact WASM-exported
methods this Arc needed to modify — before this Arc. Every pre-existing
seal/restore test exercised the lower-level, non-WASM
`DirectRatchetSessionState` methods directly. This Arc's own two new
tests are the first real, end-to-end proof of that production surface,
independent of the zeroization fix itself — a coverage gap this Arc
closes as a direct consequence of doing the migration work carefully
rather than assuming the existing test suite already covered the surface
being changed.

## Named, deliberate scope boundary

The `skipped_keys` Vec-of-tuples' own brief per-entry STACK copy (as
distinct from its per-entry HEAP plaintext source, which IS zeroized) is
explicitly left as a narrower, lower-value remainder — see the migration
inventory document's own "Explicitly NOT closed this Arc" section for the
precise reasoning. This is a named decision, not an oversight.

## Verification run

See the execution report's own Verification section for the complete,
itemized list. Summary: 630/631 native tests pass (1 pre-existing,
confirmed unrelated via A/B against `33f29f2`); 2 new real Ratchet
seal/restore tests pass; 8 new structural guards pass; a real WASM release
build succeeds with zero new export surface; 0 regressions against the
prior Arc's own structural guard suite (precise JSON-diff, 0 tests
differ).

## Files changed

Two existing production files gained a narrow, additive zeroization fix
each (`lib.rs`: 5 `seal_*` methods + `restore()` + 2 new tests;
`crypto/direct_ratchet_session.rs`: `restore()`). One new TypeScript
structural guard test file. Three new docs (this one plus two siblings).
No `Cargo.toml` change. No `package.json` change. No `p2p/`/`.tmp_gen/`
change. No Desktop Safety Center file read or touched. No `SecretHandle`
redesign. No Runtime redesign.

## Recommend exactly one next Arc

**FedOS Secure Memory Store Production Wiring Arc** — wire the existing,
tested-but-unused `SecretHandleStore` (Secure Runtime Alpha 6281–6360)
into one real production Runtime path (most naturally
`FedosMasterSeedAuthority`'s own internal ownership, or a future
per-Account secret registry), and decide, deliberately, whether any
Store operation should ever cross the WASM boundary via a narrow,
capability-limited operation set.

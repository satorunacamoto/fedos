# 20 — Normative Next Arc

This document is the single normative reference for this review's own
recommendation. Where it repeats a conclusion from `01`–`19`, this
document governs; the numbered documents are its supporting derivation.

## Base and Prerequisite Note, restated for this document specifically

Per `index.md`'s own note: the original task text anchored sequencing to
"after Alpha 821–850," a range this review confirmed does not exist
anywhere in this repository (highest existing range: 791–820, unmerged;
`master`'s own merged history reaches 621–640). The user explicitly
approved branching from current `master` HEAD (`9c1f52c`) instead. This
document's own recommendation does **not** depend on Alpha 821–850
existing, resolving, or ever being filled by any specific future Arc —
it is phrased entirely in terms of the real, named prerequisites
`01`–`19` establish.

## Conditional framing, mirroring CFv1 §15's own precedent

CFv1 §15 gave two conditional recommendations depending on whether the
in-progress Nostr Identity Binding Arc succeeded, because CFv1's own
Package A recommendation did not depend on that outcome, but the Arc
*after* Package A did. This review adopts the same conditional
discipline, one level further down its own dependency chain:

**If CFv1's own Package A (Conversation Identity & Record Foundation) has
landed:** this review's own Package C1 (Envelope Types + Validator +
Persistence Metadata, `19_arc_packaging.md`) becomes buildable, and a
future Arc should choose between **Envelope Foundation (C1)** and
**Encryption Authority Boundary (C2)** based on which unlocks more of
`13_runtime_activation_gate.md`'s own checklist soonest — both are real
options at that point, and this review does not rank them against each
other, since neither blocks the other (`19_arc_packaging.md`'s own
dependency graph: C1 needs A, C2 needs nothing from the Conversation
model at all).

**If CFv1's own Package A remains unbuilt** (the actual state of this
worktree's own checked-out `src/` at this commit, confirmed by this
review's own source reading — no `FedosConversationId`/`FedosConversationRecordV1`
exists anywhere): this review recommends the Arc that proceeds
**regardless** of Package A's status.

## Recommendation — exactly one, unconditional

**Package C2 — Encryption Authority Rust/WASM Boundary
(`19_arc_packaging.md`).**

Concretely: (1) add a `#[wasm_bindgen]`-exported wrapper around
`derive_conversation_key_via_ecdh_internal`
(`packages/fedos-core-rust/src/crypto/conversation_key.rs:235`),
following the exact opaque-handle-in/opaque-handle-out pattern
`generate_aead_key_handle`/`encrypt_aead` already establish (no raw key
byte crosses the boundary, per this codebase's own Permanent Security
Invariants); (2) produce a compiled `packages/fedos-core-rust/pkg/`
artifact via the already-existing `npm run build:wasm` script; (3)
resolve the production-runtime gating question (SEC BLOCK-3) — whether
and how Seam 2's Development-Runtime-only gate should behave differently
outside Development Runtime.

## Why this is the correct single recommendation

1. **It is the only package in this review's own dependency graph
   (`19_arc_packaging.md`) with zero dependency on the Conversation
   model** — reconfirmed directly from CFv1 §14's own finding, unchanged:
   "this track has no dependency on Packages A/B and could start in
   parallel with either." Every other package this review names (C1,
   C3, C4) needs either CFv1's own Package A or a real membership/storage
   foundation neither this review nor CFv1 has built.
2. **It closes SEC §01/§20's own BLOCK-1 and BLOCK-2 in one Arc** — the
   two blockers SEC's own final synthesis (§20) ranked among the highest-
   leverage in absolute terms, restated there as *"the highest-leverage
   unlock in absolute terms (BLOCK-1/2 combined)"* even though SEC itself
   sequenced it after a Private Message Envelope existed as a target.
   This review's own finding (`19_arc_packaging.md`) is that C2 does not
   actually need C1 to exist first as a *target* — the export and build
   work are self-contained Rust/tooling changes, verifiable by their own
   unit/vector tests (SEC §01's own finding: the AEAD/NIP-44 pipeline is
   already vector-tested) without needing a TypeScript-side Envelope type
   to call them from at all.
3. **It is genuinely small and independently reviewable** — a Rust
   `#[wasm_bindgen]` export addition plus a build-tooling run, not a
   redesign of any existing type, matching this review's own instruction
   to prefer additive framing and minimize ripple. It touches
   `packages/fedos-core-rust/` only, never `src/board/`, `src/chat/`, or
   any of the four crypto seams `01_crypto_inventory.md` catalogs.
4. **It de-risks every downstream package simultaneously.** Once C2
   ships, `13_runtime_activation_gate.md`'s items 1–3 (of 11) close in
   one Arc, C3's own encryption-authority work becomes a pure
   TypeScript-side wiring task against a now-real primitive, and C4's
   eventual standards-track group scheme has a proven, working pairwise
   primitive to build alongside rather than around.

## What this recommendation explicitly does not authorize

Building `derive_conversation_key_via_ecdh_internal`'s export does not,
by itself, authorize activating encryption anywhere in `src/` — Seam 2's
own Development-Runtime gate (item 3 above) remains a real, separate
decision even after export and build succeed, and
`13_runtime_activation_gate.md`'s remaining eight items (Envelope type,
membership, storage, AAD binding, epoch semantics, failure vocabulary,
eligibility gate extension) are **not** satisfied by this Arc and must
not be claimed as satisfied by anyone reporting on it. `noop_crypto.ts`/
`noop_storage.ts`/`noop_vault.ts` remain exactly as inert as
`01_crypto_inventory.md` found them, unchanged by this recommendation.

## See also

- `docs/reviews/conversation_foundation_v1/15_normative_v1_specification.md`
- `docs/reviews/private_conversation_security/20_blockers_recommendation.md`
- `12_wasm_export_gap.md`, `13_runtime_activation_gate.md`, `19_arc_packaging.md`

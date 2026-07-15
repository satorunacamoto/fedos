# Secure Runtime Alpha 420 — Outbox Foundation Completion Gate / Declaration

Stage 10 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc.

## 1. Completion declaration — Alpha 411–420

Declared complete:

- **Protocol-independent Outbox intent** — `FedosBoardOutboxIntent`
  (`src/board/outbox/fedos_board_outbox_types.ts`), immutable, carrying
  no protocol-native payload.
- **Explicit target model** — `FedosBoardOutboxTarget`, four supported
  outbound protocol labels, no active network destination invented.
- **No automatic provenance-based republishing** — `createFedosBoardOutboxIntent`
  takes `target` as a required explicit parameter; nothing in this Arc
  reads `FedosBoardPost.source` to compute one.
- **Intent/observation separation** — decided (Alpha 415); NO
  observation type or persistence method shipped this Arc, deliberately
  (no real consumer exists — see Alpha 421's own blocker finding).
- **Persisted Outbox record V1** — `FedosPersistedBoardOutboxRecordV1`,
  `schemaVersion: 1`.
- **Fail-closed Outbox codec** — `serializeFedosBoardOutboxIntent`/
  `deserializeFedosBoardOutboxIntent`, never throws, unknown
  fields/schema/protocol/timestamp all rejected.
- **Dedicated Outbox persistence port** — `FedosBoardOutboxPersistence`,
  sibling to (not folded into) `FedosBoardPersistence`.
- **In-memory Outbox backend** — `InMemoryFedosBoardOutboxPersistence`.
- **Append-only durable Outbox backend** — `AppendOnlyFedosBoardOutboxPersistence`,
  independent file from the Board-post log, same fail-closed crash
  discipline as `AppendOnlyFedosBoardPersistence`.
- **Host coordination** — `FedosDesktopHost.submitPostWithOutbox()`,
  additive, delegates the entire canonical write to the unmodified
  `submitPost()`.
- **Honest partial-failure semantics** — four distinguishable result
  shapes (§ Alpha 419 doc), two-file atomicity explicitly NOT claimed.
- **No network delivery of any kind** — confirmed by direct inspection:
  no file under `src/board/outbox/` imports a Relay, `fetch`, `WebSocket`,
  or any network-capable type.

## 2. Gate verification before Phase B (per this Arc's own required
   checklist)

- **Local-only `submitPost` unchanged**: confirmed — `submitPost()`'s
  own body is byte-for-byte unmodified; `submitPostWithOutbox()` is a
  new, separate method that calls it, never the reverse.
- **Explicit targets only**: confirmed — Alpha 414 §2.
- **All Outbox records survive restart**: confirmed —
  `AppendOnlyFedosBoardOutboxPersistence.listIntents()` replays the log
  file fully on every call, independent of process lifetime; verified
  by test (a fresh instance over the same file path recovers every
  previously-written intent).
- **Duplicate intents idempotent**: confirmed — deterministic
  `FedosBoardOutboxId` (Alpha 413) plus `"already-present"` write
  semantics (Alpha 417); verified by test.
- **Conflicting IDs fail closed**: confirmed — `"conflict"`, original
  preserved; verified by test.
- **Corrupt log fails closed**: confirmed — a malformed trailing line
  throws on replay, matching `AppendOnlyFedosBoardPersistence`'s own
  Alpha 357 discipline; verified by test.
- **Board post remains authoritative on Outbox failure**: confirmed —
  `submitPostWithOutbox()`'s own ordering (Alpha 419 §2) never
  conditions the canonical write on any Outbox outcome.
- **No network call, no protocol-native payload in the Outbox, no
  automatic Session publication, no `p2p` usage**: confirmed by direct
  inspection of every file under `src/board/outbox/` and the
  `submitPostWithOutbox()` diff.

**Gate: PASSED.** Phase A (Alpha 411–420) is complete and durable.

## 3. Phase B result

Phase B (Alpha 421–430, Nostr Outbound Board Publisher Foundation) was
attempted starting at its own required first Stage, Alpha 421
(inventory). That inventory found the real Nostr signing/event-building
path confined to `pub(crate)` Rust with no `#[wasm_bindgen]` export, and
this repository's own TypeScript-side Nostr cryptography module
explicitly documented as verify-only ("it never signs. No private keys
are involved."). Per this Arc's own binding instruction ("STOP AND
REPORT before implementing a second signing stack" / "declare only
Alpha 411–420 complete and report the exact blocker without fabricating
Alpha 421–430 completion"), **Phase B is NOT implemented.** No file
under a would-be `src/board/publish/nostr/` exists; no Alpha
422–430 doc claims a decision or implementation it did not make.

See `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`
for the full finding.

## 4. Next Arc recommendation

Not "Secure Runtime Alpha 431–440: ActivityPub Outbound Publisher
Boundary Arc" (that recommendation is conditioned on Alpha 421–430
completing, which it did not) and not a blind retry of Alpha 421–430
(the blocker is architectural, not a scoping mistake this Arc could
have avoided).

**Recommended: Secure Runtime Alpha 422–430 (renumbered): Nostr
Outbound Signing Boundary Decision Arc.** A review/decision-only Arc
(explicitly authorized to touch Rust/WASM, unlike this one) that
decides HOW a future outbound publisher may obtain a real BIP-340
signature without exporting raw secret bytes to TypeScript — comparing,
at minimum: (a) a new, narrowly-scoped `#[wasm_bindgen]` "sign this
exact pre-built event" export that never returns key material, only a
signature; (b) wiring the existing NIP-07 external-signer pattern
(`src/sign/nip07.ts`) into `FedosDesktopHost` as a Desktop-native
signing delegate; (c) a new Desktop-only native signing bridge outside
WASM entirely. Only once that boundary is DECIDED does a Nostr Outbound
Publisher Arc have a real signing authority to build against, rather
than repeating this Stage's own blocker.

## 5. See also

- `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`
- `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
- `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`

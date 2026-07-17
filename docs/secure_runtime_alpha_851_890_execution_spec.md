# Secure Runtime Alpha 851-890 Execution Spec

## Private Message Envelope and Encryption Authority Activation Arc

This Arc turns `docs/reviews/private_message_envelope_v1/` (20 numbered
documents, `f86deea`, already reviewed and merged) into implementation —
specifically Package C1 (Envelope Types + Validator + Persistence
Metadata), the remainder of Package C2 (Rust/WASM Encryption Authority
export), and the buildable slice of Package C3 (Direct Conversation
Encryption Activation), per `19_arc_packaging.md`'s own dependency graph.
It stops precisely at the one named blocker Package C3 could not clear
without inventing new architecture — see "Named remaining blocker"
below.

This file documents each stage actually built, per this repository's own
established per-stage execution-spec convention
(`docs/secure_runtime_alpha_821_850_execution_spec.md`). Unlike that
prior Arc, this task was not handed to its executing session as a single
literal numbered-stage prompt to copy verbatim — this document is
therefore a genuine stage-by-stage record of what was built, not a
verbatim prompt transcript.

## Session continuity note

This Arc's own execution spans two sessions. Session 1 wrote Phase A
(Alpha 853–860, the Envelope model + persistence), the Rust/WASM
`resolve_conversation_key` export and its six Rust-side tests (Alpha 869,
`packages/fedos-core-rust/src/lib.rs`), the TypeScript wiring
(`FedosWasmLoaderSkeleton.attemptDevOnlyMasterSeedResolveConversationKeyCall()`,
`FedosWasmMasterSeedAuthority.resolveConversationKey()`), the `test/secure_runtime_alpha_869_resolve_conversation_key_wiring.test.ts`
wiring test (5 cases), and the Encryption Authority / Membership
Readiness interface files (Alpha 861/863/866) — then was interrupted
before any test for Phase A/B existed and before a concrete Authority
implementation existed. Session 2 (this one) verified every one of
Session 1's claims against the actual source (rather than trusting its
own header comments), found one real inconsistency (see Alpha 870's own
"CORRECTION" note below), and completed the buildable remainder: the
Decryption Authority (Alpha 862/865), both concrete Authority
implementations (Alpha 870/871), and every test file this Arc's own
"genuinely completable now" scope requires (Alpha 872/873, plus new
tests for 853–860/866, which had none before this session).

## Phase A — Envelope Types, Validator, Persistence (Package C1)

- **Alpha 853 — Envelope Identity.**
  `src/conversation/envelope/fedos_conversation_envelope_id.ts`. A
  branded, opaque `FedosConversationEnvelopeId`, mirroring
  `FedosConversationPayloadId`'s own discipline (Alpha 802) exactly —
  generator-minted, no path characters, no protocol meaning.
- **Alpha 854 — Private Message Envelope V1.**
  `src/conversation/envelope/fedos_conversation_message_envelope.ts`.
  `FedosConversationMessageEnvelope`: `id`, `conversationId`,
  `senderMembershipId`, `payloadId` (references the EXISTING, real
  `FedosConversationPayloadStorage`, Alpha 804 — never an inline
  ciphertext field), `encryptionSuite` (closed to the two real,
  Rust-backed AEAD suites — `"ChaCha20Poly1305" | "Aes256Gcm"`, never
  Seam 1's wider aspirational union), `keyEpoch` (unbranded `number`,
  `0` always valid), `createdAt`, `replyToEnvelopeId`. No plaintext, no
  ciphertext byte, no raw key, no participant list, no delivery state —
  every one of `04_envelope_v1.md`'s own exclusions preserved.
- **Alpha 855 — Envelope Validation.**
  `src/conversation/envelope/fedos_conversation_message_envelope_validator.ts`.
  `validateFedosConversationMessageEnvelope()` — the sole constructor;
  exact field set, closed suite vocabulary, non-negative integer
  `keyEpoch`, `createdAt` range reused from `FedosBoardPost`, no
  self-reply contradiction, fails closed to `null`, never throws,
  freezes the result.
- **Alpha 856 — Associated Data Contract.**
  `src/conversation/envelope/fedos_conversation_envelope_associated_data.ts`.
  Adopts **prefix-then-encrypt**: `encodeFedosConversationEnvelopeAssociatedData()`
  produces a deterministic, canonical, length-prefixed byte header from
  `id`/`conversationId`/`senderMembershipId`/`keyEpoch`/`createdAt`/
  `replyToEnvelopeId`/`encryptionSuite`, prepended to real plaintext
  before encryption and stripped + re-derived + byte-compared after
  decryption — a genuine cryptographic tamper-detection binding without
  a Rust-side native-AAD API change (`14_associated_data.md`'s own
  option (b), formally chosen here for the first time).
- **Alpha 857 — Envelope Metadata Persistence.**
  `src/conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.ts`.
  `FedosConversationMessageEnvelopePersistence` — single-record-per-id,
  no delete method, mirrors `FedosConversationPayloadStorage`'s own
  shape exactly.
- **Alpha 858 — Envelope Codec.**
  `src/conversation/envelope/persistence/fedos_conversation_message_envelope_codec.ts`.
  `serializeFedosConversationMessageEnvelope()`/`deserializeFedosConversationMessageEnvelope()`
  — `schemaVersion` checked exactly against `1`, unknown fields
  rejected, round-trip-verified.
- **Alpha 859 — In-Memory Envelope Persistence.**
  `src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.ts`.
  `Map`-backed, restart-not-applicable (in-process only).
- **Alpha 860 — Append-Only Envelope Persistence.**
  `src/conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.ts`.
  NDJSON log file, insert-only, zero new dependency (`node:fs` only),
  fail-closed on a corrupt line or an irreconcilable duplicate,
  restart-verified.
- **Tests (this session):** `test/secure_runtime_alpha_853_860_envelope_persistence.test.ts`
  — 40 cases across all eight files above (id branding, validator
  acceptance/rejection matrix, associated-data determinism/collision/
  known-answer, codec round-trip/rejection, in-memory and append-only
  insert/duplicate/conflict/corruption/restart).

## Phase B — Encryption Authority Boundary (Package C2 + buildable slice of C3)

- **Alpha 861 — Encryption Authority (interface).**
  `src/conversation/encryption/fedos_conversation_encryption_authority.ts`.
  `FedosConversationEncryptionAuthority.encrypt()` — narrow, trusts the
  caller already confirmed Membership readiness, never itself decides
  who is a legitimate participant (`06_encryption_authority.md`'s own
  "Authority boundary, restated").
- **Alpha 862 — Decryption Authority (interface, this session).**
  `src/conversation/encryption/fedos_conversation_decryption_authority.ts`.
  The exact mirror of Alpha 861, per `07_decryption_authority.md`'s own
  "single shared implementation rather than two" recommendation for
  `resolveConversationKey()`.
- **Alpha 863 — Encryption Authority result vocabulary.** Same file as
  861: `"encrypted" | "unauthorized" | "key-unavailable" |
  "invalid-input" | "unavailable" | "failed"` — coarse and stable, no
  raw `Error`, no provider detail.
- **Alpha 864 — Suite Decision.** Embedded in Alpha 854's own header —
  the closed two-suite vocabulary, formally adopted for the Envelope.
- **Alpha 865 — Decryption Authority result vocabulary (this session).**
  Same file as 862, structurally identical to 863's own six-outcome
  shape — chosen over `16_failure_vocabulary.md`'s own finer-grained,
  four-reason proposal for internal consistency between this Arc's two
  sibling Authorities (see that file's own header for the full
  reasoning); still distinguishes the one class `07_decryption_authority.md`
  itself flagged safe to distinguish (`"key-unavailable"`, resolved
  strictly before any ciphertext is touched) from the deliberately
  undifferentiated AEAD/tamper/header-mismatch collapse (`"failed"`).
- **Alpha 866 — Membership Readiness.**
  `src/conversation/encryption/fedos_conversation_membership_readiness.ts`.
  `evaluateFedosConversationCryptoReadiness()` — a REAL
  `findMembership()` lookup against the frozen
  `FedosConversationMembershipAuthority` (Alpha 761–850) every call,
  never a hard-coded `true`; adopts Alpha 850's own answer to
  `11_key_epochs.md`'s open question — a Direct conversation's `keyEpoch`
  never advances past `0`.
- **Tests (this session):** `test/secure_runtime_alpha_866_membership_readiness.test.ts`
  — 8 cases (ready, not-member via absence/revoked/left, unsupported
  suite, unsupported epoch, both real suites).
- **Alpha 867 — Nonce freshness.** No new code — verified structurally
  already satisfied: `fedos_encrypt`'s own `seal_internal` draws a fresh
  nonce every call, and Seam 2's `encrypt()` has no nonce parameter a
  caller could select or reuse. Re-verified this session via direct
  reading of `packages/fedos-core-rust/src/lib.rs`'s own AEAD internal
  module — unchanged, no modification needed.
- **Alpha 868 — No generic oracle instruction.** A design constraint
  honored, not a file: no `encrypt(key, bytes)` free-form call is added
  anywhere; every seal continues to go through the closed
  `AeadAlgorithm`/`AeadAadDomain` vocabulary.
- **Alpha 869 — `resolveConversationKey()` Rust/WASM export + TypeScript
  wiring.** `FedosMasterSeedAuthority::resolve_conversation_key()`
  (`packages/fedos-core-rust/src/lib.rs`) — a `#[wasm_bindgen]`-exported
  method following the exact opaque-handle-in/opaque-handle-out pattern
  `generate_aead_key_handle`/`encrypt_aead` already establish, wrapping
  the EXISTING, unchanged, NIP-44-vector-verified
  `derive_conversation_key_via_ecdh_internal`. Six Rust-side tests
  (fail-closed on an empty/cleared authority, malformed hex, success,
  determinism, cross-account separation, cross-party reciprocity — the
  last two proven functionally via seal-with-one-handle/open-with-the-
  other, never by inspecting a raw byte). TypeScript wiring:
  `FedosWasmLoaderSkeleton.attemptDevOnlyMasterSeedResolveConversationKeyCall()`
  (`src/runtime/fedos_wasm_loader.ts`) and
  `FedosWasmMasterSeedAuthority.resolveConversationKey()`
  (`src/runtime/master_seed/fedos_wasm_master_seed_authority.ts`), gated
  exactly like every other `attemptDevOnly*` call already in that file.
  Verified against `test/secure_runtime_alpha_869_resolve_conversation_key_wiring.test.ts`
  (5 cases, unmodified from Session 1, all passing as-is — no test
  expectation was changed to make it pass).
- **Alpha 870 — Encryption Authority Implementation (this session).**
  `src/conversation/encryption/fedos_wasm_conversation_encryption_authority.ts`.
  `FedosWasmConversationEncryptionAuthority` — resolves the key
  (Alpha 869), builds and prepends the associated-data header
  (Alpha 856), seals via the EXISTING `encrypt()`/`exportCiphertext()`
  (`src/runtime/fedos_runtime_encrypt.ts`/`fedos_runtime_export_ciphertext.ts`),
  UTF-8 encodes the resulting `AeadCiphertextWire` into the
  `Uint8Array` `FedosConversationPayloadStorage.putPayload()` requires.
  Zero new cryptography — pure wiring, injectable
  `FedosConversationEncryptionRuntimeBoundary` for testability, mirroring
  `FedosMasterSeedWasmLoaderBoundary`'s own shape.

  **CORRECTION found and fixed this session:** Alpha 861's own interface
  file (`fedos_conversation_encryption_authority.ts`) had a header
  comment describing `localAccountIndex`/`counterpartyPublicKeyHex` as
  already-present, caller-resolved fields on
  `FedosConversationEncryptionRequest` — but the actual interface
  definition below that comment omitted both fields. This was an
  interruption artifact (Session 1 wrote the header before finishing the
  shape it describes), not a new design decision. Fixed by adding
  exactly the two fields the header already promised, with a dated
  correction note left in place — no prior commit ever shipped this
  interface without them, so this is not a rename of a previously-real
  public interface.
- **Alpha 871 — Decryption Authority Implementation (this session).**
  `src/conversation/encryption/fedos_wasm_conversation_decryption_authority.ts`.
  `FedosWasmConversationDecryptionAuthority` — the exact mirror: UTF-8
  decodes the stored ciphertext bytes back to the `AeadCiphertextWire`
  text, imports + decrypts (`fedos_runtime_import_ciphertext.ts`/
  `fedos_runtime_decrypt.ts`), then strips + re-derives + byte-compares
  the Alpha 856 header — a length or byte mismatch collapses to
  `"failed"`, the SAME undifferentiated outcome a genuine AEAD
  authentication failure produces (no oracle, per `16_failure_vocabulary.md`'s
  own finding).
- **Alpha 872 — Encryption Authority tests (this session).**
  `test/secure_runtime_alpha_861_872_encryption_authority.test.ts` — 11
  cases (invalid-input, key-unavailable via null/throw, failed via each
  boundary-call failure mode, full success, associated-data header
  verified byte-for-byte as the actual prefix passed to `encrypt()`,
  exact-argument-forwarding to `resolveConversationKey()`).
- **Alpha 873 — Decryption Authority tests (this session).**
  `test/secure_runtime_alpha_862_873_decryption_authority.test.ts` — 11
  cases, including a full round-trip integration test (encrypt with one
  Authority, decrypt with the other, over a minimal shared in-memory
  fake AEAD pair keyed by object identity — proving the wiring, not
  re-testing real cryptography, which is Rust/vector-tested elsewhere)
  and a tamper test (a changed `conversationId` at decrypt time fails
  closed to `"failed"`, never a distinguishable reason).

## Named remaining blocker — Package C3's own stopping point

Per `09_direct_key_strategy.md`'s own explicit finding, reconfirmed by
this Arc rather than solved: **resolving `localAccountIndex`/
`counterpartyPublicKeyHex` from a live `FedosConversationId`/
`FedosConversationMembership` pair is a genuinely separate
Identity-domain decision**, not invented inline by either Authority.
Concretely, no mapping exists anywhere in this codebase from a
`FedosConversationParticipantReference.publicIdentifier` (whose own
encoding varies by `authority` — `"fedos" | "nostr" | "activitypub" |
"atproto" | "session" | "temporary-capability"`) to a Master-Seed
`accountIndex`, nor is there a mapping from "the conversation's other
participant" to their `counterpartyPublicKeyHex`. Both
`FedosConversationEncryptionRequest`/`FedosConversationDecryptionRequest`
therefore accept these two fields ALREADY RESOLVED — a caller (a future
Coordinator) must supply them.

**No Coordinator is built in this Arc.** A
`fedos_conversation_encryption_coordinator.ts`/
`fedos_conversation_decryption_coordinator.ts` (referenced only in
comments, never implemented) would need to either solve the exact same
blocker inline — which this Arc's own instructions forbid inventing — or
merely pass the caller's already-resolved fields through unchanged, at
which point it would add only the readiness check
(`evaluateFedosConversationCryptoReadiness()`, already real and callable
today) plus Envelope/Payload persistence orchestration, both themselves
additional new scope beyond this Arc's own named remaining boundary.
Stopped here, honestly, rather than building a Coordinator around an
unresolved parameter.

## What this Arc does not authorize or claim

- No production-runtime gating change — Seam 2's Development-Runtime
  gate (`13_runtime_activation_gate.md` item 3) remains exactly as
  closed as before this Arc; nothing in `src/` flips it for production.
- No group/Private-Group support of any kind — `10_group_key_strategy.md`
  remains unresolved and untouched; every type/function this Arc adds is
  pairwise/Direct-mode only.
- No traffic-analysis or metadata/anonymity guarantee — this Arc
  produces ciphertext confidentiality (AEAD-sealed bytes, tamper-bound
  Envelope metadata) only. `senderMembershipId`/`conversationId`/
  `createdAt` still travel in the plaintext `FedosConversationMessageEnvelope`
  record itself.
- No GUI, Worker integration, or protocol (Nostr/ActivityPub/AT Protocol)
  wire mapping.

# Secure Runtime Alpha 890 — Completion Declaration

## Achieved

- Envelope model, validator, and persistence (Alpha 853–860) —
  `FedosConversationMessageEnvelope`, its sole validator, a length-
  prefixed deterministic associated-data header (Alpha 856, prefix-then-
  encrypt), a dedicated metadata persistence port, a fail-closed codec,
  and both an in-memory and a zero-new-dependency append-only backend.
  40 new tests (`test/secure_runtime_alpha_853_860_envelope_persistence.test.ts`).
- Rust/WASM Encryption Authority export (Alpha 869) —
  `FedosMasterSeedAuthority::resolve_conversation_key()`
  (`packages/fedos-core-rust/src/lib.rs`), a `#[wasm_bindgen]`-exported
  bridge from the account-derived Master Seed secret key to a real,
  ECDH-derived pairwise conversation key, reusing the EXISTING,
  unchanged, NIP-44-vector-verified `derive_conversation_key_via_ecdh_internal`
  — zero new elliptic-curve/HKDF/AEAD code. Six Rust-side tests: fail
  closed on an empty/cleared authority and on malformed hex; succeeds for
  a well-formed counterparty key; deterministic for the same
  account/counterparty pair; differs across distinct accounts; reciprocal
  between two independent parties (proven functionally via
  seal-with-one-handle/open-with-the-other, never by inspecting a raw
  key byte). `packages/fedos-core-rust/pkg/` artifact built and verified
  this session — `resolve_conversation_key` confirmed present in both the
  generated `.d.ts` and `.js` glue.
- TypeScript wiring (Alpha 869) —
  `FedosWasmLoaderSkeleton.attemptDevOnlyMasterSeedResolveConversationKeyCall()`
  and `FedosWasmMasterSeedAuthority.resolveConversationKey()`, gated
  identically to every other `attemptDevOnly*` call in
  `src/runtime/fedos_wasm_loader.ts`. Verified against
  `test/secure_runtime_alpha_869_resolve_conversation_key_wiring.test.ts`
  (5 cases, written by the prior session, unmodified — no test
  expectation was changed to make it pass).
- Membership Readiness (Alpha 866) —
  `evaluateFedosConversationCryptoReadiness()`: a real `findMembership()`
  lookup against the frozen `FedosConversationMembershipAuthority`
  (Alpha 761–850) every call, never a hard-coded `true`; adopts a
  Direct conversation's `keyEpoch` as permanently `0`. 8 new tests
  (`test/secure_runtime_alpha_866_membership_readiness.test.ts`).
- Encryption Authority — interface (Alpha 861), result vocabulary
  (Alpha 863), and a concrete, WASM-backed implementation
  (Alpha 870, `FedosWasmConversationEncryptionAuthority`): resolves the
  key, builds and prepends the Alpha 856 associated-data header, seals
  via the EXISTING `encrypt()`/`exportCiphertext()`, UTF-8-encodes the
  resulting wire text into storable bytes. 11 new tests, including a
  byte-for-byte check that the associated-data header is genuinely the
  prefix passed to `encrypt()`.
- Decryption Authority — interface (Alpha 862), result vocabulary
  (Alpha 865), and a concrete, WASM-backed implementation (Alpha 871,
  `FedosWasmConversationDecryptionAuthority`): the exact mirror,
  strip + re-derive + byte-compare the associated-data header after
  decrypt, collapsing any mismatch into the SAME undifferentiated
  `"failed"` outcome a genuine AEAD authentication failure produces (no
  oracle). 11 new tests, including a full encrypt-then-decrypt
  round-trip over a minimal shared fake AEAD pair (proving the TypeScript
  wiring, not re-testing real cryptography) and a tamper test.
- One real inconsistency found and fixed: Alpha 861's own interface file
  described `localAccountIndex`/`counterpartyPublicKeyHex` as
  already-present request fields in its header comment, but the actual
  `FedosConversationEncryptionRequest` shape omitted both — an
  interruption artifact from the prior session, not a new design
  decision. Corrected with both fields added exactly as already
  documented, plus a dated correction note.

## Remaining blockers

- **Named, deliberate stopping point (not attempted):** resolving
  `localAccountIndex`/`counterpartyPublicKeyHex` from a live
  `FedosConversationId`/`FedosConversationMembership` pair. No mapping
  exists anywhere in this codebase from a
  `FedosConversationParticipantReference.publicIdentifier` (whose own
  encoding varies by `authority`) to a Master-Seed `accountIndex`, nor
  from "the conversation's other participant" to their
  `counterpartyPublicKeyHex`. This is a genuinely separate
  Identity-domain decision (`09_direct_key_strategy.md`'s own explicit
  finding) — both Authorities accept these two fields already resolved,
  by design, rather than inventing the resolution inline.
- **No Coordinator built.** `fedos_conversation_encryption_coordinator.ts`/
  `fedos_conversation_decryption_coordinator.ts` (referenced only in
  comments) do not exist — building one now would either re-invent the
  blocker above inline, or merely pass an already-resolved pair through,
  at which point its only real new content (the readiness check +
  Envelope/Payload persistence orchestration) is itself additional scope
  beyond this Arc's own named boundary.
- **No production-runtime gating change.** Seam 2's Development-Runtime
  gate (`13_runtime_activation_gate.md` item 3) remains exactly as
  permanently closed as before this Arc — nothing in `src/` flips it for
  production; every real WASM call site in this Arc is still gated
  behind the same `attemptDevOnly*` chain every prior Arc already used.
- **No group/Private-Group support.** `10_group_key_strategy.md` remains
  unresolved; every type/function this Arc adds is pairwise/Direct-mode
  only — `FedosConversationEnvelopeEncryptionSuite` is closed to
  `"ChaCha20Poly1305" | "Aes256Gcm"`, both real, Rust-backed AEAD suites,
  never a group scheme.
- **No traffic-analysis/anonymity guarantee.** This Arc produces
  ciphertext confidentiality (AEAD-sealed bytes, tamper-bound Envelope
  metadata via prefix-then-encrypt) only. `senderMembershipId`/
  `conversationId`/`createdAt`/`keyEpoch` still travel in the plaintext
  `FedosConversationMessageEnvelope` record itself — nothing about who is
  talking to whom, or when, is hidden by anything this Arc adds.
- **No GUI, Worker integration, or protocol wire mapping** (Nostr/
  ActivityPub/AT Protocol representation of an Envelope) — none exists.
- **Pre-existing, unrelated, confirmed NOT caused by this Arc:**
  `crypto::secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
  (`packages/fedos-core-rust/src/crypto/secp256k1_dependency_guard.rs`)
  fails — it asserts exactly 10 production dependencies but the real
  count is 11, because `wasm-bindgen` (Stage 985) was adopted after this
  guard's own expectation was written and the guard was never updated.
  `git diff --stat` on this file across this Arc's own worktree is empty
  — this Arc touches neither the guard nor `Cargo.toml`. Also pre-existing:
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts(121,18)`,
  a `tsc --noEmit` failure present before this Arc's first edit.

## Scope and ripple

Every new/modified file lives under `src/conversation/envelope/`,
`src/conversation/encryption/`, `src/runtime/fedos_wasm_loader.ts`,
`src/runtime/master_seed/`, `packages/fedos-core-rust/src/lib.rs`,
`test/`, or `docs/`. `src/board/runtime/` is untouched. No dependency was
added to `package.json` or `packages/fedos-core-rust/Cargo.toml`. `p2p/`
(untracked, main-worktree-only) was never touched from this worktree.

## Crypto/key scope

Pairwise (Direct-mode) only — the Option D degenerate case
(`09_direct_key_strategy.md`), a single ECDH channel per
account/counterparty pair, zero new key-distribution logic. Two AEAD
suites, both real and Rust-backed: `ChaCha20Poly1305`, `Aes256Gcm`. No
group key, no Sender Key, no MLS.

## Recommendation

**A dedicated Identity-domain Arc resolving `FedosConversationParticipantReference`
→ `(accountIndex, counterpartyPublicKeyHex)`.** This is the single
remaining blocker standing between this Arc's own real, tested Encryption/
Decryption Authorities and an actual Coordinator that could drive them
from a live Conversation. Building a Coordinator before that resolution
exists would either silently invent it (forbidden by this Arc's own
instruction) or ship a Coordinator whose two most important request
fields are still opaque pass-throughs from an unspecified caller — a
speculative abstraction this codebase's own established discipline
(`FedosConversationRecord`'s "no speculative field" rule, applied here at
the Arc level) counsels against. Once that resolution is real, the
Coordinator itself (readiness check + envelope/payload persistence
orchestration around the two Authorities this Arc already built and
tested) becomes a comparatively small, low-risk wiring task.

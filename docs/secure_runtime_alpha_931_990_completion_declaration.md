# Secure Runtime Alpha 931–990 — Conversation Identity Resolution and Encryption Coordinator Arc — Completion Declaration

## Resumed-state reconciliation

Confirmed against the merged worktree at HEAD `bb1893e` before any edit:

- Alpha 890's named blocker (`docs/secure_runtime_alpha_890_completion_declaration.md`)
  — resolving `localAccountIndex`/`counterpartyPublicKeyHex` from a live
  Conversation/Membership pair — was exactly as described: neither
  Coordinator existed, both Authorities accepted the pair pre-resolved.
- `FedosConversationLifecycleState`'s own validator
  (`src/conversation/construction/fedos_conversation_draft_record_validator.ts`)
  statically rejects every lifecycle value except `"draft"` — confirmed
  by reading the validator, not assumed.
- Nostr Identity Binding (Alpha 681–720) was found at
  `src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`
  (implementation) / `fedos_nostr_author_binding_types.ts` (interface +
  result vocabulary) — the task brief's guess ("likely under
  `src/board/runtime/identity/`") was correct.
- "Four protocols": grepping `FEDOS_BOARD_SOURCE_PROTOCOLS`
  (`src/board/fedos_board_source.ts`) and
  `test/secure_runtime_alpha_637_four_protocol_boundary.test.ts` shows
  the four EXTERNALLY-sourced protocol labels are
  `nostr`/`activitypub`/`atproto`/`session` — `"fedos"` is a fifth,
  LOCAL label, never counted among "the four". The task brief's guess
  ("Nostr/ActivityPub/AT Protocol/local") was close but not exact —
  `"session"`, not `"local"`, is the fourth external protocol; `"fedos"`
  is local and separate from the four.
- Account index resolution precedent: `docs/secure_runtime_alpha_689_account_index_authority.md`
  (Alpha 689) already decided "a fixed, injected config value, default
  0, never inferred from `publicIdentifier`" for the Nostr Board Runtime
  domain — adopted identically here (`FixedFedosConversationLocalAccountIndexAuthority`).

No discrepancy found between the task brief and the actual codebase.

## Components (one line each)

| Component | Public interface | What it does |
|---|---|---|
| ConversationIdentityResolver | `src/conversation/encryption/identity/fedos_conversation_identity_resolver.ts` — `FedosConversationIdentityResolver.resolveLocalParticipant()` | Answers "who is the local participant?" by delegating to the EXISTING, unmodified `FedosConversationCreatorIdentityAuthority` (Alpha 904). |
| ConversationParticipantResolver | `.../fedos_conversation_participant_resolver.ts` — `FedosConversationParticipantResolver.resolveCounterparty()` | Given the local participant, finds the ONE other active Member via the EXISTING, unmodified `FedosConversationMembershipAuthority`; fails closed on zero or 2+ candidates. |
| AccountIndex resolution | `.../fedos_conversation_local_account_index_authority.ts` — `FedosConversationLocalAccountIndexAuthority.localAccountIndex()` | A fixed, injected local account index (default `0`), mirroring Alpha 689's own precedent — never inferred from identity. |
| Counterparty PublicKey resolution | `.../fedos_conversation_counterparty_public_key_resolver.ts` — `resolveFedosConversationCounterpartyPublicKeyHex()` | Pure function: extracts a 64-char lowercase-hex Nostr public key from the counterparty reference; fails closed for any non-`"nostr"` authority or malformed hex. |
| ConversationKeyResolver | `.../fedos_conversation_key_resolver.ts` — `FedosConversationKeyResolver.resolve()` | Composes the four above INTO the exact `(localAccountIndex, counterpartyPublicKeyHex)` pair Alpha 890 named as blocked; additionally, cryptographically verifies the local account index against the local identity via the EXISTING, unmodified Nostr Identity Binding Authority when the local identity is Nostr-keyed. |
| EncryptionCoordinator | `src/conversation/encryption/fedos_conversation_encryption_coordinator.ts` — `FedosConversationEncryptionCoordinator.encrypt()` | Orchestrates: lifecycle gate → readiness (Alpha 866, unmodified) → key resolution → the EXISTING, unmodified `FedosConversationEncryptionAuthority.encrypt()` → durable Payload + Envelope persistence, with its own crash-recovery coordination log. |
| DecryptionCoordinator | `src/conversation/encryption/fedos_conversation_decryption_coordinator.ts` — `FedosConversationDecryptionCoordinator.decrypt()` | The read-only mirror: loads an Envelope+Payload, same gates, calls the EXISTING, unmodified `FedosConversationDecryptionAuthority.decrypt()`. No coordination log (no durable write to converge). |
| Runtime wiring | `src/conversation/runtime/fedos_conversation_runtime.ts` — `FedosConversationRuntime.encryptMessage()`/`decryptMessage()` | Reachable via `runtime.conversationRuntime()`, the SAME pattern `createPrivateGroupDraft()` already uses; every new dependency is optional with a safe, fail-closed default. |
| Restart validation | `src/conversation/encryption/coordination/` (new port + in-memory + append-only backends) | A durable coordination log, reusing the Alpha 845/915–917 "read how far a prior attempt got, only move forward" discipline. |
| Failure matrix | `test/secure_runtime_alpha_931_990_failure_matrix.test.ts` | 37 tests, one per distinct coarse outcome of both Coordinators. |

## Fail-closed, three named cases

1. **Identity cannot be resolved** → `"identity-unavailable"` (and every
   other Alpha 935 resolution failure: `"not-member"`,
   `"no-counterparty"`, `"ambiguous-counterparty"`,
   `"unsupported-counterparty-authority"`,
   `"invalid-counterparty-public-key"`, `"identity-binding-unavailable"`,
   `"identity-binding-mismatch"`). Tested in
   `test/secure_runtime_alpha_931_935_identity_resolution.test.ts` and
   the failure-matrix file.
2. **The Conversation is still a draft** → `"conversation-not-active"`.
   Both Coordinators read the RAW persisted `lifecycleState` string
   directly (never through the frozen domain validator, which would make
   this branch permanently dead code — see "Honest findings" below).
   Tested with a hand-built `lifecycleState: "active"` fixture written
   directly via `FedosConversationDraftPersistence.putDraft()` (a dumb,
   unvalidated port) in
   `test/secure_runtime_alpha_943_946_encryption_decryption_coordinators.test.ts`,
   the restart-recovery tests, the failure matrix, and the runtime-wiring
   test — this is the ONLY way to reach it; NOTHING in this repository's
   real construction pipeline can produce an `"active"` record.
3. **Encryption is unavailable** → the default wiring uses
   `UnavailableFedosConversationEncryptionAuthority`/
   `UnavailableFedosConversationDecryptionAuthority` (new, mirroring
   `UnavailableFedosConversationEncryptionReadinessAuthority`'s own
   already-adopted default exactly), which always resolve `"unavailable"`
   → the Coordinator maps this to `"encryption-failed"`/
   `"decryption-failed"`. Confirmed against the README's own "Runtime
   Crypto Activation Boundary" section: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
   is fixed `false` and `"Allowed"` is structurally unreturnable in this
   checked-out tree. Tested in both coordinator test files.

## Nostr Identity Binding

Found at `src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`
(`FedosSigningAuthorityNostrAuthorBinding`, the one production
implementation) and `fedos_nostr_author_binding_types.ts`
(`FedosNostrAuthorBindingAuthority` interface, `verifyBinding()`).
`FedosConversationKeyResolver` composes over this EXACT interface,
unmodified, mapping a `FedosConversationParticipantReference` into the
`FedosBoardAuthorReference` shape `verifyBinding()` expects — this is a
genuine new security property (confirms a configured account index truly
derives the resolved local identity's own public key) built by CONNECTING
two already-existing, already-reviewed layers, not a new cryptographic
primitive.

## Four-protocol validation

"Four protocols" = `nostr`/`activitypub`/`atproto`/`session` (this
codebase's own `FEDOS_BOARD_SOURCE_PROTOCOLS` minus `"fedos"`, the fifth,
local label). `test/secure_runtime_alpha_931_990_four_protocol_validation.test.ts`
confirms `ConversationParticipantResolver` treats all four identically
(Membership resolution has no protocol-specific branch), and that
`resolveFedosConversationCounterpartyPublicKeyHex()` narrows to Nostr
ONLY at the final key-extraction step (Alpha 890's own pairwise/ECDH
scope) — every other protocol, including the three non-Nostr externally
sourced ones, fails closed with the IDENTICAL `"unsupported-authority"`
token, never a silent guess or a protocol-specific special case.

## Restart validation

Pattern: `FedosConversationDurableRedemptionCoordinator`'s own (Alpha
845–847) "deterministic id, read how far a prior attempt got, only move
forward, never re-spend an already-consumed resource." Property actually
PROVEN by `test/secure_runtime_alpha_945_encryption_restart_recovery.test.ts`
over REAL append-only NDJSON files: (1) a completed attempt, replayed by
a second, fully independent Coordinator instance over the same files,
returns the identical Envelope and calls the Encryption Authority ZERO
additional times; (2) a crash simulated between `"payload-persisted"`
and `"envelope-persisted"` (hand-seeded coordination + payload facts,
deliberately no Envelope) recovers forward, reuses the SAME payload id,
and calls the Encryption Authority ZERO times; (3) a crash simulated at
`"prepared"` only (nothing durably consumed) re-runs the full sequence,
calling the Encryption Authority exactly once.

## Honest findings / unsupported features

- **`"active"` is unreachable anywhere in this repository.** Every
  construction path (`FedosPrivateConversationConstructionCoordinator`)
  and the domain validator (`validateFedosConversationDraftRecord`) fix
  `lifecycleState: "draft"` unconditionally. `encryptMessage()`/
  `decryptMessage()`'s happy paths are therefore exercisable ONLY via a
  hand-built fixture written directly through the dumb
  `FedosConversationDraftPersistence` port, never through any real
  runtime call. This is the SAME boundary Alpha 890 already named; this
  Arc does not move it and does not fake a way past it.
- **Two outcome tokens are structurally dead code from `EncryptionCoordinator.encrypt()`'s
  own call site**: `"unsupported-suite"` (command validation already
  rejects any suite outside the closed vocabulary as `"invalid-command"`
  before readiness ever runs) and `"unsupported-epoch"` (the Coordinator
  always passes the one supported constant, `0`). Both remain in the
  result vocabulary for forward-compatibility (a future group/epoch-
  advancing Arc could reach them) rather than being silently deleted;
  `DecryptionCoordinator`'s own `"unsupported-epoch"` IS genuinely
  reachable (a persisted Envelope's `keyEpoch` is a plain non-negative
  integer, not narrowed to `0`) and is tested for real.
- **The Desktop Runtime's own config surface (`fedos_desktop_runtime_config.ts`,
  `fedos_desktop_runtime.ts`) is NOT extended** — every new dependency is
  optional on `FedosConversationRuntimeAssemblyConfig`, so
  `fedos_desktop_runtime.ts`'s existing call continues to work
  byte-for-byte unchanged and automatically gains fail-closed
  `encryptMessage()`/`decryptMessage()`, but a caller cannot yet
  configure durable envelope/payload/coordination LOG PATHS through the
  Desktop Runtime's own config type without a small follow-up (trivial —
  three more optional fields threaded through, no design decision left
  open).
- **No group/Private-Group key support** — pairwise/Direct-mode only,
  matching Alpha 890's own crypto/key scope exactly; `ConversationParticipantResolver`
  fails closed (`"ambiguous-counterparty"`) rather than guessing.
- **No new cryptography, no GUI, no Worker integration, no protocol wire
  mapping** — this Arc is pure TypeScript coordination over the EXISTING
  Rust/WASM boundary and EXISTING Authorities, exactly as scoped.

## Scope and ripple

Every new/modified file lives under `src/conversation/`, `test/`, or
`docs/`. `src/conversation/runtime/fedos_conversation_runtime.ts` and
`fedos_conversation_runtime_assembly.ts` are modified ADDITIVELY (new
optional fields/methods only — no existing field renamed, removed, or
made required). No file under `src/conversation/membership/`,
`src/scheduler/`, `src/board/runtime/publish/`, or the Conversation
schema (`fedos_conversation_record*.ts`) was touched (`git diff --stat`
confirms zero lines). No dependency was added to `package.json` or
`packages/fedos-core-rust/Cargo.toml`. `p2p/` was never created in this
worktree.

## Recommendation

**A dedicated Desktop Runtime Config Threading Arc** — plumb
`envelopeLogPath`/`payloadLogPath`/`encryptionCoordinationLogPath` (and
the optional Authority/resolver injection points this Arc already
defined on `FedosConversationRuntimeAssemblyConfig`) through
`FedosDesktopRuntimeConfig`, so a real running Desktop Runtime can be
configured with durable encryption backends and a real
`FedosWasmConversationEncryptionAuthority`/`FedosWasmMasterSeedAuthority`
pair — small, low-risk, no open design question, and the last remaining
wiring gap before `encryptMessage()`/`decryptMessage()` are reachable
from `run_fedos_desktop_runtime.ts` itself (still gated, honestly, behind
the still-unresolved `"draft" → "active"` activation blocker this Arc
does not attempt to close).

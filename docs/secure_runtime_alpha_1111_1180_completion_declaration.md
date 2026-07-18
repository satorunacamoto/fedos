# Secure Runtime Alpha 1111–1180 — Completion Declaration

Private Conversation Activation and Direct Messaging Runtime Arc.
Worktree `C:\wt\private-direct-messaging`, branch
`arc/private-conversation-activation-direct-messaging`.

## 1. Integrations performed

Two sibling Arcs, never on `master`, merged into a dedicated integration
branch built from `master` (`8b65609`):

| Branch | Commit | Merge result |
|---|---|---|
| `arc/conversation-identity-resolution-encryption-coordinator` | `f36c334` | Clean, zero conflicts |
| `arc/conversation-invitation-draft-management` | `50082bc` | Two mechanical conflicts (both sides added disjoint fields/branches to the same two files); resolved as a pure union, no logic changed |

See `docs/secure_runtime_alpha_1111_1180_integrated_inventory.md` for the
full Phase A inventory produced before any production file was touched.

## 2. Runtime config wiring (Alpha 1113/1114)

`FedosDesktopRuntimeConfig` gained ten new optional fields
(`conversationEncryptionAuthority`, `conversationDecryptionAuthority`,
`conversationIdentityResolver`, `conversationAccountIndexAuthority`,
`conversationEnvelopeLogPath`, `conversationPayloadLogPath`,
`conversationMaxPayloadByteLength`, `conversationEncryptionCoordinationLogPath`,
`conversationActivationCoordinationLogPath`,
`conversationPayloadRetentionLogPath`), all threaded through to
`assembleFedosConversationRuntimeDependencies()` in
`fedos_desktop_runtime.ts`, reusing the existing
`nostrAuthorBindingAuthority` instance (one coherent identity graph).

## 3. Activation model

`src/conversation/activation/`:
- `fedos_persisted_conversation_activation_v1.ts` — versioned record,
  five-phase vocabulary, deterministic `activation::<conversationId>` id.
- `fedos_conversation_activation_persistence.ts` +
  `in_memory_.../append_only_...` — port + two backends, mirroring the
  Alpha 913/914 construction-coordination pattern field-for-field.
- `fedos_conversation_active_lookup.ts` — the ONE shared
  `resolveFedosConversationActiveConversation()` helper both
  Encryption/Decryption Coordinators now consult.
- `fedos_conversation_direct_activation_result.ts` — closed 14-outcome
  vocabulary.
- `fedos_conversation_direct_activation_coordinator.ts` —
  `activateDirectConversation(conversationId)`, revalidating every
  readiness fact fresh on every call; the only short-circuit is a
  durable `"completed"` fact (`"already-active"`).

Exposed on `FedosConversationRuntime.activateDirectConversation()`.

## 4. Lifecycle persistence / recovery

Append-only-backed, forward-only, five-phase log
(`prepared → readiness-confirmed → lifecycle-activated → completed`, or
`terminal-failed` only from `prepared`). No update/delete method exists
on any backend — active cannot revert to draft structurally, not just by
convention. Crash recovery verified: a fresh Coordinator instance over a
durable file containing only a `"prepared"` fact converges to
`"activated"`; a fresh instance after `"completed"` returns
`"already-active"` without re-touching readiness (verified even after a
Membership revocation that would fail a fresh check — the durable fact,
not a live re-check, is authoritative, matching "active cannot silently
revert").

## 5. Supported identity/crypto scope

Unchanged from Alpha 890/931–990's own already-adopted scope: Direct
(pairwise) mode only, Nostr-keyed counterparty only, ECDH via the
existing `resolveConversationKey()`, two AEAD suites available
(`ChaCha20Poly1305`, `Aes256Gcm`) but this Arc's own messaging facade
always selects `ChaCha20Poly1305` internally (never caller-chosen), key
epoch fixed at `0`. Each local participant needs their own local Runtime
instance — no shared-state, no server relay of any kind.

## 6. Message send/read APIs

`FedosConversationRuntime`:
- `sendDirectMessage({ conversationId, body, replyToEnvelopeId })` →
  `FedosConversationDirectMessageSendResult` (9 outcomes).
- `readDirectMessage({ conversationId, envelopeId })` →
  `FedosConversationDirectMessageReadResult` (9 outcomes, no wrong-key-
  vs-tamper oracle).
- `listDirectMessages(conversationId)` → safe metadata only
  (`FedosConversationDirectMessageSummary[]`), `createdAt`-ascending with
  Envelope-id tie-break, never decrypts.

All three delegate to the pre-existing, unmodified
`FedosConversationEncryptionCoordinator`/`DecryptionCoordinator` for
every crypto/Envelope/Payload decision.

## 7. Envelope/payload behavior

Unchanged — Alpha 854/804's own records/ports, reused verbatim. The
encryption coordinator's own pre-existing crash-recovery log already
guarantees no duplicate Envelope/Payload on a retried encrypt attempt;
this Arc adds no second such mechanism.

## 8. Restart / tamper / retention / revocation results

All verified against real append-only backends and/or the real
`startFedosDesktopRuntime()` entry point:

- **Restart:** activation, a sent message, and its exact plaintext all
  survive a full `stop()` + fresh `startFedosDesktopRuntime()` cycle
  (`..._runtime_vertical_slice.test.ts`); no duplicate write.
- **Tamper:** a changed byte within the authenticated region, and a
  truncated payload, both fail closed to `"failed"` through the real
  `readDirectMessage()` path — never a partial plaintext.
- **Retention:** an active payload reads normally; a tombstoned payload
  is denied (`"tombstoned"`) both on read and in the list summary,
  enforced BEFORE any decrypt attempt.
- **Revocation:** a revoked or left local Membership denies both send
  and read (`"unauthorized"`); an unrelated participant with no
  Membership at all is denied identically.

## 9. Public-mode isolation

`createFedosBoardRuntime()`/`FedosBoardRuntime` untouched; `Publisher`/
`Scheduler`/`Outbox`/`p2p/` untouched. Verified: a private-group draft
never activates (`"unsupported-mode"`) and never gains a message API;
draft creation/read/list/invitation management (Alpha 891–1050) remain
fully usable with zero crypto configured.

## 10. Exact production gate status

**Closed.** No `packages/fedos-core-rust/pkg/` WASM artifact in this
checked-out tree. `cargo`/`wasm-bindgen` are present on this machine but
were not invoked (no Rust file changed; out of this Arc's own scope).
Every test uses injected Fake Encryption/Decryption Authorities. The real
`FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority` slot
into the exact same config fields this Arc wired, unchanged, once a real
seeded Master Seed Authority and a built WASM artifact exist.

## 11. Ripple files

Extended (narrow, mechanical): `fedos_conversation_encryption_coordinator.ts`,
`fedos_conversation_decryption_coordinator.ts`,
`fedos_conversation_runtime.ts`, `fedos_conversation_runtime_assembly.ts`,
`fedos_desktop_runtime.ts`, `fedos_desktop_runtime_config.ts`. Test
ripple (mechanical, one new required dependency field):
`secure_runtime_alpha_931_990_failure_matrix.test.ts`,
`secure_runtime_alpha_943_946_encryption_decryption_coordinators.test.ts`,
`secure_runtime_alpha_945_encryption_restart_recovery.test.ts`,
`secure_runtime_alpha_949_runtime_wiring.test.ts` (this last one's own
test 4 updated from a `lifecycleState` bypass to the new Activation-fact
mechanism — the exact property proven is unchanged). New, additive only:
`src/conversation/activation/` (6 files), `src/conversation/messaging/`
(5 files), 3 new test files, 2 docs, this README update.

## 12. Typecheck / tests / cargo / WASM

`npm run typecheck`: clean (one pre-existing, unrelated failure,
confirmed identical on plain `master`). `npm test`: see the README status
banner's own verification paragraph for the full, diffed accounting —
zero Conversation-domain regression; 173 unrelated failures traced to a
confirmed `core.autocrlf` worktree-checkout CRLF artifact, not a
behavioral defect. `cargo`/WASM: not run (no Rust/binding change).

## 13. Dependencies

`package.json`/`Cargo.toml` byte-for-byte unchanged (verified via `git
status` — neither file appears in the diff).

## 14. p2p/ untouched

Confirmed — `p2p/` never appears in this worktree's `git status` output
and was never read, imported, or referenced by any file this Arc added
or modified.

## 15. Artifact cleanup

No `dist/`, `target/`, `pkg/`, or `Cargo.lock` exists in this worktree
(nothing was built) — nothing to clean.

## 16. Next Arc recommendation

**Private Conversation Protocol Delivery Boundary Arc.** This Arc closes
the LOCAL activation/messaging gap completely — an active Direct
Conversation can now be constructed, encrypted, sent, persisted,
restarted, and authorized-read entirely through the real application
path. The one deliberately-named remaining gap this Arc does not touch
is protocol delivery (Nostr DM, or any other transport) — a genuinely
separate, larger decision (relay selection, delivery acknowledgment,
retry semantics) this Arc's own Absolute Prohibitions correctly keep out
of scope. If production crypto gating (§10) is prioritized first instead,
the correct next Arc is **Private Conversation Runtime Production
Activation Arc** (build the WASM artifact, wire a real seeded Master Seed
Authority, and re-run this Arc's own vertical-slice test with the real
`FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority` in place
of the Fake test doubles) — either is a legitimate, independently
valuable next step; this Arc does not choose between them.

# Secure Runtime Alpha 7721-7800 — Reconciliation Report

FedOS Archive Multi-Device Suppression Propagation Arc — Phase A

Status: investigation only. No source files were changed to produce this report.
Worktree: `C:\wt\archive-multidevice-suppression`
Branch: `arc/archive-multidevice-suppression-propagation`
Base commit: `feff676a` (Secure Runtime Alpha 7481-7560, FedOS Archive Envelope Retention
Parity and Metadata Deletion Semantics Arc)

## 0. Alpha range verification

- `feff676a` confirmed clean, no uncommitted changes in this worktree at checkout.
- The historical 5401-5480 collision (Direct-Ratchet-State vs. Local Deletion Capability
  lines) is recorded per instruction — see prior Arc's own reconciliation report
  (`secure_runtime_alpha_7561_7640_reconciliation_report.md §0`) for the full account; it
  predates and is unrelated to this Arc's own scope.
- Verified via `git merge-base --is-ancestor feff676 <branch>` over every local branch: no
  branch anywhere claims Alpha 7641 or beyond. **7641-7720 and 7721-7800 are both
  genuinely free.**
- The sibling parallel Arc, **A — FedOS Delivery Observation Repository Subject Index and
  Query Scalability**, owns `C:\wt\` (path not yet observed at report time) on its own
  branch, expected range **7641-7720**.
- **This Arc's own expected range, 7721-7800, is genuinely free and is hereby assigned.**

## 1. What `feff676`'s own docs say (from Phase A research pass 1)

Seven docs under `docs/secure_runtime_alpha_7481_7560_*`, read in full by the research
pass. Summary:

- Export side: `collectFedosConversationArchiveBundle()` now filters `envelopes` through
  the same `retentionAuthority.evaluatePayloadAccess()` gate as `payloads`
  (`fedos_conversation_archive_collector.ts:141-150`).
- Restore side (new): a new evaluator, `FedosPayloadRetentionAuthority.
  evaluateRetentionDecisionOnly(payloadId)` (`fedos_payload_retention_authority.ts:121-143`)
  reads the retention decision log directly, bypassing `payloadStorage`-existence (which
  would otherwise make a fresh restoring device indistinguishable from a genuinely foreign
  one). Restore's `isPayloadPermittedForRestore()` gate
  (`fedos_conversation_archive_restore.ts:118-145`) uses this evaluator exclusively.
- **The multi-device limitation, quoted verbatim**
  (`docs/secure_runtime_alpha_7481_7560_retained_copy_non_guarantees.md:53-69`):
  > "Restoring that same archive onto a device that has NEVER recorded the deletion fact (a
  > genuinely foreign/new profile) is NOT suppressed, and this Arc says so plainly...
  > `evaluatePayloadAccess()` correctly returns `{outcome:"not-found"}`... a materially
  > DIFFERENT signal from `{outcome:"denied"}`, and this Arc treats it as permission to
  > proceed, honestly, rather than inventing a global-deletion-propagation mechanism this
  > codebase has never built and this Arc's own mission explicitly forbids."
  > "If you restore an archive onto a device or profile that was never present when a
  > message was deleted, that device has no way to know the deletion happened, and the
  > message may reappear there. Restoring the same archive onto a device that already knows
  > about the deletion will not bring the message back."
- **Explicit hand-off** (`docs/secure_runtime_alpha_7481_7560_completion_declaration.md:157-168`):
  names exactly this Arc ("FedOS Archive Multi-Device Suppression Propagation Arc") as the
  recommended next step, and distinguishes two sub-cases currently both producing identical
  `{outcome:"not-found"}` behavior: (a) a truly foreign/different account (never in scope
  to fix — "Do not fabricate global deletion propagation"), and (b) "a same-account device
  that was offline when the deletion happened" (this Arc's own precise target).
- `chosen_archive_model.md` explicitly rejected embedding a cross-device deletion-fact
  carrier inside the Archive bundle itself (Option E) — confirming the mission's own
  framing that suppression propagation is a separate mechanism, not an Archive-format
  change. **This Arc does not touch the Archive bundle format.**

## 2. Local suppression/retention decision representation

`FedosPayloadRetentionAuthority` (`src/conversation/retention/fedos_payload_retention_authority.ts`):
- States: `FedosPayloadRetentionState = "active" | "tombstoned" | "payload-removed"`
  (`fedos_payload_retention_state.ts:85`) — `"active"` is implicit absence, never itself
  written. Enforced one-way transition `active -> tombstoned -> payload-removed`; any other
  transition is `"conflict"`.
- Decision record: `{payloadId, action, decidedAt, authorityReference, reasonCode}`
  (`fedos_payload_retention_decision.ts:48-56`), keyed deterministically by
  `${payloadId}::${action}` — **no revision/sequence-number concept exists.** A second,
  differing write for the same key is a hard, permanent `"conflict"`, never overwritten.
- New restore-only evaluator: `evaluateRetentionDecisionOnly(payloadId)` — pure log-only
  read, never touches `payloadStorage`.

**This Arc does not modify this Authority's own local-decision semantics** (per the
mission's own "Do not reopen those semantics" instruction) — it is read-only input to, and
a peer of, the new suppression-observation domain this Arc adds (see §11/Phase E decision).

## 3. Retention log schema, persistence, evaluators

`FedosPersistedPayloadRetentionDecisionV1` (`fedos_persisted_payload_retention_decision_v1.ts:20-29`)
— `schemaVersion:1, id, payloadId, action, decidedAt, authorityReference: string|null,
reasonCode`. Port `FedosPayloadRetentionPersistence` has **no delete method** ("a retention
decision is itself a permanent, append-only fact"). Backend
`AppendOnlyFedosPayloadRetentionPersistence` — one NDJSON file, full `replayLog()` re-parse
on every call (no cache to go stale), fail-closed (throws) on a corrupt/conflicting line —
**this exact shape is the template this Arc's own new suppression-observation log
follows precisely** (see Phase E).

## 4. Local Deletion execution records

`src/conversation/deletion/` — `FedosPersistedDeletionExecutionRecordV1`
(`fedos_persisted_deletion_execution_record_v1.ts:44-57`): `planId, requestedBy,
canonicalTargetRef, steps[], warnings[], status, recordedAt`. Confirmed **strictly
local-only by design** — no signing, no transport/serialization boundary, `requestedBy` is
explicitly "opaque local requester reference... never a display name, never plaintext."
**Not a candidate for reuse or extension by this Arc** — this Arc reads a *decision*
(§2/§3) as the trigger for creating a suppression fact; it does not touch this execution-log
domain.

## 5. Signed Deletion Request/Acknowledgement records — confirmed clean separation

`src/conversation/deletion_request/` — recipient-facing, **cross-account** concept:
`FedosDeletionRequestRecordV1`/`FedosDeletionAcknowledgementRecordV1`, signed as `kind:1`
Nostr event content via the account-level `FedosNostrSigningAuthority`, authorized against
real Conversation Membership (requester != recipient, by construction, in a shared
Conversation).

This Arc's own suppression fact is architecturally the **opposite** relationship: the SAME
account's own already-paired Device authenticating to its sibling Devices — no Conversation,
no Membership check, no recipient/requester asymmetry. **This Arc does not reuse
`deletion_request`'s types** (they are shaped for a fundamentally different trust
boundary) — Phase L below proves this separation explicitly with a real test, per the
mission's own requirement.

## 6. Archive restore's exact current decision path (the Phase H integration point)

`restoreFedosConversationArchiveBundle()` (`fedos_conversation_archive_restore.ts:187-284`)
gates every Envelope/Payload write through exactly one function,
`isPayloadPermittedForRestore()` (lines 118-145):
```
function isPayloadPermittedForRestore(retentionAuthority, payloadId): boolean {
  try { return retentionAuthority.evaluateRetentionDecisionOnly(payloadId) === "active"; }
  catch { return false; }
}
```
**Confirmed literally single-source today**: the ONLY consulted input is the restoring
device's own local retention log. This is the exact, sole integration point this Arc's own
Phase H extends. Two structural options were identified:
(a) make `isPayloadPermittedForRestore()` consult a SECOND, propagated-fact source in
    addition to the local retention log, or
(b) have a propagated suppression fact get folded into the SAME retention log via a new
    write path.

**Decision (recorded here, carried into Phase H): Option (a).** A separate,
distinguishable "imported suppression observation" source is added as a second, additive
check — never merged into the local Retention Authority's own decision log. This directly
satisfies Phase E's own explicit requirement ("local decision and imported observation
remain distinguishable") in the simplest possible way: they are different objects, backed
by different logs, from the start. `isPayloadPermittedForRestore()` becomes: permitted iff
the LOCAL retention decision is `"active"` **and** no active, trusted, imported suppression
observation exists for the same subject — local decision always wins first (a local
decision that is `"active"` while an imported fact says suppressed is still suppressed;
Phase H's own hierarchy, below, makes this explicit and total).

## 7. Restart hydration

No Board/Conversation-style in-memory hydration exists for Retention or Deletion, and none
is needed: both backends call `replayLog()` (full re-parse) on **every single port call**
— there is no cache to go stale across a restart. Restart durability is achieved purely by
constructing a fresh port instance over the same file path at Runtime construction
(`fedos_desktop_runtime.ts:724-731`, citing "the same 'fresh instance over the same durable
backend' pattern... Alpha 618/589"). **This Arc's own new suppression-observation log
follows this exact, zero-new-hydration-code pattern.**

(Note: the mission's own "Alpha 585/586" Outbox-hydration citation was not locatable
verbatim in this codebase by the research pass — the verified real precedents are Alpha 318
Board Hydration, Alpha 756 Conversation Hydration, and the Alpha 618/589 restart-stability
comment cited above; flagged, not silently substituted without disclosure.)

## 8. Conflict/revision classification precedent

Two real, reusable precedents found; no existing pattern in the Retention/Deletion domain
itself (expected — every existing write there is strictly local/single-writer; this Arc is
the FIRST time an externally-originated, potentially-out-of-order fact enters this domain):

- **Identity Transition** (`fedos_identity_transition_fact_conflict_detection.ts`) — full
  shape: `revision: number` (monotonic) + `previousTransitionId` predecessor chain +
  derived `conflictState`/`supersededByTransitionId`. Rollback = `candidate.revision &lt;=
  maxRevisionSoFar`. Cycle-detection over the predecessor chain.
- **Delivery Observation** (`fedos_delivery_observation_write_validator.ts`) — lighter
  shape: a frozen transition-graph table plus a pure timestamp-only staleness check
  (`candidate.observedAt &lt; current.observedAt`).

**Decision (carried into Phase C/G): the lighter, Delivery-Observation-shaped model,
adapted to use an explicit `revision: number` instead of a raw timestamp** (a suppression
fact's `revision` is the ORIGINATING device's own retention-decision sequence for that
subject, not a wall-clock value, since clocks across Devices are not assumed synchronized).
Rollback/conflict = `candidate.revision &lt;= maxRevisionSoFar` for the same subject+source,
mirroring Identity Transition's own exact rule but WITHOUT the full predecessor-chain/
cycle-detection machinery — a suppression fact has no "lineage" to walk (it is a flat,
per-subject monotonic fact, not a chained identity-history record), so the added complexity
of a predecessor chain is not justified for this Arc's own narrow scope.

## 9. Device Registry, Trust, Pairing (from Phase A research pass 2)

- Registry: `FedosDeviceBindingV1` (`fedos_device_binding.ts:53-66`) —
  `deviceId, accountRef{authority,publicIdentifier,identityId}, devicePublicKeyRef:
  string|null, trustState, revokedAt`. Trust states: `"pending"|"trusted"|"revoked"|
  "unavailable"` — `"revoked"` is TERMINAL, no further transition possible. Durable,
  append-only (`AppendOnlyFedosDeviceRegistryPersistence`), fail-closed on corruption.
- Synchronous evaluator: `PersistedFedosDeviceTrustAuthority.isDeviceTrusted(deviceId):
  boolean` (`persisted_fedos_device_trust_authority.ts:188-190`) — reads the durable
  binding directly, no caching, immediately reflects revocation.
- Device signing keypair: `FedosDeviceSigningKeypair` (`fedos_device_signing_keypair.ts`)
  — real secp256k1/Schnorr via `@noble/curves`, **confirmed process-memory-only, never
  durably stored** (explicit header: "no durable storage for a Device's own secret" — an
  already-accepted, named limitation, not something this Arc changes). Production caller
  (`FedosDesktopApplicationShell`) holds it in an in-process `Map`, cleared after pairing
  completes.
- Domain-separated device-signature precedent, reused identically by this Arc (Phase D):
  Device Binding proof-of-possession, Ratchet Peer Capability advertisement, Ratchet
  Session Reset, Identity Transition Device Corroboration — each defines its own fixed
  digest prefix and calls `FedosDeviceSigningKeypair.sign()`/`verifyFedosDeviceSigningSignature()`
  directly. **This Arc adds its own new prefix, following this exact, repeated pattern —
  never inventing a new signing primitive.**

## 10. Device Sync — schema, transport, reachability (from Phase A research pass 2)

Two distinct "sync journal"-shaped things exist; precision matters:

- **(a) Generic per-account change journal**, `FedosSyncJournal` (`fedos_sync_journal.ts`,
  Alpha 2421-2500) — entry: `{sequence, changeId, accountRef, originDeviceRef,
  conversationId, kind:"upsert"|"tombstone", contentHash, recordedAt}` — never carries
  content bytes, only an opaque `contentHash`. A separate, ADDITIVELY EXTENSIBLE allowlist,
  `reviewFedosSyncRecordForJournal()` (`fedos_sync_record_allowlist.ts:89-104`), gates what
  `recordType`s may enter the Journal at all: `"conversation-identity-metadata" |
  "membership-metadata" | "capability-public-event" | "retention-tombstone-fact" |
  "archive-reference" | "search-canonical-id"` — closed but extensible without touching the
  Journal's own frozen entry shape. `"retention-tombstone-fact"` is the closest existing
  precedent name. **This Arc adds one new allowed `recordType`,
  `"suppression-fact"`, to this list — the additive extension point this codebase's own
  convention explicitly anticipates.**
- **(b) Device Relay Sync** (`src/device/relay_sync/`, Alpha 3641-3720) — NOT a generic
  journal; a single-purpose, whole-Device-Transfer-package relay
  (`FedosDeviceRelaySyncWirePayloadV1` carries one opaque `encryptedPackageBase64` blob).
  Real signing (`FedosNostrSigningAuthority.signEvent()`) and real multi-relay publish with
  per-relay OK-correlation exist (`FedosDeviceRelaySyncOutboundCoordinator`,
  `FedosDeviceRelaySyncPublisher`, and a real inbound handler) — but **zero production
  construction sites exist anywhere in `fedos_desktop_runtime.ts`**; the only construction
  sites found repo-wide are in `test/secure_runtime_alpha_3641_3720_*` files.
- **Reachability, confirmed precisely**: `FedosDeviceSyncScheduler`'s production
  construction (`fedos_desktop_runtime.ts:1246-1261`) defaults `attemptFn` to `async () =&gt;
  ({outcome:"failed"})` whenever `config.deviceSyncAttemptFn` is not supplied — "this
  runtime constructs no real Relay Sync attempt of its own... every tick's own attempt
  fails closed, never fabricating 'delivered'." **This is a pre-existing, already-disclosed,
  general Device Sync reachability gap — not something this Arc discovers new, and not
  something this Arc's own narrow scope fixes** (fixing it generally, for every
  `recordType`, is a separate, wider reachability Arc, analogous to how "Desktop
  Production Feature Reachability Arc 7321-7400" was its own dedicated Arc). This Arc's own
  Phase K vertical slice instead directly constructs the REAL, tested
  `FedosDeviceRelaySyncOutboundCoordinator`/inbound-handler classes as a concrete
  `attemptFn` implementation, to prove genuine multi-Device propagation works end-to-end —
  exactly mirroring how the prior Arc's own Phase I proved real Outbox/Scheduler behavior
  via direct class construction. Packaged (`fedos_desktop_runtime.ts`-default) reachability
  is honestly disclosed as unchanged by this Arc (see the completion declaration).
- Revocation is **already** enforced live at multiple existing call sites this Arc's own
  mechanism will ride through automatically (no new revocation logic needed): Ratchet
  device-pair resolution, `FedosDeviceTrustRuntime.registerSyncDevice()`/
  `recordLocalChange()` (refuses a non-`"trusted"` `originDeviceRef` before the Journal is
  ever touched), Device Sync target planning (`fedos_device_sync_target_planning.ts:55`,
  filters to `trustState === "trusted"`), and `FedosDeviceRelaySyncOutboundCoordinator`
  itself (checks both source and target `trustState` live before publishing).

## 11. Private control-payload conventions (NIP-17) — considered and set aside

`FedosPrivateTransport.sendMailboxNip17Control()` is real, production-wired, but is
**Conversation-counterparty-scoped** (resolves a Direct-mode route to the *other party* in
a shared Conversation) — structurally the wrong shape for a fact that must reach *one's
own* other Devices (a self-addressed problem, matching Device Sync's own `["p",
accountPublicIdentifier]` self-tag convention, not the NIP-17 control channel's two-party
assumption). **Decision: this Arc uses Device Sync exclusively, not the NIP-17 control
channel**, per Phase B's own "preferred scope" framing (own-account Device Sync only) and
this structural mismatch.

## 12. Identity Transition / Device Registry interaction — real, unresolved edge case, scoped out

No code path migrates or re-keys existing Device Bindings' `accountRef` when an Identity
Transition occurs; `FedosIdentityTransitionDownstreamPlanV1` never mentions the Device
Registry. **Decision: explicitly out of scope for this Arc** (named as a declared
limitation, not silently ignored) — a suppression fact created/consumed across an Identity
Transition boundary is not guaranteed to reach the same set of Devices; Phase B's threat
model names this explicitly.

## Decisions this report makes, carried into Phases B onward

1. **Assigned Alpha range: 7721-7800.**
2. **V1 scope: own-account Device Sync only** (Phase B's own "preferred scope"), confirmed
   supported by source (§11) — Signed Deletion Request/Ack remains separate evidence, never
   auto-converted (§5, Phase L).
3. **New, separate "Imported Suppression Observation" log** — never merged into the local
   Retention Authority's own decision log (§6/§3 decision), satisfying "local decision and
   imported observation remain distinguishable" by construction.
4. **Conflict model: flat, per-subject monotonic `revision`, Delivery-Observation-shaped
   staleness check** — not Identity Transition's full predecessor-chain model (§8).
5. **Transport: Device Sync Journal, new additive `"suppression-fact"` recordType** (§10) —
   not the NIP-17 control channel (§11), not a new transport.
6. **Authentication: Device Registry trust-state + account-scoping (structural, from
   Sync's own accountRef-keying) + best-effort Device-signature evidence when a
   `devicePublicKeyRef` is available**, mirroring Peer Capability's own accepted
   evidence-level pattern (§9) — never a hard requirement for a Device-level signature,
   since most bindings have `devicePublicKeyRef: null` today (pre-existing, unchanged fact).
7. **Production wire-transport reachability**: honestly unchanged by this Arc
   (`deviceSyncAttemptFn` remains caller-injected, defaults to fail-closed) — proven via
   direct construction of the real Coordinator/Handler classes in Phase K, not via a
   production Runtime wiring change (§10).
8. **Identity Transition interaction: explicitly out of scope, named as a declared
   limitation** (§12).

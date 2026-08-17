# Rollback / Deletion / Identity Red Team — Old-Backup-Restore Adversarial Analysis

Agent C. Pure static analysis, no build/test run. All line numbers verified by direct read on
`arc/fedos-disaster-recovery-portable-backup` (worktree `C:/wt/disaster-recovery-portable-backup`).

## 0. Architecture note that changes how to read the mission's own file list

The mission names `deletionRequestExecutionLogFile`/`deletionRequestStateLogFile` as the logs whose
rollback could "undelete" content. Having read the actual execution path, that is not quite where the
real effect lives:

- `deletionRequestExecutionLogFile` (`deletion-request-execution.ndjson`) and `deletionRequestStateLogFile`
  (`deletion-request-state.ndjson`) are **bookkeeping/lifecycle** logs for the signed request/ack protocol
  (`fedos_deletion_request_state_persistence.ts`, `append_only_fedos_deletion_request_state_persistence.ts`).
- The actual local deletion **effect** (whether a payload's bytes are readable) is decided entirely by
  `FedosPayloadRetentionAuthority#currentState()` in
  `src/os/messenger/conversations/retention/fedos_payload_retention_authority.ts:107-111`, which is driven
  by a **different** log: `conversationPayloadRetentionLogFile` (`conversation-payload-retention.ndjson`,
  `fedos_local_profile_paths.ts:195`). Both the local Deletion Capability path
  (`fedos_deletion_request_inbound_coordinator.ts:349-366`, calling
  `executeFedosLocalPayloadDeletionPlan()`/`retentionAuthority.tombstonePayload()`/`removeLocalPayload()`)
  and the recipient side of Signed Deletion write through this SAME authority.

This matters for the analysis below: a restore that touches only the two named request-protocol logs would
roll back *request status UI*, not content visibility. A restore that touches the whole profile root
(the realistic case — a "Recovery Bundle" is presumably one coherent snapshot of the profile directory)
rolls back `conversation-payload-retention.ndjson` too, and **that** is what actually undeletes content.
I analyze both.

## 1. Signed Deletion — is state monotonic, and does restoring an old snapshot silently undelete?

**`conversationPayloadRetentionLogFile` (the real effect log) — YES, silent undelete, confirmed mechanically.**

`FedosPayloadRetentionAuthority#currentState()` (`fedos_payload_retention_authority.ts:107-111`) computes
state purely from **presence** of a decision record:
```
if (this.#retentionPersistence.getDecision(payloadId, "payload-removed") !== null) return "payload-removed";
if (this.#retentionPersistence.getDecision(payloadId, "tombstoned") !== null) return "tombstoned";
return "active";
```
`AppendOnlyFedosPayloadRetentionPersistence` (`append_only_fedos_payload_retention_persistence.ts:35-52`)
derives that presence by replaying whatever `conversation-payload-retention.ndjson` currently contains on
disk — nothing else. If a machine tombstones/removes payload P at T1, then a backup snapshot taken at
T0 < T1 is later restored (replacing this file), the "tombstoned"/"payload-removed" line for P is simply
absent from the restored file. `currentState()` returns `"active"`. `evaluatePayloadAccess()` returns
`"allowed"`. `readPayload()` (`fedos_payload_retention_authority.ts:146-152`) returns the actual plaintext
bytes again. **This is a full, silent undelete from the restoring machine's own point of view** — no error,
no warning, no distinguishable "this used to be deleted" marker anywhere in this code path.

**`deletionRequestExecutionLogFile`/`deletionRequestStateLogFile` (the request-protocol logs) — narrower
effect, same underlying disease.** `AppendOnlyFedosDeletionExecutionPersistence` (planId-keyed,
`append_only_fedos_deletion_execution_persistence.ts:36-53`) and
`AppendOnlyFedosDeletionRequestStatePersistence` (requestId-keyed, latest-snapshot-wins,
`append_only_fedos_deletion_request_state_persistence.ts:38-57`) both replay *only whatever bytes are
currently in the file*. Restoring an old copy of either makes a completed request/plan appear to never
have finished (e.g. `getRecord()` returns `null` or an earlier `lifecycleState`). This does not by itself
resurrect payload bytes (see §0), but it does desynchronize the UI/audit trail from the real
`conversationPayloadRetentionLogFile` state, and — worse — `executeApprovedLocalDeletionById()`
(`fedos_deletion_request_inbound_coordinator.ts:294-301`) and `rejectReceivedDeletionRequest()`
(`:314-325`) gate on `recipientDecisionPersistence` state (a THIRD log,
`deletionRequestDecisionLogFile`), so an inconsistent partial restore across these sibling logs can also
put the recipient-side state machine in a state a live system could never reach (e.g. `"policy-pending"`
resurrected after it was already `"locally-applied"`), potentially allowing a **second** execution of an
already-granted deletion request — harmless in this case (deletion is idempotent) but the same pattern
is exactly how a rollback becomes dangerous for a non-idempotent operation.

**Does `fedos_deletion_non_guarantees.ts` already admit this?** No. Its seven codes
(`fedos_deletion_non_guarantees.ts:23-30`) are: `no-remote-erasure`, `no-relay-deletion`,
`no-physical-erasure`, `no-secure-wipe`, `backup-may-remain`, `remote-device-may-remain`,
`no-deleted-everywhere`. Every one of them is about an **external, passive, never-re-merged** copy —
`"backup-may-remain"`'s own text (`:58`) is "Any separate backup ... is not affected by this action,"
i.e. it assumes the backup just sits there inert. None of them describe re-importing that backup's state
**back onto a live device** and having it silently override the live device's own later, more-advanced
deletion facts. This is a genuinely new gap, not a restatement of an admitted one.

## 2. Identity Transition — can restore roll back an ACCEPTED transition?

Two separate durable facts drive `computeFedosIdentityTransitionAcceptanceState()`
(`fedos_identity_transition_acceptance_state.ts:100-109`): the observation's baked-in `evidenceOutcome`
(written once, at receipt time, into `identityTransitionObservationLogFile`) and an **explicit local
decision** fact (`identityTransitionLocalDecisionLogFile`, only relevant when `evidenceOutcome` isn't
already `"locally-acceptable"` — see `baseAcceptanceStateFor()`, `:62-93`).

`AppendOnlyFedosIdentityTransitionLocalDecisionPersistence.putDecision()`
(`append_only_fedos_identity_transition_local_decision_persistence.ts:60-75`) enforces a monotonic
`revision` **only against whatever is currently in the file being written to** — `stale-revision` at
line 68 compares against `maxRevision` computed by replaying the *current* file, not any external
high-water mark. Restoring an older copy of this file just makes an older revision (or "none") the
new "latest" on next read (`getLatestDecision()`, `:77-81`, takes `max` over whatever lines exist).

So: yes, restoring a backup taken before a user explicitly accepted a peer's rotation (or before that
peer's transition was even observed) reverts `acceptanceState` from `"accepted"` back to whatever the
base evidence state was (`"corroborated"`/`"manual-review-required"`/etc., per `:62-93`) — **by itself**
this fails toward re-review, i.e. scenario (b) (a legitimately-rotated peer looks unverified again), which
is annoying but safe, since `FINAL_ACCEPTANCE_STATES` (`:52-58`) can never be silently promoted back to
`"accepted"` by anything automatic.

**Scenario (a) — trusting a since-rotated-away stale identity — requires a second, cross-log condition**:
`authorizeIdentityTransitionRatchetReset()` (`fedos_identity_transition_ratchet_reset_authorization.ts:72-112`)
is "the ONE function in this Arc that mutates Ratchet state" (header, `:9`) and it writes to
`directRatchetSessionLogFile`/`directRatchetSessionRecord`, a **sibling log under the same profile root**
(`fedos_local_profile_paths.ts:83`) that identity_transition code does not itself gate on. A whole-profile
Recovery Bundle restore rolls this log back too. If the backup predates the accept+ratchet-reset sequence,
restoring it puts the live Ratchet session back to pointing at the OLD (rotated-away, possibly
compromised — that's usually *why* someone rotates) identity, with no local memory that this ever changed.
A message that decrypts under that old session now looks completely legitimate to the restoring device.
**This is the worse outcome**: it is a silent security downgrade that hands back the exact trust the
rotation was meant to revoke, versus scenario (b) which only costs the user a re-verification click.

## 3. Device Trust — revoked device reappears as trusted?

Confirmed exactly as suspected, mechanically:

- `"revoked"` is a durable **event**, keyed `deviceId:"revoked"` (`fedos_persisted_device_binding_event_v1.ts:54-56`,
  "fires at most once per binding").
- `AppendOnlyFedosDeviceRegistryPersistence` (`append_only_fedos_device_registry_persistence.ts:47-67`)
  reconstructs the binding purely by replaying whatever events are **currently in the file**.
- `reconstructFedosDeviceBindingRecord()` (`fedos_device_registry_persistence.ts:51-95`) applies events in
  the order found; if the `"revoked"` event line is absent (because the restored file predates it), the
  fold simply never reaches `revokeFedosDeviceBinding()` (`:91`), and the binding stays whatever
  `"trusted"`/`"pending"` state the earlier events left it in.
- `PersistedFedosDeviceTrustAuthority.isDeviceTrusted()` (`persisted_fedos_device_trust_authority.ts:188-190`)
  and `FedosDeviceTrustRuntime.isDeviceTrusted()` (`fedos_device_trust_runtime.ts:148-150`) both read
  straight through this reconstruction with no independent check.

**Confirmed: yes**, restoring a `device-registry.ndjson` snapshot taken before Device X's revocation makes
`isDeviceTrusted(X)` return `true` again on the restoring machine — and `registerSyncDevice()`
(`fedos_device_trust_runtime.ts:152-156`) and `recordLocalChange()` (`:163-178`) both gate solely on that
same boolean, so a "revoked" device could rejoin sync fan-out and have its changes accepted into the
Journal again, post-restore.

**Is there ANY existing monotonicity/tombstone/logical-clock mechanism that could detect this?** No —
confirmed absent by direct inspection, not inferred. `FedosPersistedDeviceBindingEventV1`
(`fedos_persisted_device_binding_event_v1.ts:20-51`) carries only wall-clock timestamps
(`registeredAt`/`trustedAt`/`revokedAt`) that are **descriptive only** — nothing in
`append_only_fedos_device_registry_persistence.ts` or `fedos_device_registry_persistence.ts` compares them
against a stored high-water mark, a monotonic counter, or a prior-observed-event-count. There is no
sequence number, no hash-chain, no vector clock anywhere in this file tree. Detection is completely
absent today, not merely weak. This is itself worth flagging as its own finding, not folded into the
scenario line below.

## 4. Reconciliation strategy per risk, and what ordering signal actually exists today

All three of the code shapes above are **append-only event sets keyed by (subjectId, action/eventType)**,
not simple last-write-wins blobs. That shape is itself usable as a merge signal without inventing anything
new, with one exception:

- **Device Trust** (`deviceRegistryLogFile`): events are keyed `deviceId:eventType`, and each of
  `"registered"`/`"trusted"`/`"revoked"` fires **at most once ever** per binding
  (`fedos_persisted_device_binding_event_v1.ts:54-56`). A restore that takes the **line-level set union**
  of (current live file) ∪ (restored backup file), deduped by that same key — instead of replacing the
  file outright — cannot ever lose a `"revoked"` fact that either side already recorded, because union of
  sets is monotonic by construction. No new ordering signal needed; the existing keying IS the signal.
  Same reasoning applies cleanly to `conversationPayloadRetentionLogFile` (keyed `payloadId+action`,
  `fedos_payload_retention_decision.ts` via `fedosPayloadRetentionDecisionKey`) and to
  `deletionRequestExecutionLogFile` (keyed `planId`).
- **Identity Transition** (`identityTransitionLocalDecisionLogFile`,
  `identityTransitionObservationLogFile`): the existing `revision` integer (monotonic per lineage,
  enforced at `append_only_fedos_identity_transition_local_decision_persistence.ts:64-68`, and the
  `previousTransitionId` predecessor chain in
  `fedos_identity_transition_peer_observation_conflict_detection.ts:34-93`) is a real, already-present
  ordering signal. A union-of-lines merge is safe here too, since every read path already takes
  `max(revision)` over whatever set of lines it sees (`append_only_fedos_identity_transition_local_decision_persistence.ts:47-50,83-88`).
  The genuinely uncovered piece: this reconciliation only protects the identity_transition logs
  themselves — it does **not** by itself prevent the cross-log Ratchet-session staleness in §2, because
  `directRatchetSessionLogFile` has no comparable revision/lineage concept tying a session back to "the
  most recent transitionId this session was reset for." That correlation currently lives only in
  `identityTransitionRatchetResetLinkLogFile`-shaped data
  (`fedos_identity_transition_ratchet_reset_link.ts:19-27`) via `recordedAt`, itself just a wall-clock
  timestamp with no cross-file enforcement either.
- **Signed Deletion request lifecycle** (`deletionRequestStateLogFile` specifically): **no true ordering
  signal exists.** This log is not a keyed-event-set — it is a sequence of full snapshots per `requestId`
  whose legality is checked only via the closed transition graph
  (`fedos_deletion_request_lifecycle_state.ts:67-92`) applied against whatever the *currently loaded* file
  says is latest. `recordedAt`/`issuedAt`/`expiresAt` are wall-clock only, never compared or enforced
  (`fedos_persisted_deletion_request_state_record_v1.ts:38-57`). A naive union-of-lines merge is **not**
  safe here the way it is for the keyed-event logs: interleaving an old backup's snapshot line after a
  newer live snapshot for the same `requestId` will very likely fail `evaluateFedosDeletionRequestStateWrite()`'s
  own transition check and make the append-only backend's replay **throw**
  (`append_only_fedos_deletion_request_state_persistence.ts:50-52`), i.e. a blind merge here trades a
  silent-security bug for an availability bug (log becomes unreadable). This is the one place where **no
  ordering signal exists in the current data model at all** — that absence is itself the finding, called
  out explicitly per the mission's own instruction not to paper over it.

## 5. Ranked findings

- **P0** — `conversation-payload-retention.ndjson` rollback silently undeletes payload content with no
  trace of the fact that it was ever deleted. *Scenario: user tombstones a message at T1; a Recovery
  Bundle from T0<T1 is restored at T2; `readPayload()` returns the plaintext again at T2, indistinguishable
  from a message that was never deleted.* (`fedos_payload_retention_authority.ts:107-119,146-152`)
- **P0** — `device-registry.ndjson` rollback silently re-trusts a revoked device, with zero detection
  mechanism of any kind present in the code today. *Scenario: Device X is revoked at T1 after a suspected
  compromise; a backup from T0<T1 is restored at T2; `isDeviceTrusted(X)` returns `true`, and X can
  `registerSyncDevice()`/have `recordLocalChange()` accepted again.*
  (`append_only_fedos_device_registry_persistence.ts:47-67`, `fedos_device_registry_persistence.ts:51-95`)
- **P0** — cross-log identity-transition + ratchet-session rollback re-legitimizes a rotated-away
  (attacker-controlled) identity. *Scenario: peer rotates identity after key compromise; user accepts and
  the Ratchet session is reset at T1; a whole-profile backup from T0<T1 is restored at T2; the live Ratchet
  session again targets the OLD identity and a message under the old (compromised) key decrypts as
  legitimate.* (`fedos_identity_transition_ratchet_reset_authorization.ts:72-112` mutating a sibling log
  `fedos_local_profile_paths.ts:83` that identity_transition's own acceptance-state read path never checks)
- **P1** — `deletionRequestStateLogFile` has no ordering signal at all and cannot be safely merged by
  simple set-union; a naive reconciliation attempt throws rather than silently misbehaving, but a design
  that assumes "union of lines is always safe" (true for the other logs here) will break specifically on
  this one. *Scenario: Agent A's restore path applies the same union-merge strategy uniformly across all
  NDJSON logs; this file's replay throws on the very first out-of-order snapshot, taking down request-state
  loading entirely.* (`append_only_fedos_deletion_request_state_persistence.ts:50-52`)
- **P1** — restoring only `deletionRequestExecutionLogFile`/`deletionRequestStateLogFile` (without also
  rolling back `conversationPayloadRetentionLogFile`) desynchronizes the recipient-side decision state
  machine from the real payload state, potentially allowing an already-`"locally-applied"` request to look
  `"policy-pending"` again and be re-executed. Idempotent today, but the same code shape as a future
  non-idempotent recipient action would not be. (`fedos_deletion_request_inbound_coordinator.ts:264-278,294-301`)
- **P2** — `fedos_deletion_non_guarantees.ts`'s fixed vocabulary has no code for "restoring your own old
  backup can undo a local deletion" (as opposed to "a separate backup exists and is untouched"); low
  runtime impact by itself, but means today's honest-non-guarantee UI text would actively mislead a user
  about exactly this scenario if a restore feature ships before this vocabulary is extended.
  (`fedos_deletion_non_guarantees.ts:23-30,53-61`)

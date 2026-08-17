# Own-Device Sync — Current Architecture, Reframing, and Canonical Model Decision

**Consolidates mandate docs 01-03 and 06** (`01_CURRENT_OWN_DEVICE_MODEL.md`,
`02_SECOND_DEVICE_GAP.md`, `03_DEVICE_AUTHORITY.md`, `06_CANONICAL_MODEL_DECISION.md`)
into one document — the findings are tightly coupled and splitting them added
boilerplate, not clarity, under this arc's own time budget. Docs 04/05/07/08/09
remain separate (see sibling files).

## The central correction to this mandate's own framing

The mandate's own §0/§1 frames this as choosing between two competing, unreconciled
models — "whole-snapshot" vs "sequence-ranged facts" — as if the choice were still
open. **It is not.** Direct source investigation (not inferred) shows the current
codebase already implements BOTH models correctly, for two genuinely different jobs,
and the "incompatibility" the prior arc found is not a modeling ambiguity — it's that
someone tried to plug the wrong existing coordinator into the Scheduler.

### Job 1: Device Registry (trust inventory) sync — whole-snapshot, already correct

`FedosDeviceRelaySyncOutboundCoordinator` (Alpha 3641-3720) + `FedosDeviceSyncSessionV1`
(Alpha 3321-3400) sync exactly one thing: **which devices does my account currently
trust**, as a full point-in-time snapshot (`FedosDeviceSyncSessionDeviceEntryV1[]`,
sorted, re-validated against the live Registry on open — never trusted stale). This
is inherently snapshot-shaped: trust state is a "what's true right now" fact, not
naturally an append log. This mechanism is real, fully wired, tested (two full test
files, `secure_runtime_alpha_3641_3720_device_relay_sync_{outbound,inbound}.test.ts`),
and used correctly by the already-proven second-device pairing flow. **This does not
need fixing — it is not the gap.**

### Job 2: Application-data sync — sequence-fact log, real and sophisticated, but has NO transport

A second, entirely separate, more general subsystem already exists for account-scoped
application data: `FedosSyncJournal` (append-only, monotonic sequence, `changeId`
dedup) → `FedosSyncState` (per-device cursor, pending-change queue, outbound fan-out)
→ `FedosDeviceSyncImportCoordinator` (re-classifies every apply result through a
richer, Registry-trust-aware/record-allowlist-aware conflict vocabulary, durably
records anything not a clean apply as a Conflict fact) → `FedosDeviceSyncScheduler`
(restart-safe, single-flight, retry/abandonment policy, resource-bounded target
planning by `fromSequence`/`toSequence` range). Every one of these is real, already
implemented, already tested. The record-type allowlist
(`fedos_sync_record_allowlist.ts`) already excludes exactly the data this mandate's
§14 asks to be excluded — conversation-identity-metadata, membership-metadata,
capability-public-event, retention-tombstone-fact, archive-reference,
search-canonical-id are IN; plaintext messages, private keys, Master Seed, Sender-Key
secrets, passphrases are explicitly OUT, enforced by a sensitive-marker scan that
fails closed on unknown record types by default.

**The actual, sole gap**: `FedosDeviceSyncScheduler`'s injected `FedosDeviceSyncAttemptFn`
(the one thing that must actually MOVE bytes between two physical devices) has never
been implemented for real. The prior arc found the packaged main process calls
`eventBridge.wrapAttemptFn()` with zero arguments, so a fail-closed stub runs forever.
Investigating the "why wasn't it just wired to the existing coordinator" question
(this mandate's own premise) revealed the reason: `FedosDeviceRelaySyncOutboundCoordinator`
is Job 1's coordinator (whole Registry snapshot) — it has no concept of a
`fromSequence`/`toSequence` range because Job 1 doesn't need one. Wiring it into
Job 2's Scheduler was never going to work; it's the wrong tool, not evidence the two
models are unreconciled.

## Canonical model decision

**HYBRID — Option C, already established by the existing architecture, not chosen
fresh by this arc.**

| Concern | Winner | Why |
|---|---|---|
| Device trust inventory | Snapshot (Job 1) | Inherently "current state," small, bounded, already correct |
| Account-scoped app data | Fact-log (Job 2, Sync Journal) | Needs incremental delivery, gap detection, per-device cursor, conflict classification — all already built for this shape |
| Authority clarity | Both derive from same-account Device Registry trust — never a new authority | Confirmed: `FedosDeviceRelaySyncOutboundCoordinator` checks `sourceBinding.trustState === "trusted"` + account match before touching a Relay; `FedosDeviceSyncImportCoordinator` re-checks the ORIGIN device's live trust state per-entry, catching a since-revoked origin the base Journal classifier can't see |
| Rollback resistance | Fact-log: monotonic sequence + `changeId` dedup, native duplicate/replay safety. Snapshot: re-validated against live Registry on every open, so a stale cached snapshot self-heals | Both already proven in existing tests |
| Testability | Both already have dedicated test suites | N/A, pre-existing |

This is not a fresh, ambiguous decision this arc had to make — it is the decision the
codebase's own prior arcs (Alpha 2421-2500 through 3800) already made and built,
correctly, twice, for two different jobs. This arc's own contribution is identifying
that the "missing wiring" is: **Job 2 needs its own dedicated transport (a new,
additive `attemptFn` implementation), built by mirroring Job 1's own proven
wire-format/crypto/publish pattern — never by trying to reuse Job 1's coordinator
directly.**

## Account/Device authority (mandate §5)

Confirmed, both jobs: account admission derives exclusively from the already-proven
same-account signing authority (`FedosNostrSigningAuthority`) + the Device Registry's
own trust state (`FedosDeviceRegistryPersistence`) — no relay, no scheduler, no
transport layer is ever treated as authority. Wrong account and wrong/untrusted device
are rejected before any network I/O in both `FedosDeviceRelaySyncOutboundCoordinator.prepareAndPublish()`
and `FedosDeviceRelaySyncInboundHandler.handleIncomingEvent()`. No central service
exists or is proposed (mandate §33 honored by construction — there was never a
candidate design that needed one).

## Second-device admission gap (mandate §6, corrected)

Contrary to a literal reading of the mandate's own §6 header ("Second-Device Gap"),
device *pairing/admission* is not the gap — it was already proven solid by the prior
arc (2/2 real installed-binary tests, wrong-account fail-closed negative). The real
gap is narrower and different: **post-admission application-data sync has no live
transport**, exactly as scoped above.

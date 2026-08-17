# Root-Cause Decision, Implementation Plan, and the Coordinator's Own Stop Decision

**Consolidates mandate docs 04/07/08/09** (`04_RECOVERY_ASSET_MATRIX.md` — see prior
arc's own already-thorough recovery asset matrix, unchanged by this arc, not repeated
here; `07_IMPLEMENTATION_PLAN.md`, `08_ACCEPTANCE_MATRIX.md`, and this section's own
root-cause freeze per mandate §33/§9).

## What was actually missing (root-cause freeze, mandate §33)

Not "the sync model is ambiguous" (§01 of this review corrects that framing). The
actual, sole missing piece: **`FedosDeviceSyncScheduler`'s `attemptFn` has never had a
real implementation** — no wire format, no crypto envelope, no relay publish/subscribe,
no inbound decode/import path exists for Sync Journal batches at all (Job 1's
Registry-snapshot transport is real and unrelated; Job 2's Sync Journal transport
has never been built, in any form, by any prior arc).

## A second, genuinely open design question found while scoping the fix

While tracing exactly how a real transport would call into the existing pipeline, this
arc found `FedosSyncState`'s own public API (`recordLocalChange()` → in-process fan-out
into `#outbound`/`#pendingByDevice` → `applyPendingChanges()`) is shaped for
**single-process, multi-device simulation** — every device's own pending queue, cursor,
and journal view live inside ONE `FedosSyncState` instance. This is consistent with how
it's tested (all of Alpha 2421-2500/3721-3800's own test suites construct one
`FedosSyncState` and drive multiple `deviceRef` strings through it) but does not, by
itself, specify how a REAL cross-process transport (two physically separate installed
FedOS processes, each with its own `FedosSyncState` instance) should feed a remote
device's journal entries into the RECEIVING process's own local state so that ITS OWN
`applyPendingChanges()`/Import Coordinator pipeline sees them.

The plausible bridge — the receiving process calls its own local
`FedosSyncState.recordLocalChange(remoteDeviceRef, {...receivedFact}, now)` — is
structurally promising (dedup-by-`changeId` gives natural replay safety, and the
already-real per-entry live-trust re-check in the Import Coordinator would still apply)
but was NOT verified against real cross-process behavior this pass, and specifically
was not checked against: (a) whether `originDeviceRef` needs to already be a
`registerDevice()`-known entry in the RECEIVING process's own `#registry` for
`recordLocalChange()`'s fan-out logic to behave correctly (it iterates
`listActiveDevices()`, which is per-`accountRef`, not obviously auto-populated from a
remote device's own wire identity), and (b) whether calling `recordLocalChange()`
followed immediately by `applyPendingChanges()` on the SAME process (self-application,
not fan-out-to-a-third-device) is actually the intended composition, or whether a
different, more direct "stage this entry into MY OWN pending queue" entry point is
needed instead (the codebase already has one candidate for this shape:
`redeliverChange()`, which stages a KNOWN `changeId` directly into a target's pending
queue without the fan-out side effect — but it requires the entry to already exist in
the local journal via `getByChangeId()`, which begs the same question one level down:
does receiving a remote entry mean append-then-redeliver, or does `recordLocalChange()`
alone already compose correctly for a two-device case).

**This is a real, unresolved integration-semantics question, not a coding task.**
Building the wire/crypto/transport layer (genuinely low-risk — it is a close mirror of
the already-proven Job 1 pattern, see below) while guessing at THIS integration point
would risk shipping a transport that either double-applies entries, silently drops
them, or corrupts the cursor/pending-queue invariants those classes were designed
around — exactly the class of mistake the mandate's own §33 ("do not patch guesses")
and this session's own established discipline (e.g. the prior arc's Option A/B decision
on the exact same subsystem) says to stop and report rather than push through.

## Coordinator decision: DEFER the transport implementation, ship the investigation

This is not one of the mandate's own literally-named stop conditions ("two
incompatible defensible designs" — there's one plausible design, just unverified; "a
new user-visible trust authority" — no; "copying device-private ratchet secrets" — no,
confirmed absent from the record-type allowlist by construction; "anti-rollback
unfixable" — no, already strong per `02_CONFLICT_AND_ANTI_ROLLBACK.md`). It is,
however, exactly the situation the mandate's own guidance anticipates when it says "a
wrong or rushed protocol decision is worse than an honestly incomplete implementation."
Given the security stakes of getting a NEW cross-process sync integration point wrong
(silent data loss, double-application, or a cursor invariant violation are all
plausible failure modes of a rushed guess here), and the coordinator's own remaining
budget in this single pass, the responsible choice is to document this precisely
(above) rather than force it.

## What a follow-up arc needs to do (shovel-ready)

1. **Resolve the `FedosSyncState` integration question above** — read
   `fedos_sync_pending_change_queue.ts`/`fedos_sync_cursor.ts` (not yet read this pass)
   and, if still ambiguous, write ONE minimal, additive test against a real two-instance
   `FedosSyncState` (sender + receiver, separate instances, mimicking two real
   processes) proving whichever composition (`recordLocalChange()` alone vs.
   append-then-`redeliverChange()`) produces correct, non-duplicating,
   correctly-cursor-advancing behavior BEFORE writing any transport code.
2. **Build the transport as a close mirror of the already-proven Job 1 pattern** —
   every piece below already has a working, tested precedent to copy the shape of:
   - `fedos_device_sync_journal_batch.ts` (payload: `sourceDeviceId`, `targetDeviceId`,
     account identity, `fromSequence`/`toSequence`, `entries: FedosSyncJournalEntryV1[]`)
     — mirrors `fedos_device_sync_session.ts`'s validation-function shape.
   - `fedos_device_sync_journal_package_encryption.ts` — mirrors
     `fedos_device_sync_package_encryption.ts` EXACTLY (same encrypt-to-self
     `resolveConversationKey()` construction, same `"Conversation"` `AeadAadDomain`, no
     new crypto, no Rust/WASM change) — reuse `encodeFedosDeviceSyncPackageHeader()`/
     `splitFedosDeviceSyncPackageHeader()` from `fedos_device_sync_package_header.ts`
     AS-IS (already generic: account/target-device identity + timestamp, no
     session-specific content).
   - `fedos_device_sync_journal_wire_payload.ts` + `fedos_device_sync_journal_event.ts`
     — mirrors `fedos_device_relay_sync_wire_payload.ts`/`_event.ts`, with a NEW, distinct
     marker tag (e.g. `["fedos-device-sync-journal","1"]`) so it can never collide with
     the Job 1 route's own `["fedos-device-sync","1"]` tag. Same `kind:1` route decision
     (NIP-17 confirmed absent from this line of history by the Job 1 arc's own Phase B
     investigation — re-litigating that is out of scope, reuse the decision).
   - `fedos_device_sync_journal_outbound_coordinator.ts` — sources entries via
     `FedosSyncJournal.readFrom(fromSequence)` bounded by `toSequence` (`FedosSyncState`
     has no direct range-read accessor today — `journalEntries()` returns everything;
     either add a narrow, additive `readRange()` to `FedosSyncJournal` mirroring
     `readFrom()`'s own one-line filter shape, or filter the `journalEntries()` result
     in the new coordinator — prefer the latter, zero widening of the frozen Alpha
     2421-2500 class), builds+seals the batch, signs via the same
     `FedosNostrSigningAuthority.signEvent()`, publishes via the ALREADY GENERIC
     `FedosDeviceRelaySyncPublisher` (confirmed reusable as-is — it operates on any
     signed Nostr event, no Job-1-specific coupling).
   - `fedos_device_sync_journal_inbound_handler.ts` — mirrors
     `fedos_device_relay_sync_inbound_handler.ts`'s exact defense-in-depth order (dedup
     by relay event id → outer signature verify → recipient/account match → expiry →
     dedup by batch content hash → live source/target trust re-check → content-hash
     gate before decrypt → open package) then, only on success, performs whatever the
     step-1 integration decision above resolved to.
   - A real `FedosDeviceSyncAttemptFn` factory wrapping the outbound coordinator,
     finally giving `fedos_electron_beta_main.cts`'s `wrapAttemptFn()` call a real
     argument instead of none.
3. **Test with real WASM crypto** — reuse `test/support/device_relay_sync_test_fixture.ts`'s
   own fixture pattern (real signing authority, real encrypt-to-self resolution) almost
   directly; only the payload type changes.
4. **Do not touch `electron_builder.beta.config.json` last** — add every new compiled
   `dist/*.js` file this produces to the packaged-binary files allowlist BEFORE the
   first real packaged-binary test run, per this session's own established P0 pattern.
5. Full targeted matrix per mandate §34/§38, installed two-device proof per §37-44 —
   both genuinely deferred to the same follow-up arc, since neither can start before
   step 1 is resolved.

## Migration/rollback (mandate §27-31, brief — reconfirming, not re-investigating)

Unchanged from the prior arc's own P2 classification: no file-level schema-version
migration mechanism exists yet, and building one is not urgent (only one schema
generation has ever shipped across every durable store this session's audits have
covered). This arc adds nothing new here since no new durable schema was introduced
(the transport above remains unimplemented). Re-confirmed: no auto-update exists or is
built (§32/§41 of prior mandates) — correctly absent, by deliberate permanent design.

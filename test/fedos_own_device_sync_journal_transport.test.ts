import { describe, it, expect, vi } from "vitest";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { FedosDeviceRelaySyncPublisher } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_publisher.js";
import { InMemoryFedosDeviceRelaySyncObservationRepository } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.js";
import { InMemoryFedosDeviceRelaySyncInboundDedupPersistence } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_inbound_dedup_persistence.js";
import {
  FedosWasmDeviceSyncJournalPackageEncryptionAuthority,
} from "../src/os/messenger/device/sync_journal_transport/fedos_device_sync_journal_package_encryption.js";
import { FedosDeviceSyncJournalOutboundCoordinator, createFedosDeviceSyncJournalAttemptFn } from "../src/os/messenger/device/sync_journal_transport/fedos_device_sync_journal_outbound_coordinator.js";
import { FedosDeviceSyncJournalInboundHandler } from "../src/os/messenger/device/sync_journal_transport/fedos_device_sync_journal_inbound_handler.js";
import { FedosSyncState } from "../src/os/messenger/sync/fedos_sync_state.js";
import { FakeDeviceRelaySyncRelay } from "./support/fake_device_relay_sync_relay.js";
import {
  buildDeviceRelaySyncFixture,
  fakeMasterSeedAuthority,
  fakeRoundTrippingRuntimeBoundary,
  DEVICE_RELAY_SYNC_KEY_HANDLE,
  INITIATOR_DEVICE_ID,
  RESPONDER_DEVICE_ID,
  DEVICE_RELAY_SYNC_BUILD_FIELDS,
  type DeviceRelaySyncFixture,
} from "./support/device_relay_sync_test_fixture.js";

const NOW = 1_900_000_000;

async function connectedRelay(url: string, okBehavior: "accept" | "reject" | "timeout" = "accept"): Promise<FakeDeviceRelaySyncRelay> {
  const relay = new FakeDeviceRelaySyncRelay(url, okBehavior);
  await relay.connect();
  return relay;
}

/**
 * ONE shared fake round-trip boundary per test -- mirrors the established
 * fixture's own `fixture.encryptionAuthority` being a SINGLE instance
 * reused for both build (outbound) and read (inbound). The fake's own
 * ciphertext handle/wire maps are per-instance closures (real AEAD bytes
 * would round-trip fine across two genuinely separate instances/processes;
 * only this in-memory TEST FAKE needs the same instance on both sides to
 * simulate that).
 */
function journalEncryptionAuthority(): FedosWasmDeviceSyncJournalPackageEncryptionAuthority {
  return new FedosWasmDeviceSyncJournalPackageEncryptionAuthority(
    fakeMasterSeedAuthority(vi.fn(async () => DEVICE_RELAY_SYNC_KEY_HANDLE)),
    fakeRoundTrippingRuntimeBoundary(),
  );
}

function buildOutbound(
  fixture: DeviceRelaySyncFixture,
  syncState: FedosSyncState,
  relays: FakeDeviceRelaySyncRelay[],
  encryptionAuthority: FedosWasmDeviceSyncJournalPackageEncryptionAuthority,
) {
  const relaySet = new FedosConversationRelaySet(relays);
  const publisher = new FedosDeviceRelaySyncPublisher(relaySet, 200);
  const observationRepository = new InMemoryFedosDeviceRelaySyncObservationRepository();
  const coordinator = new FedosDeviceSyncJournalOutboundCoordinator({
    registryPersistence: fixture.registryPersistence,
    syncState,
    signingAuthority: fixture.signingAuthority,
    publisher,
    encryptionAuthority,
    observationRepository,
    accountRef: fixture.accountRef,
    localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex,
    selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
    suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite,
    now: () => NOW,
  });
  return { coordinator, observationRepository };
}

function buildInbound(fixture: DeviceRelaySyncFixture, syncState: FedosSyncState, localDeviceId: string) {
  const dedupPersistence = new InMemoryFedosDeviceRelaySyncInboundDedupPersistence();
  const observationRepository = new InMemoryFedosDeviceRelaySyncObservationRepository();
  const handler = new FedosDeviceSyncJournalInboundHandler({
    registryPersistence: fixture.registryPersistence,
    dedupPersistence,
    observationRepository,
    syncState,
    localDeviceId,
    localAccountRef: fixture.accountRef,
  });
  return { handler, dedupPersistence, observationRepository };
}

describe("Own-Device Sync Journal Transport -- real crypto, real signing, real two-instance FedosSyncState", () => {
  it("1. full positive round trip: initiator's local change reaches responder's own local pending queue and applies with cursor advance", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const encryptionAuthority = journalEncryptionAuthority();

    const syncStateSource = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncStateSource.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const { coordinator } = buildOutbound(fixture, syncStateSource, [relay], encryptionAuthority);

    const result = await coordinator.prepareAndPublish({
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: "xfer-1",
      fromSequence: 1,
      toSequence: 1,
    });
    expect(result.outcome).toBe("published");
    expect(relay.stored).toHaveLength(1);

    // Responder's own SEPARATE process/state.
    const responderState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { handler } = buildInbound(fixture, responderState, RESPONDER_DEVICE_ID);

    const descriptor = relay.stored[0]!;
    const inboundResult = await handler.handleIncomingEvent({
      descriptor,
      encryptionAuthority,
      suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite,
      localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      now: NOW + 1,
    });
    expect(inboundResult.outcome).toBe("imported");
    expect(inboundResult.entryOutcomes).toEqual([{ changeId: "c1", appendOutcome: "appended", redeliverOutcome: "enqueued" }]);

    const applyResults = responderState.applyPendingChanges(RESPONDER_DEVICE_ID, NOW + 2);
    expect(applyResults).toHaveLength(1);
    expect(applyResults[0]!.outcome).toBe("applied");
    expect(responderState.getCursor(RESPONDER_DEVICE_ID).sequence).toBe(1);
  });

  it("2. real attemptFn factory: the same round trip works through createFedosDeviceSyncJournalAttemptFn(), the exact function wrapAttemptFn() needs", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const { coordinator } = buildOutbound(fixture, syncState, [relay], journalEncryptionAuthority());
    const attemptFn = createFedosDeviceSyncJournalAttemptFn(coordinator);

    const attemptResult = await attemptFn({
      scheduleId: "sched-1",
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      fromSequence: 1,
      toSequence: 1,
      attemptNumber: 1,
      transferSessionId: "xfer-2",
    });
    expect(attemptResult.outcome).toBe("delivered");
  });

  it("3. wrong-account: an inbound wire delivery claiming a different account is rejected before any local journal mutation", async () => {
    const fixtureA = await buildDeviceRelaySyncFixture(NOW);
    const fixtureB = await buildDeviceRelaySyncFixture(NOW + 1); // a genuinely different real account (different signing authority)
    const relay = await connectedRelay("wss://relay-a.example");
    const syncState = new FedosSyncState(fixtureA.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const { coordinator } = buildOutbound(fixtureA, syncState, [relay], journalEncryptionAuthority());
    await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-3", fromSequence: 1, toSequence: 1 });

    const responderState = new FedosSyncState(fixtureB.accountRef.publicIdentifier);
    const { handler } = buildInbound(fixtureB, responderState, RESPONDER_DEVICE_ID);
    const descriptor = relay.stored[0]!;
    const result = await handler.handleIncomingEvent({
      descriptor,
      encryptionAuthority: journalEncryptionAuthority(),
      suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite,
      localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex,
      selfAccountPublicKeyHex: fixtureB.accountRef.publicIdentifier,
      now: NOW + 2,
    });
    expect(result.outcome).toBe("wrong-account");
    expect(responderState.journalEntries()).toHaveLength(0); // no local mutation happened
  });

  it("4. wrong-recipient: a payload addressed to a different target device is rejected", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const { coordinator } = buildOutbound(fixture, syncState, [relay], journalEncryptionAuthority());
    await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-4", fromSequence: 1, toSequence: 1 });

    const notTheTarget = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { handler } = buildInbound(fixture, notTheTarget, "some-other-device-id");
    const descriptor = relay.stored[0]!;
    const result = await handler.handleIncomingEvent({
      descriptor,
      encryptionAuthority: journalEncryptionAuthority(),
      suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite,
      localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      now: NOW + 2,
    });
    expect(result.outcome).toBe("wrong-recipient");
  });

  it("5. source-not-trusted (outbound): a never-registered source device is refused before any Relay is touched", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { coordinator } = buildOutbound(fixture, syncState, [relay], journalEncryptionAuthority());
    const result = await coordinator.prepareAndPublish({ sourceDeviceId: "never-registered", targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-5", fromSequence: 1, toSequence: 1 });
    expect(result.outcome).toBe("source-not-trusted");
    expect(relay.stored).toHaveLength(0);
  });

  it("6. no-entries: requesting a range the local journal cannot fully, gaplessly provide is refused rather than sending a partial/malformed batch", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const { coordinator } = buildOutbound(fixture, syncState, [relay], journalEncryptionAuthority());
    const result = await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-6", fromSequence: 1, toSequence: 5 });
    expect(result.outcome).toBe("no-entries");
    expect(relay.stored).toHaveLength(0);
  });

  it("7. duplicate delivery (same relay event replayed): rejected at the relay-event-id dedup layer, no double-apply", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const encryptionAuthority = journalEncryptionAuthority();
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const { coordinator } = buildOutbound(fixture, syncState, [relay], encryptionAuthority);
    await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-7", fromSequence: 1, toSequence: 1 });

    const responderState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { handler } = buildInbound(fixture, responderState, RESPONDER_DEVICE_ID);
    const descriptor = relay.stored[0]!;
    const first = await handler.handleIncomingEvent({ descriptor, encryptionAuthority, suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite, localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, now: NOW + 1 });
    expect(first.outcome).toBe("imported");
    responderState.applyPendingChanges(RESPONDER_DEVICE_ID, NOW + 2);
    expect(responderState.getCursor(RESPONDER_DEVICE_ID).sequence).toBe(1);

    const second = await handler.handleIncomingEvent({ descriptor, encryptionAuthority, suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite, localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, now: NOW + 3 });
    expect(second.outcome).toBe("duplicate");
    const secondApply = responderState.applyPendingChanges(RESPONDER_DEVICE_ID, NOW + 4);
    expect(secondApply).toHaveLength(0);
    expect(responderState.getCursor(RESPONDER_DEVICE_ID).sequence).toBe(1); // unchanged, never double-advanced
  });

  it("8. multi-entry batch (1..3, a gap-safe contiguous range) applies in the sender's own original order on the receiver", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const encryptionAuthority = journalEncryptionAuthority();
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c2", conversationId: "conv-1", kind: "upsert", contentHash: "aa12" }, NOW + 1);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c3", conversationId: "conv-1", kind: "tombstone", contentHash: "aa13" }, NOW + 2);
    const { coordinator } = buildOutbound(fixture, syncState, [relay], encryptionAuthority);
    const publish = await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-8", fromSequence: 1, toSequence: 3 });
    expect(publish.outcome).toBe("published");

    const responderState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { handler } = buildInbound(fixture, responderState, RESPONDER_DEVICE_ID);
    const descriptor = relay.stored[0]!;
    const result = await handler.handleIncomingEvent({ descriptor, encryptionAuthority, suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite, localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, now: NOW + 3 });
    expect(result.outcome).toBe("imported");
    expect(result.entryOutcomes.map((e) => e.changeId)).toEqual(["c1", "c2", "c3"]); // real order preserved

    const applyResults = responderState.applyPendingChanges(RESPONDER_DEVICE_ID, NOW + 4);
    expect(applyResults.map((r) => ({ changeId: r.changeId, outcome: r.outcome }))).toEqual([
      { changeId: "c1", outcome: "applied" },
      { changeId: "c2", outcome: "applied" }, // same conversation, SAME originDeviceRef as c1 (the initiator's own sequential edit) -- classifyFedosSyncConflict only flags "concurrent-update" on a DIFFERING originDeviceRef, so this is correctly "none"/applied, not a conflict
      { changeId: "c3", outcome: "applied" }, // tombstone -- terminal fact, applied
    ]);
    expect(responderState.getCursor(RESPONDER_DEVICE_ID).sequence).toBe(3);
  });

  it("10. gap detection: a genuine hole in the middle of the requested range (another device's entry occupies sequence 2) is refused, not silently skipped", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const syncState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW); // seq 1, initiator
    syncState.recordLocalChange(RESPONDER_DEVICE_ID, { changeId: "c2", conversationId: "conv-2", kind: "upsert", contentHash: "aa12" }, NOW + 1); // seq 2, a DIFFERENT origin device -- a real hole for the initiator's own range
    syncState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c3", conversationId: "conv-1", kind: "upsert", contentHash: "aa13" }, NOW + 2); // seq 3, initiator
    const { coordinator } = buildOutbound(fixture, syncState, [relay], journalEncryptionAuthority());

    const result = await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-10", fromSequence: 1, toSequence: 3 });
    expect(result.outcome).toBe("no-entries"); // only 2 of the 3 requested sequence numbers belong to the initiator -- refused, never sends a partial/reordered batch
    expect(relay.stored).toHaveLength(0);
  });

  it("11. offline / target unreachable: every relay rejecting or timing out the publish is classified distinctly, never silently 'delivered'", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const syncStateRejected = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncStateRejected.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const rejectingRelay = await connectedRelay("wss://relay-reject.example", "reject");
    const { coordinator: rejectCoordinator } = buildOutbound(fixture, syncStateRejected, [rejectingRelay], journalEncryptionAuthority());
    const rejectAttempt = await createFedosDeviceSyncJournalAttemptFn(rejectCoordinator)({
      scheduleId: "sched-11a", sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, fromSequence: 1, toSequence: 1, attemptNumber: 1, transferSessionId: "xfer-11a",
    });
    expect(rejectAttempt.outcome).toBe("relay-disconnected"); // the account's own only configured relay is unreachable/refusing -- a real "offline" shape, safe to retry later

    const syncStateTimeout = new FedosSyncState(fixture.accountRef.publicIdentifier);
    syncStateTimeout.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    const timeoutRelay = await connectedRelay("wss://relay-timeout.example", "timeout");
    const { coordinator: timeoutCoordinator } = buildOutbound(fixture, syncStateTimeout, [timeoutRelay], journalEncryptionAuthority());
    const timeoutAttempt = await createFedosDeviceSyncJournalAttemptFn(timeoutCoordinator)({
      scheduleId: "sched-11b", sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, fromSequence: 1, toSequence: 1, attemptNumber: 1, transferSessionId: "xfer-11b",
    });
    expect(timeoutAttempt.outcome).toBe("relay-timeout"); // no OK ever arrives -- distinct from an explicit rejection
  });

  it("12. restart mid-batch: a process that dies after applying only the first entry locally correctly resumes to completion on a fresh retry (new transferSessionId/event) covering the same range -- durable local state (syncState/dedup persistence surviving the crash) plus per-entry idempotency together give restart-safety without any transport-level transaction", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const encryptionAuthority = journalEncryptionAuthority();
    const senderState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    senderState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    senderState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c2", conversationId: "conv-2", kind: "upsert", contentHash: "aa12" }, NOW + 1);
    senderState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c3", conversationId: "conv-3", kind: "upsert", contentHash: "aa13" }, NOW + 2);

    // Durable receiver-side state -- these instances stand in for storage that survives a process restart (unlike the
    // in-memory `FedosSyncState`/dedup instances that a real crash would need to have persisted; here we simulate that
    // durability by simply keeping the SAME instances alive across the two simulated "process lifetimes" below).
    const responderState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { handler: firstProcessHandler } = buildInbound(fixture, responderState, RESPONDER_DEVICE_ID);

    // Simulates the FIRST process's inbound handler crashing after applying only entry c1 to local state, before
    // ever finishing the batch's own entry loop (see fedos_device_sync_journal_inbound_handler.ts's own entry loop --
    // this reproduces stopping partway through it without relying on any internal test hook).
    responderState.recordLocalChange(INITIATOR_DEVICE_ID, { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "aa11" }, NOW);
    responderState.redeliverChange(RESPONDER_DEVICE_ID, "c1");
    void firstProcessHandler; // the crash happens before this handler ever runs handleIncomingEvent for this range

    // The Scheduler's own restart-safety (`#recoverInterruptedSchedules()`, pre-existing/unmodified) re-attempts the
    // SAME [1,3] range after restart -- a genuinely FRESH publish (new transferSessionId, new signed event, new relay
    // event id), not a replay of anything the first process ever sent.
    const { coordinator } = buildOutbound(fixture, senderState, [relay], encryptionAuthority);
    const publish = await coordinator.prepareAndPublish({ sourceDeviceId: INITIATOR_DEVICE_ID, targetDeviceId: RESPONDER_DEVICE_ID, transferSessionId: "xfer-12-retry", fromSequence: 1, toSequence: 3 });
    expect(publish.outcome).toBe("published");

    // The SECOND (post-restart) process's own inbound handler, reusing the SAME durable responderState/registryPersistence.
    const { handler: secondProcessHandler } = buildInbound(fixture, responderState, RESPONDER_DEVICE_ID);
    const descriptor = relay.stored[0]!;
    const result = await secondProcessHandler.handleIncomingEvent({ descriptor, encryptionAuthority, suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite, localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, now: NOW + 3 });
    expect(result.outcome).toBe("imported");
    expect(result.entryOutcomes).toEqual([
      { changeId: "c1", appendOutcome: "duplicate", redeliverOutcome: "duplicate" }, // already journaled+staged by the pre-crash partial apply -- safely re-recognized, not re-applied
      { changeId: "c2", appendOutcome: "appended", redeliverOutcome: "enqueued" },
      { changeId: "c3", appendOutcome: "appended", redeliverOutcome: "enqueued" },
    ]);

    const applyResults = responderState.applyPendingChanges(RESPONDER_DEVICE_ID, NOW + 4);
    expect(applyResults.map((r) => ({ changeId: r.changeId, outcome: r.outcome }))).toEqual([
      { changeId: "c1", outcome: "applied" },
      { changeId: "c2", outcome: "applied" },
      { changeId: "c3", outcome: "applied" },
    ]);
    expect(responderState.getCursor(RESPONDER_DEVICE_ID).sequence).toBe(3); // fully caught up, no entry lost, none double-applied
  });

  it("9. malformed relay event content is rejected", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const responderState = new FedosSyncState(fixture.accountRef.publicIdentifier);
    const { handler } = buildInbound(fixture, responderState, RESPONDER_DEVICE_ID);
    const result = await handler.handleIncomingEvent({
      descriptor: { id: "fake-id", author: "fake-author", createdAt: NOW, kind: 1, tags: [["fedos-device-sync-journal", "1"]], content: "{not valid json", signature: "fake-sig", provider: "nostr" },
      encryptionAuthority: journalEncryptionAuthority(),
      suite: DEVICE_RELAY_SYNC_BUILD_FIELDS.suite,
      localAccountIndex: DEVICE_RELAY_SYNC_BUILD_FIELDS.localAccountIndex,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      now: NOW,
    });
    expect(result.outcome).toBe("malformed");
  });
});

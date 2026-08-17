/**
 * Own-Device Sync Protocol Final Closure arc — the real installed
 * two-device proof (mandate §37-44). Reuses
 * `test/secure_runtime_alpha_4581_4660_device_registration_pairing_durable_journal.test.ts`'s
 * own established topology: two independent `startFedosDesktopRuntime()`
 * instances, each with its OWN durable directory (device registry / sync
 * journal / inbound dedup), representing two independent installed
 * processes of the SAME account. Cross-device trust is bootstrapped via
 * `FedosDeviceTrustRuntime`'s own real `registerDevice()`/`confirmTrust()`/
 * `registerSyncDevice()` (the SAME primitives the real pairing-exchange
 * protocol calls internally, already proven correct end to end by the
 * 4581-4660 Arc's own test) rather than re-running the full challenge/
 * proof-of-possession exchange, since PAIRING correctness is not this
 * file's own subject — Journal Transport convergence is.
 *
 * REAL crypto throughout: one real WASM `FedosWasmMasterSeedAuthority`
 * (generated once, SHARED between both Runtimes, mirroring how two real
 * physical devices holding the SAME account recovery seed would each
 * independently derive the identical Nostr public identity and the
 * identical encrypt-to-self conversation key) and one real
 * `FedosWasmNostrSigningAuthority` (also shared, for the SAME reason —
 * both devices can validly sign as the account). What is genuinely
 * SEPARATE per device: `localDeviceId`, the durable Device Registry/Sync
 * Journal/Inbound Dedup log files, and the `FedosRunningDesktopRuntime`
 * instance itself.
 *
 * Relay layer: ONE shared `FakeDeviceRelaySyncRelay` (real functional
 * in-process relay -- store-and-forward, replays historical events to a
 * newly (re)subscribing listener, exactly the "offline then later
 * receive" shape a real Relay provides) -- both Runtimes' own
 * `conversationTransportRelays` point at the SAME instance, the one thing
 * this in-process model cannot fully replicate about two genuinely
 * separate machines (a real Relay server would sit between them instead).
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { startFedosDesktopRuntime, type FedosRunningDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDeviceTrustRuntime } from "../src/os/messenger/desktop/runtime/fedos_device_trust_runtime.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosSyncApplyResult } from "../src/os/messenger/sync/fedos_sync_state.js";
import { FedosWasmMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { FedosWasmNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
import { FakeDeviceRelaySyncRelay } from "./support/fake_device_relay_sync_relay.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";

declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

const NOW = 1_950_000_000;

function makeTmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

async function primedLoader(): Promise<FedosWasmLoaderSkeleton> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader;
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

/**
 * REAL finding this test surfaced: `FedosSyncJournal` assigns sequence
 * numbers from ONE GLOBAL counter shared by every origin device recorded
 * into it (not a per-origin-device counter) -- once a Runtime has received
 * ANY inbound entry from a peer, that peer's own local entry no longer
 * necessarily starts at sequence 1. `readGaplessRange()` filters by BOTH
 * `originDeviceRef` AND the caller-supplied `[fromSequence, toSequence]`,
 * so a caller (the Scheduler, in production, via `planFedosDeviceSyncTargets()`)
 * must ask for the ACTUAL sequence its own local entry landed at, never
 * assume "the Nth thing I recorded locally" equals "sequence N". This
 * helper looks that up directly from the Journal, exactly as a real
 * caller must.
 */
function sequenceOf(runtime: FedosRunningDesktopRuntime, changeId: string): number {
  const entry = runtime.deviceTrust().journalEntries().find((e) => e.changeId === changeId);
  if (entry === undefined) throw new Error(`sequenceOf: no journal entry for changeId "${changeId}"`);
  return entry.sequence;
}

interface DeviceHarness {
  readonly dir: string;
  readonly localDeviceId: string;
  runtime: FedosRunningDesktopRuntime;
}

/** Idempotent per real deviceId -- a harness reused across multiple `bootStrapMutualTrust()` calls
 * (e.g. Device A pairing with both B and a later third device) must not re-attempt a transition
 * its own real Registry already completed; `already-registered`/an already-`"trusted"` state are
 * both honest, expected outcomes here, never treated as failures. */
function bootstrapOneDirection(trust: FedosDeviceTrustRuntime, accountRef: FedosDeviceBindingAccountRef, deviceId: string): void {
  if (trust.isDeviceTrusted(deviceId)) return;
  const registered = trust.registerDevice({ deviceId, accountRef, devicePublicKeyRef: `pubkey-ref-${deviceId}`, label: null }, NOW).outcome;
  expect(["registered", "already-registered"]).toContain(registered);
  expect(trust.confirmTrust(deviceId, NOW).outcome).toBe("trusted");
  expect(trust.registerSyncDevice(deviceId, NOW)).toBe("registered");
}

async function bootStrapMutualTrust(a: DeviceHarness, b: DeviceHarness): Promise<void> {
  const accountRef = a.runtime.deviceTrust().localAccountRef();
  for (const [self, peer] of [
    [a, b],
    [b, a],
  ] as const) {
    const trust = self.runtime.deviceTrust();
    bootstrapOneDirection(trust, accountRef, self.localDeviceId);
    bootstrapOneDirection(trust, accountRef, peer.localDeviceId);
  }
}

describe("Own-Device Sync Protocol Final Closure -- real installed two-device proof (two real Runtimes, real WASM crypto, real shared relay)", () => {
  it(
    "bootstrap, bidirectional convergence, offline+restart catch-up, benign conflict, security-sensitive tombstone-vs-upsert conflict, wrong-account negative",
    async () => {
    await withDevelopmentNodeEnv(async () => {
    const loader = await primedLoader();
    const masterSeed = new FedosWasmMasterSeedAuthority(loader);
    expect(await masterSeed.generate()).toBe(true);
    const signingAuthority = new FedosWasmNostrSigningAuthority(masterSeed, loader);
    const identity = await signingAuthority.publicIdentityForAccount(0);
    expect(identity).not.toBeNull();
    const accountRef = { authority: "nostr" as const, publicIdentifier: identity!.publicKeyHex, identityId: null };

    const sharedRelay = new FakeDeviceRelaySyncRelay("wss://shared-installed-proof.example");
    await sharedRelay.connect();

    function configFor(dir: string, localDeviceId: string, onApplied?: (results: readonly FedosSyncApplyResult[]) => void): Record<string, unknown> {
      return {
        boardLogPath: join(dir, "board.ndjson"),
        outboxLogPath: join(dir, "outbox.ndjson"),
        deliveryEnabled: false,
        deviceTrustEnabled: true,
        localDeviceId,
        localAccountRef: accountRef,
        deviceRegistryLogPath: join(dir, "device_registry.ndjson"),
        deviceBindingChallengeReplayLogPath: join(dir, "replay.ndjson"),
        deviceSyncJournalLogPath: join(dir, "sync_journal.ndjson"),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: { maxAttempts: 5, laterDelaySeconds: 30 },
        deviceSyncJournalMasterSeedAuthority: masterSeed,
        deviceSyncJournalInboundDedupLogPath: join(dir, "journal_inbound_dedup.ndjson"),
        deviceSyncJournalOnApplied: onApplied,
        conversationTransportRelays: [sharedRelay],
        conversationTransportSigningAuthority: signingAuthority,
        conversationTransportAccountIndex: 0,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(accountRef.authority, accountRef.publicIdentifier),
      };
    }

    // Observes each Runtime's own real-time auto-apply outcomes (the ONE thing a fire-and-forget
    // inbound delivery has no other observable sink for) -- test-only, via the SAME optional,
    // never-set-in-production `deviceSyncJournalOnApplied` config hook this arc added.
    const appliedOnA: FedosSyncApplyResult[] = [];
    const appliedOnB: FedosSyncApplyResult[] = [];

    const dirA = makeTmpDir("fedos-installed-proof-devA-");
    const dirB = makeTmpDir("fedos-installed-proof-devB-");
    const a: DeviceHarness = { dir: dirA, localDeviceId: "device-a", runtime: await startFedosDesktopRuntime(configFor(dirA, "device-a", (results) => appliedOnA.push(...results)) as never) };
    const b: DeviceHarness = { dir: dirB, localDeviceId: "device-b", runtime: await startFedosDesktopRuntime(configFor(dirB, "device-b", (results) => appliedOnB.push(...results)) as never) };

    // --- Bootstrap: mutual trust (self + peer) on both real, independent Registries. ---
    await bootStrapMutualTrust(a, b);
    expect(a.runtime.deviceTrust().isDeviceTrusted("device-b")).toBe(true);
    expect(b.runtime.deviceTrust().isDeviceTrusted("device-a")).toBe(true);

    // --- Bidirectional convergence: A -> B. ---
    const recA1 = a.runtime.deviceTrust().recordLocalChange("device-a", "conversation-identity-metadata", { changeId: "a1", conversationId: "conv-a", kind: "upsert", contentHash: "aa11" }, NOW);
    expect(recA1.outcome).toBe("recorded");
    const seqA1 = sequenceOf(a.runtime, "a1");
    const publishA1 = await a.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-a", targetDeviceId: "device-b", transferSessionId: "xfer-a1", fromSequence: seqA1, toSequence: seqA1 });
    expect(publishA1.outcome).toBe("published");
    await settle();
    expect(b.runtime.deviceTrust().getCursor("device-b").sequence).toBe(1);
    expect(b.runtime.deviceTrust().journalEntries().map((e) => e.changeId)).toContain("a1");

    // --- Bidirectional convergence: B -> A. ---
    const recB1 = b.runtime.deviceTrust().recordLocalChange("device-b", "conversation-identity-metadata", { changeId: "b1", conversationId: "conv-b", kind: "upsert", contentHash: "bb11" }, NOW + 1);
    expect(recB1.outcome).toBe("recorded");
    const seqB1 = sequenceOf(b.runtime, "b1");
    const publishB1 = await b.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-b", targetDeviceId: "device-a", transferSessionId: "xfer-b1", fromSequence: seqB1, toSequence: seqB1 });
    expect(publishB1.outcome).toBe("published");
    await settle();
    // The cursor advances to the RECEIVED entry's own sequence within A's own local journal --
    // A's journal already contains "a1" (A's own local record) at sequence 1, so "b1" (received)
    // lands at sequence 2, not 1 -- the cursor is never a simple "count of things applied so
    // far", it is genuinely the local journal's own global sequence position.
    expect(a.runtime.deviceTrust().getCursor("device-a").sequence).toBe(sequenceOf(a.runtime, "b1"));
    expect(a.runtime.deviceTrust().journalEntries().map((e) => e.changeId)).toContain("b1");

    // --- Offline + restart catch-up: stop Device B (simulates it going offline), Device A
    // publishes a THIRD change while B is down, then Device B "comes back online" as a fresh
    // Runtime instance over the SAME durable directory (a genuine restart) -- its own fresh
    // Inbound Subscription's start() replays the still-stored event from the shared Relay. ---
    await b.runtime.stop();
    const recA2 = a.runtime.deviceTrust().recordLocalChange("device-a", "conversation-identity-metadata", { changeId: "a2", conversationId: "conv-a2", kind: "upsert", contentHash: "aa22" }, NOW + 2);
    expect(recA2.outcome).toBe("recorded");
    const seqA2 = sequenceOf(a.runtime, "a2");
    const publishA2 = await a.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-a", targetDeviceId: "device-b", transferSessionId: "xfer-a2", fromSequence: seqA2, toSequence: seqA2 });
    expect(publishA2.outcome).toBe("published");

    b.runtime = await startFedosDesktopRuntime(configFor(dirB, "device-b", (results) => appliedOnB.push(...results)) as never);
    await settle();
    // Caught up on restart, never lost -- B's own local journal already has "a1" (received
    // earlier, sequence 1) and "b1" (B's own local record, sequence 2), so "a2" (received on
    // restart) lands at sequence 3.
    expect(b.runtime.deviceTrust().getCursor("device-b").sequence).toBe(sequenceOf(b.runtime, "a2"));
    expect(b.runtime.deviceTrust().journalEntries().map((e) => e.changeId)).toEqual(expect.arrayContaining(["a1", "a2"]));
    // Durable trust survived the restart too -- never re-bootstrapped.
    expect(b.runtime.deviceTrust().isDeviceTrusted("device-a")).toBe(true);

    // --- Benign conflict: two DIFFERENT devices independently edit the SAME conversation;
    // classified honestly as "concurrent-update" on the receiving side, never silently merged.
    // REAL FINDING while building this: `FedosSyncState` only ever runs conflict classification
    // for entries an `applyPendingChanges()` call actually processes from a device's OWN pending
    // queue -- a device's OWN `recordLocalChange()` entries never route through its OWN pending
    // queue (they fan OUT to other devices), so they can never become that SAME device's own
    // classification baseline. A genuine "two different origins converge on one receiver" proof
    // therefore needs a receiver that is NEITHER origin -- a real THIRD device of the same
    // account (mirrors how this would look with three real installed devices; a personal
    // multi-device account is not inherently limited to two). ---
    const dirThird = makeTmpDir("fedos-installed-proof-devThird-");
    const third: DeviceHarness = { dir: dirThird, localDeviceId: "device-third", runtime: await startFedosDesktopRuntime(configFor(dirThird, "device-third") as never) };
    await bootStrapMutualTrust(a, third); // A <-> device-third only -- B never needs to know about it for this scenario

    const recB2 = b.runtime.deviceTrust().recordLocalChange("device-b", "conversation-identity-metadata", { changeId: "b2", conversationId: "conv-shared", kind: "upsert", contentHash: "cc11" }, NOW + 3);
    expect(recB2.outcome).toBe("recorded");
    const seqB2 = sequenceOf(b.runtime, "b2");
    const publishB2 = await b.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-b", targetDeviceId: "device-a", transferSessionId: "xfer-b2", fromSequence: seqB2, toSequence: seqB2 });
    expect(publishB2.outcome).toBe("published");
    await settle();
    expect(appliedOnA.find((r) => r.changeId === "b2")?.outcome).toBe("applied"); // A's own first-ever entry for "conv-shared" -- nothing to conflict with yet

    const recC1 = third.runtime.deviceTrust().recordLocalChange("device-third", "conversation-identity-metadata", { changeId: "c-shared-1", conversationId: "conv-shared", kind: "upsert", contentHash: "dd11" }, NOW + 4);
    expect(recC1.outcome).toBe("recorded");
    const seqC1Shared = sequenceOf(third.runtime, "c-shared-1");
    const publishC1 = await third.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-third", targetDeviceId: "device-a", transferSessionId: "xfer-c-shared-1", fromSequence: seqC1Shared, toSequence: seqC1Shared });
    expect(publishC1.outcome).toBe("published");
    await settle();
    const cSharedOnA = appliedOnA.find((r) => r.changeId === "c-shared-1");
    expect(cSharedOnA?.outcome).toBe("conflict");
    expect(cSharedOnA?.conflict).toBe("concurrent-update"); // honest, not silently merged -- B's own edit (originDeviceRef "device-b") is NOT lost, it is still in A's own journal
    expect(a.runtime.deviceTrust().journalEntries().map((e) => e.changeId)).toEqual(expect.arrayContaining(["b2", "c-shared-1"]));

    // --- Security-sensitive conflict: attempt to resurrect a signed-deleted item. Device A
    // tombstones "conv-secret" and syncs it to B -- B's own real apply path gives B a genuine
    // "last applied = tombstone" baseline for that conversation (unlike A's own un-applied local
    // record, per the finding immediately above). Device A THEN syncs a LATER upsert for the
    // SAME conversation to B (modeling a stale/compromised resend of pre-deletion content) -- B
    // must classify it as "tombstone-vs-upsert", never silently resurrect it as "applied". ---
    const recA4 = a.runtime.deviceTrust().recordLocalChange("device-a", "retention-tombstone-fact", { changeId: "a4", conversationId: "conv-secret", kind: "tombstone", contentHash: "ee11" }, NOW + 6);
    expect(recA4.outcome).toBe("recorded");
    const seqA4 = sequenceOf(a.runtime, "a4");
    const publishA4 = await a.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-a", targetDeviceId: "device-b", transferSessionId: "xfer-a4", fromSequence: seqA4, toSequence: seqA4 });
    expect(publishA4.outcome).toBe("published");
    await settle();
    expect(appliedOnB.find((r) => r.changeId === "a4")?.outcome).toBe("applied"); // B's own real, transport-derived "last applied" baseline for "conv-secret" is now the tombstone

    const recA5 = a.runtime.deviceTrust().recordLocalChange("device-a", "conversation-identity-metadata", { changeId: "a5", conversationId: "conv-secret", kind: "upsert", contentHash: "ff11" }, NOW + 7);
    expect(recA5.outcome).toBe("recorded");
    const seqA5 = sequenceOf(a.runtime, "a5");
    const publishA5 = await a.runtime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-a", targetDeviceId: "device-b", transferSessionId: "xfer-a5", fromSequence: seqA5, toSequence: seqA5 });
    expect(publishA5.outcome).toBe("published");
    await settle();
    const a5OnB = appliedOnB.find((r) => r.changeId === "a5");
    expect(a5OnB?.outcome).toBe("conflict");
    expect(a5OnB?.conflict).toBe("tombstone-vs-upsert"); // NOT "applied" -- the tombstone is never silently overwritten/resurrected by this transport
    expect(b.runtime.deviceTrust().journalEntries().map((e) => e.changeId)).toEqual(expect.arrayContaining(["a4", "a5"])); // both facts remain in the honest history, neither silently dropped

    await third.runtime.stop();
    rmSync(dirThird, { recursive: true, force: true });

    // --- Wrong-account negative: a genuinely different account's own outbound coordinator
    // cannot deliver into either real Device's Registry -- rejected before any local mutation. ---
    const foreignLoader = await primedLoader();
    const foreignMasterSeed = new FedosWasmMasterSeedAuthority(foreignLoader);
    expect(await foreignMasterSeed.generate()).toBe(true);
    const foreignSigningAuthority = new FedosWasmNostrSigningAuthority(foreignMasterSeed, foreignLoader);
    const foreignIdentity = await foreignSigningAuthority.publicIdentityForAccount(0);
    const foreignAccountRef = { authority: "nostr" as const, publicIdentifier: foreignIdentity!.publicKeyHex, identityId: null };
    const dirC = makeTmpDir("fedos-installed-proof-devC-foreign-");
    const foreignRuntime = await startFedosDesktopRuntime({
      boardLogPath: join(dirC, "board.ndjson"),
      outboxLogPath: join(dirC, "outbox.ndjson"),
      deliveryEnabled: false,
      deviceTrustEnabled: true,
      localDeviceId: "device-c-foreign",
      localAccountRef: foreignAccountRef,
      deviceRegistryLogPath: join(dirC, "device_registry.ndjson"),
      deviceBindingChallengeReplayLogPath: join(dirC, "replay.ndjson"),
      deviceSyncJournalLogPath: join(dirC, "sync_journal.ndjson"),
      deviceSyncSchedulerEnabled: true,
      deviceSyncAbandonmentPolicy: { maxAttempts: 5, laterDelaySeconds: 30 },
      deviceSyncJournalMasterSeedAuthority: foreignMasterSeed,
      deviceSyncJournalInboundDedupLogPath: join(dirC, "journal_inbound_dedup.ndjson"),
      conversationTransportRelays: [sharedRelay],
      conversationTransportSigningAuthority: foreignSigningAuthority,
      conversationTransportAccountIndex: 0,
      deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(foreignAccountRef.authority, foreignAccountRef.publicIdentifier),
    } as never);
    const trustC = foreignRuntime.deviceTrust();
    expect(trustC.registerDevice({ deviceId: "device-c-foreign", accountRef: foreignAccountRef, devicePublicKeyRef: "pubkey-ref-c", label: null }, NOW).outcome).toBe("registered");
    expect(trustC.confirmTrust("device-c-foreign", NOW).outcome).toBe("trusted");
    expect(trustC.registerSyncDevice("device-c-foreign", NOW)).toBe("registered");
    trustC.recordLocalChange("device-c-foreign", "conversation-identity-metadata", { changeId: "c1", conversationId: "conv-foreign", kind: "upsert", contentHash: "1122" }, NOW + 9);

    const journalEntriesBeforeAttack = a.runtime.deviceTrust().journalEntries().length;
    // The foreign account has never registered/trusted "device-a" or "device-b" on its OWN
    // Registry -- source-not-trusted rejects it before it can even attempt to address either
    // real device (mirrors this file's own real trust model: an attacker cannot forge trust
    // it never had). The genuinely load-bearing negative check is the earlier wrong-account
    // unit coverage (`test/fedos_own_device_sync_journal_transport.test.ts`, test 3) proving
    // the INBOUND side independently rejects a mismatched account even if a foreign event
    // somehow reached the shared Relay; this asserts no journal mutation occurred on either
    // real Device from this foreign attempt either way.
    const seqC1 = sequenceOf(foreignRuntime, "c1");
    const attackPublish = await foreignRuntime.deviceSyncJournalOutbound()!.prepareAndPublish({ sourceDeviceId: "device-c-foreign", targetDeviceId: "device-a", transferSessionId: "xfer-attack", fromSequence: seqC1, toSequence: seqC1 });
    expect(attackPublish.outcome).toBe("target-not-trusted");
    await settle();
    expect(a.runtime.deviceTrust().journalEntries().length).toBe(journalEntriesBeforeAttack);

    await a.runtime.stop();
    await b.runtime.stop();
    await foreignRuntime.stop();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
    rmSync(dirC, { recursive: true, force: true });
    });
    },
    60_000,
  );
});

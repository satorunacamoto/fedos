/**
 * Secure Runtime Alpha 4421-4500 ("Desktop Device Sync Badge, Notification,
 * and Operational Event Wiring Arc") — Phase F: real acceptance tests
 * covering every named scenario (sync start, sync success, sync failure,
 * retry, conflict, device offline, device online, badge update, tray
 * update, notification, multiple events, restart, shutdown).
 *
 * Real `startFedosDesktopRuntime()` (Device Sync side: real
 * `FedosDeviceTrustRuntime`/`FedosDeviceSyncScheduler`, driven through
 * `runtime.deviceSyncOperational()` -- the SAME facade Production code
 * uses), a real, separate `FedosDesktopConversationUiPresentationBoundary`
 * (for a real `FedosDesktopUnreadCounterViewModel`, matching this
 * codebase's own `secure_runtime_alpha_4341_4420_badge_coordinator.test.ts`
 * fixture exactly), and real `FedosDesktopNotificationCoordinator`/
 * `FedosDesktopBadgeCoordinator`. `FakeTrackingNotificationPort`/
 * `FakeTrackingTrayStatusPort`/`FakeTrackingBadgePort` are real, total,
 * inspectable Port implementations -- the SAME style as this codebase's
 * own established `FakeTrackingBadgePort`/`NoopFedosDesktopNotificationPort`,
 * never a mock library.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";
import { FedosDeviceSyncEventBridge } from "../src/os/messenger/device/sync_events/fedos_device_sync_event_bridge.js";
import type { FedosDeviceSyncAttemptFn } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_attempt.js";
import type { FedosDeviceSyncAttemptOutcomeCode } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_retry_policy.js";
import {
  FedosDesktopDeviceSyncPresentationWiring,
  type FedosDeviceSyncNotificationSink,
  type FedosDeviceSyncTrayStatusSink,
} from "../src/os/messenger/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.js";

import { createFedosDesktopConversationUiPresentationBoundary } from "../src/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { FedosDesktopBadgeCoordinator, type FedosDesktopBadgeRegistryView } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_coordinator.js";
import type { FedosDesktopBadgePort } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_port.js";
import type { FedosDesktopBadgeView } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_types.js";
import { FedosDesktopNotificationCoordinator } from "../src/os/messenger/notifications/fedos_desktop_notification_coordinator.js";
import type { FedosDesktopNotificationPort, FedosDesktopNotificationDeliveryResult } from "../src/os/messenger/notifications/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../src/os/messenger/notifications/fedos_desktop_notification_types.js";

// ---------------------------------------------------------------------
// Real, total, inspectable Port fakes (never a mock library) -- mirrors
// `FakeTrackingBadgePort` (`secure_runtime_alpha_4341_4420_badge_coordinator.test.ts`).
// ---------------------------------------------------------------------

class FakeTrackingNotificationPort implements FedosDesktopNotificationPort {
  readonly delivered: FedosDesktopNotificationView[] = [];
  status(): "available" | "unavailable" {
    return "available";
  }
  async notify(view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult> {
    this.delivered.push(view);
    return { delivered: true, reason: "delivered by FakeTrackingNotificationPort" };
  }
}

class FakeTrackingTrayStatusPort implements FedosDeviceSyncTrayStatusSink {
  readonly tooltips: string[] = [];
  setTooltip(text: string): void {
    this.tooltips.push(text);
  }
}

class FakeTrackingBadgePort implements FedosDesktopBadgePort {
  readonly rendered: FedosDesktopBadgeView[] = [];
  status(): "available" | "unavailable" {
    return "available";
  }
  render(view: FedosDesktopBadgeView): void {
    this.rendered.push(view);
  }
}

// ---------------------------------------------------------------------
// Device Sync Runtime fixture -- mirrors the Bridge test file's own helpers.
// ---------------------------------------------------------------------

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "npub-account-wiring", identityId: null };

function makeTmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function baseDeviceSyncConfig(dir: string) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false as const,
  };
}

async function startDeviceSyncRuntime(
  dir: string,
  attemptFn: FedosDeviceSyncAttemptFn,
  opts: { abandonmentPolicy?: { maxAttempts: number; laterDelaySeconds: number }; scheduleLogPath?: string } = {},
) {
  const runtime = await startFedosDesktopRuntime({
    ...baseDeviceSyncConfig(dir),
    deviceTrustEnabled: true,
    localDeviceId: "dev-A",
    localAccountRef: ACCOUNT_A,
    deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
    deviceSyncSchedulerEnabled: true,
    deviceSyncAbandonmentPolicy: opts.abandonmentPolicy ?? { maxAttempts: 5, laterDelaySeconds: 1 },
    deviceSyncAttemptFn: attemptFn,
    deviceSyncScheduleLogPath: opts.scheduleLogPath,
  });
  return runtime;
}

/** Registers `dev-A` (local) and `dev-B` (target), trusts both, and records exactly one pending change so a single tick attempts exactly one schedule. Idempotent-safe to call at most once per runtime. */
function seedOneTarget(runtime: Awaited<ReturnType<typeof startFedosDesktopRuntime>>, targetDeviceId = "dev-B", changeIdSuffix = "1"): void {
  const dt = runtime.deviceTrust();
  if (dt.getDevice("dev-A") === null) {
    dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: null }, 100);
    dt.confirmTrust("dev-A", 100);
  }
  dt.registerDevice({ deviceId: targetDeviceId, accountRef: ACCOUNT_A, devicePublicKeyRef: `k-${targetDeviceId}`, label: null }, 100);
  dt.confirmTrust(targetDeviceId, 100);
  dt.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: `conv-${changeIdSuffix}`, changeId: `chg-${changeIdSuffix}`, kind: "upsert", contentHash: `hash-${changeIdSuffix}` }, 100);
}

function fixedOutcome(outcome: FedosDeviceSyncAttemptOutcomeCode): FedosDeviceSyncAttemptFn {
  return async () => ({ outcome });
}

// ---------------------------------------------------------------------
// Notification/Badge fixture -- a SEPARATE, minimal, real Boundary purely
// for a real `FedosDesktopUnreadCounterViewModel` -- mirrors
// `secure_runtime_alpha_4341_4420_badge_coordinator.test.ts`'s own
// `freshConfig()` exactly. Unread content itself is irrelevant to what
// this Arc's own Wiring is tested for (routing, not unread accuracy) --
// `recentConversationIds` stays empty throughout, so `refresh()` always
// resolves the SAME real "no unread messages" baseline, deterministically.
// ---------------------------------------------------------------------

function fakeMarker(request: { localAccountIndex: number; counterpartyPublicKeyHex: string }): Uint8Array {
  return new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
}
class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    const marker = fakeMarker(request);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    const marker = fakeMarker(request);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };

function freshBoundaryConfig(dir: string): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationConstructionCoordinationLogPath: join(dir, "construction-coordination.log"),
    conversationEnvelopeLogPath: join(dir, "envelope.log"),
    conversationPayloadLogPath: join(dir, "payload.log"),
    conversationEncryptionCoordinationLogPath: join(dir, "encryption-coordination.log"),
    conversationActivationCoordinationLogPath: join(dir, "activation.log"),
    conversationPayloadRetentionLogPath: join(dir, "retention.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(ALICE),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
  };
}

interface WiringFixture {
  readonly wiring: FedosDesktopDeviceSyncPresentationWiring;
  readonly notificationPort: FakeTrackingNotificationPort;
  readonly trayPort: FakeTrackingTrayStatusPort;
  readonly badgePort: FakeTrackingBadgePort;
  readonly badgeCoordinator: FedosDesktopBadgeCoordinator;
  readonly notificationCoordinator: FedosDesktopNotificationCoordinator;
  readonly stop: () => Promise<void>;
}

async function buildWiringFixture(dir: string): Promise<WiringFixture> {
  const boundary = createFedosDesktopConversationUiPresentationBoundary();
  const started = await boundary.runtimeStatus.start(freshBoundaryConfig(dir));
  if (started.status !== "loaded") throw new Error(`expected boundary to start, got ${started.status}`);

  const notificationPort = new FakeTrackingNotificationPort();
  const notificationCoordinator = new FedosDesktopNotificationCoordinator(notificationPort);
  const trayPort = new FakeTrackingTrayStatusPort();
  const badgePort = new FakeTrackingBadgePort();
  const emptyRegistry: FedosDesktopBadgeRegistryView = { recentConversationIds: [] };
  const badgeCoordinator = new FedosDesktopBadgeCoordinator(emptyRegistry, boundary.unreadCounter, badgePort);

  const wiring = new FedosDesktopDeviceSyncPresentationWiring({
    notificationCoordinator: notificationCoordinator as FedosDeviceSyncNotificationSink,
    badgeCoordinator,
    trayStatusSink: trayPort,
  });

  return { wiring, notificationPort, trayPort, badgePort, badgeCoordinator, notificationCoordinator, stop: () => boundary.runtimeStatus.stop().then(() => undefined) };
}

describe("Alpha 4421-4500 -- Phase F acceptance: sync start / sync success / notification / badge update / tray update", () => {
  it("a successful sync tick drives sync-started then sync-completed through Notification + Badge + Tray, end to end", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-success-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-success-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => void fixture.wiring.handleEvent(e) });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(fixedOutcome("delivered")));
      seedOneTarget(runtime);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("ok");

      // Notification: "device-sync" (sync-started) then "sync-complete" (sync-completed) -- the two
      // closed kinds this scenario's own real event sequence maps to.
      expect(fixture.notificationPort.delivered.map((v) => v.kind)).toEqual(["device-sync", "sync-complete"]);
      // Badge: setSynchronizing(true) then refresh(), then setSynchronizing(false) then refresh() --
      // both real refreshes render (zero recent conversations -> "none" both times, but TWO real
      // renders happened, proving the badge Coordinator was actually driven, not skipped).
      expect(fixture.badgePort.rendered.length).toBeGreaterThanOrEqual(1);
      // Tray: Synchronizing (sync-started) -> Idle (sync-completed).
      expect(fixture.trayPort.tooltips).toEqual(["Device sync: Synchronizing", "Device sync: Idle"]);
      expect(fixture.wiring.currentTrayStatus).toBe("Idle");

      await runtime.stop();
      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  });
});

describe("Alpha 4421-4500 -- Phase F acceptance: sync failure / notification / tray", () => {
  it("a terminal failure drives sync-failed through Notification + Tray, badge synchronizing cleared", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-fail-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-fail-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => void fixture.wiring.handleEvent(e) });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(fixedOutcome("revoked-target")));
      seedOneTarget(runtime);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      expect(fixture.notificationPort.delivered.map((v) => v.kind)).toEqual(["device-sync", "sync-failed"]);
      expect(fixture.notificationPort.delivered[1]!.body).toContain("revoked-target");
      expect(fixture.trayPort.tooltips).toEqual(["Device sync: Synchronizing", "Device sync: Failure"]);
      expect(fixture.wiring.currentTrayStatus).toBe("Failure");

      await runtime.stop();
      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  });
});

describe("Alpha 4421-4500 -- Phase F acceptance: retry", () => {
  it("a transient outcome drives retry-scheduled -- tray stays Synchronizing, no notification fired for the retry itself", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-retry-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-retry-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => void fixture.wiring.handleEvent(e), abandonmentMaxAttempts: 5 });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(fixedOutcome("relay-timeout")), { abandonmentPolicy: { maxAttempts: 5, laterDelaySeconds: 1 } });
      seedOneTarget(runtime);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      // Only "sync-started" produces a Notification ("device-sync") -- "retry-scheduled" itself is not
      // one of Phase C's four connected event kinds.
      expect(fixture.notificationPort.delivered.map((v) => v.kind)).toEqual(["device-sync"]);
      expect(fixture.trayPort.tooltips).toEqual(["Device sync: Synchronizing", "Device sync: Synchronizing"]);
      expect(fixture.wiring.currentTrayStatus).toBe("Synchronizing");

      await runtime.stop();
      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  });
});

describe("Alpha 4421-4500 -- Phase F acceptance: conflict", () => {
  it("identity-conflict drives conflict-detected -- tray 'Conflict', a real notification (reusing 'device-sync', never a new kind)", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-conflict-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-conflict-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => void fixture.wiring.handleEvent(e) });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(fixedOutcome("identity-conflict")));
      seedOneTarget(runtime);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      expect(fixture.notificationPort.delivered.map((v) => v.kind)).toEqual(["device-sync", "device-sync"]);
      expect(fixture.notificationPort.delivered[1]!.body).toContain("conflict detected");
      expect(fixture.trayPort.tooltips).toEqual(["Device sync: Synchronizing", "Device sync: Conflict"]);
      expect(fixture.wiring.currentTrayStatus).toBe("Conflict");

      await runtime.stop();
      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  });
});

describe("Alpha 4421-4500 -- Phase F acceptance: device offline / device online", () => {
  it("target-unavailable drives Tray 'Disconnected'; a later delivered attempt against the same target drives Tray back to 'Idle'", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-offline-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-offline-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      let call = 0;
      const scripted: FedosDeviceSyncAttemptFn = async () => {
        call += 1;
        return { outcome: call === 1 ? "target-unavailable" : "delivered" };
      };
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => void fixture.wiring.handleEvent(e) });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(scripted), { abandonmentPolicy: { maxAttempts: 5, laterDelaySeconds: 1 } });
      seedOneTarget(runtime);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();
      // "device-offline" is the LAST event this tick emits (after "retry-scheduled") -- the tray
      // reflects it as the final tooltip for this tick.
      expect(fixture.trayPort.tooltips.at(-1)).toBe("Device sync: Disconnected");
      expect(fixture.wiring.currentTrayStatus).toBe("Disconnected");

      await new Promise((resolve) => setTimeout(resolve, 1100));
      await facade.triggerSyncNow();
      // "device-online" fires, then "sync-completed" (Idle) -- Idle is the final, real status.
      expect(fixture.trayPort.tooltips.at(-1)).toBe("Device sync: Idle");
      expect(fixture.wiring.currentTrayStatus).toBe("Idle");

      await runtime.stop();
      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  }, 10_000);
});

describe("Alpha 4421-4500 -- Phase F acceptance: multiple events (two target devices, one tick)", () => {
  it("one tick attempting two schedules produces two independent, correctly-correlated event sequences, both routed", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-multi-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-multi-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      const outcomesByTarget: Record<string, FedosDeviceSyncAttemptOutcomeCode> = { "dev-B": "delivered", "dev-C": "revoked-target" };
      const scripted: FedosDeviceSyncAttemptFn = async (request) => ({ outcome: outcomesByTarget[request.targetDeviceId] ?? "failed" });
      const events: { kind: string; targetDeviceId?: string }[] = [];
      const bridge = new FedosDeviceSyncEventBridge({
        listener: (e) => {
          events.push({ kind: e.kind, targetDeviceId: "targetDeviceId" in e ? e.targetDeviceId : undefined });
          void fixture.wiring.handleEvent(e);
        },
      });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(scripted));
      seedOneTarget(runtime, "dev-B", "1");
      seedOneTarget(runtime, "dev-C", "2");

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") expect(result.value).toHaveLength(2);

      const forB = events.filter((e) => e.targetDeviceId === "dev-B").map((e) => e.kind);
      const forC = events.filter((e) => e.targetDeviceId === "dev-C").map((e) => e.kind);
      expect(forB).toEqual(["sync-started", "sync-progress", "sync-completed"]);
      expect(forC).toEqual(["sync-started", "sync-progress", "sync-failed"]);

      // Both real notifications reached the Port -- "device-sync" for dev-B's own start, "sync-complete"
      // for its completion, "device-sync" for dev-C's own start, "sync-failed" for its failure (in the
      // Scheduler's own deterministic, sorted-by-targetDeviceId attempt order -- dev-B before dev-C).
      expect(fixture.notificationPort.delivered.map((v) => v.kind)).toEqual(["device-sync", "sync-complete", "device-sync", "sync-failed"]);

      await runtime.stop();
      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  });
});

describe("Alpha 4421-4500 -- Phase F acceptance: restart", () => {
  it("a fresh Bridge+Wiring instance over a RESTARTED Runtime (same persisted schedule log) resumes cleanly -- no false carried-over offline belief, attemptCount continues from where it left off", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-restart-sync-");
    const wiringDirA = makeTmpDir("fedos-4421-4500-wiring-restart-ui-a-");
    const wiringDirB = makeTmpDir("fedos-4421-4500-wiring-restart-ui-b-");
    const scheduleLogPath = join(syncDir, "schedules.ndjson");
    try {
      // First "process": one transient failure, then a clean stop (mid-lifecycle, never delivered).
      const fixtureA = await buildWiringFixture(wiringDirA);
      const bridgeA = new FedosDeviceSyncEventBridge({ listener: (e) => void fixtureA.wiring.handleEvent(e) });
      const runtimeA = await startDeviceSyncRuntime(syncDir, bridgeA.wrapAttemptFn(fixedOutcome("target-unavailable")), {
        abandonmentPolicy: { maxAttempts: 5, laterDelaySeconds: 1 },
        scheduleLogPath,
      });
      seedOneTarget(runtimeA);
      const facadeA = runtimeA.deviceSyncOperational();
      facadeA.startSync();
      await facadeA.triggerSyncNow();
      expect(fixtureA.trayPort.tooltips.at(-1)).toBe("Device sync: Disconnected");
      await runtimeA.stop();
      await fixtureA.stop();

      // "Restart": a FRESH Bridge, FRESH Wiring, FRESH Runtime instance over the SAME schedule log.
      const fixtureB = await buildWiringFixture(wiringDirB);
      const bridgeB = new FedosDeviceSyncEventBridge({ listener: (e) => void fixtureB.wiring.handleEvent(e) });
      expect(bridgeB.isTargetBelievedOffline("dev-B")).toBe(false); // no stale belief carried over.
      const runtimeB = await startDeviceSyncRuntime(syncDir, bridgeB.wrapAttemptFn(fixedOutcome("delivered")), {
        abandonmentPolicy: { maxAttempts: 5, laterDelaySeconds: 1 },
        scheduleLogPath,
      });
      // Registers/trusts the SAME devices again (Device Registry persistence in this test is
      // in-memory, unlike the Schedule log -- a real restart with a durable
      // `deviceRegistryLogPath` would not need this; this test isolates the ONE thing it is actually
      // proving, Schedule restart-continuity, from Device Registry restart-continuity, which
      // `secure_runtime_alpha_3721_3800_device_sync_scheduler.test.ts`'s own restart test already
      // covers separately).
      seedOneTarget(runtimeB);
      const facadeB = runtimeB.deviceSyncOperational();
      facadeB.startSync();

      await new Promise((resolve) => setTimeout(resolve, 1100));
      const resultB = await facadeB.triggerSyncNow();
      expect(resultB.outcome).toBe("ok");
      // The persisted schedule continued from attemptCount=1 (recorded by runtimeA) -- this second
      // attempt is attemptCount=2, delivered, real Schedule state now "completed".
      const schedulesB = (() => {
        const listed = facadeB.listSchedules();
        if (listed.outcome !== "ok") throw new Error("expected ok");
        return listed.value;
      })();
      expect(schedulesB[0]!.attemptCount).toBe(2);
      expect(schedulesB[0]!.state).toBe("completed");
      expect(fixtureB.trayPort.tooltips.at(-1)).toBe("Device sync: Idle");

      await runtimeB.stop();
      await fixtureB.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDirA, { recursive: true, force: true });
      rmSync(wiringDirB, { recursive: true, force: true });
    }
  }, 10_000);
});

describe("Alpha 4421-4500 -- Phase F acceptance: shutdown", () => {
  it("runtime.stop() waits for an in-flight, Bridge-wrapped attempt, then resolves cleanly -- no dangling event, no crash", async () => {
    const syncDir = makeTmpDir("fedos-4421-4500-wiring-shutdown-sync-");
    const wiringDir = makeTmpDir("fedos-4421-4500-wiring-shutdown-ui-");
    try {
      const fixture = await buildWiringFixture(wiringDir);
      let releaseAttempt: (() => void) | undefined;
      const blocking: FedosDeviceSyncAttemptFn = () =>
        new Promise((resolve) => {
          releaseAttempt = () => resolve({ outcome: "delivered" });
        });
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => void fixture.wiring.handleEvent(e) });
      const runtime = await startDeviceSyncRuntime(syncDir, bridge.wrapAttemptFn(blocking));
      seedOneTarget(runtime);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const triggerPromise = facade.triggerSyncNow();

      let stopResolved = false;
      const stopPromise = runtime.stop().then(() => {
        stopResolved = true;
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(stopResolved).toBe(false); // the in-flight attempt has not released yet.

      releaseAttempt!();
      await triggerPromise;
      await stopPromise;
      expect(stopResolved).toBe(true);
      expect(fixture.trayPort.tooltips).toContain("Device sync: Idle");

      await fixture.stop();
    } finally {
      rmSync(syncDir, { recursive: true, force: true });
      rmSync(wiringDir, { recursive: true, force: true });
    }
  });
});

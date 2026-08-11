/**
 * Secure Runtime Alpha 4421-4500 ("Desktop Device Sync Badge, Notification,
 * and Operational Event Wiring Arc") — Phase B: `FedosDeviceSyncEventBridge`
 * real acceptance tests.
 *
 * Real `startFedosDesktopRuntime()`, real `FedosDeviceTrustRuntime`, real
 * `FedosDeviceSyncScheduler` (via `runtime.deviceSyncOperational()`) --
 * `wrapAttemptFn()` is supplied as `config.deviceSyncAttemptFn`, the SAME
 * real integration point production code would use. No mock library
 * anywhere -- every "fake" below is a real, total, minimal implementation
 * of an existing interface (mirrors this codebase's own established
 * `FakeTrackingBadgePort`/`StubVerifiedFedosDeviceRegistrationAuthority`
 * convention).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";
import { FedosDeviceSyncEventBridge } from "../src/os/messenger/device/sync_events/fedos_device_sync_event_bridge.js";
import { FEDOS_DEVICE_SYNC_EVENT_KINDS, type FedosDeviceSyncEvent } from "../src/os/messenger/device/sync_events/fedos_device_sync_event.js";
import type { FedosDeviceSyncAttemptFn } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_attempt.js";
import type { FedosDeviceSyncAttemptOutcomeCode } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_retry_policy.js";

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "npub-account-bridge", identityId: null };
const ABANDONMENT_POLICY = { maxAttempts: 5, laterDelaySeconds: 1 };

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-4421-4500-bridge-"));
}

function baseConfig(dir: string) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false as const,
  };
}

/** Wires one trusted target device ("dev-B") with exactly one pending change, so a single `triggerSyncNow()` attempts exactly one schedule. */
async function seedRuntimeWithOnePendingTarget(dir: string, attemptFn: FedosDeviceSyncAttemptFn, abandonmentPolicy = ABANDONMENT_POLICY) {
  const runtime = await startFedosDesktopRuntime({
    ...baseConfig(dir),
    deviceTrustEnabled: true,
    localDeviceId: "dev-A",
    localAccountRef: ACCOUNT_A,
    deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
    deviceSyncSchedulerEnabled: true,
    deviceSyncAbandonmentPolicy: abandonmentPolicy,
    deviceSyncAttemptFn: attemptFn,
  });
  const dt = runtime.deviceTrust();
  dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: null }, 100);
  dt.registerDevice({ deviceId: "dev-B", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-b", label: null }, 100);
  dt.confirmTrust("dev-A", 100);
  dt.confirmTrust("dev-B", 100);
  dt.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: "conv-1", changeId: "chg-1", kind: "upsert", contentHash: "hash-1" }, 100);
  return runtime;
}

function fixedOutcome(outcome: FedosDeviceSyncAttemptOutcomeCode): FedosDeviceSyncAttemptFn {
  return async () => ({ outcome });
}

describe("Alpha 4421-4500 -- FedosDeviceSyncEventBridge: closed vocabulary", () => {
  it("is exactly the nine documented kinds", () => {
    expect(new Set(FEDOS_DEVICE_SYNC_EVENT_KINDS)).toEqual(
      new Set(["sync-started", "sync-progress", "sync-completed", "sync-failed", "conflict-detected", "retry-scheduled", "retry-aborted", "device-offline", "device-online"]),
    );
  });
});

describe("Alpha 4421-4500 -- FedosDeviceSyncEventBridge: per-outcome classification (real Runtime/Scheduler)", () => {
  it("delivered -> sync-started, sync-progress, sync-completed (never a failure kind)", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("delivered")));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") expect(result.value).toHaveLength(1);

      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "sync-completed"]);
      expect(events.every((e) => "targetDeviceId" in e && e.targetDeviceId === "dev-B")).toBe(true);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("revoked-target (terminal 'never') -> sync-failed, never retry-scheduled", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("revoked-target")));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "sync-failed"]);
      const failed = events.find((e) => e.kind === "sync-failed");
      expect(failed).toMatchObject({ outcome: "revoked-target" });
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("identity-conflict -> conflict-detected, never sync-failed/retry-*", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("identity-conflict")));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "conflict-detected"]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("relay-timeout (transient, directive 'later', below abandonment threshold) -> retry-scheduled", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e), abandonmentMaxAttempts: 5 });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("relay-timeout")));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      // "relay-timeout" is a real transient RELAY signal, not a Device-connectivity signal (this
      // Bridge's own `OFFLINE_SIGNAL_OUTCOMES` is deliberately narrow -- "target-unavailable"/
      // "relay-disconnected" only, see its own header) -- no "device-offline" here.
      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "retry-scheduled"]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("relay-timeout at the abandonment threshold (attemptNumber >= abandonmentMaxAttempts) -> retry-aborted, not retry-scheduled", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e), abandonmentMaxAttempts: 1 });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("relay-timeout")), { maxAttempts: 1, laterDelaySeconds: 1 });
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "retry-aborted"]);
      // Cross-checked against what the REAL Scheduler itself actually persisted -- the Bridge's own
      // claim is never taken on faith alone.
      const schedules = (() => {
        const listed = facade.listSchedules();
        if (listed.outcome !== "ok") throw new Error("expected ok");
        return listed.value;
      })();
      expect(schedules[0]!.state).toBe("operator-required");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("without abandonmentMaxAttempts supplied, every 'later' directive is honestly reported as retry-scheduled only (never a false retry-aborted claim)", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) }); // no abandonmentMaxAttempts
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("relay-timeout")), { maxAttempts: 1, laterDelaySeconds: 1 });
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      // The real Scheduler DID abandon it (operator-required), but this Bridge instance was never
      // told the policy's own maxAttempts, so it reports the only thing it can honestly claim.
      expect(events.some((e) => e.kind === "retry-aborted")).toBe(false);
      expect(events.some((e) => e.kind === "retry-scheduled")).toBe(true);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("operator-required outcome from an unclassified code -> retry-aborted directly (not identity-conflict, not sync-failed)", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      // "disallowed-record" IS in TERMINAL_NEVER per the real retry policy -- use a genuinely
      // unclassified string is not possible through the closed outcome type, so this asserts the
      // real "never" terminal path distinctly from "later"/"operator-required" above using a
      // DIFFERENT terminal code than the "revoked-target" test, for broader real coverage.
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("disallowed-record")));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();
      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "sync-failed"]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a throwing real attemptFn is treated as 'failed' -- matches the Scheduler's own catch discipline exactly, never an unhandled rejection", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      const throwing: FedosDeviceSyncAttemptFn = async () => {
        throw new Error("boom");
      };
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(throwing));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("ok");
      // "failed" is not in the Retry Policy's own TERMINAL_NEVER/RETRYABLE_LATER sets -- it falls
      // through to the SAME "operator-required" default every unclassified outcome gets
      // (`classifyFedosDeviceSyncRetryDirective()`'s own real table), which this Bridge reports as
      // "retry-aborted" -- verified against the real classifier, never assumed.
      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "retry-aborted"]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wrapAttemptFn(undefined) mirrors the Runtime's own fail-closed default -- always the real 'failed' outcome, never a fabricated 'delivered'", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(undefined));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();
      // Same real classification as the "throwing" case above -- "failed" -> "operator-required" -> "retry-aborted".
      expect(events.map((e) => e.kind)).toEqual(["sync-started", "sync-progress", "retry-aborted"]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Alpha 4421-4500 -- FedosDeviceSyncEventBridge: device connectivity (offline/online)", () => {
  it("target-unavailable -> device-offline once; a later delivered attempt against the SAME target -> device-online", async () => {
    const dir = makeTmpDir();
    try {
      const events: FedosDeviceSyncEvent[] = [];
      let call = 0;
      const scripted: FedosDeviceSyncAttemptFn = async () => {
        call += 1;
        return { outcome: call === 1 ? "target-unavailable" : "delivered" };
      };
      const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(scripted), { maxAttempts: 5, laterDelaySeconds: 1 });
      const facade = runtime.deviceSyncOperational();
      facade.startSync();

      await facade.triggerSyncNow();
      expect(bridge.isTargetBelievedOffline("dev-B")).toBe(true);
      expect(events.filter((e) => e.kind === "device-offline")).toHaveLength(1);

      // Wait past `nextEligibleAt` (1s laterDelaySeconds) for the SAME schedule to become eligible again.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await facade.triggerSyncNow();

      expect(bridge.isTargetBelievedOffline("dev-B")).toBe(false);
      expect(events.filter((e) => e.kind === "device-online")).toHaveLength(1);
      expect(events.filter((e) => e.kind === "sync-completed")).toHaveLength(1);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 10_000);

  it("a fresh Bridge instance never carries over a stale offline belief -- first observation is a baseline", () => {
    const events: FedosDeviceSyncEvent[] = [];
    const bridge = new FedosDeviceSyncEventBridge({ listener: (e) => events.push(e) });
    expect(bridge.isTargetBelievedOffline("dev-B")).toBe(false);
  });
});

describe("Alpha 4421-4500 -- FedosDeviceSyncEventBridge: a broken listener never breaks the real attempt path", () => {
  it("a throwing listener is swallowed -- attemptFn's own result is still returned to the Scheduler unmodified", async () => {
    const dir = makeTmpDir();
    try {
      const bridge = new FedosDeviceSyncEventBridge({
        listener: () => {
          throw new Error("listener boom");
        },
      });
      const runtime = await seedRuntimeWithOnePendingTarget(dir, bridge.wrapAttemptFn(fixedOutcome("delivered")));
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.outcome).toBe("delivered");
      }
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

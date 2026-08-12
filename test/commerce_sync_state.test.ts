import { describe, it, expect } from "vitest";
import {
  deriveCommerceSyncStatus,
  describeCommerceSyncStatus,
  CommerceSyncTracker,
  type CommerceSyncSnapshot,
  type CommerceSyncStatus,
} from "../src/os/commerce/order/sync_state.js";

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — sync-state
 * derivation must be HONEST: never claim "up-to-date"/"connected" while a
 * real problem (offline, failed attempt) is in effect, and never claim
 * freshness indefinitely from one old success. See `sync_state.ts`'s own
 * header for the full contract this file proves.
 */

const NOW = 1_000_000;

function snap(overrides: Partial<CommerceSyncSnapshot>): CommerceSyncSnapshot {
  return {
    isOffline: false,
    inFlight: false,
    lastAttemptAt: null,
    lastAttemptSucceeded: null,
    now: NOW,
    ...overrides,
  };
}

describe("deriveCommerceSyncStatus — priority/truth table", () => {
  it("offline wins over every other signal, including mid-flight or a recent success", () => {
    expect(deriveCommerceSyncStatus(snap({ isOffline: true }))).toBe("offline");
    expect(deriveCommerceSyncStatus(snap({ isOffline: true, inFlight: true }))).toBe("offline");
    expect(
      deriveCommerceSyncStatus(snap({ isOffline: true, lastAttemptSucceeded: true, lastAttemptAt: NOW - 1000 })),
    ).toBe("offline");
    expect(deriveCommerceSyncStatus(snap({ isOffline: true, lastAttemptSucceeded: false, lastAttemptAt: NOW - 1000 }))).toBe(
      "offline",
    );
  });

  it("in-flight (and online) reports 'syncing', even with a prior failure on record", () => {
    expect(deriveCommerceSyncStatus(snap({ inFlight: true }))).toBe("syncing");
    expect(deriveCommerceSyncStatus(snap({ inFlight: true, lastAttemptSucceeded: false, lastAttemptAt: NOW - 1000 }))).toBe(
      "syncing",
    );
  });

  it("the most recent COMPLETED attempt having failed reports 'sync-failed' -- never silently falls back to a success claim", () => {
    expect(deriveCommerceSyncStatus(snap({ lastAttemptSucceeded: false, lastAttemptAt: NOW - 1000 }))).toBe("sync-failed");
  });

  it("a recent success within the fresh window reports 'up-to-date'", () => {
    expect(deriveCommerceSyncStatus(snap({ lastAttemptSucceeded: true, lastAttemptAt: NOW - 1000 }))).toBe("up-to-date");
    // Exactly at the boundary is still fresh.
    expect(deriveCommerceSyncStatus(snap({ lastAttemptSucceeded: true, lastAttemptAt: NOW - 15_000 }))).toBe("up-to-date");
  });

  it("a STALE success (past the fresh window) degrades to 'connected' -- never keeps claiming 'up-to-date' forever", () => {
    expect(deriveCommerceSyncStatus(snap({ lastAttemptSucceeded: true, lastAttemptAt: NOW - 15_001 }))).toBe("connected");
    expect(deriveCommerceSyncStatus(snap({ lastAttemptSucceeded: true, lastAttemptAt: NOW - 10_000_000 }))).toBe("connected");
  });

  it("never having attempted a sync yet (but online, idle, no error) reports 'connected', never a fabricated 'up-to-date'", () => {
    expect(deriveCommerceSyncStatus(snap({}))).toBe("connected");
  });

  it("a bogus/negative age (clock skew, or now before lastAttemptAt) never fabricates 'up-to-date'", () => {
    expect(deriveCommerceSyncStatus(snap({ lastAttemptSucceeded: true, lastAttemptAt: NOW + 5000 }))).toBe("connected");
  });
});

describe("describeCommerceSyncStatus — honest, non-jargon copy for all five states", () => {
  const ALL_STATUSES: readonly CommerceSyncStatus[] = ["offline", "syncing", "sync-failed", "up-to-date", "connected"];

  it("every status has a non-empty label and detail sentence", () => {
    for (const status of ALL_STATUSES) {
      const text = describeCommerceSyncStatus(status);
      expect(text.label.length).toBeGreaterThan(0);
      expect(text.detail.length).toBeGreaterThan(0);
    }
  });

  it("never mentions implementation jargon (IPC/relay/poll/websocket) in any status text", () => {
    for (const status of ALL_STATUSES) {
      const text = describeCommerceSyncStatus(status);
      const combined = `${text.label} ${text.detail}`.toLowerCase();
      expect(combined).not.toMatch(/ipc|relay|poll|websocket|nostr/);
    }
  });

  it("'up-to-date' text genuinely claims freshness, and 'sync-failed'/'offline' never do", () => {
    expect(describeCommerceSyncStatus("up-to-date").detail.toLowerCase()).toMatch(/up to date/);
    expect(describeCommerceSyncStatus("sync-failed").detail.toLowerCase()).not.toMatch(/up to date/);
    expect(describeCommerceSyncStatus("offline").detail.toLowerCase()).not.toMatch(/up to date/);
  });
});

describe("CommerceSyncTracker — real bookkeeping across an attempt lifecycle", () => {
  it("starts with no attempt on record (never fabricates a success before any real fetch ran)", () => {
    const tracker = new CommerceSyncTracker();
    expect(deriveCommerceSyncStatus(tracker.snapshot(false, NOW))).toBe("connected");
  });

  it("begin() -> in flight -> reports 'syncing'", () => {
    const tracker = new CommerceSyncTracker();
    tracker.begin();
    expect(deriveCommerceSyncStatus(tracker.snapshot(false, NOW))).toBe("syncing");
  });

  it("begin() then complete(true, ...) -> 'up-to-date' immediately, degrades to 'connected' once stale", () => {
    const tracker = new CommerceSyncTracker();
    tracker.begin();
    tracker.complete(true, NOW);
    expect(deriveCommerceSyncStatus(tracker.snapshot(false, NOW))).toBe("up-to-date");
    expect(deriveCommerceSyncStatus(tracker.snapshot(false, NOW + 20_000))).toBe("connected");
  });

  it("begin() then complete(false, ...) -> 'sync-failed', and a LATER successful attempt overwrites it", () => {
    const tracker = new CommerceSyncTracker();
    tracker.begin();
    tracker.complete(false, NOW);
    expect(deriveCommerceSyncStatus(tracker.snapshot(false, NOW))).toBe("sync-failed");

    tracker.begin();
    tracker.complete(true, NOW + 1000);
    expect(deriveCommerceSyncStatus(tracker.snapshot(false, NOW + 1000))).toBe("up-to-date");
  });

  it("going offline reports 'offline' regardless of ANY prior tracked attempt outcome", () => {
    const tracker = new CommerceSyncTracker();
    tracker.begin();
    tracker.complete(true, NOW);
    expect(deriveCommerceSyncStatus(tracker.snapshot(true, NOW))).toBe("offline");
  });
});

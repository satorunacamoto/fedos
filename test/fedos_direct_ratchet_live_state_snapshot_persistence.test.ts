/**
 * Direct Ratchet Live-State Durability arc — targeted coverage for the
 * NEW code this arc adds/rewrites:
 *   - `FileFedosDirectRatchetLiveStateSnapshotPersistence`'s atomic
 *     rewrite-in-place storage shape (never append-forever).
 *   - `checkFedosDirectRatchetLiveStateSnapshotFreshness()` /
 *     `readFedosDirectRatchetLiveStateSnapshotSafe()`.
 *   - `checkpointFedosDirectRatchetSecretsV1()` /
 *     `restoreFedosDirectRatchetSealedStateV1()`'s freshness gate.
 *
 * Against `09_ACCEPTANCE_MATRIX.md` items 1, 3, 4, 6, 8, 9, 10, 11.
 * Deliberately crypto-free: every sealed-state field here is a synthetic
 * opaque string, since this layer never seals/unseals anything itself
 * (only `FedosDirectRatchetCryptographicSession.sealState()`/`restore()`,
 * unmodified by this arc, do that) — real end-to-end sealed-secret
 * restore-after-restart correctness is already covered by
 * `secure_runtime_alpha_7241_7320_direct_ratchet_repeated_restart.test.ts`
 * and the production sealing test files.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  InMemoryFedosDirectRatchetLiveStateSnapshotPersistence,
  FileFedosDirectRatchetLiveStateSnapshotPersistence,
  checkFedosDirectRatchetLiveStateSnapshotFreshness,
  readFedosDirectRatchetLiveStateSnapshotSafe,
  type FedosDirectRatchetLiveStateSnapshotV1,
} from "../src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import { InMemoryFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.js";
import {
  checkpointFedosDirectRatchetSecretsV1,
  restoreFedosDirectRatchetSealedStateV1,
} from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_secret_checkpoint.js";
import { FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS, type FedosDirectRatchetCounters } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_counters.js";
import type { FedosDirectRatchetSessionId, FedosDirectRatchetSuite } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSealedState } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.js";

const SUITE: FedosDirectRatchetSuite = "fedos-direct-ratchet-v1";
const SESSION_A = "session-a" as unknown as FedosDirectRatchetSessionId;
const SESSION_B = "session-b" as unknown as FedosDirectRatchetSessionId;

function counters(sendCounter: number, receiveCounter: number, previousChainCounter = 0): FedosDirectRatchetCounters {
  return { sendCounter, receiveCounter, previousChainCounter };
}

function syntheticSealedState(tag: string): FedosDirectRatchetSealedState {
  return {
    sealedRootKey: `sealed-root-${tag}`,
    sealedSendingChainKey: `sealed-sending-${tag}`,
    sealedReceivingChainKey: `sealed-receiving-${tag}`,
    sealedLocalRatchetPrivateKey: `sealed-private-${tag}`,
    sealedSkippedKeys: [],
  };
}

describe("checkFedosDirectRatchetLiveStateSnapshotFreshness", () => {
  it("null snapshot -> not-found", () => {
    expect(checkFedosDirectRatchetLiveStateSnapshotFreshness(null, FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS)).toBe("not-found");
  });

  it("snapshot counters exactly matching the durable ceiling -> fresh", () => {
    const snapshot: FedosDirectRatchetLiveStateSnapshotV1 = { schemaVersion: 1, sealedRootKey: "r", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(3, 2, 1) };
    expect(checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, counters(3, 2, 1))).toBe("fresh");
  });

  it("Agent R's finding: a validly-shaped snapshot behind the durable ceiling in sendCounter alone is stale, even though it would decrypt", () => {
    const snapshot: FedosDirectRatchetLiveStateSnapshotV1 = { schemaVersion: 1, sealedRootKey: "r", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(5, 5, 0) };
    expect(checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, counters(6, 5, 0))).toBe("stale");
  });

  it("behind the ceiling in receiveCounter alone is stale", () => {
    const snapshot: FedosDirectRatchetLiveStateSnapshotV1 = { schemaVersion: 1, sealedRootKey: "r", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(5, 5, 0) };
    expect(checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, counters(5, 6, 0))).toBe("stale");
  });

  it("behind the ceiling in previousChainCounter alone is stale", () => {
    const snapshot: FedosDirectRatchetLiveStateSnapshotV1 = { schemaVersion: 1, sealedRootKey: "r", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(5, 5, 0) };
    expect(checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, counters(5, 5, 1))).toBe("stale");
  });

  it("AHEAD of the durable ceiling is still fresh (the snapshot is the newer of the two by definition -- only BEHIND is ever rejected)", () => {
    const snapshot: FedosDirectRatchetLiveStateSnapshotV1 = { schemaVersion: 1, sealedRootKey: "r", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(9, 9, 0) };
    expect(checkFedosDirectRatchetLiveStateSnapshotFreshness(snapshot, counters(5, 5, 0))).toBe("fresh");
  });
});

describe("FileFedosDirectRatchetLiveStateSnapshotPersistence -- atomic rewrite-in-place storage shape (item 1)", () => {
  it("a second write for the SAME sessionId overwrites, never appends -- the on-disk file always holds exactly one current record per sessionId", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-"));
    try {
      const filePath = join(dir, "snapshot.json");
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      persistence.putSnapshot(SESSION_A as unknown as string, { schemaVersion: 1, sealedRootKey: "gen0-root", sealedSendingChainKey: "gen0-send", sealedReceivingChainKey: "gen0-recv", sealedLocalRatchetPrivateKey: "gen0-priv", counters: counters(0, 0, 0) });
      persistence.putSnapshot(SESSION_A as unknown as string, { schemaVersion: 1, sealedRootKey: "gen1-root", sealedSendingChainKey: "gen1-send", sealedReceivingChainKey: "gen1-recv", sealedLocalRatchetPrivateKey: "gen1-priv", counters: counters(3, 2, 0) });

      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual([SESSION_A as unknown as string]);
      expect(raw).not.toContain("gen0-root"); // the superseded record is genuinely gone, not merely shadowed

      const current = persistence.getSnapshot(SESSION_A as unknown as string);
      expect(current?.sealedRootKey).toBe("gen1-root");
      expect(current?.counters).toEqual(counters(3, 2, 0));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("two different sessions coexist independently in the same file (last-writer-wins is per-sessionId, never global)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-multi-"));
    try {
      const filePath = join(dir, "snapshot.json");
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      persistence.putSnapshot(SESSION_A as unknown as string, { schemaVersion: 1, sealedRootKey: "a-root", sealedSendingChainKey: null, sealedReceivingChainKey: null, sealedLocalRatchetPrivateKey: "a-priv", counters: counters(1, 0, 0) });
      persistence.putSnapshot(SESSION_B as unknown as string, { schemaVersion: 1, sealedRootKey: "b-root", sealedSendingChainKey: null, sealedReceivingChainKey: null, sealedLocalRatchetPrivateKey: "b-priv", counters: counters(0, 1, 0) });
      persistence.putSnapshot(SESSION_A as unknown as string, { schemaVersion: 1, sealedRootKey: "a-root-v2", sealedSendingChainKey: null, sealedReceivingChainKey: null, sealedLocalRatchetPrivateKey: "a-priv-v2", counters: counters(2, 0, 0) });

      expect(persistence.getSnapshot(SESSION_A as unknown as string)?.sealedRootKey).toBe("a-root-v2");
      expect(persistence.getSnapshot(SESSION_B as unknown as string)?.sealedRootKey).toBe("b-root"); // session B's write is untouched by session A's second write
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("FileFedosDirectRatchetLiveStateSnapshotPersistence -- missing/corrupt/schema-invalid (items 3, 4, 6)", () => {
  it("no file at all -> getSnapshot returns null (never throws) -- item 3, missing snapshot", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-missing-"));
    try {
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(join(dir, "does-not-exist.json"));
      expect(persistence.getSnapshot(SESSION_A as unknown as string)).toBeNull();
      const safe = readFedosDirectRatchetLiveStateSnapshotSafe(persistence, SESSION_A as unknown as string);
      expect(safe).toEqual({ snapshot: null, corrupt: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("invalid JSON on disk -> getSnapshot throws, and the safe reader converts that into an honest corrupt:true rather than propagating -- item 4", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-corrupt-"));
    try {
      const filePath = join(dir, "snapshot.json");
      writeFileSync(filePath, "{not valid json", "utf8");
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      expect(() => persistence.getSnapshot(SESSION_A as unknown as string)).toThrow();
      const safe = readFedosDirectRatchetLiveStateSnapshotSafe(persistence, SESSION_A as unknown as string);
      expect(safe).toEqual({ snapshot: null, corrupt: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("truncated JSON on disk (a real crash-mid-write shape) -> same corrupt:true handling, never a false-good read", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-truncated-"));
    try {
      const filePath = join(dir, "snapshot.json");
      const full = JSON.stringify({ [SESSION_A as unknown as string]: { schemaVersion: 1, sealedRootKey: "root", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(1, 1, 0) } });
      writeFileSync(filePath, full.slice(0, Math.floor(full.length / 2)), "utf8");
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      const safe = readFedosDirectRatchetLiveStateSnapshotSafe(persistence, SESSION_A as unknown as string);
      expect(safe.corrupt).toBe(true);
      expect(safe.snapshot).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("well-formed JSON but an unsupported schemaVersion -> rejected as schema-invalid, never silently accepted -- item 6", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-schema-"));
    try {
      const filePath = join(dir, "snapshot.json");
      writeFileSync(filePath, JSON.stringify({ [SESSION_A as unknown as string]: { schemaVersion: 2, sealedRootKey: "root", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: counters(1, 1, 0) } }), "utf8");
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      expect(() => persistence.getSnapshot(SESSION_A as unknown as string)).toThrow();
      const safe = readFedosDirectRatchetLiveStateSnapshotSafe(persistence, SESSION_A as unknown as string);
      expect(safe).toEqual({ snapshot: null, corrupt: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("well-formed JSON but missing/malformed counters -> rejected as schema-invalid (the freshness gate has nothing safe to compare against otherwise)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-badcounters-"));
    try {
      const filePath = join(dir, "snapshot.json");
      writeFileSync(filePath, JSON.stringify({ [SESSION_A as unknown as string]: { schemaVersion: 1, sealedRootKey: "root", sealedSendingChainKey: "s", sealedReceivingChainKey: "v", sealedLocalRatchetPrivateKey: "p", counters: { sendCounter: -1, receiveCounter: 0, previousChainCounter: 0 } } }), "utf8");
      const persistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      expect(() => persistence.getSnapshot(SESSION_A as unknown as string)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("checkpointFedosDirectRatchetSecretsV1 / restoreFedosDirectRatchetSealedStateV1 -- freshness-gated restore", () => {
  it("a freshly-checkpointed session restores exactly the sealed fields it was given, when durableCounters match", () => {
    const snapshotPersistence = new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence();
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    const sealed = syntheticSealedState("v1");
    checkpointFedosDirectRatchetSecretsV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, SUITE, 0, sealed, 1_700_000_000_000, counters(1, 0, 0));

    const restored = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, counters(1, 0, 0));
    expect(restored).not.toBeNull();
    expect(restored?.sealedRootKey).toBe(sealed.sealedRootKey);
    expect(restored?.sealedSendingChainKey).toBe(sealed.sealedSendingChainKey);
    expect(restored?.sealedLocalRatchetPrivateKey).toBe(sealed.sealedLocalRatchetPrivateKey);
  });

  it("item 8 (Agent R): a durably-committed counter advance past what the snapshot carries makes restore fail closed, even though the snapshot itself is genuinely well-formed -- the classic stale-chain-position-replay case", () => {
    const snapshotPersistence = new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence();
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    checkpointFedosDirectRatchetSecretsV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, SUITE, 0, syntheticSealedState("stale"), 1_700_000_000_000, counters(3, 3, 0));

    // The session's own durable counter record (commitCounters()) has since
    // advanced further than this checkpoint's own embedded counters --
    // simulating exactly the active-rollback scenario this file's header
    // documents (an attacker, or a stale backup, replacing the current
    // snapshot with an older-but-validly-shaped one).
    const restored = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, counters(4, 3, 0));
    expect(restored, "a stale snapshot must never be restored, regardless of how well-formed it is").toBeNull();
  });

  it("item 11: a session that was never checkpointed at all (the universal legacy/metadata-only case) fails closed identically to a stale one -- both correctly route to the same reset-required path", () => {
    const snapshotPersistence = new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence();
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    const restored = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS);
    expect(restored).toBeNull();
  });

  it("item 4/12 (corrupt on-disk file): restore fails closed rather than throwing an uncaught exception through the send/receive path", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-live-state-snapshot-restore-corrupt-"));
    try {
      const filePath = join(dir, "snapshot.json");
      writeFileSync(filePath, "not json at all", "utf8");
      const snapshotPersistence = new FileFedosDirectRatchetLiveStateSnapshotPersistence(filePath);
      const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
      expect(() => restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS)).not.toThrow();
      const restored = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS);
      expect(restored).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("item 10 (isolation): a checkpoint for one sessionId is never restorable under a different sessionId -- same binding-key barrier as before, unaffected by the storage-shape fix", () => {
    const snapshotPersistence = new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence();
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    checkpointFedosDirectRatchetSecretsV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, SUITE, 0, syntheticSealedState("owned-by-a"), 1_700_000_000_000, counters(1, 0, 0));

    const restoredUnderWrongSession = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_B, 0, FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS);
    expect(restoredUnderWrongSession, "session B must never see session A's own checkpointed secrets").toBeNull();
  });

  it("item 9 (duplicate/concurrent write): re-checkpointing the SAME session with advanced counters is well-defined last-writer-wins, never ambiguous", () => {
    const snapshotPersistence = new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence();
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    checkpointFedosDirectRatchetSecretsV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, SUITE, 0, syntheticSealedState("first"), 1_700_000_000_000, counters(1, 0, 0));
    checkpointFedosDirectRatchetSecretsV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, SUITE, 0, syntheticSealedState("second"), 1_700_000_000_001, counters(2, 0, 0));

    const restored = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, counters(2, 0, 0));
    expect(restored?.sealedRootKey).toBe("sealed-root-second");

    // The FIRST checkpoint's own counters must never satisfy a freshness
    // check that requires the SECOND checkpoint's ceiling -- proves the
    // overwrite genuinely replaced the record rather than merging/keeping
    // the older one reachable under any durable-counter value.
    const restoredAgainstOldCeiling = restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, SESSION_A, 0, counters(1, 0, 0));
    expect(restoredAgainstOldCeiling?.sealedRootKey).toBe("sealed-root-second");
  });
});

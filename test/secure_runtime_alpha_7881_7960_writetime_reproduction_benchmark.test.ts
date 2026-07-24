/**
 * Secure Runtime Alpha 7881-7960 — Phase B: bounded reproduction harness
 * for the CURRENT (pre-fix) `AppendOnlyFedosDeliveryObservationPersistence`
 * write-time behavior. This file measures and logs real numbers; it is
 * the "before" half of the mission's own required before/after
 * performance report (see
 * `docs/secure_runtime_alpha_7881_7960_write_index_design_and_crash_consistency.md`).
 * It intentionally does NOT assert tight timing thresholds — timing
 * varies by machine — it only proves the qualitative shape (cost of a
 * single write/lookup grows with prior log size T) that Stage 2 of this
 * Arc exists to eliminate.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/board/observation/append_only_fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "../src/board/observation/fedos_delivery_observation_codec.js";

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-7881-7960-writetime-repro-"));
}

function fixtureRecord(i: number): FedosPersistedDeliveryObservationRecordV1 {
  return {
    schemaVersion: 1,
    id: `repro-subject-${i}::accepted::${1_700_000_000_000 + i}`,
    subjectId: `repro-subject-${i}`,
    state: "accepted",
    observedAt: 1_700_000_000_000 + i,
  } as FedosPersistedDeliveryObservationRecordV1;
}

/** Bulk-writes T valid, unique records directly to disk -- NOT through `putObservation`, so fixture construction itself stays fast (bounded, not O(T^2)) regardless of how large T is. */
function buildFixture(filePath: string, count: number): void {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(JSON.stringify(fixtureRecord(i)));
  }
  writeFileSync(filePath, lines.join("\n") + (count > 0 ? "\n" : ""), "utf8");
}

describe("Secure Runtime Alpha 7881-7960 -- Phase B reproduction: current write-time O(T) behavior", () => {
  it("1. a single new-id `putObservation` call costs more as prior log size T grows (100 / 1000 / 4000 / 10000)", () => {
    const dir = makeDir();
    try {
      const sizes = [100, 1000, 4000, 10000];
      const timings: Record<number, number> = {};
      for (const size of sizes) {
        const logPath = join(dir, `t-${size}.ndjson`);
        buildFixture(logPath, size);
        const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
        const start = performance.now();
        const result = persistence.putObservation(fixtureRecord(size)); // one brand-new id
        const elapsedMs = performance.now() - start;
        timings[size] = elapsedMs;
        expect(result).toBe("inserted");
      }
      // eslint-disable-next-line no-console
      console.log("[7881-7960 Phase B reproduction] single-insert cost by prior T (ms):", timings);
      // Qualitative reproduction, not a strict regression gate: T=10000 must not be
      // cheaper than T=100 -- if it were, the O(T) claim itself would be false and this
      // Arc's own premise would need re-examination before any fix is written.
      expect(timings[10000]!).toBeGreaterThanOrEqual(timings[100]!);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. duplicate (already-present) insert at large T is also O(T) -- full replay runs before the equality check can short-circuit", () => {
    const dir = makeDir();
    try {
      const size = 10000;
      const logPath = join(dir, "dup.ndjson");
      buildFixture(logPath, size);
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const existingRecord = fixtureRecord(size - 1); // last fixture record, already on disk
      const start = performance.now();
      const result = persistence.putObservation(existingRecord);
      const elapsedMs = performance.now() - start;
      // eslint-disable-next-line no-console
      console.log(`[7881-7960 Phase B reproduction] duplicate insert at T=${size} took ${elapsedMs.toFixed(3)}ms`);
      expect(result).toBe("already-present");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. conflicting (same id, different content) insert at large T is also O(T)", () => {
    const dir = makeDir();
    try {
      const size = 10000;
      const logPath = join(dir, "conflict.ndjson");
      buildFixture(logPath, size);
      const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const conflicting: FedosPersistedDeliveryObservationRecordV1 = {
        ...fixtureRecord(size - 1),
        state: "rejected",
      } as FedosPersistedDeliveryObservationRecordV1;
      const start = performance.now();
      const result = persistence.putObservation(conflicting);
      const elapsedMs = performance.now() - start;
      // eslint-disable-next-line no-console
      console.log(`[7881-7960 Phase B reproduction] conflicting insert at T=${size} took ${elapsedMs.toFixed(3)}ms`);
      expect(result).toBe("conflict");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. restart/rebuild cost (first listObservations() call over a fresh instance) at T=10000 and T=100000", () => {
    const dir = makeDir();
    try {
      for (const size of [10000, 100000]) {
        const logPath = join(dir, `restart-${size}.ndjson`);
        buildFixture(logPath, size);
        const persistence = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
        const start = performance.now();
        const all = persistence.listObservations();
        const elapsedMs = performance.now() - start;
        // eslint-disable-next-line no-console
        console.log(`[7881-7960 Phase B reproduction] restart rebuild at T=${size} took ${elapsedMs.toFixed(3)}ms`);
        expect(all.length).toBe(size);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

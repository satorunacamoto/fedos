/**
 * Secure Runtime Alpha 7881-7960 — Phase G: performance acceptance for
 * the new lazy write index, re-running the methodology from
 * `test/secure_runtime_alpha_7881_7960_writetime_reproduction_benchmark.test.ts`
 * (the "before" half) against the FIXED implementation (the "after"
 * half). Numbers are logged for the before/after performance report;
 * assertions are qualitative (no more per-write O(T) growth on a single
 * warm instance) rather than tight thresholds, since wall-clock timing
 * varies by machine.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/append_only_fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "../src/os/messenger/board/observation/fedos_delivery_observation_codec.js";

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-7881-7960-perf-"));
}

function fixtureRecord(i: number): FedosPersistedDeliveryObservationRecordV1 {
  return {
    schemaVersion: 1,
    id: `perf-subject-${i}::accepted::${1_700_000_000_000 + i}`,
    subjectId: `perf-subject-${i}`,
    state: "accepted",
    observedAt: 1_700_000_000_000 + i,
  } as FedosPersistedDeliveryObservationRecordV1;
}

function buildFixture(filePath: string, count: number): void {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) lines.push(JSON.stringify(fixtureRecord(i)));
  writeFileSync(filePath, lines.join("\n") + (count > 0 ? "\n" : ""), "utf8");
}

describe("Secure Runtime Alpha 7881-7960 -- Phase G performance acceptance (post-fix)", () => {
  it("1. N sequential appends on ONE warm instance no longer scale quadratically: 100 / 1000 / 4000 / 10000", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "seq.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const checkpoints = [100, 1000, 4000, 10000];
      const cumulativeAt: Record<number, number> = {};
      const start = performance.now();
      let written = 0;
      for (const checkpoint of checkpoints) {
        while (written < checkpoint) {
          expect(p.putObservation(fixtureRecord(written))).toBe("inserted");
          written++;
        }
        cumulativeAt[checkpoint] = performance.now() - start;
      }
      // eslint-disable-next-line no-console
      console.log("[7881-7960 Phase G after-fix] cumulative time for N sequential appends on one instance (ms):", cumulativeAt);
      // O(N^2) growth would make the 10000 -> 1000 ratio roughly (10000/1000)^2 = 100x the per-step cost,
      // i.e. cumulative[10000] would dwarf cumulative[1000] by ~100x or more; O(N) growth keeps that
      // ratio close to 10x. Assert well below the quadratic prediction, generously bounded for timing noise.
      const ratio = cumulativeAt[10000]! / Math.max(cumulativeAt[1000]!, 0.001);
      expect(ratio, `10000/1000 cumulative-time ratio was ${ratio}, expected roughly linear (~10x), not quadratic (~100x)`).toBeLessThan(40);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. one write at T=100,000 (prebuilt fixture): first call pays the one-time index build; a SECOND write on the SAME warm instance is cheap regardless of T", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "large.ndjson");
      buildFixture(logPath, 100_000);
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);

      const firstStart = performance.now();
      expect(p.putObservation(fixtureRecord(100_000))).toBe("inserted"); // pays the one-time rebuild
      const firstElapsed = performance.now() - firstStart;

      const secondStart = performance.now();
      expect(p.putObservation(fixtureRecord(100_001))).toBe("inserted"); // warm index, O(1) average
      const secondElapsed = performance.now() - secondStart;

      // eslint-disable-next-line no-console
      console.log(`[7881-7960 Phase G after-fix] T=100000: first write (cold, pays rebuild) ${firstElapsed.toFixed(3)}ms, second write (warm) ${secondElapsed.toFixed(3)}ms`);
      expect(secondElapsed, "a second write on an already-warm instance must be far cheaper than the cold first write at T=100000").toBeLessThan(firstElapsed);
      expect(secondElapsed).toBeLessThan(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("3. duplicate/conflict lookup on a warm instance at large T is O(1) average, not O(T)", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "lookup.ndjson");
      buildFixture(logPath, 10_000);
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      p.listObservations(); // warm the index once

      const dupStart = performance.now();
      expect(p.putObservation(fixtureRecord(9_999))).toBe("already-present");
      const dupElapsed = performance.now() - dupStart;

      const conflictStart = performance.now();
      expect(p.putObservation({ ...fixtureRecord(9_998), state: "rejected" })).toBe("conflict");
      const conflictElapsed = performance.now() - conflictStart;

      // eslint-disable-next-line no-console
      console.log(`[7881-7960 Phase G after-fix] warm duplicate lookup ${dupElapsed.toFixed(3)}ms, warm conflict lookup ${conflictElapsed.toFixed(3)}ms`);
      expect(dupElapsed).toBeLessThan(5);
      expect(conflictElapsed).toBeLessThan(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. startup rebuild cost is unchanged (still one O(T) pass) -- this Arc never claims O(1) filesystem/rebuild cost, only O(1) average lookup on an already-warm instance", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "restart.ndjson");
      buildFixture(logPath, 10_000);
      const fresh = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const start = performance.now();
      const all = fresh.listObservations();
      const elapsed = performance.now() - start;
      // eslint-disable-next-line no-console
      console.log(`[7881-7960 Phase G after-fix] restart rebuild at T=10000 (unchanged, still O(T)) took ${elapsed.toFixed(3)}ms`);
      expect(all.length).toBe(10_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

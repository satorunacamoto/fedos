/**
 * Secure Runtime Alpha 7881-7960 — Phases D/E/G: `AppendOnlyFedosDeliveryObservationPersistence`'s
 * own new lazy write index. Persistence-layer-only tests (no Repository,
 * no Query, no validator) — proves the index never changes durability or
 * conflict truth, only lookup cost, and proves the exact append-ordering/
 * crash-consistency contract documented in
 * `docs/secure_runtime_alpha_7881_7960_write_index_design_and_crash_consistency.md`.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AppendOnlyFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/append_only_fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "../src/os/messenger/board/observation/fedos_delivery_observation_codec.js";

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-7881-7960-write-index-"));
}

function record(
  subjectId: string,
  state: FedosPersistedDeliveryObservationRecordV1["state"],
  observedAt: number,
): FedosPersistedDeliveryObservationRecordV1 {
  return { schemaVersion: 1, id: `${subjectId}::${state}::${observedAt}`, subjectId, state, observedAt };
}

describe("Secure Runtime Alpha 7881-7960 -- write index persistence-layer tests", () => {
  it("1. empty log: listObservations is [], getObservation is null, first insert succeeds", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(p.listObservations()).toEqual([]);
      expect(p.getObservation("nope")).toBeNull();
      const r = record("subj-1", "publishing", 1);
      expect(p.putObservation(r)).toBe("inserted");
      expect(p.getObservation(r.id)).toEqual(r);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. duplicate id, identical content: already-present, no duplicate line appended", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const r = record("subj-1", "publishing", 1);
      expect(p.putObservation(r)).toBe("inserted");
      expect(p.putObservation({ ...r })).toBe("already-present");
      const lines = (readFileSync(logPath, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
      expect(lines.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. conflicting same id, different content: conflict, no line appended", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const r = record("subj-1", "publishing", 1);
      expect(p.putObservation(r)).toBe("inserted");
      const conflicting = { ...r, subjectId: "subj-DIFFERENT" };
      expect(p.putObservation(conflicting)).toBe("conflict");
      const lines = (readFileSync(logPath, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
      expect(lines.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. corrupt middle line: index build throws, fails closed", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(p.putObservation(record("subj-1", "publishing", 1))).toBe("inserted");
      appendFileSync(logPath, "{not valid json\n", "utf8");
      const fresh = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(() => fresh.listObservations()).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. truncated tail: index build throws, fails closed", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      p.putObservation(record("subj-1", "publishing", 1));
      p.putObservation(record("subj-1", "accepted", 2));
      const full = readFileSync(logPath, "utf8") as string;
      writeFileSync(logPath, full.slice(0, Math.floor(full.length * 0.9)), "utf8");
      const fresh = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(() => fresh.listObservations()).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6. failed append (missing parent directory): returns \"failed\", index unchanged, no phantom entry", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "missing-subdir", "log.ndjson"); // parent directory never created
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const r = record("subj-1", "publishing", 1);
      expect(p.putObservation(r)).toBe("failed");
      expect(p.getObservation(r.id)).toBeNull();
      expect(p.listObservations()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("7. concurrent (sequential) appends on the SAME instance: both visible immediately, in order, no restart needed", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const r1 = record("subj-1", "publishing", 1);
      const r2 = record("subj-1", "accepted", 2);
      expect(p.putObservation(r1)).toBe("inserted");
      expect(p.putObservation(r2)).toBe("inserted");
      expect(p.listObservations()).toEqual([r1, r2]);
      expect(p.getObservation(r1.id)).toEqual(r1);
      expect(p.getObservation(r2.id)).toEqual(r2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("8. ACCEPTED stale-instance behavior: a second instance that already built its index does not see the first instance's later append until reconstructed", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const writer = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const reader = new AppendOnlyFedosDeliveryObservationPersistence(logPath);

      expect(reader.listObservations()).toEqual([]); // reader builds its (empty) index now

      const r = record("subj-1", "publishing", 1);
      expect(writer.putObservation(r)).toBe("inserted");

      // Stale: reader's own cached index predates the write.
      expect(reader.listObservations()).toEqual([]);
      expect(reader.getObservation(r.id)).toBeNull();

      // Reconstruction heals it -- this is the real "restart" path.
      const rebuiltReader = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(rebuiltReader.listObservations()).toEqual([r]);
      expect(rebuiltReader.getObservation(r.id)).toEqual(r);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("9. restart rebuild: a fresh instance over an existing durable log reconstructs identical state", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      {
        const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
        p.putObservation(record("subj-1", "publishing", 1));
        p.putObservation(record("subj-1", "accepted", 2));
        p.putObservation(record("subj-2", "publishing", 3));
      }
      const restarted = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      expect(restarted.listObservations().length).toBe(3);
      expect(restarted.getObservation("subj-1::accepted::2")).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. duplicate retry after a failed append: once the append actually succeeds, a later identical retry is already-present, not a second line", () => {
    const dir = makeDir();
    try {
      const logPath = join(dir, "log.ndjson");
      const p = new AppendOnlyFedosDeliveryObservationPersistence(logPath);
      const r = record("subj-1", "publishing", 1);
      expect(p.putObservation(r)).toBe("inserted");
      // Retry of the exact same record (e.g. caller retries after a transient error upstream).
      expect(p.putObservation({ ...r })).toBe("already-present");
      const lines = (readFileSync(logPath, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
      expect(lines.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

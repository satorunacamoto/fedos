/**
 * Secure Runtime Alpha 3641–3720 — Append-Only Device Sync Observation
 * Repository. Mirrors `../../../board/observation/append_only_fedos_delivery_observation_persistence.ts`'s
 * own NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption, zero new dependency.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosDeviceRelaySyncObservationId,
  isWellFormedFedosDeviceRelaySyncObservationV1,
  type FedosDeviceRelaySyncObservationRepository,
  type FedosDeviceRelaySyncObservationState,
  type FedosDeviceRelaySyncObservationV1,
  type FedosDeviceRelaySyncObservationWriteResult,
} from "../fedos_device_relay_sync_observation.js";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

function factsAreEqual(a: FedosDeviceRelaySyncObservationV1, b: FedosDeviceRelaySyncObservationV1): boolean {
  return a.subjectId === b.subjectId && a.state === b.state && a.observedAt === b.observedAt && a.reason === b.reason;
}

function replayLog(filePath: string): FedosDeviceRelaySyncObservationV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosDeviceRelaySyncObservationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isWellFormedFedosDeviceRelaySyncObservationV1(parsedJson)) {
      throw new Error("AppendOnlyFedosDeviceRelaySyncObservationRepository: corrupt or schema-invalid record found in log file.");
    }
    const fact = Object.freeze({ ...parsedJson }) as FedosDeviceRelaySyncObservationV1;
    const existing = byId.get(fact.id);
    if (existing === undefined) {
      byId.set(fact.id, fact);
    } else if (!factsAreEqual(existing, fact)) {
      throw new Error(`AppendOnlyFedosDeviceRelaySyncObservationRepository: conflicting duplicate records for id "${fact.id}" found in log file.`);
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosDeviceRelaySyncObservationRepository implements FedosDeviceRelaySyncObservationRepository {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  record(subjectId: string, state: FedosDeviceRelaySyncObservationState, observedAt: number, reason: string | null = null): FedosDeviceRelaySyncObservationWriteResult {
    if (typeof subjectId !== "string" || subjectId.trim().length === 0) return "failed";
    const id = fedosDeviceRelaySyncObservationId(subjectId, state, observedAt);
    const fact: FedosDeviceRelaySyncObservationV1 = Object.freeze({ id, subjectId, state, observedAt, reason });
    const existing = replayLog(this.#filePath).find((f) => f.id === id) ?? null;
    if (existing !== null) {
      return factsAreEqual(existing, fact) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(fact) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "recorded";
  }

  get(id: string): FedosDeviceRelaySyncObservationV1 | null {
    return replayLog(this.#filePath).find((f) => f.id === id) ?? null;
  }

  list(): readonly FedosDeviceRelaySyncObservationV1[] {
    return replayLog(this.#filePath);
  }

  listBySubject(subjectId: string): readonly FedosDeviceRelaySyncObservationV1[] {
    return this.list().filter((fact) => fact.subjectId === subjectId);
  }
}

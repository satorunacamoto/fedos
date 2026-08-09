/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase F/I: Append-Only Replay Persistence.
 *
 * Mirrors `./append_only_fedos_device_registry_persistence.ts`'s own
 * NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption (one unparseable line or
 * one irreconcilable duplicate key throws unconditionally), zero new
 * dependency, no compaction/delete/rewrite. This is what gives the replay
 * guard restart-safety: a consumed nonce recorded before a crash is still
 * consumed after restart, because `getConsumption()` replays this same log.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { deserializeFedosDeviceBindingChallengeConsumption } from "./fedos_device_binding_challenge_replay_codec.js";
import {
  fedosDeviceBindingChallengeConsumptionKey,
  fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual,
  type FedosDeviceBindingChallengeReplayPersistence,
  type FedosDeviceBindingChallengeReplayWriteResult,
} from "./fedos_device_binding_challenge_replay_persistence.js";
import type { FedosPersistedDeviceBindingChallengeConsumptionV1 } from "./fedos_persisted_device_binding_challenge_consumption_v1.js";

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

/** PRIVATE — replays the append log into a deduplicated array. A parse/schema failure or an irreconcilable duplicate throws unconditionally (fail-closed on corruption). */
function replayLog(filePath: string): FedosPersistedDeviceBindingChallengeConsumptionV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedDeviceBindingChallengeConsumptionV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    const parsed = deserializeFedosDeviceBindingChallengeConsumption(parsedJson);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDeviceBindingChallengeReplayPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosDeviceBindingChallengeConsumptionKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDeviceBindingChallengeReplayPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosDeviceBindingChallengeReplayPersistence implements FedosDeviceBindingChallengeReplayPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putConsumption(record: FedosPersistedDeviceBindingChallengeConsumptionV1): FedosDeviceBindingChallengeReplayWriteResult {
    const key = fedosDeviceBindingChallengeConsumptionKey(record);
    const existing = replayLog(this.#filePath).find((r) => fedosDeviceBindingChallengeConsumptionKey(r) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getConsumption(nonce: string): FedosPersistedDeviceBindingChallengeConsumptionV1 | null {
    return replayLog(this.#filePath).find((r) => r.nonce === nonce) ?? null;
  }
}

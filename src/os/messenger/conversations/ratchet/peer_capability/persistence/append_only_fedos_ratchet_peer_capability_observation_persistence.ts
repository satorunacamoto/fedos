/**
 * Secure Runtime Alpha 5721–5800 — Append-Only Peer Capability
 * Observation Persistence. Mirrors
 * `../../persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.ts`'s
 * NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption (one unparseable line
 * or one irreconcilable duplicate key throws unconditionally), zero new
 * dependency, no compaction/delete/rewrite. This is what gives restart
 * replay (Phase P step 10): an observation recorded before a restart is
 * still on file after, because `listObservations()` replays this same
 * log.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import type { FedosDeviceBindingAccountRef } from "../../../../../../device/fedos_device_binding.js";
import {
  decodeFedosRatchetPeerCapabilityObservationV1,
  encodeFedosRatchetPeerCapabilityObservationV1,
} from "../../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.js";
import {
  fedosRatchetPeerCapabilityObservationKey,
  fedosRatchetPeerCapabilityObservationsAreEqual,
  fedosRatchetPeerCapabilityObservationSubjectKey,
  type FedosRatchetPeerCapabilityObservationPersistence,
  type FedosRatchetPeerCapabilityObservationWriteResult,
} from "../../../../../../conversation/ratchet/peer_capability/persistence/fedos_ratchet_peer_capability_observation_persistence.js";
import type { FedosRatchetPeerCapabilityObservationV1 } from "../../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.js";

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
function replayLog(filePath: string): FedosRatchetPeerCapabilityObservationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosRatchetPeerCapabilityObservationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosRatchetPeerCapabilityObservationV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosRatchetPeerCapabilityObservationPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosRatchetPeerCapabilityObservationKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosRatchetPeerCapabilityObservationsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosRatchetPeerCapabilityObservationPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosRatchetPeerCapabilityObservationPersistence implements FedosRatchetPeerCapabilityObservationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putObservation(record: FedosRatchetPeerCapabilityObservationV1): FedosRatchetPeerCapabilityObservationWriteResult {
    const key = fedosRatchetPeerCapabilityObservationKey(record);
    const existing = replayLog(this.#filePath).find((r) => fedosRatchetPeerCapabilityObservationKey(r) === key) ?? null;
    if (existing !== null) {
      return fedosRatchetPeerCapabilityObservationsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, encodeFedosRatchetPeerCapabilityObservationV1(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listObservations(): readonly FedosRatchetPeerCapabilityObservationV1[] {
    return replayLog(this.#filePath);
  }

  listObservationsForPeerDevice(
    localDeviceRef: string,
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
  ): readonly FedosRatchetPeerCapabilityObservationV1[] {
    const subject = fedosRatchetPeerCapabilityObservationSubjectKey(localDeviceRef, peerAccountRef, peerDeviceRef);
    return replayLog(this.#filePath).filter(
      (r) => fedosRatchetPeerCapabilityObservationSubjectKey(r.localDeviceRef, r.peerAccountRef, r.peerDeviceRef) === subject,
    );
  }
}

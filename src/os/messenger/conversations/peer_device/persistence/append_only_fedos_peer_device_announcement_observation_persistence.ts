/**
 * FedOS Peer Device Discovery Arc — Append-Only Peer Device Announcement
 * Observation Persistence. Mirrors
 * `../../ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption, zero new dependency, no
 * compaction/delete/rewrite. This is what gives restart replay: an
 * observation recorded before a restart is still on file after, because
 * `listObservations()` replays this same log.
 */
import { readFileSync, appendFileSync } from "node:fs";
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { decodeFedosPeerDeviceAnnouncementObservationV1, encodeFedosPeerDeviceAnnouncementObservationV1 } from "../fedos_peer_device_announcement_observation.js";
import {
  fedosPeerDeviceAnnouncementObservationKey,
  fedosPeerDeviceAnnouncementObservationsAreEqual,
  fedosPeerDeviceAnnouncementObservationSubjectKey,
  type FedosPeerDeviceAnnouncementObservationPersistence,
  type FedosPeerDeviceAnnouncementObservationWriteResult,
} from "./fedos_peer_device_announcement_observation_persistence.js";
import type { FedosPeerDeviceAnnouncementObservationV1 } from "../fedos_peer_device_announcement_observation.js";

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
function replayLog(filePath: string): FedosPeerDeviceAnnouncementObservationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPeerDeviceAnnouncementObservationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosPeerDeviceAnnouncementObservationV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosPeerDeviceAnnouncementObservationPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosPeerDeviceAnnouncementObservationKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPeerDeviceAnnouncementObservationsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosPeerDeviceAnnouncementObservationPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosPeerDeviceAnnouncementObservationPersistence implements FedosPeerDeviceAnnouncementObservationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putObservation(record: FedosPeerDeviceAnnouncementObservationV1): FedosPeerDeviceAnnouncementObservationWriteResult {
    const key = fedosPeerDeviceAnnouncementObservationKey(record);
    const existing = replayLog(this.#filePath).find((r) => fedosPeerDeviceAnnouncementObservationKey(r) === key) ?? null;
    if (existing !== null) {
      return fedosPeerDeviceAnnouncementObservationsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, encodeFedosPeerDeviceAnnouncementObservationV1(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listObservations(): readonly FedosPeerDeviceAnnouncementObservationV1[] {
    return replayLog(this.#filePath);
  }

  listObservationsForPeerDevice(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string): readonly FedosPeerDeviceAnnouncementObservationV1[] {
    const subject = fedosPeerDeviceAnnouncementObservationSubjectKey(localDeviceRef, peerAccountRef, deviceId);
    return replayLog(this.#filePath).filter((r) => fedosPeerDeviceAnnouncementObservationSubjectKey(r.localDeviceRef, r.peerAccountRef, r.deviceId) === subject);
  }
}

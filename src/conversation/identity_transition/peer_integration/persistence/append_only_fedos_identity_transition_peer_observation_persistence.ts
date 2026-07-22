/**
 * Secure Runtime Alpha 5961–6040 — Append-Only Peer Transition
 * Observation Persistence. Mirrors
 * `../../persistence/append_only_fedos_identity_transition_fact_persistence.ts`'s
 * NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption, zero new dependency,
 * no compaction/delete/rewrite.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosIdentityTransitionPeerObservationV1,
  encodeFedosIdentityTransitionPeerObservationV1,
  fedosIdentityTransitionPeerObservationKey,
  fedosIdentityTransitionPeerObservationLineageKeyParts,
  type FedosIdentityTransitionPeerObservationV1,
} from "../fedos_identity_transition_peer_observation.js";
import { determineFedosIdentityTransitionPeerObservationWriteOutcome, type FedosIdentityTransitionPeerObservationWriteOutcome } from "../fedos_identity_transition_peer_observation_conflict_detection.js";
import type { FedosIdentityTransitionPeerObservationPersistence } from "./fedos_identity_transition_peer_observation_persistence.js";

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

function replayLog(filePath: string): FedosIdentityTransitionPeerObservationV1[] {
  const contents = readLogFile(filePath);
  const observations: FedosIdentityTransitionPeerObservationV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosIdentityTransitionPeerObservationV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosIdentityTransitionPeerObservationPersistence: corrupt or schema-invalid record found in log file.");
    }
    observations.push(parsed);
  }
  return observations;
}

export class AppendOnlyFedosIdentityTransitionPeerObservationPersistence implements FedosIdentityTransitionPeerObservationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putObservation(observation: FedosIdentityTransitionPeerObservationV1): FedosIdentityTransitionPeerObservationWriteOutcome {
    const existing = replayLog(this.#filePath);
    const outcome = determineFedosIdentityTransitionPeerObservationWriteOutcome(existing, observation);
    if (outcome !== "inserted") return outcome;
    try {
      appendFileSync(this.#filePath, encodeFedosIdentityTransitionPeerObservationV1(observation) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listObservations(): readonly FedosIdentityTransitionPeerObservationV1[] {
    return replayLog(this.#filePath);
  }

  getObservation(
    localDeviceRef: string,
    peerAccountRef: FedosIdentityTransitionPeerObservationV1["peerAccountRef"],
    peerDeviceRef: string,
    transitionId: string,
  ): FedosIdentityTransitionPeerObservationV1 | null {
    const key = fedosIdentityTransitionPeerObservationKey({
      schemaVersion: 1,
      localDeviceRef,
      peerAccountRef,
      peerDeviceRef,
      transitionId,
    } as FedosIdentityTransitionPeerObservationV1);
    return replayLog(this.#filePath).find((o) => fedosIdentityTransitionPeerObservationKey(o) === key) ?? null;
  }

  listLineage(
    localDeviceRef: string,
    oldAccountAuthority: string,
    oldAccountPublicIdentifier: string,
    oldAccountIdentityId: string | null,
  ): readonly FedosIdentityTransitionPeerObservationV1[] {
    const key = fedosIdentityTransitionPeerObservationLineageKeyParts(localDeviceRef, oldAccountAuthority, oldAccountPublicIdentifier, oldAccountIdentityId);
    return replayLog(this.#filePath).filter(
      (o) => fedosIdentityTransitionPeerObservationLineageKeyParts(o.localDeviceRef, o.oldAccountIdentity.authority, o.oldAccountIdentity.publicIdentifier, o.oldAccountIdentity.identityId) === key,
    );
  }

  listObservationsForLocalDevice(localDeviceRef: string): readonly FedosIdentityTransitionPeerObservationV1[] {
    return replayLog(this.#filePath).filter((o) => o.localDeviceRef === localDeviceRef);
  }

  listObservationsForTransition(localDeviceRef: string, transitionId: string): readonly FedosIdentityTransitionPeerObservationV1[] {
    return replayLog(this.#filePath).filter((o) => o.localDeviceRef === localDeviceRef && o.transitionId === transitionId);
  }
}

/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase I: multi-Device status aggregation.
 *
 * A safe READ MODEL, never a mutation path. Deliberately per-Device,
 * never a single account-wide boolean (Phase I's own explicit
 * instruction). Reuses the SAME `FedosDeliveryObservationQuery` this
 * codebase already shares across Board/Conversation/Device-Relay-Sync
 * (Phase I's own "reuse existing... aggregation patterns" instruction) —
 * this file adds no new observation vocabulary of its own.
 *
 * HONEST SCOPE, stated precisely rather than silently overclaimed: this
 * Arc builds NO return-acknowledgement protocol (a receiving Device
 * signaling "I received and applied this fact" back to the sender would
 * be a second wire flow this Arc's own narrow scope does not include).
 * `"relay-accepted"` is therefore the STRONGEST per-Device status this
 * model can honestly report from the sending Device's own vantage point
 * — it means "a Relay took the event," never "the target Device actually
 * imported it" (the same Relay-ACK-is-not-receipt distinction this
 * codebase enforces everywhere else, Phase A reconciliation report §
 * Relay ACK semantics). A future Arc could add a real acknowledgement
 * fact (mirroring Signed Deletion's own Acknowledgement record) — not
 * built here, named in the completion declaration's own recommended next
 * Arc only if warranted.
 */

import type { FedosDeviceBindingAccountRef, FedosDeviceTrustState } from "../../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeliveryObservationRepository } from "../../../../board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../../../../board/observation/fedos_delivery_observation_query.js";
import { toFedosDeliveryObservationSubjectId } from "../../../../board/observation/fedos_delivery_observation.js";
import { fedosArchiveSuppressionFanoutSubjectId } from "../../../../device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.js";
import type { FedosArchiveSuppressionObservationAuthority } from "../../../../conversation/retention/fedos_archive_suppression_observation_authority.js";
import type { FedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";

/**
 * Per-Device status, from the SENDING Device's own local point of view.
 * Never claims: all Devices erased, all backups erased, recipient
 * erased, Relay erased, or that the target actually applied the fact.
 */
export type FedosArchiveSuppressionDeviceStatus =
  /** The Device Registry has no record of this deviceId at all -- never targeted, and cannot be. */
  | "unknown"
  /** The Device is currently revoked -- checked LIVE, overrides any historical observation (a revoked Device may still hold a copy from before revocation, but is never a future fanout target). */
  | "revoked"
  /** Currently trusted, but no fanout attempt has ever been recorded for this exact fact -- e.g. this Device paired AFTER the fact was created and broadcast (Phase B's own named "missing Device" edge case). */
  | "never-attempted"
  /** A fanout attempt is in flight (queued/publishing), outcome not yet known. */
  | "pending"
  /** A Relay accepted the outbound event -- Relay acceptance ONLY, see this file's own header. */
  | "relay-accepted"
  /** Every configured Relay rejected the outbound event. */
  | "relay-rejected"
  /** The attempt failed before or during publish (signing failure, every Relay unreachable, etc.) -- distinct from an explicit Relay rejection. */
  | "relay-failed";

export interface FedosArchiveSuppressionDeviceStatusEntry {
  readonly deviceId: string;
  readonly status: FedosArchiveSuppressionDeviceStatus;
}

export interface FedosArchiveSuppressionFactStatus {
  readonly factId: string;
  /** This LOCAL Device's own restore-suppression state for the fact's own subject, per `FedosArchiveSuppressionObservationAuthority.evaluateSuppression()` -- included here because it is the one honest "is this actually working, right now, on this Device" signal, distinct from any remote Device's own delivery status. */
  readonly localSuppressionActive: boolean;
  readonly devices: readonly FedosArchiveSuppressionDeviceStatusEntry[];
}

export interface FedosArchiveSuppressionStatusAggregationDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly observationRepository: FedosDeliveryObservationRepository;
  readonly suppressionAuthority: Pick<FedosArchiveSuppressionObservationAuthority, "evaluateSuppression">;
}

/** One fact's own per-Device fanout status, across every Device the account's own Registry currently knows about (trusted OR revoked -- an unknown deviceId simply never appears here, matching "unknown" being derivable only by a caller who supplies a candidate id the Registry doesn't recognize). */
export function aggregateFedosArchiveSuppressionFactStatus(
  factId: string,
  subjectRef: FedosConversationPayloadId,
  accountRef: FedosDeviceBindingAccountRef,
  deps: FedosArchiveSuppressionStatusAggregationDeps,
): FedosArchiveSuppressionFactStatus {
  const query = new FedosDeliveryObservationQuery(deps.observationRepository);
  const bindings = deps.registryPersistence.listBindingsForAccount(accountRef.authority, accountRef.publicIdentifier);

  const devices: FedosArchiveSuppressionDeviceStatusEntry[] = bindings.map((binding) => {
    if (binding.trustState === "revoked") {
      return { deviceId: binding.deviceId, status: "revoked" as const };
    }
    const subjectId = toFedosDeliveryObservationSubjectId(fedosArchiveSuppressionFanoutSubjectId(factId, binding.deviceId));
    const observation = subjectId === null ? null : query.currentStateFor(subjectId);
    if (observation === null) {
      return { deviceId: binding.deviceId, status: "never-attempted" as const };
    }
    const status: FedosArchiveSuppressionDeviceStatus =
      observation.state === "accepted"
        ? "relay-accepted"
        : observation.state === "rejected"
          ? "relay-rejected"
          : observation.state === "failed"
            ? "relay-failed"
            : "pending"; // "queued" | "publishing"
    return { deviceId: binding.deviceId, status };
  });

  return {
    factId,
    localSuppressionActive: deps.suppressionAuthority.evaluateSuppression(subjectRef, "restore") === "suppressed",
    devices,
  };
}

/** Convenience: resolves a single, specific candidate deviceId's status for one fact -- returns `"unknown"` if the Registry has no binding for it at all (the ONE status this function above can never itself produce, since it only ever enumerates REAL bindings). */
export function fedosArchiveSuppressionDeviceStatusFor(
  factStatus: FedosArchiveSuppressionFactStatus,
  deviceId: string,
): FedosArchiveSuppressionDeviceStatus {
  return factStatus.devices.find((entry) => entry.deviceId === deviceId)?.status ?? "unknown";
}

export type { FedosDeviceTrustState };

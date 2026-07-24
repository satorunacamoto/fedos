/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase F: the Outbound Coordinator.
 *
 * Sequence, per currently-trusted, same-account, non-self target Device:
 * (1) verify source (local) Device remains trusted, (2) resolve the
 * live, currently-trusted target Device set from the Device Registry —
 * NEVER a caller-supplied list, so a target that was revoked between
 * enqueue and send is naturally excluded, (3) build the wire payload
 * (Phase C fact + OPTIONAL Phase D device evidence), (4) sign through
 * the EXISTING, UNWIDENED `FedosNostrSigningAuthority.signEvent()`
 * (kind 1), (5) publish to the configured Relay set via the EXISTING,
 * REUSED `FedosDeviceRelaySyncPublisher` (Alpha 3641-3720, unmodified —
 * "do not create a new Relay transport if Device Sync already has a
 * suitable seam," this Arc's own Phase F instruction, honored literally:
 * the Publisher class itself is already fully generic over any
 * `FedosNostrWireEvent`), (6) record a durable, per-`(fact,
 * targetDevice)` Observation fact for each outcome via the SAME generic,
 * protocol-agnostic `FedosDeliveryObservationRepository` Board/
 * Conversation/Device-Relay-Sync all already share (Phase I's own
 * "reuse existing Device/Deletion aggregation patterns" instruction,
 * honored directly rather than inventing a new status log).
 *
 * Bounded fanout: target count is the Device Registry's own real,
 * already-bounded trusted-Device count for one account — no unbounded
 * loop of any kind. One target Device's own publish failure never
 * affects another's (`Promise.all`, per-target try/catch boundary
 * implicit in the Publisher's own per-Relay-outcome design one layer
 * down). Local deletion NEVER waits for this coordinator (Phase F's own
 * explicit requirement) — this class is called strictly AFTER a local
 * suppression fact is already durably recorded
 * (`fedos_archive_suppression_local_bridge.ts`), fire-and-forget from
 * the caller's own point of view; a Device Sync retry (via whatever real
 * `FedosDeviceSyncScheduler`/`attemptFn` a caller wires — Phase A
 * reconciliation report §10's own honest reachability disclosure) is
 * this domain's own existing retry seam, not a second one this Arc
 * invents.
 */

import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosArchiveSuppressionFact } from "../../conversation/retention/fedos_archive_suppression_fact.js";
import type { FedosArchiveSuppressionFactDeviceEvidenceV1 } from "../../conversation/retention/fedos_archive_suppression_fact_signing.js";
import { buildFedosArchiveSuppressionWirePayload } from "./fedos_archive_suppression_wire_payload.js";
import { buildFedosArchiveSuppressionUnsignedEventRequest } from "./fedos_archive_suppression_event.js";
import { FedosDeviceRelaySyncPublisher, type FedosDeviceRelaySyncPublishOutcome } from "../relay_sync/fedos_device_relay_sync_publisher.js";
import type { FedosConversationRelaySet } from "../../conversation/transport/relay/fedos_conversation_relay_set.js";
import type { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import { toFedosDeliveryObservationSubjectId } from "../../board/observation/fedos_delivery_observation.js";
import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

const DEFAULT_TTL_SECONDS = 86_400; // 24h -- generous enough for a genuinely offline target Device (Phase B's own "offline Device" handling).

/** Deterministic, stable per-`(factId, targetDeviceId)` Observation subject -- so repeated fanout attempts for the SAME fact/target accumulate a real attempt HISTORY (mirrors every other Observation-based domain in this codebase) rather than colliding. */
export function fedosArchiveSuppressionFanoutSubjectId(factId: string, targetDeviceId: string): string {
  return `archive-suppression::${factId}::${targetDeviceId}`;
}

export interface FedosArchiveSuppressionOutboundDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly publisher: FedosDeviceRelaySyncPublisher;
  readonly observationRepository: FedosDeliveryObservationRepository;
  readonly now?: () => number;
}

export interface FedosArchiveSuppressionOutboundRequest {
  readonly fact: FedosArchiveSuppressionFact;
  readonly deviceEvidence: FedosArchiveSuppressionFactDeviceEvidenceV1 | null;
  readonly sourceDeviceId: string;
  readonly localAccountIndex: number;
  readonly ttlSeconds?: number;
}

export type FedosArchiveSuppressionOutboundOutcome = "source-not-trusted" | "no-other-trusted-devices" | "fanned-out";

export interface FedosArchiveSuppressionOutboundTargetResult {
  readonly targetDeviceId: string;
  readonly published: boolean;
  readonly relayOutcomes: readonly FedosDeviceRelaySyncPublishOutcome[] | null;
}

export interface FedosArchiveSuppressionOutboundResult {
  readonly outcome: FedosArchiveSuppressionOutboundOutcome;
  readonly targets: readonly FedosArchiveSuppressionOutboundTargetResult[];
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class FedosArchiveSuppressionOutboundCoordinator {
  readonly #deps: FedosArchiveSuppressionOutboundDeps;
  readonly #now: () => number;

  constructor(deps: FedosArchiveSuppressionOutboundDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? defaultNowSeconds;
  }

  /** Fans the fact out to every OTHER currently-trusted Device sharing `fact.accountRef` -- never to a revoked/unknown/self Device, never a fabricated "all Devices informed" summary (the caller reads real per-target outcomes, and MISSING/offline targets simply produce no entry here at all -- see Phase I aggregation for how "never attempted because it was never registered" is distinguished from "attempted, no response yet"). */
  async fanOut(request: FedosArchiveSuppressionOutboundRequest, now: number = this.#now()): Promise<FedosArchiveSuppressionOutboundResult> {
    const sourceBinding = this.#deps.registryPersistence.getBinding(request.sourceDeviceId);
    if (sourceBinding === null || sourceBinding.trustState !== "trusted") {
      return { outcome: "source-not-trusted", targets: [] };
    }

    const accountRef: FedosDeviceBindingAccountRef = request.fact.accountRef;
    const targetDeviceIds = this.#deps.registryPersistence
      .listBindingsForAccount(accountRef.authority, accountRef.publicIdentifier)
      .filter((binding) => binding.trustState === "trusted" && binding.deviceId !== request.sourceDeviceId)
      .map((binding) => binding.deviceId);

    if (targetDeviceIds.length === 0) {
      return { outcome: "no-other-trusted-devices", targets: [] };
    }

    const ttlSeconds = request.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const results = await Promise.all(targetDeviceIds.map((targetDeviceId) => this.#sendToOneTarget(request, targetDeviceId, now, ttlSeconds)));

    return { outcome: "fanned-out", targets: results };
  }

  async #sendToOneTarget(
    request: FedosArchiveSuppressionOutboundRequest,
    targetDeviceId: string,
    now: number,
    ttlSeconds: number,
  ): Promise<FedosArchiveSuppressionOutboundTargetResult> {
    const subjectId = toFedosDeliveryObservationSubjectId(fedosArchiveSuppressionFanoutSubjectId(request.fact.factId, targetDeviceId));
    if (subjectId === null) {
      return { targetDeviceId, published: false, relayOutcomes: null };
    }

    const deliveryId = bytesToHex(nobleRandomBytes(16));
    const payload = buildFedosArchiveSuppressionWirePayload({
      sourceDeviceId: request.sourceDeviceId,
      targetDeviceId,
      fact: request.fact,
      deviceEvidence: request.deviceEvidence,
      createdAt: now,
      expiresAt: now + ttlSeconds,
      deliveryId,
    });

    this.#deps.observationRepository.record(subjectId, "queued", now);

    const unsignedRequest = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: request.localAccountIndex });
    this.#deps.observationRepository.record(subjectId, "publishing", now);
    const event = await this.#deps.signingAuthority.signEvent(unsignedRequest);
    if (event === null) {
      this.#deps.observationRepository.record(subjectId, "failed", now, "signing-failed");
      return { targetDeviceId, published: false, relayOutcomes: null };
    }

    const relayOutcomes = await this.#deps.publisher.publish(event);
    const anyAccepted = relayOutcomes.some((outcome) => outcome.outcome === "accepted");
    const state = anyAccepted ? "accepted" : relayOutcomes.some((outcome) => outcome.outcome === "rejected") ? "rejected" : "failed";
    this.#deps.observationRepository.record(subjectId, state, now);

    return { targetDeviceId, published: anyAccepted, relayOutcomes };
  }
}

export { FedosDeviceRelaySyncPublisher };
export type { FedosConversationRelaySet };

/**
 * Secure Runtime Alpha 3641–3720 ("Relay-Assisted Device Synchronization")
 * — the Outbound Coordinator (Phase D).
 *
 * Sequence: (1) verify source Device remains trusted, (2) verify target
 * Device remains trusted, (3) load the Transfer Session (must already be
 * `"approved"` — the Invitation/Challenge/Proof/Approval handshake is
 * `FedosDeviceTransferCoordinator`'s own, UNMODIFIED concern, completed
 * BEFORE this file is ever called; this Arc does not redesign, repeat, or
 * shortcut it), (4) build the encrypted Sync Package — ONLY IF this
 * `transferSessionId` has no Outbox record yet, otherwise REUSE the
 * cached one (Phase D's own "no duplicate package construction"), (5)
 * build the versioned wire payload, (6) sign through the EXISTING,
 * UNWIDENED `FedosNostrSigningAuthority.signEvent()` (kind 1), (7)
 * publish to the configured Relay set, (8) record a per-Relay Observation
 * fact for each outcome, (9) return the LOCAL/session outcome and the
 * per-Relay outcomes as two SEPARATE fields — never conflated, and never
 * implying target Device import (Phase D's own "Relay ACK means Relay
 * acceptance only").
 */

import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceSyncSessionV1 } from "../sync_session/fedos_device_sync_session.js";
import type { FedosDeviceSyncPackageEncryptionAuthority } from "../sync_package/fedos_device_sync_package_encryption.js";
import type { FedosDeviceTransferApprovalV1 } from "../transfer/fedos_device_transfer_proof.js";
import { FedosDeviceTransferCoordinator } from "../transfer/fedos_device_transfer_coordinator.js";
import {
  deserializeFedosDeviceTransferPackageFromBytes,
  serializeFedosDeviceTransferPackageToBytes,
  type FedosDeviceTransferPackageV1,
} from "../transfer/fedos_device_transfer_package.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { AeadAlgorithm } from "../../../../runtime/fedos_wasm_loader.js";
import {
  FedosSecureRandomDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeNonceGenerator,
} from "../binding_challenge/fedos_device_binding_challenge.js";
import {
  buildFedosDeviceRelaySyncWirePayload,
  computeFedosDeviceRelaySyncPackageContentHash,
} from "./fedos_device_relay_sync_wire_payload.js";
import { buildFedosDeviceRelaySyncUnsignedEventRequest } from "./fedos_device_relay_sync_event.js";
import { FedosDeviceRelaySyncPublisher, type FedosDeviceRelaySyncPublishOutcome } from "./fedos_device_relay_sync_publisher.js";
import type { FedosDeviceRelaySyncObservationRepository } from "./fedos_device_relay_sync_observation.js";
import type { FedosDeviceRelaySyncOutboxPersistence } from "./persistence/fedos_device_relay_sync_outbox_persistence.js";

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";

const DEFAULT_TTL_SECONDS = 86_400; // 24h -- generous enough for a genuinely offline target Device (Phase J).

export type FedosDeviceRelaySyncOutboundOutcome =
  | "published"
  | "source-not-trusted"
  | "target-not-trusted"
  | "wrong-account"
  | "session-not-found"
  | "session-wrong-state"
  | "invalid-approval"
  | "expired"
  | "key-unavailable"
  | "invalid-input"
  | "failed";

export interface FedosDeviceRelaySyncOutboundResult {
  readonly outcome: FedosDeviceRelaySyncOutboundOutcome;
  /** The LOCAL/session outcome (this Runtime's own state) -- kept SEPARATE from `relayOutcomes` (Phase D's own explicit instruction). `null` unless `outcome === "published"`. */
  readonly relayOutcomes: readonly FedosDeviceRelaySyncPublishOutcome[] | null;
  readonly transferSessionId: string | null;
  readonly deliveryId: string | null;
}

export interface FedosDeviceRelaySyncOutboundDeps {
  readonly transferCoordinator: FedosDeviceTransferCoordinator;
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly outboxPersistence: FedosDeviceRelaySyncOutboxPersistence;
  readonly observationRepository: FedosDeviceRelaySyncObservationRepository;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly publisher: FedosDeviceRelaySyncPublisher;
  readonly encryptionAuthority: FedosDeviceSyncPackageEncryptionAuthority;
  readonly nonceGenerator?: FedosDeviceBindingChallengeNonceGenerator;
  readonly now?: () => number;
}

export interface FedosDeviceRelaySyncOutboundRequest {
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly transferSessionId: string;
  readonly approval: FedosDeviceTransferApprovalV1;
  readonly syncSession: FedosDeviceSyncSessionV1;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly suite: AeadAlgorithm;
  readonly ttlSeconds?: number;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class FedosDeviceRelaySyncOutboundCoordinator {
  readonly #deps: FedosDeviceRelaySyncOutboundDeps;
  readonly #nonceGenerator: FedosDeviceBindingChallengeNonceGenerator;
  readonly #now: () => number;

  constructor(deps: FedosDeviceRelaySyncOutboundDeps) {
    this.#deps = deps;
    this.#nonceGenerator = deps.nonceGenerator ?? new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
    this.#now = deps.now ?? defaultNowSeconds;
  }

  async prepareAndPublish(request: FedosDeviceRelaySyncOutboundRequest, now: number = this.#now()): Promise<FedosDeviceRelaySyncOutboundResult> {
    const sourceBinding = this.#deps.registryPersistence.getBinding(request.sourceDeviceId);
    if (sourceBinding === null || sourceBinding.trustState !== "trusted") {
      return { outcome: "source-not-trusted", relayOutcomes: null, transferSessionId: null, deliveryId: null };
    }
    if (sourceBinding.accountRef.authority !== request.accountRef.authority || sourceBinding.accountRef.publicIdentifier !== request.accountRef.publicIdentifier) {
      return { outcome: "wrong-account", relayOutcomes: null, transferSessionId: null, deliveryId: null };
    }
    const targetBinding = this.#deps.registryPersistence.getBinding(request.targetDeviceId);
    if (targetBinding === null || targetBinding.trustState !== "trusted") {
      return { outcome: "target-not-trusted", relayOutcomes: null, transferSessionId: null, deliveryId: null };
    }
    if (targetBinding.accountRef.authority !== request.accountRef.authority || targetBinding.accountRef.publicIdentifier !== request.accountRef.publicIdentifier) {
      return { outcome: "wrong-account", relayOutcomes: null, transferSessionId: null, deliveryId: null };
    }

    const session = this.#deps.transferCoordinator.getSession(request.transferSessionId);
    if (session === null) {
      return { outcome: "session-not-found", relayOutcomes: null, transferSessionId: null, deliveryId: null };
    }

    let transferPackage: FedosDeviceTransferPackageV1;
    let deliveryId: string;

    const existingOutboxRecord = this.#deps.outboxPersistence.getRecord(request.transferSessionId);
    if (existingOutboxRecord !== null) {
      // Phase D: "No duplicate package construction for the same transfer/session revision" -- reuse the cached bytes, never rebuild.
      const bytes = new Uint8Array(Buffer.from(existingOutboxRecord.transferPackageBase64, "base64"));
      const cached = deserializeFedosDeviceTransferPackageFromBytes(bytes);
      if (cached === null) {
        return { outcome: "failed", relayOutcomes: null, transferSessionId: null, deliveryId: null };
      }
      transferPackage = cached;
      deliveryId = existingOutboxRecord.deliveryId;
    } else {
      if (session.state !== "approved") {
        return { outcome: "session-wrong-state", relayOutcomes: null, transferSessionId: null, deliveryId: null };
      }
      const built = await this.#deps.transferCoordinator.buildTransferPackage(
        {
          sessionId: request.transferSessionId,
          approval: request.approval,
          syncSession: request.syncSession,
          encryptionAuthority: this.#deps.encryptionAuthority,
          suite: request.suite,
          localAccountIndex: request.localAccountIndex,
          selfAccountPublicKeyHex: request.selfAccountPublicKeyHex,
        },
        now,
      );
      if (built.outcome !== "package-sent") {
        const outcome = built.outcome === "wrong-state" ? "session-wrong-state" : (built.outcome as FedosDeviceRelaySyncOutboundOutcome);
        return { outcome, relayOutcomes: null, transferSessionId: null, deliveryId: null };
      }
      transferPackage = built.package!;
      deliveryId = this.#nonceGenerator.generateNonce();

      this.#deps.outboxPersistence.putRecord({
        schemaVersion: 1,
        transferSessionId: request.transferSessionId,
        packageContentHash: computeFedosDeviceRelaySyncPackageContentHash(transferPackage),
        deliveryId,
        builtAt: now,
        transferPackageBase64: Buffer.from(serializeFedosDeviceTransferPackageToBytes(transferPackage)).toString("base64"),
      });
    }

    const ttlSeconds = request.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const payload = buildFedosDeviceRelaySyncWirePayload({
      transferPackage,
      transferSessionId: request.transferSessionId,
      sourceDeviceId: request.sourceDeviceId,
      targetDeviceId: request.targetDeviceId,
      accountAuthority: request.accountRef.authority,
      accountPublicIdentifier: request.accountRef.publicIdentifier,
      createdAt: now,
      expiresAt: now + ttlSeconds,
      deliveryId,
    });

    const subjectId = request.transferSessionId;
    this.#deps.observationRepository.record(subjectId, "queued", now);

    const unsignedRequest = buildFedosDeviceRelaySyncUnsignedEventRequest({ payload, localAccountIndex: request.localAccountIndex });
    this.#deps.observationRepository.record(subjectId, "publishing", now);
    const event = await this.#deps.signingAuthority.signEvent(unsignedRequest);
    if (event === null) {
      this.#deps.observationRepository.record(subjectId, "relay-failed", now, "signing-failed");
      return { outcome: "failed", relayOutcomes: null, transferSessionId: request.transferSessionId, deliveryId };
    }

    const relayOutcomes = await this.#deps.publisher.publish(event);
    for (const relayOutcome of relayOutcomes) {
      const relaySubject = `${subjectId}::${relayOutcome.relayUrl}`;
      const state = relayOutcome.outcome === "accepted" ? "relay-accepted" : relayOutcome.outcome === "rejected" ? "relay-rejected" : "relay-failed";
      this.#deps.observationRepository.record(relaySubject, state, now);
    }

    return { outcome: "published", relayOutcomes, transferSessionId: request.transferSessionId, deliveryId };
  }
}

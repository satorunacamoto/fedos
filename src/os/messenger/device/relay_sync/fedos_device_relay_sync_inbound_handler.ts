/**
 * Secure Runtime Alpha 3641–3720 ("Relay-Assisted Device Synchronization")
 * — the Inbound Handler (Phase E).
 *
 * Sequence: (1) receive a candidate `FedosEventDescriptor`, (2) validate
 * route/event shape (`parseFedosDeviceRelaySyncEventDescriptor()`), (3)
 * dedup by the outer Relay event id (Phase F, primary key — cross-Relay
 * redelivery of the identical event), (4) verify the OUTER Nostr signature
 * — reusing the EXISTING, UNMODIFIED `NobleSignatureVerifier`
 * (`../../nostr/noble_signature.ts`, real BIP-340 Schnorr, the SAME
 * verifier `verifyFedosDeviceBindingAccountAuthorization()` already
 * reuses) — a tampered outer event (any field of `content`, including the
 * routing fields this file itself trusts next) fails closed here, BEFORE
 * any of its claims are acted on, (5) verify the intended recipient
 * Device/account, (6) dedup by `transferSessionId`+`packageContentHash`
 * (Phase F, secondary key — the SAME package delivered via a DIFFERENT
 * Relay), (7) re-check LIVE Device Registry trust for BOTH source and
 * target (revoked fails closed), (8) verify the outer content-hash binding
 * BEFORE ever attempting decrypt, (9) open the encrypted Sync Package
 * through the EXISTING, UNMODIFIED `FedosDeviceTransferCoordinator.verifyTransferPackage()`
 * — this file adds NO new decryption logic, NO new tamper/expiry/replay
 * check beyond what that Coordinator already proves, (10) on success,
 * durably record the import fact, (11) produce one explicit, honest local
 * outcome.
 *
 * Does NOT import merely because the outer Nostr event was well-formed or
 * relay-accepted (Phase E's own explicit instruction) — every one of the
 * checks above must independently pass first.
 *
 * SCOPE BOUNDARY, stated honestly: this file assumes the Transfer
 * Session's own Invitation → Challenge → Proof → Approval handshake
 * (`FedosDeviceTransferCoordinator`, Alpha 3481–3560, UNMODIFIED) has
 * ALREADY completed — reaching `"approved"`/`"package-sent"` — through
 * whatever channel established it (this Arc does not redesign, relay, or
 * shortcut that handshake). This Arc's own new work begins at Package
 * publish and ends at Package receive/decrypt/import, exactly the Target
 * Flow this Arc's own instructions describe starting from "prepare
 * encrypted transfer/session package."
 */

import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import { NobleSignatureVerifier } from "../../adapters/nostr/protocol/noble_signature.js";
import type { NostrEvent, NostrTag } from "../../adapters/nostr/protocol/types.js";
import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceSyncSessionV1 } from "../sync_session/fedos_device_sync_session.js";
import type { FedosDeviceSyncPackageEncryptionAuthority } from "../sync_package/fedos_device_sync_package_encryption.js";
import type { FedosDeviceTransferCoordinator } from "../transfer/fedos_device_transfer_coordinator.js";
import type { AeadAlgorithm } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import {
  extractFedosDeviceTransferPackageFromWirePayload,
  isFedosDeviceRelaySyncWirePayloadExpired,
  computeFedosDeviceRelaySyncPackageContentHash,
} from "./fedos_device_relay_sync_wire_payload.js";
import { parseFedosDeviceRelaySyncEventDescriptor } from "./fedos_device_relay_sync_event.js";
import type { FedosDeviceRelaySyncObservationRepository } from "./fedos_device_relay_sync_observation.js";
import type { FedosDeviceRelaySyncInboundDedupPersistence } from "./persistence/fedos_device_relay_sync_inbound_dedup_persistence.js";

export type FedosDeviceRelaySyncInboundOutcome =
  | "imported"
  | "duplicate"
  | "malformed"
  | "invalid-signature"
  | "wrong-recipient"
  | "wrong-account"
  | "source-not-trusted"
  | "target-not-trusted"
  | "expired"
  | "conflict"
  | "manifest-mismatch"
  | "key-unavailable"
  | "invalid-input"
  | "failed";

export interface FedosDeviceRelaySyncInboundResult {
  readonly outcome: FedosDeviceRelaySyncInboundOutcome;
  readonly syncSession: FedosDeviceSyncSessionV1 | null;
}

export interface FedosDeviceRelaySyncInboundDeps {
  readonly transferCoordinator: FedosDeviceTransferCoordinator;
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly dedupPersistence: FedosDeviceRelaySyncInboundDedupPersistence;
  readonly observationRepository: FedosDeviceRelaySyncObservationRepository;
  readonly localDeviceId: string;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
}

export interface FedosDeviceRelaySyncInboundRequest {
  readonly descriptor: FedosEventDescriptor;
  readonly encryptionAuthority: FedosDeviceSyncPackageEncryptionAuthority;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly now: number;
}

export class FedosDeviceRelaySyncInboundHandler {
  readonly #deps: FedosDeviceRelaySyncInboundDeps;

  constructor(deps: FedosDeviceRelaySyncInboundDeps) {
    this.#deps = deps;
  }

  async handleIncomingEvent(request: FedosDeviceRelaySyncInboundRequest): Promise<FedosDeviceRelaySyncInboundResult> {
    const { descriptor, now } = request;

    // Phase F, layer 1: dedup by the outer Relay event id, BEFORE any parsing.
    if (this.#deps.dedupPersistence.getByRelayEventId(descriptor.id) !== null) {
      return { outcome: "duplicate", syncSession: null };
    }

    const payload = parseFedosDeviceRelaySyncEventDescriptor(descriptor);
    if (payload === null) {
      this.#deps.observationRepository.record(`relay-event::${descriptor.id}`, "denied", now, "malformed");
      return { outcome: "malformed", syncSession: null };
    }

    const subjectId = payload.transferSessionId;

    // The claimed account identity (`payload.accountPublicIdentifier`) must be the SAME identity that actually
    // produced this outer Nostr signature -- and that signature must itself be real. A tampered `content` (any
    // field, including the routing facts trusted below) fails closed here, before any of its claims are acted on.
    if (descriptor.author !== payload.accountPublicIdentifier) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "invalid-signature");
      return { outcome: "invalid-signature", syncSession: null };
    }
    if (!(await NobleSignatureVerifier.verify(descriptorToNostrEvent(descriptor)))) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "invalid-signature");
      return { outcome: "invalid-signature", syncSession: null };
    }

    this.#deps.observationRepository.record(subjectId, "received", now);

    if (payload.targetDeviceId !== this.#deps.localDeviceId) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "wrong-recipient");
      return { outcome: "wrong-recipient", syncSession: null };
    }
    if (
      payload.accountAuthority !== this.#deps.localAccountRef.authority ||
      payload.accountPublicIdentifier !== this.#deps.localAccountRef.publicIdentifier
    ) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "wrong-account");
      return { outcome: "wrong-account", syncSession: null };
    }

    if (isFedosDeviceRelaySyncWirePayloadExpired(payload, now)) {
      this.#deps.observationRepository.record(subjectId, "expired", now);
      return { outcome: "expired", syncSession: null };
    }

    // Phase F, layer 2: dedup by transferSessionId+packageContentHash -- the SAME package via a DIFFERENT Relay.
    const existingBySessionAndHash = this.#deps.dedupPersistence.getBySessionAndHash(payload.transferSessionId, payload.packageContentHash);
    if (existingBySessionAndHash !== null) {
      return { outcome: "duplicate", syncSession: null };
    }

    const sourceBinding = this.#deps.registryPersistence.getBinding(payload.sourceDeviceId);
    if (sourceBinding === null || sourceBinding.trustState !== "trusted") {
      this.#deps.observationRepository.record(subjectId, "denied", now, "source-not-trusted");
      return { outcome: "source-not-trusted", syncSession: null };
    }
    const targetBinding = this.#deps.registryPersistence.getBinding(payload.targetDeviceId);
    if (targetBinding === null || targetBinding.trustState !== "trusted") {
      this.#deps.observationRepository.record(subjectId, "denied", now, "target-not-trusted");
      return { outcome: "target-not-trusted", syncSession: null };
    }

    const transferPackage = extractFedosDeviceTransferPackageFromWirePayload(payload);
    if (transferPackage === null) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "malformed-package");
      return { outcome: "malformed", syncSession: null };
    }

    // Outer content-hash gate -- catches a substituted/tampered payload BEFORE any decrypt is even attempted.
    if (computeFedosDeviceRelaySyncPackageContentHash(transferPackage) !== payload.packageContentHash) {
      this.#deps.observationRepository.record(subjectId, "denied", now, "conflict");
      return { outcome: "conflict", syncSession: null };
    }

    const verified = await this.#deps.transferCoordinator.verifyTransferPackage(
      {
        transferPackage,
        encryptionAuthority: request.encryptionAuthority,
        suite: request.suite,
        localAccountIndex: request.localAccountIndex,
        selfAccountPublicKeyHex: request.selfAccountPublicKeyHex,
      },
      now,
    );

    if (verified.outcome === "duplicate-package") {
      return { outcome: "duplicate", syncSession: verified.session };
    }
    if (verified.outcome !== "verified") {
      const mapped = mapVerifyOutcome(verified.outcome);
      this.#deps.observationRepository.record(subjectId, "denied", now, mapped);
      return { outcome: mapped, syncSession: null };
    }

    this.#deps.dedupPersistence.putImport({
      schemaVersion: 1,
      relayEventId: descriptor.id,
      transferSessionId: payload.transferSessionId,
      packageContentHash: payload.packageContentHash,
      importedAt: now,
    });
    this.#deps.observationRepository.record(subjectId, "imported", now);

    return { outcome: "imported", syncSession: verified.session };
  }
}

function mapVerifyOutcome(outcome: string): FedosDeviceRelaySyncInboundOutcome {
  switch (outcome) {
    case "conflict":
    case "manifest-mismatch":
    case "expired":
    case "malformed":
    case "key-unavailable":
    case "invalid-input":
      return outcome;
    default:
      return "failed";
  }
}

/** PRIVATE — the reverse of `nostrWireEventToFedosEventDescriptor()` (Alpha 454, unmodified), needed ONLY so `NobleSignatureVerifier.verify()` (which expects NIP-01 field names) can check a `FedosEventDescriptor`'s own signature. Pure, synchronous; no I/O. */
function descriptorToNostrEvent(descriptor: FedosEventDescriptor): NostrEvent {
  return {
    id: descriptor.id,
    pubkey: descriptor.author,
    created_at: descriptor.createdAt,
    kind: descriptor.kind,
    tags: descriptor.tags.map((tag): NostrTag => [...tag]),
    content: descriptor.content,
    sig: descriptor.signature,
  };
}

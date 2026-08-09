/**
 * Secure Runtime Alpha 5721–5800 — Phase G: the narrow Outbound
 * Coordinator. Gathers local, evidence-backed capabilities, constructs
 * one canonical advertisement or lifecycle notification, signs it
 * (account-level always, Device-level best-effort per Phase E), selects
 * the existing `"nostr-nip17-v1"` route, builds the encrypted private
 * payload (Phase F), and publishes through the EXISTING
 * `FedosPrivateTransport.sendMailboxNip17Control()` seam — reusing that
 * seam's own Outbox persistence, bounded retry, and Relay-ACK machinery
 * verbatim rather than building a second one.
 *
 * Fails closed: denies publish when the local Device is revoked, when
 * this coordinator has been `stop()`ped, or when the recipient Device has
 * no Device Registry binding on file at all (an unknown recipient path).
 * Relay ACK (`"delivered"`) is surfaced as its own outcome, never
 * conflated with peer acceptance — this coordinator has no way to know
 * whether the peer ever imports, verifies, or accepts what it publishes.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { isFedosDeviceBindingRevoked } from "../../../device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosDeviceSigningKeypair } from "../../../device/crypto/fedos_device_signing_keypair.js";
import {
  FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX,
  canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent,
  type FedosRatchetPeerCapabilityAdvertisementV1,
} from "./fedos_ratchet_peer_capability_advertisement.js";
import {
  FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DEVICE_SIGNATURE_PREFIX,
  canonicalSerializeFedosRatchetPeerLifecycleNotificationContent,
  type FedosRatchetPeerLifecycleFact,
  type FedosRatchetPeerLifecycleNotificationV1,
} from "./fedos_ratchet_peer_lifecycle_notification.js";
import {
  authorizeFedosRatchetPeerCapabilityContent,
  createFedosRatchetPeerCapabilityDeviceSignature,
} from "./fedos_ratchet_peer_capability_authentication.js";
import { generateFedosRatchetPeerCapabilityNonce } from "./fedos_ratchet_peer_capability_nonce.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "./fedos_ratchet_peer_capability_control_payload.js";
import type { FedosRatchetPeerCapabilityEntry } from "./fedos_ratchet_peer_capability_vocabulary.js";

export interface FedosRatchetPeerCapabilitySendResult {
  readonly outcome: "delivered" | "rejected" | "failed" | "later";
}

export interface FedosRatchetPeerCapabilityOutboundDependencies {
  readonly deviceRegistry: FedosDeviceRegistryPersistence;
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly clock: () => number;
  readonly sendMailboxNip17Control: (
    controlId: string,
    conversationId: FedosConversationId,
    plaintext: Uint8Array,
    createdAt: number,
  ) => Promise<FedosRatchetPeerCapabilitySendResult | { readonly outcome: string }>;
  readonly locallySupportedCapabilities: readonly FedosRatchetPeerCapabilityEntry[];
}

export type FedosRatchetPeerCapabilityOutboundOutcome =
  | { readonly outcome: "published"; readonly relayOutcome: string }
  | { readonly outcome: "runtime-stopped" | "local-device-revoked" | "recipient-device-unknown" | "signing-unavailable" | "invalid-input" };

export interface FedosRatchetPeerCapabilityAdvertiseParams {
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly revision: number;
  readonly expiresInMs: number;
  readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
}

export interface FedosRatchetPeerCapabilityNotifyParams {
  readonly notificationId: string;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly affectedDeviceRef: string;
  readonly fact: FedosRatchetPeerLifecycleFact;
  readonly revision: number;
  readonly expiresInMs: number;
  readonly supersedesNotificationId?: string;
  readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
}

export class FedosRatchetPeerCapabilityOutboundCoordinator {
  readonly #deps: FedosRatchetPeerCapabilityOutboundDependencies;
  #stopped = false;

  constructor(deps: FedosRatchetPeerCapabilityOutboundDependencies) {
    this.#deps = deps;
  }

  /** Irreversible for this instance — mirrors `FedosDirectRatchetStateRuntime.stop()`'s own fail-closed discipline. */
  stop(): void {
    this.#stopped = true;
  }

  #preflight(recipientDeviceRef: string): FedosRatchetPeerCapabilityOutboundOutcome | null {
    if (this.#stopped) return { outcome: "runtime-stopped" };
    const localBinding = this.#deps.deviceRegistry.getBinding(this.#deps.localDeviceRef);
    if (localBinding !== null && isFedosDeviceBindingRevoked(localBinding)) return { outcome: "local-device-revoked" };
    const recipientBinding = this.#deps.deviceRegistry.getBinding(recipientDeviceRef);
    if (recipientBinding === null) return { outcome: "recipient-device-unknown" };
    return null;
  }

  async advertiseCapabilities(
    params: FedosRatchetPeerCapabilityAdvertiseParams,
  ): Promise<FedosRatchetPeerCapabilityOutboundOutcome & { readonly advertisement?: FedosRatchetPeerCapabilityAdvertisementV1 }> {
    const preflightFailure = this.#preflight(params.recipientDeviceRef);
    if (preflightFailure !== null) return preflightFailure;

    const issuedAt = this.#deps.clock();
    const content = {
      senderAccountRef: this.#deps.localAccountRef,
      senderDeviceRef: this.#deps.localDeviceRef,
      recipientAccountRef: params.recipientAccountRef,
      recipientDeviceRef: params.recipientDeviceRef,
      conversationId: params.conversationId,
      revision: params.revision,
      capabilities: this.#deps.locallySupportedCapabilities,
      issuedAt,
      expiresAt: issuedAt + params.expiresInMs,
      nonce: generateFedosRatchetPeerCapabilityNonce(),
    };
    const canonicalContent = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(content);
    const accountAuthorization = await authorizeFedosRatchetPeerCapabilityContent(
      this.#deps.signingAuthority,
      this.#deps.accountIndex,
      issuedAt,
      canonicalContent,
    );
    if (accountAuthorization === null) return { outcome: "signing-unavailable" };

    const deviceSignatureHex =
      params.deviceSigningKeypair !== undefined
        ? createFedosRatchetPeerCapabilityDeviceSignature(
            params.deviceSigningKeypair,
            FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX,
            canonicalContent,
          )
        : null;

    const advertisement: FedosRatchetPeerCapabilityAdvertisementV1 = {
      schemaVersion: 1,
      ...content,
      accountAuthorization,
      deviceSignatureHex,
    };

    const plaintext = encodeFedosRatchetPeerCapabilityControlPayload({
      schemaVersion: 1,
      kind: "peer-capability-advertisement",
      advertisement,
    });
    const controlId = `peer-capability-advertisement:${content.nonce}`;
    const sendResult = await this.#deps.sendMailboxNip17Control(controlId, params.conversationId, plaintext, issuedAt);
    return { outcome: "published", relayOutcome: sendResult.outcome, advertisement };
  }

  async publishDeviceLifecycleNotification(
    params: FedosRatchetPeerCapabilityNotifyParams,
  ): Promise<FedosRatchetPeerCapabilityOutboundOutcome & { readonly notification?: FedosRatchetPeerLifecycleNotificationV1 }> {
    if (typeof params.notificationId !== "string" || params.notificationId.length === 0) return { outcome: "invalid-input" };
    const preflightFailure = this.#preflight(params.recipientDeviceRef);
    if (preflightFailure !== null) return preflightFailure;

    const issuedAt = this.#deps.clock();
    const content = {
      notificationId: params.notificationId,
      issuerAccountRef: this.#deps.localAccountRef,
      issuerDeviceRef: this.#deps.localDeviceRef,
      targetAccountRef: params.recipientAccountRef,
      targetDeviceRef: params.recipientDeviceRef,
      affectedDeviceRef: params.affectedDeviceRef,
      fact: params.fact,
      revision: params.revision,
      issuedAt,
      expiresAt: issuedAt + params.expiresInMs,
      nonce: generateFedosRatchetPeerCapabilityNonce(),
      supersedesNotificationId: params.supersedesNotificationId ?? null,
    };
    const canonicalContent = canonicalSerializeFedosRatchetPeerLifecycleNotificationContent(content);
    const accountAuthorization = await authorizeFedosRatchetPeerCapabilityContent(
      this.#deps.signingAuthority,
      this.#deps.accountIndex,
      issuedAt,
      canonicalContent,
    );
    if (accountAuthorization === null) return { outcome: "signing-unavailable" };

    const deviceSignatureHex =
      params.deviceSigningKeypair !== undefined
        ? createFedosRatchetPeerCapabilityDeviceSignature(
            params.deviceSigningKeypair,
            FEDOS_RATCHET_PEER_LIFECYCLE_NOTIFICATION_DEVICE_SIGNATURE_PREFIX,
            canonicalContent,
          )
        : null;

    const notification: FedosRatchetPeerLifecycleNotificationV1 = {
      schemaVersion: 1,
      ...content,
      accountAuthorization,
      deviceSignatureHex,
    };

    const plaintext = encodeFedosRatchetPeerCapabilityControlPayload({
      schemaVersion: 1,
      kind: "peer-lifecycle-notification",
      notification,
    });
    // Stable logical notification id reused verbatim as the Outbox `controlId` — exact-event retry never mints a second logical send for the same fact.
    const sendResult = await this.#deps.sendMailboxNip17Control(params.notificationId, params.conversationId, plaintext, issuedAt);
    return { outcome: "published", relayOutcome: sendResult.outcome, notification };
  }
}

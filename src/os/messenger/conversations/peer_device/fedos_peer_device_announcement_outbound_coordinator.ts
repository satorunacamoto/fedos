/**
 * FedOS Peer Device Discovery Arc — the narrow Outbound Coordinator.
 * Constructs one canonical announcement, signs it (account-level always,
 * device-level best-effort per `06_PROTOCOL_CONTRACT_FREEZE.md` §3),
 * selects the existing `"nostr-nip17-v1"` route, and publishes through the
 * EXISTING `FedosPrivateTransport.sendMailboxNip17Control()` seam — reusing
 * that seam's own Outbox persistence, bounded retry, and Relay-ACK
 * machinery verbatim rather than building a second one. Mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_outbound_coordinator.ts`
 * almost exactly.
 *
 * `conversationId` is a TRANSPORT routing parameter only — it selects
 * which already-established Direct Conversation's route to publish
 * through (`06` §1's scope decision: only accounts that already share an
 * active Direct Conversation exchange announcements). It is never part of
 * the signed content (`06` §10 — device identity is not a
 * conversation-scoped fact).
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosNostrSigningAuthority } from "../../adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosDeviceSigningKeypair } from "../../device/crypto/fedos_device_signing_keypair.js";
import { FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_SIGNATURE_PREFIX, canonicalSerializeFedosPeerDeviceAnnouncementContent, type FedosPeerDeviceAnnouncementV1 } from "./fedos_peer_device_announcement.js";
import { authorizeFedosPeerDeviceAnnouncementContent, createFedosPeerDeviceAnnouncementDeviceSignature } from "./fedos_peer_device_announcement_authentication.js";
import { generateFedosPeerDeviceAnnouncementNonce } from "./fedos_peer_device_announcement_nonce.js";
import { encodeFedosPeerDeviceAnnouncementControlPayload } from "./fedos_peer_device_announcement_control_payload.js";
import type { FedosRatchetPeerCapabilityEntry } from "../ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";

export interface FedosPeerDeviceAnnouncementSendResult {
  readonly outcome: "delivered" | "rejected" | "failed" | "later";
}

export interface FedosPeerDeviceAnnouncementOutboundDependencies {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly accountIndex: number;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  /** This protocol's own stable, protocol-scoped device identifier for the LOCAL device — never the same-account `localDeviceRef` config string. Generate once via `generateFedosPeerDeviceAnnouncementDeviceId()` and persist it durably at the composition root. */
  readonly localAnnouncedDeviceId: string;
  readonly localAnnouncedDevicePublicKeyHex: string;
  readonly clock: () => number;
  readonly sendMailboxNip17Control: (controlId: string, conversationId: FedosConversationId, plaintext: Uint8Array, createdAt: number) => Promise<FedosPeerDeviceAnnouncementSendResult | { readonly outcome: string }>;
  readonly locallySupportedCapabilities: readonly FedosRatchetPeerCapabilityEntry[];
}

export type FedosPeerDeviceAnnouncementOutboundOutcome =
  | { readonly outcome: "published"; readonly relayOutcome: string; readonly announcement: FedosPeerDeviceAnnouncementV1 }
  | { readonly outcome: "runtime-stopped" | "signing-unavailable" };

export interface FedosPeerDeviceAnnounceParams {
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly conversationId: FedosConversationId;
  readonly epoch: number;
  readonly supersedesAnnouncementId?: string;
  readonly deviceSigningKeypair?: FedosDeviceSigningKeypair;
}

export class FedosPeerDeviceAnnouncementOutboundCoordinator {
  readonly #deps: FedosPeerDeviceAnnouncementOutboundDependencies;
  #stopped = false;

  constructor(deps: FedosPeerDeviceAnnouncementOutboundDependencies) {
    this.#deps = deps;
  }

  /** Irreversible for this instance. */
  stop(): void {
    this.#stopped = true;
  }

  async announceLocalDevice(params: FedosPeerDeviceAnnounceParams): Promise<FedosPeerDeviceAnnouncementOutboundOutcome> {
    if (this.#stopped) return { outcome: "runtime-stopped" };

    const issuedAt = this.#deps.clock();
    const content = {
      senderAccountRef: this.#deps.localAccountRef,
      recipientAccountRef: params.recipientAccountRef,
      deviceId: this.#deps.localAnnouncedDeviceId,
      devicePublicKeyHex: this.#deps.localAnnouncedDevicePublicKeyHex,
      capabilities: this.#deps.locallySupportedCapabilities,
      epoch: params.epoch,
      supersedesAnnouncementId: params.supersedesAnnouncementId ?? null,
      issuedAt,
      nonce: generateFedosPeerDeviceAnnouncementNonce(),
    };
    const canonicalContent = canonicalSerializeFedosPeerDeviceAnnouncementContent(content);
    const accountAuthorization = await authorizeFedosPeerDeviceAnnouncementContent(this.#deps.signingAuthority, this.#deps.accountIndex, issuedAt, canonicalContent);
    if (accountAuthorization === null) return { outcome: "signing-unavailable" };

    const deviceSignatureHex =
      params.deviceSigningKeypair !== undefined ? createFedosPeerDeviceAnnouncementDeviceSignature(params.deviceSigningKeypair, FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_SIGNATURE_PREFIX, canonicalContent) : null;

    const announcement: FedosPeerDeviceAnnouncementV1 = {
      schemaVersion: 1,
      ...content,
      accountAuthorization,
      deviceSignatureHex,
    };

    const plaintext = encodeFedosPeerDeviceAnnouncementControlPayload({ schemaVersion: 1, kind: "peer-device-announcement", announcement });
    const controlId = `peer-device-announcement:${content.nonce}`;
    const sendResult = await this.#deps.sendMailboxNip17Control(controlId, params.conversationId, plaintext, issuedAt);
    return { outcome: "published", relayOutcome: sendResult.outcome, announcement };
  }
}

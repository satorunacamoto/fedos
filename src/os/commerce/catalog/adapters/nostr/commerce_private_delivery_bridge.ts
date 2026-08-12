/**
 * FedOS Commerce Purchase Completion mega-arc (Agent D) — the PRIVATE
 * `Delivery`/status transport. Sibling of `commerce_private_order_bridge.ts`
 * (same directory, unmodified by this file) — reuses that file's own
 * Coordinator-approved design decision verbatim rather than re-deriving a
 * second one: calls `FedosMasterSeedAuthority.encryptNip44Wire()`/
 * `decryptNip44Wire()` DIRECTLY (the same real NIP-44 v2 wire-crypto
 * primitive), signs the outer event via the SAME real
 * `FedosNostrSigningAuthority`, publishes/subscribes via the SAME real
 * `RelayPublisher`/`WebSocketRelayAdapter` the public discovery and
 * private-order-sync paths already use, and reuses `kind: 1` for the exact
 * same reason (`FedosNostrSigningAuthority`'s own closed `kind` allowlist —
 * see `commerce_private_order_bridge.ts`'s own header for the full account).
 * This is intentionally NOT a second transport stack — every primitive
 * this file touches is one already reviewed and shipped by the private
 * Order-sync pass; the only new thing is the payload category
 * (`PrivateDeliverySyncPayload`, `../../../events/commerce_private_delivery_sync.js`)
 * and its own topic tag, so a subscriber can never confuse a Delivery sync
 * event with an Order sync event or a public Commerce event.
 *
 * THE HONEST PRIVACY BOUNDARY — identical to `commerce_private_order_bridge.ts`'s
 * own (read that file's header for the full account, not repeated here):
 * `content` is genuine NIP-44 ciphertext, decryptable only by the two real
 * counterparties; the outer event's real signer pubkey and a `["p", ...]`
 * recipient tag are NOT hidden, and `created_at` is not randomized. This
 * file makes no different or wider claim than that.
 *
 * STATUS: wired into the shipped Electron app this pass — see
 * `commercePrivateDeliveryTransportFor()`/
 * `commercePrivateDeliveryDiscoverAndApplyNonFatal()`
 * (`fedos_electron_beta_main.cts`).
 */

import { isNostrEvent } from "../../../../messenger/adapters/nostr/protocol/event.js";
import { NobleSignatureVerifier } from "../../../../messenger/adapters/nostr/protocol/noble_signature.js";
import type { SignatureVerifier } from "../../../../messenger/adapters/nostr/protocol/signature.js";
import type { NostrEvent } from "../../../../messenger/adapters/nostr/protocol/types.js";
import type { RelayPublisher } from "../../../../messenger/adapters/nostr/protocol/publish.js";
import {
  freezeFedosNostrUnsignedEventRequest,
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "../../../../messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import {
  isWellFormedPrivateDeliverySyncPayload,
  type PrivateDeliverySyncPayload,
} from "../../../events/commerce_private_delivery_sync.js";

/** Fixed `kind` — see this file's header for exactly why. */
export const COMMERCE_PRIVATE_DELIVERY_EVENT_KIND = 1;
/** Distinct topic namespace from `COMMERCE_PRIVATE_ORDER_SYNC_TAG` AND from
 * `commerce_event_bridge.ts`'s own public `fedos-commerce:<category>:v1` —
 * never collides with either on the wire. */
export const COMMERCE_PRIVATE_DELIVERY_SYNC_TAG = "fedos-commerce-private:delivery-sync:v1";

/** Same narrow seam `commerce_private_order_bridge.ts`'s own `CommerceNip44Wire` defines — declared again locally rather than imported cross-file, matching that file's own "depend on the narrowest seam a file actually uses" convention (avoids this file depending on the order bridge at all). */
export interface CommerceNip44Wire {
  encryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null>;
  decryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null>;
}

/**
 * Encrypts an ALREADY-VALIDATED payload into a NIP-44 wire ciphertext
 * string. Returns `null` (fails closed, never throws) on ANY failure.
 */
export async function encryptPrivateDeliverySyncPayload(
  payload: PrivateDeliverySyncPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  nip44Wire: CommerceNip44Wire,
): Promise<string | null> {
  if (!isWellFormedPrivateDeliverySyncPayload(payload)) return null;
  if (typeof nip44Wire.encryptNip44Wire !== "function") return null;
  try {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    return await nip44Wire.encryptNip44Wire(accountIndex, counterpartyPublicKeyHex, plaintext);
  } catch {
    return null;
  }
}

/**
 * Builds the unsigned request `FedosNostrSigningAuthority.signEvent()`
 * expects for a private-delivery envelope. Returns `null` (fails closed,
 * never throws) if encryption itself failed or the resulting request does
 * not pass `isWellFormedFedosNostrUnsignedEventRequest()`.
 */
export async function buildCommercePrivateDeliveryUnsignedEventRequest(
  payload: PrivateDeliverySyncPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  createdAt: number,
  nip44Wire: CommerceNip44Wire,
): Promise<FedosNostrUnsignedEventRequest | null> {
  const ciphertext = await encryptPrivateDeliverySyncPayload(payload, counterpartyPublicKeyHex, accountIndex, nip44Wire);
  if (ciphertext === null) return null;

  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_PRIVATE_DELIVERY_EVENT_KIND,
    tags: [
      ["t", COMMERCE_PRIVATE_DELIVERY_SYNC_TAG],
      ["p", counterpartyPublicKeyHex],
    ],
    content: ciphertext,
  };
  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

export interface CommercePrivateDeliveryTransportSendResult {
  readonly accepted: boolean;
  readonly eventId: string;
  readonly message: string;
}

export interface RealCommercePrivateDeliveryTransportOptions {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly relayPublisher: RelayPublisher;
  readonly nip44Wire: CommerceNip44Wire;
  readonly accountIndex: number;
  readonly now?: () => number;
}

/**
 * The ONE real private-delivery transport — mirrors
 * `RealCommercePrivateOrderTransport` exactly (structure, not code).
 * `test/commerce_nostr_real_relay_private_delivery_sync.test.ts` exercises
 * this exact class with REAL WASM NIP-44 crypto over a REAL local relay.
 */
export class RealCommercePrivateDeliveryTransport {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #relayPublisher: RelayPublisher;
  readonly #nip44Wire: CommerceNip44Wire;
  readonly #accountIndex: number;
  readonly #now: () => number;

  constructor(options: RealCommercePrivateDeliveryTransportOptions) {
    this.#signingAuthority = options.signingAuthority;
    this.#relayPublisher = options.relayPublisher;
    this.#nip44Wire = options.nip44Wire;
    this.#accountIndex = options.accountIndex;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(payload: PrivateDeliverySyncPayload, counterpartyPublicKeyHex: string): Promise<CommercePrivateDeliveryTransportSendResult> {
    const request = await buildCommercePrivateDeliveryUnsignedEventRequest(
      payload,
      counterpartyPublicKeyHex,
      this.#accountIndex,
      this.#now(),
      this.#nip44Wire,
    );
    if (request === null) {
      return { accepted: false, eventId: "", message: "payload failed validation/encryption/unsigned-request construction" };
    }

    const signed: NostrEvent | null = await this.#signingAuthority.signEvent(request);
    if (signed === null) {
      return { accepted: false, eventId: "", message: "signing authority returned no signed event" };
    }

    const published = await this.#relayPublisher.publish(signed);
    return { accepted: published.accepted, eventId: published.eventId, message: published.message };
  }
}

// ---------------------------------------------------------------------------
// Inbound
// ---------------------------------------------------------------------------

export type InboundPrivateDeliveryOutcome =
  | "decrypted"
  | "not-mine"
  | "rejected-unverified-signature"
  | "rejected-decrypt-failed"
  | "rejected-unknown-shape";

export interface InboundPrivateDeliveryEnvelope {
  readonly outcome: InboundPrivateDeliveryOutcome;
  readonly eventId: string;
  /** The event's REAL verified signer — never a claim read out of the decrypted content. Empty string when signature verification itself did not run. */
  readonly senderPubkeyHex: string;
  readonly payload?: PrivateDeliverySyncPayload;
}

export interface CommerceInboundPrivateDeliveryBridgeOptions {
  readonly nip44Wire: CommerceNip44Wire;
  readonly localAccountIndex: number;
  /** Defaults to `NobleSignatureVerifier` — this repo's own real verifier. */
  readonly verifier?: SignatureVerifier;
}

/**
 * Builds an `InboundPrivateDeliveryEnvelope` from an unknown wire value,
 * running REAL signature verification AND real NIP-44 decryption along the
 * way. Never throws — mirrors `verifyAndDecryptInboundPrivateOrderEnvelope()`
 * exactly.
 */
export async function verifyAndDecryptInboundPrivateDeliveryEnvelope(
  event: unknown,
  options: CommerceInboundPrivateDeliveryBridgeOptions,
): Promise<InboundPrivateDeliveryEnvelope> {
  if (!isNostrEvent(event)) {
    return { outcome: "not-mine", eventId: "", senderPubkeyHex: "" };
  }
  const hasOwnTag = event.tags.some((tag) => tag[0] === "t" && tag[1] === COMMERCE_PRIVATE_DELIVERY_SYNC_TAG);
  if (!hasOwnTag) {
    return { outcome: "not-mine", eventId: event.id, senderPubkeyHex: "" };
  }

  const verifier = options.verifier ?? NobleSignatureVerifier;
  let signatureVerified: boolean;
  try {
    signatureVerified = await verifier.verify(event);
  } catch {
    signatureVerified = false;
  }
  if (!signatureVerified) {
    return { outcome: "rejected-unverified-signature", eventId: event.id, senderPubkeyHex: "" };
  }

  if (typeof options.nip44Wire.decryptNip44Wire !== "function") {
    return { outcome: "rejected-decrypt-failed", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  let plaintextBytes: Uint8Array | null;
  try {
    plaintextBytes = await options.nip44Wire.decryptNip44Wire(options.localAccountIndex, event.pubkey, event.content);
  } catch {
    plaintextBytes = null;
  }
  if (plaintextBytes === null) {
    return { outcome: "rejected-decrypt-failed", eventId: event.id, senderPubkeyHex: event.pubkey };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes));
  } catch {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  if (!isWellFormedPrivateDeliverySyncPayload(parsed)) {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }

  return { outcome: "decrypted", eventId: event.id, senderPubkeyHex: event.pubkey, payload: parsed };
}

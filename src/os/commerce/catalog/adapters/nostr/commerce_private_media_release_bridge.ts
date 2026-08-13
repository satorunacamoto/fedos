/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — the
 * PRIVATE `MediaAccessGrant` release transport. Sibling of
 * `commerce_private_delivery_bridge.ts` (same directory, unmodified by this
 * file) — reuses that file's own Coordinator-approved design decision
 * verbatim rather than re-deriving a second one: calls
 * `FedosMasterSeedAuthority.encryptNip44Wire()`/`decryptNip44Wire()`
 * DIRECTLY, signs the outer event via the SAME real
 * `FedosNostrSigningAuthority`, publishes/subscribes via the SAME real
 * `RelayPublisher`/`WebSocketRelayAdapter` every other private-sync channel
 * already uses, and reuses `kind: 1` for the exact same reason
 * (`FedosNostrSigningAuthority`'s own closed `kind` allowlist). This is
 * intentionally NOT a second transport stack — the only new things are the
 * two payload categories (`../../../events/commerce_private_media_release_sync.js`)
 * and their own topic tags, so a subscriber can never confuse a
 * media-release event with any other private-sync category.
 *
 * TWO DIRECTIONS, ONE FILE — a request transport (buyer -> seller) and a
 * response transport (seller -> buyer), each with its own tag so a listener
 * can subscribe to exactly the direction it cares about (a seller's process
 * only ever needs to discover REQUESTS; a buyer's process only ever needs to
 * discover RESPONSES — see `commerce_private_media_release_sync.ts`'s own
 * header for why a request/response shape exists here at all, unlike the
 * other three, purely-assertive private-sync channels).
 *
 * THE HONEST PRIVACY BOUNDARY — identical to every sibling bridge's own
 * (read `commerce_private_order_bridge.ts`'s header for the full account,
 * not repeated here): `content` is genuine NIP-44 ciphertext, decryptable
 * only by the two real counterparties; the outer event's real signer pubkey
 * and a `["p", ...]` recipient tag are NOT hidden, and `created_at` is not
 * randomized. This file makes no different or wider claim than that.
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
  isWellFormedPrivateMediaReleaseRequestPayload,
  isWellFormedPrivateMediaReleasePayload,
  type PrivateMediaReleaseRequestPayload,
  type PrivateMediaReleasePayload,
} from "../../../events/commerce_private_media_release_sync.js";

/** Fixed `kind` — see this file's header for exactly why. */
export const COMMERCE_PRIVATE_MEDIA_RELEASE_EVENT_KIND = 1;
/** Distinct topic namespace from every other private/public Commerce tag — never collides on the wire. */
export const COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG = "fedos-commerce-private:media-release-request:v1";
export const COMMERCE_PRIVATE_MEDIA_RELEASE_TAG = "fedos-commerce-private:media-release:v1";

/** Same narrow seam every sibling bridge declares locally rather than importing cross-file. */
export interface CommerceNip44Wire {
  encryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null>;
  decryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null>;
}

// ---------------------------------------------------------------------------
// Outbound: request (buyer -> seller)
// ---------------------------------------------------------------------------

export async function encryptPrivateMediaReleaseRequestPayload(
  payload: PrivateMediaReleaseRequestPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  nip44Wire: CommerceNip44Wire,
): Promise<string | null> {
  if (!isWellFormedPrivateMediaReleaseRequestPayload(payload)) return null;
  if (typeof nip44Wire.encryptNip44Wire !== "function") return null;
  try {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    return await nip44Wire.encryptNip44Wire(accountIndex, counterpartyPublicKeyHex, plaintext);
  } catch {
    return null;
  }
}

export async function buildCommercePrivateMediaReleaseRequestUnsignedEventRequest(
  payload: PrivateMediaReleaseRequestPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  createdAt: number,
  nip44Wire: CommerceNip44Wire,
): Promise<FedosNostrUnsignedEventRequest | null> {
  const ciphertext = await encryptPrivateMediaReleaseRequestPayload(payload, counterpartyPublicKeyHex, accountIndex, nip44Wire);
  if (ciphertext === null) return null;
  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_PRIVATE_MEDIA_RELEASE_EVENT_KIND,
    tags: [
      ["t", COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG],
      ["p", counterpartyPublicKeyHex],
    ],
    content: ciphertext,
  };
  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

export interface CommercePrivateMediaReleaseTransportSendResult {
  readonly accepted: boolean;
  readonly eventId: string;
  readonly message: string;
}

export interface RealCommercePrivateMediaReleaseRequestTransportOptions {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly relayPublisher: RelayPublisher;
  readonly nip44Wire: CommerceNip44Wire;
  readonly accountIndex: number;
  readonly now?: () => number;
}

/** The ONE real private-media-release-REQUEST transport (buyer -> seller). */
export class RealCommercePrivateMediaReleaseRequestTransport {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #relayPublisher: RelayPublisher;
  readonly #nip44Wire: CommerceNip44Wire;
  readonly #accountIndex: number;
  readonly #now: () => number;

  constructor(options: RealCommercePrivateMediaReleaseRequestTransportOptions) {
    this.#signingAuthority = options.signingAuthority;
    this.#relayPublisher = options.relayPublisher;
    this.#nip44Wire = options.nip44Wire;
    this.#accountIndex = options.accountIndex;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(payload: PrivateMediaReleaseRequestPayload, counterpartyPublicKeyHex: string): Promise<CommercePrivateMediaReleaseTransportSendResult> {
    const request = await buildCommercePrivateMediaReleaseRequestUnsignedEventRequest(
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
    if (signed === null) return { accepted: false, eventId: "", message: "signing authority returned no signed event" };
    const published = await this.#relayPublisher.publish(signed);
    return { accepted: published.accepted, eventId: published.eventId, message: published.message };
  }
}

export type InboundPrivateMediaReleaseRequestOutcome =
  | "decrypted"
  | "not-mine"
  | "rejected-unverified-signature"
  | "rejected-decrypt-failed"
  | "rejected-unknown-shape";

export interface InboundPrivateMediaReleaseRequestEnvelope {
  readonly outcome: InboundPrivateMediaReleaseRequestOutcome;
  readonly eventId: string;
  /** The event's REAL verified signer — never a claim read out of the decrypted content. */
  readonly senderPubkeyHex: string;
  readonly payload?: PrivateMediaReleaseRequestPayload;
}

export interface CommerceInboundPrivateMediaReleaseBridgeOptions {
  readonly nip44Wire: CommerceNip44Wire;
  readonly localAccountIndex: number;
  readonly verifier?: SignatureVerifier;
}

/** Seller-side: builds an `InboundPrivateMediaReleaseRequestEnvelope` from an unknown wire value. Never throws. */
export async function verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(
  event: unknown,
  options: CommerceInboundPrivateMediaReleaseBridgeOptions,
): Promise<InboundPrivateMediaReleaseRequestEnvelope> {
  if (!isNostrEvent(event)) return { outcome: "not-mine", eventId: "", senderPubkeyHex: "" };
  const hasOwnTag = event.tags.some((tag) => tag[0] === "t" && tag[1] === COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG);
  if (!hasOwnTag) return { outcome: "not-mine", eventId: event.id, senderPubkeyHex: "" };

  const verifier = options.verifier ?? NobleSignatureVerifier;
  let signatureVerified: boolean;
  try {
    signatureVerified = await verifier.verify(event);
  } catch {
    signatureVerified = false;
  }
  if (!signatureVerified) return { outcome: "rejected-unverified-signature", eventId: event.id, senderPubkeyHex: "" };

  if (typeof options.nip44Wire.decryptNip44Wire !== "function") {
    return { outcome: "rejected-decrypt-failed", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  let plaintextBytes: Uint8Array | null;
  try {
    plaintextBytes = await options.nip44Wire.decryptNip44Wire(options.localAccountIndex, event.pubkey, event.content);
  } catch {
    plaintextBytes = null;
  }
  if (plaintextBytes === null) return { outcome: "rejected-decrypt-failed", eventId: event.id, senderPubkeyHex: event.pubkey };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes));
  } catch {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  if (!isWellFormedPrivateMediaReleaseRequestPayload(parsed)) {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  return { outcome: "decrypted", eventId: event.id, senderPubkeyHex: event.pubkey, payload: parsed };
}

// ---------------------------------------------------------------------------
// Outbound: response (seller -> buyer)
// ---------------------------------------------------------------------------

export async function encryptPrivateMediaReleasePayload(
  payload: PrivateMediaReleasePayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  nip44Wire: CommerceNip44Wire,
): Promise<string | null> {
  if (!isWellFormedPrivateMediaReleasePayload(payload)) return null;
  if (typeof nip44Wire.encryptNip44Wire !== "function") return null;
  try {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    return await nip44Wire.encryptNip44Wire(accountIndex, counterpartyPublicKeyHex, plaintext);
  } catch {
    return null;
  }
}

export async function buildCommercePrivateMediaReleaseUnsignedEventRequest(
  payload: PrivateMediaReleasePayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  createdAt: number,
  nip44Wire: CommerceNip44Wire,
): Promise<FedosNostrUnsignedEventRequest | null> {
  const ciphertext = await encryptPrivateMediaReleasePayload(payload, counterpartyPublicKeyHex, accountIndex, nip44Wire);
  if (ciphertext === null) return null;
  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_PRIVATE_MEDIA_RELEASE_EVENT_KIND,
    tags: [
      ["t", COMMERCE_PRIVATE_MEDIA_RELEASE_TAG],
      ["p", counterpartyPublicKeyHex],
    ],
    content: ciphertext,
  };
  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

export interface RealCommercePrivateMediaReleaseTransportOptions {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly relayPublisher: RelayPublisher;
  readonly nip44Wire: CommerceNip44Wire;
  readonly accountIndex: number;
  readonly now?: () => number;
}

/** The ONE real private-media-release-RESPONSE transport (seller -> buyer). */
export class RealCommercePrivateMediaReleaseTransport {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #relayPublisher: RelayPublisher;
  readonly #nip44Wire: CommerceNip44Wire;
  readonly #accountIndex: number;
  readonly #now: () => number;

  constructor(options: RealCommercePrivateMediaReleaseTransportOptions) {
    this.#signingAuthority = options.signingAuthority;
    this.#relayPublisher = options.relayPublisher;
    this.#nip44Wire = options.nip44Wire;
    this.#accountIndex = options.accountIndex;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(payload: PrivateMediaReleasePayload, counterpartyPublicKeyHex: string): Promise<CommercePrivateMediaReleaseTransportSendResult> {
    const request = await buildCommercePrivateMediaReleaseUnsignedEventRequest(
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
    if (signed === null) return { accepted: false, eventId: "", message: "signing authority returned no signed event" };
    const published = await this.#relayPublisher.publish(signed);
    return { accepted: published.accepted, eventId: published.eventId, message: published.message };
  }
}

export type InboundPrivateMediaReleaseOutcome =
  | "decrypted"
  | "not-mine"
  | "rejected-unverified-signature"
  | "rejected-decrypt-failed"
  | "rejected-unknown-shape";

export interface InboundPrivateMediaReleaseEnvelope {
  readonly outcome: InboundPrivateMediaReleaseOutcome;
  readonly eventId: string;
  readonly senderPubkeyHex: string;
  readonly payload?: PrivateMediaReleasePayload;
}

/** Buyer-side: builds an `InboundPrivateMediaReleaseEnvelope` from an unknown wire value. Never throws. */
export async function verifyAndDecryptInboundPrivateMediaReleaseEnvelope(
  event: unknown,
  options: CommerceInboundPrivateMediaReleaseBridgeOptions,
): Promise<InboundPrivateMediaReleaseEnvelope> {
  if (!isNostrEvent(event)) return { outcome: "not-mine", eventId: "", senderPubkeyHex: "" };
  const hasOwnTag = event.tags.some((tag) => tag[0] === "t" && tag[1] === COMMERCE_PRIVATE_MEDIA_RELEASE_TAG);
  if (!hasOwnTag) return { outcome: "not-mine", eventId: event.id, senderPubkeyHex: "" };

  const verifier = options.verifier ?? NobleSignatureVerifier;
  let signatureVerified: boolean;
  try {
    signatureVerified = await verifier.verify(event);
  } catch {
    signatureVerified = false;
  }
  if (!signatureVerified) return { outcome: "rejected-unverified-signature", eventId: event.id, senderPubkeyHex: "" };

  if (typeof options.nip44Wire.decryptNip44Wire !== "function") {
    return { outcome: "rejected-decrypt-failed", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  let plaintextBytes: Uint8Array | null;
  try {
    plaintextBytes = await options.nip44Wire.decryptNip44Wire(options.localAccountIndex, event.pubkey, event.content);
  } catch {
    plaintextBytes = null;
  }
  if (plaintextBytes === null) return { outcome: "rejected-decrypt-failed", eventId: event.id, senderPubkeyHex: event.pubkey };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes));
  } catch {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  if (!isWellFormedPrivateMediaReleasePayload(parsed)) {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }
  return { outcome: "decrypted", eventId: event.id, senderPubkeyHex: event.pubkey, payload: parsed };
}

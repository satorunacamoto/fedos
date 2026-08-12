/**
 * Commerce Purchase/Payment Completion mega-arc (Agent P) — the PRIVATE
 * Payment-evidence transport. Sibling of `commerce_private_order_bridge.ts`
 * in every structural respect (same directory, per
 * `test/architecture_boundary_commerce.test.ts`'s `NOSTR_ADAPTER_DIR`
 * allowlist — this is the ONLY place under `src/os/commerce` besides that
 * file, `commerce_event_bridge.ts`, and `commerce_inbound_event_bridge.ts`
 * allowed to know a real `NostrEvent` shape).
 *
 * REUSE, NOT A SECOND CRYPTO/MESSAGING STACK
 * ----------------------------------------------------------------------
 * Calls the SAME `FedosMasterSeedAuthority.encryptNip44Wire()`/
 * `decryptNip44Wire()` real NIP-44 v2 wire-crypto primitive
 * `commerce_private_order_bridge.ts` already calls (imports its
 * `CommerceNip44Wire` seam directly rather than re-declaring it). Signs via
 * the SAME injected `FedosNostrSigningAuthority`, publishes via the SAME
 * injected `RelayPublisher`, verifies inbound signatures via the SAME
 * `NobleSignatureVerifier` default. No new signer, no new relay client, no
 * new crypto primitive is implemented anywhere in this file.
 *
 * WHY `kind: 1` AND A DISTINCT `["t", ...]` TAG (not a new private-order
 * tag, not a public Commerce category)
 * ----------------------------------------------------------------------
 * Same reasoning as `commerce_private_order_bridge.ts`'s own header:
 * `FedosNostrSigningAuthority`'s real implementation enforces a closed
 * `kind` allowlist that this file has no standing to widen.
 * `COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG` is a DIFFERENT namespace
 * than both `commerce_event_bridge.ts`'s public
 * `fedos-commerce:<category>:v1` tags AND
 * `commerce_private_order_bridge.ts`'s own `COMMERCE_PRIVATE_ORDER_SYNC_TAG`
 * — a subscriber can never confuse a payment-evidence event with an Order
 * sync event or a public listing, even though all three currently share
 * `kind: 1`.
 *
 * THE HONEST PRIVACY BOUNDARY — identical to
 * `commerce_private_order_bridge.ts`'s own (see that file's header for the
 * full statement): `content` is genuine NIP-44 ciphertext, decryptable
 * only by the real intended recipient; the outer event's signer pubkey and
 * the plaintext `["p", recipientPubkeyHex]` tag are NOT hidden from a
 * relay operator or passive observer. Metadata-visible, content-private —
 * not an anonymity claim.
 *
 * THIS FILE STAYS WIRE-LEVEL ONLY — no `PaymentEvidence`/settlement-ledger
 * knowledge lives here, mirroring `commerce_private_order_bridge.ts`'s own
 * "never know the Order domain, only the wire payload" discipline. The
 * receiver-side domain translation + validation gate lives in
 * `../../../payment/payment_evidence_port.ts` — this file only proves "a
 * genuinely signed, genuinely encrypted-for-me payload of this exact
 * shape arrived from this real pubkey", nothing more.
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
import type { CommerceNip44Wire } from "./commerce_private_order_bridge.js";
import {
  isWellFormedPrivatePaymentEvidenceSyncPayload,
  type PrivatePaymentEvidenceSyncPayload,
} from "../../../events/commerce_private_payment_evidence_sync.js";
import {
  buildOutboundPaymentEvidenceSyncPayload,
  type PaymentEvidenceOrderBinding,
  type PaymentEvidenceSendPort,
  type PaymentEvidenceSendResult,
} from "../../../payment/payment_evidence_port.js";
import type { PaymentEvidence } from "../../../payment/types.js";

export type { CommerceNip44Wire };

/** Fixed `kind` — see this file's header for exactly why. */
export const COMMERCE_PRIVATE_PAYMENT_EVIDENCE_EVENT_KIND = 1;
/** Distinct topic namespace from both the public catalog tags AND `commerce_private_order_bridge.ts`'s own `COMMERCE_PRIVATE_ORDER_SYNC_TAG` — never collides with either on the wire. */
export const COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG = "fedos-commerce-private:payment-evidence-sync:v1";

/**
 * Encrypts an ALREADY-VALIDATED payload into a NIP-44 wire ciphertext
 * string. Returns `null` (fails closed, never throws) on ANY failure —
 * malformed payload, no `encryptNip44Wire` support, no Master Seed held,
 * or an internal derivation/encrypt failure.
 */
export async function encryptPrivatePaymentEvidenceSyncPayload(
  payload: PrivatePaymentEvidenceSyncPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  nip44Wire: CommerceNip44Wire,
): Promise<string | null> {
  if (!isWellFormedPrivatePaymentEvidenceSyncPayload(payload)) return null;
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
 * expects for a private-payment-evidence envelope. Returns `null` (fails
 * closed, never throws) if encryption itself failed or the resulting
 * request does not pass `isWellFormedFedosNostrUnsignedEventRequest()`.
 */
export async function buildCommercePrivatePaymentEvidenceUnsignedEventRequest(
  payload: PrivatePaymentEvidenceSyncPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  createdAt: number,
  nip44Wire: CommerceNip44Wire,
): Promise<FedosNostrUnsignedEventRequest | null> {
  const ciphertext = await encryptPrivatePaymentEvidenceSyncPayload(payload, counterpartyPublicKeyHex, accountIndex, nip44Wire);
  if (ciphertext === null) return null;

  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_PRIVATE_PAYMENT_EVIDENCE_EVENT_KIND,
    tags: [
      ["t", COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG],
      ["p", counterpartyPublicKeyHex],
    ],
    content: ciphertext,
  };
  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

export interface CommercePrivatePaymentEvidenceTransportSendResult {
  readonly accepted: boolean;
  readonly eventId: string;
  readonly message: string;
}

export interface RealCommercePrivatePaymentEvidenceTransportOptions {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly relayPublisher: RelayPublisher;
  readonly nip44Wire: CommerceNip44Wire;
  readonly accountIndex: number;
  readonly now?: () => number;
}

/**
 * The ONE real private-payment-evidence transport — encrypts via
 * `encryptNip44Wire`, signs via the injected `FedosNostrSigningAuthority`,
 * publishes via the injected `RelayPublisher`. Pure wire-level plumbing;
 * `../../../payment/payment_evidence_port.ts`'s `RealPaymentEvidenceTransport`
 * is the domain-facing adapter that builds a well-formed payload from a
 * real `PaymentEvidence` and calls this class underneath.
 */
export class RealCommercePrivatePaymentEvidenceTransport {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #relayPublisher: RelayPublisher;
  readonly #nip44Wire: CommerceNip44Wire;
  readonly #accountIndex: number;
  readonly #now: () => number;

  constructor(options: RealCommercePrivatePaymentEvidenceTransportOptions) {
    this.#signingAuthority = options.signingAuthority;
    this.#relayPublisher = options.relayPublisher;
    this.#nip44Wire = options.nip44Wire;
    this.#accountIndex = options.accountIndex;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(
    payload: PrivatePaymentEvidenceSyncPayload,
    counterpartyPublicKeyHex: string,
  ): Promise<CommercePrivatePaymentEvidenceTransportSendResult> {
    const request = await buildCommercePrivatePaymentEvidenceUnsignedEventRequest(
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

/**
 * The domain-facing adapter: implements `PaymentEvidenceSendPort`
 * (`../../../payment/payment_evidence_port.ts`) on top of this file's own
 * wire-level `RealCommercePrivatePaymentEvidenceTransport`. This is the
 * ONE place that bridges "a real, already-authoritative `PaymentEvidence`"
 * to "an encrypted, signed wire message" — `buildOutboundPaymentEvidenceSyncPayload()`
 * (imported from the Port module) refuses non-authoritative evidence
 * before this class ever touches the network, so even a caller that
 * accidentally passes unverified evidence here cannot leak it as if it
 * were transportable settlement proof.
 */
export class RealPaymentEvidenceTransport implements PaymentEvidenceSendPort {
  readonly #wireTransport: RealCommercePrivatePaymentEvidenceTransport;
  readonly #now: () => number;

  constructor(options: RealCommercePrivatePaymentEvidenceTransportOptions) {
    this.#wireTransport = new RealCommercePrivatePaymentEvidenceTransport(options);
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(
    evidence: PaymentEvidence,
    binding: PaymentEvidenceOrderBinding,
    counterpartyPubkeyHex: string,
  ): Promise<PaymentEvidenceSendResult> {
    const payload = buildOutboundPaymentEvidenceSyncPayload(evidence, binding, this.#now());
    if (payload === null) {
      return { accepted: false, message: "evidence is not authoritative, or evidence/binding failed validation -- refused to transport" };
    }
    const sent = await this.#wireTransport.send(payload, counterpartyPubkeyHex);
    return { accepted: sent.accepted, message: sent.message };
  }
}

// ---------------------------------------------------------------------------
// Inbound
// ---------------------------------------------------------------------------

export type InboundPrivatePaymentEvidenceOutcome =
  | "decrypted"
  | "not-mine"
  | "rejected-unverified-signature"
  | "rejected-decrypt-failed"
  | "rejected-unknown-shape";

export interface InboundPrivatePaymentEvidenceEnvelope {
  readonly outcome: InboundPrivatePaymentEvidenceOutcome;
  readonly eventId: string;
  /** The event's REAL verified signer — never a claim read out of the decrypted content. Empty string when signature verification itself did not run. */
  readonly senderPubkeyHex: string;
  readonly payload?: PrivatePaymentEvidenceSyncPayload;
}

export interface CommerceInboundPrivatePaymentEvidenceBridgeOptions {
  readonly nip44Wire: CommerceNip44Wire;
  readonly localAccountIndex: number;
  /** Defaults to `NobleSignatureVerifier` — this repo's own real verifier. */
  readonly verifier?: SignatureVerifier;
}

/**
 * Builds an `InboundPrivatePaymentEvidenceEnvelope` from an unknown wire
 * value, running REAL signature verification AND real NIP-44 decryption
 * along the way. Never throws. This function alone is NOT the "receiver
 * validation" gate the arc brief requires — it only proves cryptographic
 * authenticity + shape; `payment_evidence_port.ts`'s
 * `applyInboundPaymentEvidenceSync()` is what checks Order binding,
 * amount/currency, provider identity, current state, and replay/idempotency
 * before ever touching the settlement ledger.
 */
export async function verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(
  event: unknown,
  options: CommerceInboundPrivatePaymentEvidenceBridgeOptions,
): Promise<InboundPrivatePaymentEvidenceEnvelope> {
  if (!isNostrEvent(event)) {
    return { outcome: "not-mine", eventId: "", senderPubkeyHex: "" };
  }
  const hasOwnTag = event.tags.some((tag) => tag[0] === "t" && tag[1] === COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG);
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
  if (!isWellFormedPrivatePaymentEvidenceSyncPayload(parsed)) {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }

  return { outcome: "decrypted", eventId: event.id, senderPubkeyHex: event.pubkey, payload: parsed };
}

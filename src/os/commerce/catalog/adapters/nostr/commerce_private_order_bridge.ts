/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
 * Coordinator-directed pass) — the PRIVATE Order/status transport. Sibling
 * of `commerce_event_bridge.ts`/`commerce_inbound_event_bridge.ts` (same
 * directory, unmodified by this pass) — together the three files are the
 * only places under `src/os/commerce` allowed to know a real `NostrEvent`
 * shape (`test/architecture_boundary_commerce.test.ts`'s `NOSTR_ADAPTER_DIR`).
 *
 * COORDINATOR DECISION THIS FILE IMPLEMENTS (read before editing)
 * ----------------------------------------------------------------------
 * The full NIP-17 Rumor->Seal->Gift-Wrap stack
 * (`NostrNip17V1WireAdapter`, `../../../../messenger/adapters/nostr/
 * conversation_delivery/nip17/`) was evaluated and REJECTED for Commerce:
 * its `build()` requires a real `FedosConversationMessageEnvelope`
 * (`senderMembershipId`/`payloadId` — real Membership/Conversation-Payload-
 * Storage foreign keys that do not exist for two Commerce counterparties
 * with no prior Conversation) — fabricating them would be a real
 * domain-layering violation, not a shortcut. Instead, this file calls
 * `FedosMasterSeedAuthority.encryptNip44Wire()`/`decryptNip44Wire()`
 * DIRECTLY — the SAME real, reviewed NIP-44 v2 wire-crypto primitive the
 * Gift-Wrap adapter itself calls underneath (Secure Runtime Alpha
 * 1761-1840 Phase B), so this is REUSE of the existing Nostr adapter's own
 * crypto, never a second implementation (arc §9). No new crypto is
 * implemented anywhere in this file.
 *
 * NO NEW SIGNER, NO NEW RELAY CLIENT. The outer, real Nostr event that
 * carries the NIP-44 ciphertext is signed by the SAME
 * `FedosNostrSigningAuthority` `commerce_event_bridge.ts` already uses,
 * and published via the SAME `RelayPublisher`/read via the SAME
 * `WebSocketRelayAdapter` this wave's public-discovery path already uses.
 *
 * WHY `kind: 1` HERE TOO (not a new Commerce-private kind)
 * ----------------------------------------------------------------------
 * `FedosNostrSigningAuthority`'s own real implementation enforces a
 * CLOSED `kind` allowlist (`isWellFormedFedosNostrUnsignedEventRequest`,
 * `.../protocol/sign/fedos_nostr_signing_authority.ts`) — exactly `1`
 * (public text note), Messenger's own proprietary private-delivery kind,
 * or the NIP-59 Seal kind. Widening that allowlist to mint a new
 * Commerce-private kind is shared Messenger signing infrastructure, out
 * of this file's territory (same reasoning `commerce_event_bridge.ts`'s
 * own header already gives for reusing `kind: 1`). What actually
 * distinguishes a private-order envelope from an ordinary public Commerce
 * event or from Messenger's own private delivery is its `["t", ...]` tag
 * (`COMMERCE_PRIVATE_ORDER_SYNC_TAG` below — a DIFFERENT namespace than
 * `commerce_event_bridge.ts`'s own `fedos-commerce:<category>:v1`, so a
 * subscriber can never confuse the two) plus a `["p", recipientPubkeyHex]`
 * tag so the intended recipient's own subscription filter can find it —
 * and, structurally, its `content` is opaque NIP-44 ciphertext, never
 * `JSON.stringify()` of a public draft.
 *
 * THE HONEST PRIVACY BOUNDARY (arc §18's own explicit requirement — read
 * before claiming this is anonymous)
 * ----------------------------------------------------------------------
 * WHAT IS HIDDEN: the event's `content` is genuinely NIP-44-v2 encrypted
 * — only the two real counterparties (the sender's real account and the
 * `counterpartyPublicKeyHex` the ciphertext was encrypted for) can ever
 * decrypt it. A relay operator, a passive network observer, or any third
 * party who is not one of the two real counterparties sees only opaque
 * ciphertext bytes as `content` — never the order id, product id,
 * quantity, price, status, or reject/cancel reason.
 *
 * WHAT IS **NOT** HIDDEN (this is the bounded, honest guarantee — do not
 * upgrade this into an anonymity claim): the outer event is signed by the
 * sender's REAL, already-public Commerce identity (the same pubkey their
 * own public product listings/orders already use) and carries a real,
 * plaintext `["p", recipientPubkeyHex]` tag naming the real recipient. A
 * relay operator or passive observer CAN see that these two specific
 * pubkeys are exchanging events, and roughly WHEN (the event's own
 * `created_at`, not randomized the way NIP-17's own Gift-Wrap/Seal layers
 * deliberately randomize timestamps up to two days into the past — see
 * `fedos_nostr_nip17_v1_wire_adapter.ts`'s own header for that
 * randomization this file does NOT replicate). This is metadata-visible,
 * content-private — the SAME transport-layer honesty
 * `../../network_profile.ts`'s own header already insists on ("Tor is
 * transport policy, never an anonymity guarantee") applied to THIS
 * transport's own real properties, not a new claim.
 *
 * STATUS: wired into the shipped Electron app this pass — see
 * `commercePrivateOrderTransportFor()`/
 * `commercePrivateOrderDiscoverAndApplyNonFatal()`
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
  isWellFormedPrivateOrderSyncPayload,
  type PrivateOrderSyncPayload,
} from "../../../events/commerce_private_order_sync.js";

/** Fixed `kind` — see this file's header for exactly why. */
export const COMMERCE_PRIVATE_ORDER_EVENT_KIND = 1;
/** Distinct topic namespace from `commerce_event_bridge.ts`'s own
 * `fedos-commerce:<category>:v1` (public) AND from Messenger's own
 * private-delivery kind/tags — never collides with either on the wire. */
export const COMMERCE_PRIVATE_ORDER_SYNC_TAG = "fedos-commerce-private:order-sync:v1";

/**
 * The narrow seam a `FedosMasterSeedAuthority.encryptNip44Wire`-capable
 * object satisfies — deliberately narrower than the full
 * `FedosMasterSeedAuthority` interface (this file only ever calls these
 * two methods). Matches this repo's own established "depend on the
 * narrowest seam a file actually uses" convention.
 */
export interface CommerceNip44Wire {
  encryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null>;
  decryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null>;
}

/**
 * Encrypts an ALREADY-VALIDATED payload into a NIP-44 wire ciphertext
 * string. Returns `null` (fails closed, never throws) on ANY failure —
 * malformed payload, no `encryptNip44Wire` support, no Master Seed held,
 * or an internal derivation/encrypt failure — mirroring
 * `encryptNip44Wire`'s own documented fail-closed contract.
 */
export async function encryptPrivateOrderSyncPayload(
  payload: PrivateOrderSyncPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  nip44Wire: CommerceNip44Wire,
): Promise<string | null> {
  if (!isWellFormedPrivateOrderSyncPayload(payload)) return null;
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
 * expects for a private-order envelope. Returns `null` (fails closed,
 * never throws) if encryption itself failed or the resulting request does
 * not pass `isWellFormedFedosNostrUnsignedEventRequest()`.
 */
export async function buildCommercePrivateOrderUnsignedEventRequest(
  payload: PrivateOrderSyncPayload,
  counterpartyPublicKeyHex: string,
  accountIndex: number,
  createdAt: number,
  nip44Wire: CommerceNip44Wire,
): Promise<FedosNostrUnsignedEventRequest | null> {
  const ciphertext = await encryptPrivateOrderSyncPayload(payload, counterpartyPublicKeyHex, accountIndex, nip44Wire);
  if (ciphertext === null) return null;

  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_PRIVATE_ORDER_EVENT_KIND,
    tags: [
      ["t", COMMERCE_PRIVATE_ORDER_SYNC_TAG],
      ["p", counterpartyPublicKeyHex],
    ],
    content: ciphertext,
  };
  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

export interface CommercePrivateOrderTransportSendResult {
  readonly accepted: boolean;
  readonly eventId: string;
  readonly message: string;
}

export interface RealCommercePrivateOrderTransportOptions {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly relayPublisher: RelayPublisher;
  readonly nip44Wire: CommerceNip44Wire;
  readonly accountIndex: number;
  readonly now?: () => number;
}

/**
 * The ONE real private-order transport — encrypts via `encryptNip44Wire`,
 * signs the resulting ciphertext-carrying event via the injected
 * `FedosNostrSigningAuthority` (real production signing, same seam
 * `RealCommerceNostrEventTransport` already uses), publishes via the
 * injected `RelayPublisher` (same real write-path). Never used by this
 * wave's own type-level unit tests (those inject a fake `CommerceNip44Wire`
 * instead) — `test/commerce_nostr_real_relay_private_order_sync.test.ts`
 * exercises this exact class with REAL WASM NIP-44 crypto over a REAL
 * local relay.
 */
export class RealCommercePrivateOrderTransport {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #relayPublisher: RelayPublisher;
  readonly #nip44Wire: CommerceNip44Wire;
  readonly #accountIndex: number;
  readonly #now: () => number;

  constructor(options: RealCommercePrivateOrderTransportOptions) {
    this.#signingAuthority = options.signingAuthority;
    this.#relayPublisher = options.relayPublisher;
    this.#nip44Wire = options.nip44Wire;
    this.#accountIndex = options.accountIndex;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(payload: PrivateOrderSyncPayload, counterpartyPublicKeyHex: string): Promise<CommercePrivateOrderTransportSendResult> {
    const request = await buildCommercePrivateOrderUnsignedEventRequest(
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

export type InboundPrivateOrderOutcome =
  | "decrypted"
  | "not-mine"
  | "rejected-unverified-signature"
  | "rejected-decrypt-failed"
  | "rejected-unknown-shape";

export interface InboundPrivateOrderEnvelope {
  readonly outcome: InboundPrivateOrderOutcome;
  readonly eventId: string;
  /** The event's REAL verified signer — never a claim read out of the
   * decrypted content. Empty string when signature verification itself
   * did not run (structurally invalid event / wrong tag). */
  readonly senderPubkeyHex: string;
  readonly payload?: PrivateOrderSyncPayload;
}

export interface CommerceInboundPrivateOrderBridgeOptions {
  readonly nip44Wire: CommerceNip44Wire;
  readonly localAccountIndex: number;
  /** Defaults to `NobleSignatureVerifier` — this repo's own real verifier,
   * same default `commerce_inbound_event_bridge.ts` uses. */
  readonly verifier?: SignatureVerifier;
}

/**
 * Builds an `InboundPrivateOrderEnvelope` from an unknown wire value,
 * running REAL signature verification AND real NIP-44 decryption along
 * the way. Never throws. `"not-mine"` covers a structurally-not-a-NostrEvent
 * input OR an event missing this file's own `COMMERCE_PRIVATE_ORDER_SYNC_TAG`
 * tag — the same cheap, pre-crypto filter a real subscriber's own relay
 * filter already applies, re-checked here defense-in-depth. A genuine
 * decrypt failure (wrong recipient, tampered ciphertext, or simply "this
 * event was never encrypted for me") is `"rejected-decrypt-failed"` —
 * `decryptNip44Wire`'s own fail-closed contract makes this
 * indistinguishable from "not encrypted for me at all", exactly the "no
 * oracle detail in the failure" discipline this repo's NIP-17 work
 * already established for the exact same reason.
 */
export async function verifyAndDecryptInboundPrivateOrderEnvelope(
  event: unknown,
  options: CommerceInboundPrivateOrderBridgeOptions,
): Promise<InboundPrivateOrderEnvelope> {
  if (!isNostrEvent(event)) {
    return { outcome: "not-mine", eventId: "", senderPubkeyHex: "" };
  }
  const hasOwnTag = event.tags.some((tag) => tag[0] === "t" && tag[1] === COMMERCE_PRIVATE_ORDER_SYNC_TAG);
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
  if (!isWellFormedPrivateOrderSyncPayload(parsed)) {
    return { outcome: "rejected-unknown-shape", eventId: event.id, senderPubkeyHex: event.pubkey };
  }

  return { outcome: "decrypted", eventId: event.id, senderPubkeyHex: event.pubkey, payload: parsed };
}

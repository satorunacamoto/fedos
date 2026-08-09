/**
 * Secure Runtime Alpha 1471–1540 ("Private Transport Boundary and
 * Multi-Relay Delivery Arc"); wire `kind` closed onto the shared FedOS
 * proprietary kind by Secure Runtime Alpha 1611–1690 ("Nostr Private
 * Wire Standardization and Transport Reconciliation Arc"), Alpha 1615
 * ("Kind-1 Closure").
 *
 * Packages an already-encrypted `FedosConversationMessageEnvelope`
 * (`../envelope/fedos_conversation_message_envelope.ts`, ciphertext
 * already produced by `FedosConversationEncryptionAuthority`, Alpha 861 —
 * unchanged, reused, never touched here) into the ONE wire shape this
 * repository's Nostr Signing Authority will sign:
 * `FedosNostrUnsignedEventRequest` (`../../nostr/sign/fedos_nostr_signing_authority.ts`).
 *
 * NO NEW CRYPTO: this file moves already-opaque ciphertext bytes only —
 * it never encrypts, decrypts, or derives a key.
 *
 * `kind` is HARD-FIXED to `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` (`24700` —
 * `../delivery/nostr/fedos_private_nostr_delivery_mode.ts`, Alpha
 * 1399/1402) by `isWellFormedFedosNostrUnsignedEventRequest()`
 * (`../../nostr/sign/fedos_nostr_signing_authority.ts`) — this file does
 * not, and cannot, invent a new Nostr kind; it reuses the SAME
 * FedOS-proprietary, disclosed, non-interoperable kind the
 * `privateNostrDelivery()` facade (Alpha 1391–1470) already established
 * and the Signing Authority's own closed two-value allowlist already
 * permits. Alpha 1611–1690's own Phase A reconciliation report
 * (`docs/secure_runtime_alpha_1611_1690_phase_a_reconciliation.md`, §2/§4)
 * found this file previously hard-fixed `kind: 1` instead — a private
 * ciphertext event was, before this Arc, wire-indistinguishable in KIND
 * from a public Board post, relying on tags alone to opt a relay/client
 * OUT of treating it as public. That is now structurally impossible:
 * `kind: 1` is reserved for public Board posts ONLY (see
 * `../../board/` — untouched, byte-for-byte, by this change). A private
 * transport event is now distinguished from any other proprietary-kind
 * event PURELY by tags: `["fedos-private","1"]` marks it as a
 * private-TRANSPORT event specifically (as opposed to one delivered via
 * the separate `privateNostrDelivery()` facade, which uses its own,
 * different tag shape at the SAME kind — see the Phase A report's own
 * §9 "duplicate functionality" finding, deliberately not unified by this
 * Arc), `["p", counterpartyPublicKeyHex]` names the intended recipient
 * (NIP-01 convention, reused as an idiom — no NIP-04/NIP-17/NIP-44
 * semantics are implemented or assumed), and `["e-envelope",
 * envelopeId]` carries the opaque `FedosConversationEnvelopeId` this
 * event corresponds to, so a receiver can correlate delivery without
 * decrypting first.
 *
 * `content` is the ciphertext, base64-encoded — the SAME encoding-only
 * boundary discipline `fedos_conversation_payload_codec.ts` (Alpha 806)
 * already established for Conversation Payload bytes crossing a
 * text-only wire boundary, reused here for the identical reason (Nostr's
 * own `content` field is a JSON string, never raw bytes).
 *
 * HARD GUARDRAILS:
 *   - `buildFedosPrivateTransportUnsignedEventRequest` never inspects or
 *     transforms the ciphertext bytes themselves — base64 encode only.
 *   - `parseFedosPrivateTransportEventDescriptor` fails closed to `null`
 *     for anything malformed, any `kind` other than
 *     `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` (Alpha 1615 — `kind: 1` is no
 *     longer ever accepted here, closing Alpha 1612's own audit finding),
 *     or missing the `"fedos-private"` marker tag — never throws, never
 *     guesses.
 *   - No plaintext, no key, no key epoch beyond what the Envelope itself
 *     already carries publicly (`keyEpoch` is not secret — see
 *     `fedos_conversation_message_envelope.ts`'s own header).
 */

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import type { FedosConversationMessageEnvelope } from "../../../conversations/envelope/fedos_conversation_message_envelope.js";
import type { FedosNostrUnsignedEventRequest } from "../protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosEventDescriptor } from "../../../desktop/fedos_event_descriptor.js";
import { toFedosConversationEnvelopeId, type FedosConversationEnvelopeId } from "../../../conversations/envelope/fedos_conversation_envelope_id.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../conversation_delivery/fedos_private_nostr_delivery_mode.js";

/** The ONLY marker tag distinguishing a private-TRANSPORT event (as opposed to a `privateNostrDelivery()`-originated one, or a public Board post) at the shared `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` wire boundary (Alpha 1615). */
export const FEDOS_PRIVATE_TRANSPORT_MARKER_TAG: readonly [string, string] = ["fedos-private", "1"];

const BASE64_SHAPE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const NOSTR_ACCOUNT_INDEX_MAX = 4_294_967_295;

export interface FedosPrivateTransportUnsignedEventRequestInput {
  readonly envelope: FedosConversationMessageEnvelope;
  readonly ciphertext: Uint8Array;
  readonly counterpartyPublicKeyHex: string;
  readonly localAccountIndex: number;
}

/**
 * `createdAt` reuses `envelope.createdAt` (Unix seconds, unchanged) — no
 * separate transport-layer clock is introduced, mirroring
 * `FedosDesktopHost.submitPostWithOutbox()`'s own "reuse the caller's
 * already-chosen timestamp" discipline.
 */
export function buildFedosPrivateTransportUnsignedEventRequest(
  input: FedosPrivateTransportUnsignedEventRequestInput,
): FedosNostrUnsignedEventRequest {
  return {
    accountIndex: input.localAccountIndex,
    createdAt: input.envelope.createdAt,
    kind: FEDOS_PRIVATE_NOSTR_DELIVERY_KIND,
    tags: [
      [...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG],
      ["p", input.counterpartyPublicKeyHex],
      ["e-envelope", input.envelope.id],
    ],
    content: Buffer.from(input.ciphertext).toString("base64"),
  };
}

export interface FedosPrivateTransportParsedEvent {
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly recipientPublicKeyHex: string;
  readonly ciphertext: Uint8Array;
}

function findTagValue(tags: readonly (readonly string[])[], name: string): string | null {
  const tag = tags.find((candidate) => candidate.length >= 2 && candidate[0] === name);
  return tag !== undefined ? (tag[1] as string) : null;
}

function hasMarkerTag(tags: readonly (readonly string[])[]): boolean {
  return tags.some(
    (tag) => tag.length >= 2 && tag[0] === FEDOS_PRIVATE_TRANSPORT_MARKER_TAG[0] && tag[1] === FEDOS_PRIVATE_TRANSPORT_MARKER_TAG[1],
  );
}

/**
 * Fails closed to `null` for any event that is not `kind:
 * FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` (Alpha 1615 — `kind: 1` is never
 * accepted, closing Alpha 1612's own audit finding), lacks the
 * `"fedos-private"` marker tag, lacks a well-formed `p`/`e-envelope` tag,
 * or whose `content` is not valid base64 — never throws. A caller (the
 * Inbound Subscription) is expected to call this for EVERY inbound event
 * regardless of source, and treat `null` as "not a private-transport
 * event for us" (e.g. a public Board `kind: 1` post, or a
 * `privateNostrDelivery()`-originated event at the same proprietary kind
 * but a different tag shape).
 */
export function parseFedosPrivateTransportEventDescriptor(
  descriptor: FedosEventDescriptor,
): FedosPrivateTransportParsedEvent | null {
  if (descriptor.kind !== FEDOS_PRIVATE_NOSTR_DELIVERY_KIND) return null;
  if (!hasMarkerTag(descriptor.tags)) return null;

  const rawEnvelopeId = findTagValue(descriptor.tags, "e-envelope");
  if (rawEnvelopeId === null) return null;
  const envelopeId = toFedosConversationEnvelopeId(rawEnvelopeId);
  if (envelopeId === null) return null;

  const recipientPublicKeyHex = findTagValue(descriptor.tags, "p");
  if (recipientPublicKeyHex === null) return null;

  if (descriptor.content.length > 0 && !BASE64_SHAPE.test(descriptor.content)) return null;
  const ciphertext = Uint8Array.from(Buffer.from(descriptor.content, "base64"));

  return { envelopeId, recipientPublicKeyHex, ciphertext };
}

/** Structural validation only, mirroring `isWellFormedFedosNostrSigningPublicIdentity`'s own narrow role. Exported so callers building `localAccountIndex` from an untrusted source can fail closed before ever calling `buildFedosPrivateTransportUnsignedEventRequest`. */
export function isValidFedosPrivateTransportAccountIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= NOSTR_ACCOUNT_INDEX_MAX;
}

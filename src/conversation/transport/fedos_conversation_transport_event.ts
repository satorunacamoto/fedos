/**
 * Secure Runtime Alpha 1471–1540 ("Private Transport Boundary and
 * Multi-Relay Delivery Arc").
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
 * `kind` is HARD-FIXED to `1` by `isWellFormedFedosNostrUnsignedEventRequest()`
 * (`../../nostr/sign/fedos_nostr_signing_authority.ts`, Alpha 424's own V1
 * policy) — this file does not, and cannot, invent a new Nostr kind. A
 * private transport envelope is distinguished from a public Board post
 * PURELY by tags: `["fedos-private","1"]` marks it as a private-transport
 * event at all, `["p", counterpartyPublicKeyHex]` names the intended
 * recipient (NIP-01 convention, reused as an idiom — no NIP-04/NIP-17/
 * NIP-44 semantics are implemented or assumed), and `["e-envelope",
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
 *     for anything malformed or missing the `"fedos-private"` marker tag
 *     — never throws, never guesses.
 *   - No plaintext, no key, no key epoch beyond what the Envelope itself
 *     already carries publicly (`keyEpoch` is not secret — see
 *     `fedos_conversation_message_envelope.ts`'s own header).
 */

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import type { FedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosNostrUnsignedEventRequest } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import { toFedosConversationEnvelopeId, type FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";

/** The ONLY marker tag distinguishing a private-transport event from a public Board post at this `kind: 1` wire boundary. */
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
    kind: 1,
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
 * Fails closed to `null` for any event that is not `kind: 1`, lacks the
 * `"fedos-private"` marker tag, lacks a well-formed `p`/`e-envelope` tag,
 * or whose `content` is not valid base64 — never throws. A caller (the
 * Inbound Subscription) is expected to call this for EVERY inbound event
 * regardless of source, and treat `null` as "not a private-transport
 * event for us" (e.g. a public Board post sharing the same `kind: 1`).
 */
export function parseFedosPrivateTransportEventDescriptor(
  descriptor: FedosEventDescriptor,
): FedosPrivateTransportParsedEvent | null {
  if (descriptor.kind !== 1) return null;
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

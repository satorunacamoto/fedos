/**
 * Secure Runtime Alpha 801 ("Private Payload Model Decision") / Alpha
 * 803 ("Payload Descriptor") — Stages 11/13 of the Alpha 791–820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 *
 * This Arc does NOT define a Private Message. `FedosConversationPayloadDescriptor`
 * is the minimum, non-secret METADATA describing an opaque stored
 * payload — never the bytes themselves (those travel separately, see
 * `./fedos_conversation_payload_storage.ts`'s own `putPayload`/
 * `getPayload` split).
 *
 * `mediaType` is a closed vocabulary of exactly one value,
 * `"application/octet-stream"` — this boundary makes NO claim about
 * what the bytes mean; interpreting them (plaintext, ciphertext, or
 * anything else) is explicitly a future Envelope layer's job, never
 * this one's (Alpha 814). Bytes are never labeled "ciphertext" here —
 * this boundary uses the neutral term "opaque payload" throughout,
 * exactly per this Arc's own instruction.
 *
 * Explicitly EXCLUDED (Alpha 803's own instruction):
 *   - plaintext body — this is a byte-length/metadata record, never a
 *     content record.
 *   - cryptographic algorithm / key epoch — belong to a future Envelope
 *     layer that does not exist in this Arc.
 *   - author / membership / invitation — no identity/membership/
 *     capability concept exists in this Arc's own scope.
 *   - arbitrary metadata bag — matches `FedosConversationRecord`'s own
 *     "no speculative fields" discipline (Alpha 745).
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationPayloadId } from "./fedos_conversation_payload_id.js";

/** Closed vocabulary of exactly one value — see this file's own header for why. */
export type FedosConversationPayloadMediaType = "application/octet-stream";

export interface FedosConversationPayloadDescriptor {
  readonly id: FedosConversationPayloadId;
  readonly conversationId: FedosConversationId;
  readonly mediaType: FedosConversationPayloadMediaType;
  readonly byteLength: number;
  /** Unix seconds, matching `FedosConversationRecord.createdAt`'s own convention. */
  readonly createdAt: number;
}

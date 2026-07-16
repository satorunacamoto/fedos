/**
 * Secure Runtime Alpha 806 ("Payload Codec V1") — Stage 16 of the Alpha
 * 791–820 Conversation Retention & Private Payload Storage Boundary
 * Foundation Arc.
 *
 * The STABLE WIRE SHAPE the append-only backend writes — mirrors
 * `FedosPersistedConversationRecordV1`'s own discipline (Alpha 750).
 * `bytesBase64` is base64 encoding used ONLY at this persistence
 * boundary (Alpha 806's own instruction: "Do not expose base64 as the
 * Application API") — every Application-facing type
 * (`FedosConversationPayload`, `FedosConversationPayloadDescriptor`)
 * carries a real `Uint8Array`/plain fields, never a base64 string.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedConversationPayloadV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - Plain serializable data only.
 *   - This file defines a TYPE ONLY — no function, no class (the codec
 *     itself is `./fedos_conversation_payload_codec.ts`).
 */

export interface FedosPersistedConversationPayloadV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly conversationId: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly createdAt: number;
  /** Base64-encoded bytes — see this file's own header for why this stays confined to the persistence boundary. */
  readonly bytesBase64: string;
}

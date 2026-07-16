/**
 * Secure Runtime Alpha 802 ("Payload Identifier") — Stage 12 of the
 * Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * `FedosConversationPayloadId` is a protocol-neutral, opaque application
 * id — mirrors `FedosBoardPostId`'s own existing discipline
 * (`../fedos_board_identifiers.ts`, Alpha 252): branded, no protocol
 * meaning, no path characters accepted, no secret-bearing value.
 *
 * DECISION: unlike `FedosConversationId` (deterministic from an
 * already-existing `(boardId, threadId)` pair, Alpha 743), a payload has
 * no natural deterministic key — many payloads may legitimately belong
 * to the same Conversation. Generation is therefore an INJECTED
 * interface (`FedosConversationPayloadIdGenerator`), mirroring
 * `FedosBoardRuntimeIdGenerator`'s own established pattern
 * (`../../board/runtime/fedos_board_runtime_id_generator.ts`, Alpha
 * 626) exactly — default implementation is cryptographic random, never
 * a content hash (no "same content, same id" collision property is
 * wanted here, matching Alpha 626's own Option C rejection reasoning).
 *
 * No content-hash claim is made anywhere in this file — `toFedosConversationPayloadId`
 * only BRANDS an already-chosen string; it does not derive one.
 *
 * Collision behavior: explicit — a colliding id is a genuine
 * `FedosConversationPayloadStorage`-level `"conflict"` (if the existing
 * record differs) or `"already-present"` (if structurally identical),
 * never silently overwritten. This file itself performs no collision
 * detection (that is the storage port's own job, mirroring Alpha 626's
 * identical division of responsibility).
 *
 * HARD GUARDRAILS:
 *   - No path character (`/`, `\`, `..`) is ever accepted by
 *     `toFedosConversationPayloadId` — defends the future append-only
 *     backend (Alpha 809) against a path-derived id being used to
 *     construct a filesystem path.
 *   - No secret-bearing value — an id here is, like every other
 *     Canonical Board/Conversation id, an already-public application
 *     identifier.
 *   - No new production dependency — reuses `@noble/hashes/utils.js`,
 *     already a dependency (Alpha 626).
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

export type FedosConversationPayloadId = string & { readonly __brand: "FedosConversationPayloadId" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function containsPathCharacters(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.includes("..");
}

/** Brands an already-chosen, non-empty, path-character-free string. Returns `null` for anything else. */
export function toFedosConversationPayloadId(value: string): FedosConversationPayloadId | null {
  if (!isNonEmptyString(value)) return null;
  if (containsPathCharacters(value)) return null;
  return value as FedosConversationPayloadId;
}

/** Mints a fresh, opaque raw string suitable for `toFedosConversationPayloadId()` to brand. Mirrors `FedosBoardRuntimeIdGenerator`'s own pure-interface shape. */
export interface FedosConversationPayloadIdGenerator {
  generatePayloadId(): string;
}

/** The default generator: 16 bytes (128 bits) of `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded — identical margin to `FedosSecureRandomBoardRuntimeIdGenerator` (Alpha 626). */
export class FedosSecureRandomConversationPayloadIdGenerator implements FedosConversationPayloadIdGenerator {
  generatePayloadId(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}

/**
 * FedOS Identity Transition Foundation Arc — Phase E: transition
 * identity.
 *
 * Mirrors `../envelope/fedos_conversation_envelope_id.ts`'s own
 * "16 bytes of `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded"
 * generation discipline exactly. Deliberately NOT derived from the reason
 * string or any other transition field (Absolute Prohibitions: "do not
 * derive the ID from a free-form reason string") — a fresh CSPRNG value
 * every call, so retry/import idempotency (Phase P) is decided by
 * `putTransitionFact()`'s own key-equality check, never by re-deriving
 * the same id from the same inputs.
 */
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../../../../conversation/identity_transition/fedos_identity_transition_id_limits.js";

const ID_PREFIX = "fedos-identity-transition-";
const ID_PATTERN = /^fedos-identity-transition-[0-9a-f]{32}$/;

/** Mints a fresh, opaque transition id. Never derived from any caller-supplied content. */
export function generateFedosIdentityTransitionId(): string {
  return `${ID_PREFIX}${bytesToHex(randomBytes(16))}`;
}

/** Structural shape check only — fixed prefix + 32 lowercase hex chars, bounded length. Fails closed; never throws. */
export function isWellFormedFedosIdentityTransitionId(value: unknown): value is string {
  return typeof value === "string" && value.length <= FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH && ID_PATTERN.test(value);
}

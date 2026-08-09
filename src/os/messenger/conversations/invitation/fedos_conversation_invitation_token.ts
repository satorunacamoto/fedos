/**
 * Secure Runtime Alpha 992 ("Invitation Token") — Phase A of the Alpha
 * 991–1050 Conversation Invitation Transport & Draft Management Arc.
 *
 * Per this Arc's own reconciliation
 * (`docs/secure_runtime_alpha_991_1050_reconciliation_report.md`, Finding 1),
 * an "invitation token" is NOT a new secret and NOT a new generator. It is a
 * transport-shaped PAIRING of two values that already exist and are already
 * minted by the frozen Capability boundary:
 *   - the PUBLIC `FedosConversationCapabilityId`
 *     (`../capability/fedos_conversation_capability_id.ts`, Alpha 777), and
 *   - the one-time `FedosConversationCapabilityBearerSecret`
 *     (`../capability/fedos_conversation_capability_bearer_secret.ts`, Alpha
 *     778).
 *
 * Both are required to redeem an invitation (`redeem()` takes both), so a
 * recipient-facing "token" is exactly this pair — the value a real transport
 * (an invite URL, a QR code) would encode. This file introduces NO new
 * cryptography, NO new randomness, and NO new opaque type: it only groups two
 * already-branded values so the transport can hand them across as one unit.
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`.
 *   - This file NEVER generates a bearer secret — it only carries one an
 *     issuance already produced (Alpha 907's "returned exactly once" channel).
 *   - No `console.log`/`JSON.stringify` of a token anywhere in this Arc — the
 *     `bearerSecret` field is subject to the same no-logging discipline as the
 *     bearer secret it holds.
 */

import type { FedosConversationCapabilityId } from "../capability/fedos_conversation_capability_id.js";
import type { FedosConversationCapabilityBearerSecret } from "../capability/fedos_conversation_capability_bearer_secret.js";

/** The recipient-facing redeemable pair — a public id plus the one-time bearer secret. Never a new secret; see this file's own header. */
export interface FedosConversationInvitationToken {
  readonly capabilityId: FedosConversationCapabilityId;
  readonly bearerSecret: FedosConversationCapabilityBearerSecret;
}

/** Groups an already-minted public capability id and its already-minted one-time bearer secret into one transport token. Mints nothing. */
export function toFedosConversationInvitationToken(
  capabilityId: FedosConversationCapabilityId,
  bearerSecret: FedosConversationCapabilityBearerSecret,
): FedosConversationInvitationToken {
  return Object.freeze({ capabilityId, bearerSecret });
}

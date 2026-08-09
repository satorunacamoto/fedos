/**
 * Secure Runtime Alpha 834 ("Bearer Verification Persistence Decision")
 * / Alpha 835 ("Capability Secret Verifier Boundary") — Stages 2-3 of
 * Phase C of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * Alpha 834 — compared:
 *   A. plaintext secret persistence — REJECTED: the (frozen, unchanged)
 *      Alpha 778 bearer-secret boundary exists specifically so a bearer
 *      secret is never written to a durable, on-disk log; persisting it
 *      in plaintext would defeat that boundary's own purpose the moment
 *      any durability is added.
 *   B. one-way verifier/hash persistence — ADOPTED, see below.
 *   C. opaque OS secret-store handle — REJECTED: no OS secret-store
 *      integration exists anywhere in this codebase; introducing one
 *      would be new platform-integration scope this Arc does not need.
 *   D. deterministic secret regeneration — REJECTED: nothing here
 *      derives a bearer secret from other state; the (frozen)
 *      `FedosConversationCapabilitySecretGenerator` is explicitly
 *      injected/random-shaped, not deterministic.
 *   E. capability becomes invalid after restart — REJECTED: defeats
 *      this Arc's own objective (restart-stable capabilities).
 *
 * SHA-256 (`@noble/hashes/sha2.js`) is used — an EXISTING dependency
 * (`@noble/hashes` is already in `package.json`, already imported
 * elsewhere in this codebase for `randomBytes`/`bytesToHex`,
 * `../../../board/runtime/fedos_board_runtime_id_generator.ts`), a
 * well-established, un-modified primitive — no cryptography is invented
 * here, and no new npm dependency is introduced.
 *
 * Alpha 835 — the smallest boundary: `createFedosConversationCapabilityBearerVerifier()`
 * / `fedosConversationCapabilityBearerVerifierMatches()`. A verifier
 * ALONE is not sufficient to redeem — it can confirm a PRESENTED secret
 * hashes to the same value, but cannot itself be presented as a bearer
 * secret (the redemption request type,
 * `FedosConversationCapabilityRedemptionRequest`, Alpha 781, frozen,
 * still requires a `FedosConversationCapabilityBearerSecret`, a
 * structurally distinct branded type this file never produces).
 *
 * Comparison is constant-time-SHAPED (`fedosConversationCapabilityBearerSecretsMatch`,
 * Alpha 778, reused verbatim after both sides are reduced to the SAME
 * hex-digest shape) — no early-exit on the first mismatched hash
 * character.
 *
 * HARD GUARDRAILS:
 *   - No raw bearer secret is ever logged — this file's own functions
 *     take a secret as input and never write it anywhere themselves.
 *   - No `Debug`/`JSON` serialization helper for a raw bearer secret
 *     exists anywhere in this file.
 *   - No generic password/credential framework — two functions only.
 *   - No new npm dependency.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  fedosConversationCapabilityBearerSecretsMatch,
  toFedosConversationCapabilityBearerSecret,
  type FedosConversationCapabilityBearerSecret,
} from "../../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";

export type FedosConversationCapabilityBearerVerifier = string & { readonly __brand: "FedosConversationCapabilityBearerVerifier" };

/** One-way — the raw `bearerSecret` cannot be recovered from the returned verifier. */
export function createFedosConversationCapabilityBearerVerifier(
  bearerSecret: FedosConversationCapabilityBearerSecret,
): FedosConversationCapabilityBearerVerifier {
  return bytesToHex(sha256(utf8ToBytes(bearerSecret))) as FedosConversationCapabilityBearerVerifier;
}

/** Recomputes the hash of `presented` and compares it against the stored `verifier` — never recovers or exposes the original secret. */
export function fedosConversationCapabilityBearerVerifierMatches(
  verifier: FedosConversationCapabilityBearerVerifier,
  presented: FedosConversationCapabilityBearerSecret,
): boolean {
  const presentedHash = createFedosConversationCapabilityBearerVerifier(presented);
  // Reuses the existing constant-time-shaped comparator (Alpha 778) by
  // routing both hex digests through the SAME branded-string boundary —
  // both operands are hash strings here, never the raw secret itself.
  return fedosConversationCapabilityBearerSecretsMatch(
    toFedosConversationCapabilityBearerSecret(verifier)!,
    toFedosConversationCapabilityBearerSecret(presentedHash)!,
  );
}

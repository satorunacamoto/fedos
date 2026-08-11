/**
 * Secure Runtime Alpha 778 ("Bearer Secret Boundary") — Stage 4 of
 * Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc.
 *
 * A SEPARATE opaque bearer value — never stored on
 * `FedosConversationCapabilityDescriptor` (`./fedos_conversation_capability_descriptor.ts`,
 * Alpha 777), never on `FedosConversationRecord`, never on any
 * `FedosBoardPost`. Per this Arc's own Absolute Prohibitions (no
 * cryptography invented, no Rust/Cargo change), this Arc does NOT
 * generate real cryptographically-random secret material itself — an
 * injected `FedosConversationCapabilitySecretGenerator` supplies the
 * value (mirrors `FedosBoardRuntimeIdGenerator`'s own injected-generator
 * convention, `../../board/runtime/fedos_board_runtime_id_generator.ts`),
 * exactly like this Arc's own instruction allows: "use an injected
 * verifier boundary and keep real generation out of scope."
 *
 * `fedosConversationCapabilityBearerSecretsMatch()` is a constant-time
 * string comparison — NOT a cryptographic primitive, just length-
 * independent-of-early-exit equality, matching this Arc's own "equality
 * only through safe verifier where possible" requirement without
 * inventing or importing any cryptography.
 *
 * HARD GUARDRAILS:
 *   - This type is never returned by `inspectDescriptor()` (Alpha 780)
 *     or embedded in `FedosConversationCapabilityDescriptor` (Alpha
 *     777) — grep-verified by
 *     `test/secure_runtime_alpha_788_security_structural_guards.test.ts`.
 *   - No `console.log`/`JSON.stringify` of a bearer secret anywhere in
 *     this Arc's own source or tests.
 */

export type FedosConversationCapabilityBearerSecret = string & { readonly __brand: "FedosConversationCapabilityBearerSecret" };

/** Injected — this Arc mints no real random secret material itself. See this file's own header. */
export interface FedosConversationCapabilitySecretGenerator {
  generateBearerSecret(): FedosConversationCapabilityBearerSecret;
}

function isNonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Brands an already-chosen, non-empty string as a `FedosConversationCapabilityBearerSecret`. Returns `null` for anything else. */
export function toFedosConversationCapabilityBearerSecret(value: string): FedosConversationCapabilityBearerSecret | null {
  return isNonEmpty(value) ? (value as FedosConversationCapabilityBearerSecret) : null;
}

/**
 * Constant-time-shaped equality: always scans the full length of the
 * LONGER operand, never returns early on the first mismatched
 * character. Not a cryptographic guarantee — merely avoids the most
 * naive `===`-driven early-exit timing signal without importing any
 * cryptography.
 */
export function fedosConversationCapabilityBearerSecretsMatch(
  a: FedosConversationCapabilityBearerSecret,
  b: FedosConversationCapabilityBearerSecret,
): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }
  return diff === 0;
}

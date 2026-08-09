/**
 * Secure Runtime Alpha 923 ("Running Runtime Integration") — Phase D of
 * the Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * Default, secure-random implementations of the two injected generators
 * the (frozen, unmodified) Capability authorities require — a
 * `FedosConversationCapabilityIdGenerator` (Alpha 786) and a
 * `FedosConversationCapabilitySecretGenerator` (Alpha 778). Both use 16/32
 * bytes of `@noble/hashes` randomness, hex-encoded, EXACTLY like
 * `FedosSecureRandomBoardRuntimeIdGenerator` (Alpha 626) — ZERO new
 * dependency, and no cryptography invented (a bearer secret is opaque
 * random material, not a key, per the Alpha 778 boundary this Arc must
 * not cross).
 *
 * These live in the runtime module (not the frozen `capability/`
 * directory) because they are wiring defaults the Local Runtime supplies,
 * never part of the Capability domain's own accepted surface.
 *
 * HARD GUARDRAILS:
 *   - No bearer secret is ever logged or `JSON.stringify`d here — these
 *     functions only MINT opaque material and return it to their
 *     immediate caller (the Capability authority), which owns the Alpha
 *     834/835 verifier boundary.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";
import {
  toFedosConversationCapabilityBearerSecret,
  type FedosConversationCapabilityBearerSecret,
  type FedosConversationCapabilitySecretGenerator,
} from "../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationCapabilityIdGenerator } from "../../../../conversation/capability/in_memory_fedos_conversation_capability_authority.js";

export class FedosSecureRandomCapabilityIdGenerator implements FedosConversationCapabilityIdGenerator {
  generateCapabilityId(): string {
    return `cap-${bytesToHex(nobleRandomBytes(16))}`;
  }
}

export class FedosSecureRandomCapabilitySecretGenerator implements FedosConversationCapabilitySecretGenerator {
  generateBearerSecret(): FedosConversationCapabilityBearerSecret {
    // 32 bytes (256 bits) of opaque randomness — branded through the Alpha
    // 778 boundary. `!` is safe: a 64-char hex string is always non-empty.
    return toFedosConversationCapabilityBearerSecret(bytesToHex(nobleRandomBytes(32)))!;
  }
}

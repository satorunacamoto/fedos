/**
 * Secure Runtime Alpha 942 ("Default Encryption Authority") — Phase B of
 * the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * Mirrors `UnavailableFedosConversationEncryptionReadinessAuthority`'s
 * own already-adopted default shape EXACTLY
 * (`../readiness/fedos_conversation_encryption_readiness_authority.ts`,
 * Alpha 924: "the default, and the ONLY production implementation this
 * Arc ships... no `process.env` read, no constructor parameter, and no
 * override path"). The README's own "Runtime Crypto Activation Boundary"
 * section confirms the SAME fail-closed state this default encodes:
 * `evaluateRuntimeCryptoActivation`/`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
 * never return/report `"Allowed"`/`true` anywhere in this checked-out
 * tree — so a caller of `FedosConversationRuntime` that does not
 * EXPLICITLY inject the real `FedosWasmConversationEncryptionAuthority`
 * (`./fedos_wasm_conversation_encryption_authority.ts`, Alpha 870, over
 * a real, seeded `FedosMasterSeedAuthority`) gets an Authority that
 * NEVER reports success — never a silent fallback to unauthenticated or
 * unencrypted delivery.
 *
 * Lives in its OWN new file rather than added to
 * `fedos_conversation_encryption_authority.ts` (Alpha 861, frozen by the
 * sibling Arc that shipped it) — this Arc's own "extend additively,
 * never edit a frozen file without a reviewed defect" discipline.
 */

import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../../../../conversation/encryption/fedos_conversation_encryption_authority.js";

export class UnavailableFedosConversationEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(_request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    return { outcome: "unavailable" };
  }
}

/**
 * Secure Runtime Alpha 923 ("Running Runtime Integration") / Alpha 924
 * ("Default Encryption Readiness") — Phase D of the Alpha 891–930 Private
 * Conversation Draft Construction and Readiness Runtime Arc.
 *
 * The NARROW readiness-authority interface a future encryption Arc will
 * implement — this Arc depends on nothing from an Alpha 851–890 (or any
 * encryption-activation) worktree, exactly as this Arc's own
 * Preconditions require. It defines only the smallest question
 * construction must ask: "for this conversation's mode, is message
 * encryption ready RIGHT NOW?" — and answers it, by default,
 * `"unavailable"`.
 *
 * `docs/reviews/private_conversation_construction_v1/08_encryption_gate.md`
 * confirmed, against real source, that every encryption-readiness
 * sub-check resolves `"unavailable"` in this checked-out tree
 * (`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false`, no WASM artifact). This
 * interface deliberately does NOT import `src/crypto`/`src/runtime` — it
 * is a pure injection seam, so this Arc never depends on the crypto
 * runtime's own shape at all. A future Arc supplies a real implementation
 * that consults those modules; until then, the default below is the ONLY
 * production implementation, and it never claims readiness it cannot
 * back.
 *
 * The coarse state is a subset of `FedosConversationReadinessAxisState`
 * (`./fedos_conversation_readiness_axis.ts`) — `"ready"` unlocks the
 * `activation-ready` overall outcome (Alpha 899); anything else keeps
 * every constructed Conversation `draft`-only. `"not-required"` is
 * intentionally NOT offered here: a private Conversation always requires
 * real encryption before it may ever be presented as active, so "no
 * encryption needed" is never an honest answer for `private-group`/
 * `direct` mode.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";

export type FedosConversationEncryptionReadinessState = "ready" | "unavailable" | "unsupported" | "failed";

export interface FedosConversationEncryptionReadiness {
  readonly state: FedosConversationEncryptionReadinessState;
}

export interface FedosConversationEncryptionReadinessAuthority {
  /** Total, never throws — mirrors every other Authority read in this codebase. */
  evaluateEncryptionReadiness(conversationId: FedosConversationId): FedosConversationEncryptionReadiness;
}

/**
 * Alpha 924 — the default, and the ONLY production implementation this
 * Arc ships. Always `"unavailable"`, for every conversation, with no
 * `process.env` read, no constructor parameter, and no override path —
 * exactly the fail-closed shape `FedosRuntimeCryptoProvider` itself
 * already has (`08_encryption_gate.md`). No fallback crypto of any kind.
 */
export class UnavailableFedosConversationEncryptionReadinessAuthority
  implements FedosConversationEncryptionReadinessAuthority
{
  evaluateEncryptionReadiness(_conversationId: FedosConversationId): FedosConversationEncryptionReadiness {
    return { state: "unavailable" };
  }
}

/**
 * Secure Runtime Alpha 1118 ("Activation Result Vocabulary") — Phase B of
 * the Alpha 1111–1180 Private Conversation Activation and Direct Messaging
 * Runtime Arc.
 *
 * Coarse, closed, stable outcomes only — no raw `Error`, no provider
 * message, matching every other coordinator result type in this codebase
 * (`FedosConversationEncryptionCoordinatorResult`,
 * `FedosPrivateConversationConstructionResult`, etc.). Selected from Alpha
 * 1118's own candidate list — every outcome below is genuinely reachable
 * by `FedosConversationDirectActivationCoordinator` (Alpha 1122);
 * `"partial-activation"` is deliberately OMITTED: this Arc's own
 * append-only, forward-only coordination log (Alpha 1121) converges a
 * partial attempt automatically on the next call rather than ever
 * surfacing an intermediate state to a caller — the same reasoning
 * `FedosPrivateConversationConstructionCoordinator`'s own result
 * vocabulary already applies (it names `"partial-construction"` only
 * where a genuinely observable partial durable state exists; this
 * coordinator has no analogous observable-but-incomplete case a caller
 * could act on, since every readiness check happens BEFORE any durable
 * write). `"conversation-not-found"` is added beyond the candidate list —
 * every other coordinator in this codebase (`FedosConversationEncryptionCoordinatorResult`,
 * `FedosConversationDecryptionCoordinatorResult`) already carries this
 * exact outcome for an unknown id, and Alpha 1118 asks for "coarse stable
 * outcomes", not an exhaustive fixed set.
 */

export type FedosConversationDirectActivationResult =
  | { readonly outcome: "activated" }
  | { readonly outcome: "already-active" }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "unsupported-mode" }
  | { readonly outcome: "not-ready" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "participant-unavailable" }
  | { readonly outcome: "membership-invalid" }
  | { readonly outcome: "policy-invalid" }
  | { readonly outcome: "encryption-unavailable" }
  | { readonly outcome: "storage-unavailable" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "unavailable" };

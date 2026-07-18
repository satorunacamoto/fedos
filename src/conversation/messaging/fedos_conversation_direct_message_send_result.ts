/**
 * Secure Runtime Alpha 1129 ("Send Result Vocabulary") — Phase C of the
 * Alpha 1111–1180 Private Conversation Activation and Direct Messaging
 * Runtime Arc.
 *
 * Coarse, closed, stable outcomes only. `"sent-locally"` is the ONLY
 * success token, deliberately worded — per Alpha 1129's own instruction —
 * to never imply network/protocol delivery; this Arc ships no delivery of
 * any kind. `"partial-write"` is deliberately OMITTED: the underlying
 * `FedosConversationEncryptionCoordinator.encrypt()` (Alpha 943, reused
 * unmodified) already has a full crash-recoverable coordination log that
 * converges any partial durable state on the very next call rather than
 * ever surfacing an intermediate write to a caller — the identical
 * reasoning `FedosConversationDirectActivationResult` already applies to
 * `"partial-activation"`.
 */

export type FedosConversationDirectMessageSendResult =
  | { readonly outcome: "sent-locally"; readonly envelopeId: string }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "conversation-not-active" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "encryption-unavailable" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "failed" };

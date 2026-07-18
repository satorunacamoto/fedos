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
 *
 * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") Phase C (Alpha 1851) — ADDITIVE,
 * OPTIONAL `delivery` field on `"sent-locally"` ONLY. Alpha 1851's own
 * "never label Relay ACK as recipient delivery, return SEPARATE facts"
 * instruction: `delivery` is a SEPARATE fact from local storage, present
 * ONLY when a caller configured standard delivery (`deps.delivery` on
 * `FedosConversationDirectMessagingCoordinatorDependencies`) — omitted
 * entirely for every caller that did not, so this remains 100%
 * source-compatible with every existing caller/test.
 */
import type { FedosPrivateWireDeliveryQueueOutcome } from "../transport/fedos_private_wire_prepared_delivery.js";

export type FedosConversationDirectMessageSendResult =
  | { readonly outcome: "sent-locally"; readonly envelopeId: string; readonly delivery?: FedosPrivateWireDeliveryQueueOutcome }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "conversation-not-active" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "encryption-unavailable" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "failed" };

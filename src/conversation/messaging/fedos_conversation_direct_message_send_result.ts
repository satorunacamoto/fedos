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
 *
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — `delivery` ADDITIVELY widened to
 * also accept `FedosDirectRatchetSendOutcome`
 * (`../ratchet/fedos_direct_ratchet_outbound_integration.js`), the
 * ratchet route's own closed outcome vocabulary — still a SEPARATE fact
 * from local storage, present only when `ratchetDelivery` was
 * configured. Every existing caller that never configures either
 * `delivery`/`ratchetDelivery` still sees `delivery` entirely absent.
 */
import type { FedosPrivateWireDeliveryQueueOutcome } from "../transport/fedos_private_wire_prepared_delivery.js";
import type { FedosDirectRatchetSendOutcome } from "../ratchet/fedos_direct_ratchet_outbound_integration.js";
import type { FedosForwardSecrecyUnavailableReason } from "../ratchet/fedos_direct_conversation_forward_secrecy_route.js";

export type FedosConversationDirectMessageSendResult =
  | {
      readonly outcome: "sent-locally";
      readonly envelopeId: string;
      readonly delivery?: FedosPrivateWireDeliveryQueueOutcome | FedosDirectRatchetSendOutcome;
      /**
       * FedOS Conversation Forward Secrecy (Phase 1) — ADDITIVE, OPTIONAL,
       * present only when a caller supplied `forwardSecrecySelector`.
       *
       * A SEPARATE fact from both local storage and `delivery`, in exactly
       * the same spirit Alpha 1851 established for `delivery` itself: it
       * says whether THIS message got forward secrecy, and when it did not,
       * names the specific reason from a closed vocabulary. `forwardSecrecy:
       * false` is the honest answer for an ordinary packaged launch; before
       * this field existed, that fact had no representation anywhere in the
       * result and a non-forward-secret send was indistinguishable from a
       * forward-secret one.
       *
       * Carries no key material, no Device id, and no account id.
       */
      readonly forwardSecrecy?: {
        readonly forwardSecrecy: boolean;
        readonly reason: FedosForwardSecrecyUnavailableReason | null;
      };
    }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "conversation-not-active" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "encryption-unavailable" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "failed" };

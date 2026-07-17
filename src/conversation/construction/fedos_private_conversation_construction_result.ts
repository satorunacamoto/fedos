/**
 * Secure Runtime Alpha 903 ("Command Result Vocabulary") — Phase B of the
 * Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * A CLOSED outcome vocabulary — no `Error` object, no raw backend text,
 * no stack trace, mirroring every other Authority result type in this
 * codebase. A success (or idempotent replay) exposes the draft view, its
 * live readiness reading, the creator's owner Membership, and — only at
 * issuance time, only through the one-time grant boundary — an initial
 * Capability. A failure exposes ONLY its closed outcome token (plus, for
 * a partial construction, whatever durable facts already exist, so a
 * caller/restart reader can see exactly what was persisted).
 *
 * Outcomes (Alpha 903's own list):
 *   - `"draft-created"`        — draft + creator owner Membership durable;
 *                               for `direct`, additionally the
 *                               recipient-bound Capability. NEVER active,
 *                               NEVER encrypted (Alpha 893/924).
 *   - `"already-present"`      — an identical draft already exists (an
 *                               idempotent retry, Alpha 909); the same
 *                               durable facts are re-read and returned.
 *   - `"partial-construction"` — the draft is durable but a
 *                               required-for-completion fact is still
 *                               pending (creator Membership, or a
 *                               `direct` recipient Capability); recovery
 *                               can complete it (Alpha 916/917).
 *   - `"conflict"`             — a DIFFERENT record already occupies this
 *                               id (Alpha 908/909).
 *   - `"invalid-command"`      — the command itself is malformed.
 *   - `"identity-unavailable"` — the creator identity axis failed closed.
 *   - `"policy-failed"`        — no valid policy for the requested mode.
 *   - `"membership-failed"`    — creator Membership admission genuinely
 *                               conflicts (not a transient retry).
 *   - `"capability-failed"`    — a required Capability issuance genuinely
 *                               failed in a non-recoverable way.
 *   - `"persistence-failed"`   — the draft record write itself failed;
 *                               nothing durable resulted.
 *   - `"unavailable"`          — a dependency (an authority/port) was not
 *                               available at all.
 */

import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";
import type { FedosConversationReadiness } from "../readiness/fedos_conversation_readiness.js";
import type {
  FedosConversationDraftView,
  FedosPrivateConversationInitialCapabilityGrant,
} from "./fedos_conversation_draft_view.js";

/** The pending fact a `"partial-construction"` is missing — a closed, coarse token, never raw detail. */
export type FedosPrivateConversationPartialConstructionDetail = "creator-membership-pending" | "recipient-capability-pending";

export type FedosPrivateConversationConstructionResult =
  | {
      readonly outcome: "draft-created";
      readonly draft: FedosConversationDraftView;
      readonly readiness: FedosConversationReadiness;
      readonly ownerMembership: FedosConversationMembership;
      readonly capability?: FedosPrivateConversationInitialCapabilityGrant;
    }
  | {
      readonly outcome: "already-present";
      readonly draft: FedosConversationDraftView;
      readonly readiness: FedosConversationReadiness;
      readonly ownerMembership: FedosConversationMembership;
      readonly capability?: FedosPrivateConversationInitialCapabilityGrant;
    }
  | {
      readonly outcome: "partial-construction";
      readonly draft: FedosConversationDraftView;
      readonly readiness: FedosConversationReadiness;
      readonly ownerMembership: FedosConversationMembership | null;
      readonly detail: FedosPrivateConversationPartialConstructionDetail;
    }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "invalid-command" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "policy-failed" }
  | { readonly outcome: "membership-failed"; readonly draft: FedosConversationDraftView }
  | { readonly outcome: "capability-failed"; readonly draft: FedosConversationDraftView; readonly ownerMembership: FedosConversationMembership }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "unavailable" };

/**
 * Secure Runtime Alpha 925 ("Read Facade") — Phase D of the Alpha 891–930
 * Private Conversation Draft Construction and Readiness Runtime Arc.
 *
 * The immutable, application-safe read shapes the Conversation Runtime
 * (`../runtime/fedos_conversation_runtime.ts`, Alpha 922) exposes. Every
 * shape here is metadata only — draft mode/lifecycle, resolved policy,
 * participant Membership summaries, Capability PUBLIC descriptors,
 * construction status. NONE carries a bearer secret, key handle, or any
 * value from `src/crypto`/`src/vault`/`src/runtime` (Alpha 925/928).
 *
 * The bearer secret of an initial Capability travels through EXACTLY ONE
 * channel — the one-time `FedosPrivateConversationInitialCapabilityGrant`
 * on the construction RESULT (Alpha 907), never through any read facade,
 * never re-derivable afterward (`inspectDescriptor()` returns only the
 * non-secret descriptor).
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationPolicy } from "../../../../board/runtime/policy/fedos_conversation_policy.js";
import type { FedosConversationCapabilityDescriptor } from "../../../../conversation/capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationCapabilityBearerSecret } from "../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosPrivateConversationMode } from "../../../../conversation/construction/fedos_private_conversation_id.js";
import type { FedosConversationLifecycleState } from "../../../../conversation/construction/fedos_conversation_lifecycle_state.js";
import type { FedosPrivateConversationPolicyReference } from "../../../../conversation/construction/fedos_conversation_draft_record.js";

/** An immutable read view of a private draft — the resolved policy is included so a caller never needs the policy authority itself. */
export interface FedosConversationDraftView {
  readonly id: FedosConversationId;
  readonly mode: FedosPrivateConversationMode;
  readonly lifecycleState: FedosConversationLifecycleState;
  readonly policyReference: FedosPrivateConversationPolicyReference;
  readonly policy: FedosConversationPolicy;
  readonly creator: FedosConversationParticipantReference;
  readonly createdAt: number;
}

/**
 * The ONE-TIME initial-Capability grant (Alpha 907) — the ONLY place a
 * bearer secret is ever returned. Present on a construction result at
 * issuance time only; never stored on any record, never returned by any
 * read facade.
 */
export interface FedosPrivateConversationInitialCapabilityGrant {
  readonly descriptor: FedosConversationCapabilityDescriptor;
  readonly bearerSecret: FedosConversationCapabilityBearerSecret;
}

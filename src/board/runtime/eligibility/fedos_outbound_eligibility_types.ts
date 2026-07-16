/**
 * Secure Runtime Alpha 663 ("Outbound Eligibility Input") / Alpha 664
 * ("Eligibility Result Vocabulary") — Stages 3/4 of the Alpha 641–680
 * Public Identity, Conversation Policy & Application Runtime
 * Integration Arc.
 *
 * `FedosOutboundEligibilityInput` deliberately OMITS a `FedosBoardPost`
 * field, adjusting the Arc's own candidate shape ("Adjust to avoid
 * duplicating... if unnecessary") — continuing Alpha 633's own prior
 * discipline (`../fedos_board_runtime_outbound_eligibility.ts`'s own
 * header: "this file takes NO `FedosBoardPost` parameter at all...
 * confirming by construction that no source-provenance field is ever
 * consulted here"). Extending that same guarantee: no version of this
 * evaluator, at any Arc, has ever needed to read a post's own body,
 * timestamp, or `source` to decide eligibility — only the resolved
 * Author, the resolved Policy, and the requested Target matter. Adding
 * an unused `post` parameter here would only invite a FUTURE change to
 * start reading `post.source` for target inference, which Alpha 668
 * explicitly forbids.
 *
 * No signer object, no Relay reference, no secret, no retry data, and
 * no delivery Observation history anywhere in this file (Alpha 663's
 * own exclusion list).
 */

import type { FedosBoardOutboxTarget } from "../../outbox/fedos_board_outbox_types.js";
import type { FedosConversationPolicy } from "../policy/fedos_conversation_policy.js";
import type { FedosPublicAuthorResolution } from "../identity/fedos_public_author_authority.js";

export interface FedosOutboundEligibilityInput {
  readonly policy: FedosConversationPolicy;
  readonly target: FedosBoardOutboxTarget;
  readonly authorResolution: FedosPublicAuthorResolution;
}

/**
 * Alpha 664. Coarse, stable reasons only — never a raw `Error`, stack
 * trace, or Provider/Publisher-supplied message string.
 */
export type FedosOutboundEligibilityResult =
  | { readonly outcome: "eligible" }
  | {
      readonly outcome: "ineligible";
      readonly reason:
        | "conversation-local-only"
        | "unsupported-conversation-mode"
        | "anonymous-author"
        | "identity-not-controlled"
        | "unsupported-target"
        | "protocol-mismatch";
    };

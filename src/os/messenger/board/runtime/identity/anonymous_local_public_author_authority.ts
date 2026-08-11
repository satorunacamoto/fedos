/**
 * Secure Runtime Alpha 645 ("Anonymous Local Author Policy") / Alpha
 * 646 ("Public Author Authority Interface") — Stages 5/6 of the Alpha
 * 641–680 Public Identity, Conversation Policy & Application Runtime
 * Integration Arc.
 *
 * Alpha 645's own decision, among the four compared:
 *   A. require a resolved identity and reject otherwise
 *   B. continue explicit anonymous-local mode
 *   C. generate a new persistent local identity automatically — FORBIDDEN
 *   D. accept caller-supplied identity — FORBIDDEN
 *
 * DECISION: B remains, unchanged in substance from Alpha 627 — public
 * post creation is never blocked on identity in V1 — but now surfaced
 * through an EXPLICIT, separately constructible
 * `FedosPublicAuthorAuthority` implementation, so a caller/test can
 * select "always anonymous-local" deliberately, distinctly from
 * `FedosDesktopPublicAuthorAuthority`'s own "resolved, unless nothing is
 * configured" behavior collapsing to the same outcome today only
 * because no default identity source is wired yet (Alpha 641's own
 * finding).
 *
 * This class is never eligible for protocol publishing (Alpha 645's own
 * requirement) — enforced not here, but structurally, by
 * `evaluateFedosOutboundEligibility()`
 * (`../eligibility/fedos_outbound_eligibility_evaluator.ts`) rejecting
 * every `"anonymous-local"` resolution outright — this class carries no
 * eligibility logic of its own, matching every other Authority in this
 * Arc.
 */

import { anonymousLocalAuthorReference } from "../fedos_board_runtime_author_authority.js";
import type { FedosPublicAuthorAuthority, FedosPublicAuthorResolution } from "./fedos_public_author_authority.js";

export class AnonymousLocalPublicAuthorAuthority implements FedosPublicAuthorAuthority {
  async resolvePublicAuthor(): Promise<FedosPublicAuthorResolution> {
    return { outcome: "anonymous-local", author: anonymousLocalAuthorReference() };
  }
}

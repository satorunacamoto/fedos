/**
 * Stage 126 — Creator governance preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing sample appeal/reputation/subscription/
 * treasury records run through their real (pure) review functions —
 * `../creator/appeal.js`, `../creator/reputation.js`,
 * `../creator/subscription_policy.js`, `../community/treasury_policy.js` —
 * as a read-only preview page, gated behind an explicit
 * `?creatorGovernancePreview=1` flag in the Worker (see `../worker.js`).
 * Every label is HTML-escaped.
 *
 * There is NO DAO, NO vote, NO payment, NO treasury balance, and NO
 * settlement anywhere in this file (or in the four boundaries it calls) —
 * every review function it calls is a pure label lookup that mutates
 * nothing and contacts no provider.
 */

import { reviewCreatorAppeal, type CreatorAppealDescriptor } from "../../commerce/creator/appeal.js";
import { reviewReputationSignal, type ReputationSignalDescriptor } from "../../commerce/creator/reputation.js";
import {
  reviewSubscriptionPolicyTarget,
  type SubscriptionPolicyTargetInput,
} from "../../commerce/creator/subscription_policy.js";
import {
  reviewCommunityTreasuryDisclosure,
  type CommunityTreasuryDisclosureRequest,
} from "../community/treasury_policy.js";
import { escapeHtml } from "./html.js";

/** Static sample appeal records for the preview page. Never stored, never live. */
export const SAMPLE_CREATOR_APPEALS: readonly CreatorAppealDescriptor[] = [
  {
    idRef: "appeal-1",
    creatorRef: "creator-alice",
    targetRef: "moderation-1",
    kind: "moderation_action_placeholder",
    status: "under_review_placeholder",
  },
];

/** Static sample reputation signals for the preview page. Never aggregated, never live. */
export const SAMPLE_REPUTATION_SIGNALS: readonly ReputationSignalDescriptor[] = [
  { idRef: "signal-1", creatorRef: "creator-alice", label: "steady_placeholder" },
];

/** Static sample subscription policy targets for the preview page. Never checked against a real plan. */
export const SAMPLE_SUBSCRIPTION_TARGETS: readonly SubscriptionPolicyTargetInput[] = [
  { idRef: "sub-1", targetRef: "post-1", policyKind: "public_placeholder" },
  { idRef: "sub-2", targetRef: "post-2", policyKind: "supporter_only_placeholder" },
];

/** Static sample treasury disclosure requests for the preview page. Never a real balance. */
export const SAMPLE_TREASURY_REQUESTS: readonly CommunityTreasuryDisclosureRequest[] = [
  { idRef: "treasury-1", communityRef: "community-1", categoryKind: "operating_placeholder" },
];

function renderAppealRow(appeal: CreatorAppealDescriptor): string {
  const decision = reviewCreatorAppeal(appeal);
  return (
    `<li class="creator-governance-appeal-item">` +
    `<dl><dt>kind</dt><dd>${escapeHtml(appeal.kind)}</dd>` +
    `<dt>status</dt><dd>${escapeHtml(decision.state)}</dd></dl>` +
    `</li>`
  );
}

function renderReputationRow(signal: ReputationSignalDescriptor): string {
  const decision = reviewReputationSignal(signal);
  return (
    `<li class="creator-governance-reputation-item">` +
    `<dl><dt>label</dt><dd>${escapeHtml(signal.label)}</dd>` +
    `<dt>review</dt><dd>${escapeHtml(decision.state)}</dd></dl>` +
    `</li>`
  );
}

function renderSubscriptionRow(target: SubscriptionPolicyTargetInput): string {
  const review = reviewSubscriptionPolicyTarget(target);
  return (
    `<li class="creator-governance-subscription-item">` +
    `<dl><dt>policy</dt><dd>${escapeHtml(target.policyKind)}</dd>` +
    `<dt>visibility</dt><dd>${escapeHtml(review.decision)}</dd></dl>` +
    `</li>`
  );
}

function renderTreasuryRow(request: CommunityTreasuryDisclosureRequest): string {
  const review = reviewCommunityTreasuryDisclosure(request);
  return (
    `<li class="creator-governance-treasury-item">` +
    `<dl><dt>category</dt><dd>${escapeHtml(request.categoryKind)}</dd>` +
    `<dt>disclosure</dt><dd>${escapeHtml(review.decision)}</dd></dl>` +
    `</li>`
  );
}

/**
 * The full read-only creator governance preview page: a note explaining
 * every row is a static sample run through a pure review function (never a
 * vote, payment, or settlement), then one section per boundary. NO
 * apply/vote/pay button exists anywhere on this page.
 */
export function renderCreatorGovernancePreviewPage(
  appeals: readonly CreatorAppealDescriptor[],
  signals: readonly ReputationSignalDescriptor[],
  subscriptionTargets: readonly SubscriptionPolicyTargetInput[],
  treasuryRequests: readonly CommunityTreasuryDisclosureRequest[],
): string {
  return (
    `<section class="creator-governance-preview-page">` +
    `<h2>Creator governance preview</h2>` +
    `<p class="creator-governance-preview-note">Read-only sample preview — every row is a static ` +
    `sample run through a pure review function; nothing here is a vote, a payment, a settlement, or ` +
    `a treasury balance.</p>` +
    `<h3>Appeals</h3><ul class="creator-governance-appeal-list">${appeals.map(renderAppealRow).join("")}</ul>` +
    `<h3>Reputation signals</h3><ul class="creator-governance-reputation-list">${signals.map(renderReputationRow).join("")}</ul>` +
    `<h3>Subscription policy</h3><ul class="creator-governance-subscription-list">${subscriptionTargets.map(renderSubscriptionRow).join("")}</ul>` +
    `<h3>Community treasury policy</h3><ul class="creator-governance-treasury-list">${treasuryRequests.map(renderTreasuryRow).join("")}</ul>` +
    `</section>`
  );
}

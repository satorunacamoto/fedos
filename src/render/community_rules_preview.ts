/**
 * Stage 116 — Community ruleset preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a fixed set of sample community moderation
 * rules — built from `CommunityModerationPolicyKind`/
 * `CommunityModerationRequestedAction` (Stage 115, `src/community/moderation.ts`)
 * — as a read-only preview page, gated behind an explicit
 * `?communityRulesPreview=1` flag in the Worker (see `src/worker.ts`).
 * Every rule-derived string is HTML-escaped.
 *
 * Each sample rule is run through the PURE `reviewCommunityModerationTarget`
 * function to show what visibility label (`hidden_placeholder`/
 * `muted_placeholder`/`filtered_placeholder`) it would map to — this is a
 * DISPLAY of the hide/mute/filter model, never a real moderation action:
 * nothing is hidden, muted, or filtered in any live view by this file, and
 * NOTHING here deletes/removes/purges anything (those actions do not exist
 * on the underlying type — see `../community/moderation.js`'s hard
 * guardrails).
 *
 * NEVER rendered here: `content`/`body`/bytes of any kind (there is none on
 * this boundary's types), or a claim that a rule "deletes"/"removes"/
 * "purges" content.
 */

import {
  reviewCommunityModerationTarget,
  type CommunityModerationPolicyKind,
  type CommunityModerationRequestedAction,
  type CommunityModerationTargetKind,
} from "../community/moderation.js";
import { escapeHtml } from "./html.js";

/** One sample, static community rule entry for the preview page. */
export interface CommunityRulePreviewEntry {
  readonly id: string;
  readonly label: string;
  readonly policyKind: CommunityModerationPolicyKind;
  readonly targetKind: CommunityModerationTargetKind;
  readonly action: CommunityModerationRequestedAction;
  readonly description: string;
}

/** Static sample rules for the preview page. Never fetched, never live, never applied. */
export const SAMPLE_COMMUNITY_RULES: readonly CommunityRulePreviewEntry[] = [
  {
    id: "rule-spam-posts",
    label: "Spam posts are hidden",
    policyKind: "default_placeholder",
    targetKind: "post_placeholder",
    action: "hide_placeholder",
    description: "A post matching spam heuristics would not be rendered by FedOS's own view.",
  },
  {
    id: "rule-muted-replies",
    label: "Replies from a muted account are de-emphasized",
    policyKind: "creator_space_placeholder",
    targetKind: "reply_placeholder",
    action: "mute_placeholder",
    description: "A reply from a muted account would render collapsed, not hidden outright.",
  },
  {
    id: "rule-filtered-listings",
    label: "Flagged listings are excluded from the default filter",
    policyKind: "marketplace_placeholder",
    targetKind: "listing_placeholder",
    action: "filter_placeholder",
    description: "A flagged listing would be excluded from the default view, still visible elsewhere.",
  },
  {
    id: "rule-hidden-chat",
    label: "Reported chat messages are hidden in that room",
    policyKind: "chat_placeholder",
    targetKind: "chat_placeholder",
    action: "hide_placeholder",
    description: "A reported chat message would not be rendered in that room's own view.",
  },
];

/**
 * A single rule's read-only preview: label, policy/target kind, requested
 * action, description (all HTML-escaped), and the PURE
 * `reviewCommunityModerationTarget` visibility-decision label it maps to.
 * Never a claim of deletion/removal/purge — the description explicitly
 * frames this as FedOS's own local visibility choice.
 */
export function renderCommunityRulePreview(rule: CommunityRulePreviewEntry): string {
  const review = reviewCommunityModerationTarget({
    targetKind: rule.targetKind,
    policyKind: rule.policyKind,
    action: rule.action,
  });
  return (
    `<li class="community-rule-preview-item" data-rule="${escapeHtml(rule.id)}">` +
    `<h3 class="community-rule-preview-label">${escapeHtml(rule.label)}</h3>` +
    `<dl class="community-rule-preview-meta">` +
    `<dt>policy</dt><dd>${escapeHtml(rule.policyKind)}</dd>` +
    `<dt>target</dt><dd>${escapeHtml(rule.targetKind)}</dd>` +
    `<dt>action</dt><dd>${escapeHtml(rule.action)}</dd>` +
    `<dt>visibility</dt><dd>${escapeHtml(review.decision)}</dd>` +
    `</dl>` +
    `<p class="community-rule-preview-description">${escapeHtml(rule.description)}</p>` +
    `</li>`
  );
}

/**
 * The full read-only community ruleset preview page: a note explaining
 * these are hide/mute/filter visibility choices — never deletion/removal/
 * purge of any content — then each sample rule's preview. NO content/body/
 * bytes appears anywhere on this page.
 */
export function renderCommunityRulesPreviewPage(
  rules: readonly CommunityRulePreviewEntry[],
): string {
  const items = rules.map(renderCommunityRulePreview).join("");
  return (
    `<section class="community-rules-preview-page">` +
    `<h2>Community ruleset preview</h2>` +
    `<p class="community-rules-preview-note">Read-only sample preview — these rules describe ` +
    `hide/mute/filter visibility choices FedOS's own rendering would make. No content is ever ` +
    `deleted, removed, or purged by any rule shown here.</p>` +
    `<ul class="community-rules-preview-list">${items}</ul>` +
    `</section>`
  );
}

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — pure, bounded
 * "where is my order?" landing-screen pointer text, built ONLY from the
 * already-computed `CommerceBuyerActivitySummary`/`CommerceSellerActivitySummary`
 * (`activity_summary.ts`) — never a new order-state derivation of its own,
 * per this codebase's "one tested source of truth per concept" discipline
 * (see `activity_summary.ts`'s own header).
 *
 * WHY THIS EXISTS: the app always lands on the Conversations screen after
 * unlock or restart (`routeByStatus()`/`renderReady()`,
 * `fedos_electron_beta_renderer.ts`), with no pointer back to an
 * in-progress or just-completed order — confirmed as an unresolved P2 by
 * the coordinator's own AFTER usability report
 * (`docs/commerce/usability-v2/COMMERCE-FRICTION-LEDGER-AFTER.md`, row #7:
 * "no pointer back to an in-progress or just-completed order... reduced
 * but not closed from v1"). Nav badges (`updateCommerceNavBadge()`) do
 * help, but they are only visible on the Shop/My Store tab buttons
 * themselves — this module additionally answers the buyer's/seller's own
 * "where is my order?" question in plain text the moment they land,
 * without requiring a visit to either tab first.
 *
 * Deliberately ONE bounded line, not a feed: this arc's own scope
 * explicitly excludes "large visual redesign"/new UI surfaces — this is
 * additive text on the existing landing screen, not a new screen.
 */
import type { CommerceBuyerActivitySummary, CommerceSellerActivitySummary } from "./activity_summary.js";

export interface CommerceLandingPointer {
  /** `null` when there is genuinely nothing to point at — the caller should render/show nothing (never a fabricated "0 items" line). */
  readonly text: string | null;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function buyerLine(s: CommerceBuyerActivitySummary): string | null {
  const parts: string[] = [];
  if (s.readyToPay > 0) parts.push(`${pluralize(s.readyToPay, "order")} ready to pay`);
  if (s.readyToAcknowledge > 0) parts.push(`${pluralize(s.readyToAcknowledge, "order")} ready to acknowledge`);
  if (s.readyToComplete > 0) parts.push(`${pluralize(s.readyToComplete, "order")} ready to complete`);
  if (s.readyReceipts > 0) parts.push(`${pluralize(s.readyReceipts, "receipt")} ready`);
  if (parts.length === 0 && s.awaitingSellerAcceptance > 0) {
    parts.push(`${pluralize(s.awaitingSellerAcceptance, "order")} awaiting seller acceptance`);
  }
  return parts.length > 0 ? `Shop: ${parts.join(", ")}.` : null;
}

function sellerLine(s: CommerceSellerActivitySummary): string | null {
  const parts: string[] = [];
  if (s.newSubmitted > 0) parts.push(`${pluralize(s.newSubmitted, "new order")}`);
  if (s.unpaid > 0) parts.push(`${pluralize(s.unpaid, "order")} awaiting buyer payment`);
  if (s.paidReadyToFulfill > 0) parts.push(`${pluralize(s.paidReadyToFulfill, "order")} paid, ready to fulfill`);
  if (s.fulfillingInProgress > 0) parts.push(`${pluralize(s.fulfillingInProgress, "order")} awaiting buyer confirmation`);
  return parts.length > 0 ? `My Store: ${parts.join(", ")}.` : null;
}

/**
 * Combines both roles' summaries into ONE bounded landing-screen line
 * (never a full activity feed). Returns `{text: null}` when neither role
 * has anything outstanding — the caller must not render an empty/placeholder
 * line in that case (never a fabricated "all clear" claim this module did
 * not actually check the receipts/content for).
 *
 * Either argument may be `undefined` (e.g. the caller's own IPC call
 * failed or hasn't completed yet) — this NEVER fabricates a summary from
 * missing data; a missing role simply contributes no line, exactly the
 * same "fail closed, never fabricate" discipline `activity_summary.ts`'s
 * own callers already follow.
 */
export function buildCommerceLandingPointer(
  asBuyer: CommerceBuyerActivitySummary | undefined,
  asSeller: CommerceSellerActivitySummary | undefined,
): CommerceLandingPointer {
  const lines: string[] = [];
  if (asBuyer !== undefined) {
    const l = buyerLine(asBuyer);
    if (l !== null) lines.push(l);
  }
  if (asSeller !== undefined) {
    const l = sellerLine(asSeller);
    if (l !== null) lines.push(l);
  }
  return { text: lines.length > 0 ? lines.join(" ") : null };
}

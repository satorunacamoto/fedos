/**
 * Secure Runtime Alpha 633 ("Outbound Eligibility V1") — Stage 13 of
 * the Alpha 621–640 Public Board Runtime Application API Foundation Arc.
 *
 * Public mode ONLY — no Private/DM policy of any kind is designed or
 * implemented here (out of THIS Arc's own scope entirely; see the
 * prior review's own §10 for the full future eligibility-gate design
 * across every Conversation Mode).
 *
 * Per the prior review's own §10 ("Outbound Safety") requirement, this
 * gate runs BEFORE `createFedosBoardOutboxIntent` — inside
 * `FedosBoardRuntime`'s own command handlers
 * (`./fedos_board_runtime.ts`), never inside the Scheduler or
 * Publisher, and never derives a target from `post.source` (this file
 * takes NO `FedosBoardPost` parameter at all — only the resolved
 * `author` and the caller-supplied `target`, confirming by construction
 * that no source-provenance field is ever consulted here).
 *
 * Three checks, ALL required, fail-closed (`false` unless every check
 * passes):
 *
 *   1. Target protocol is one this Arc recognizes for public fan-out —
 *      `"session"` is EXCLUDED (Alpha 633's own instruction: "Session
 *      への public fanout禁止"). The prior review's own §13 finding is
 *      why: Session's own DM-vs-broadcast semantics are not yet
 *      characterized anywhere in this codebase (`FedosBoardOutboundProtocol`
 *      names it, but no capability/policy document decides what a
 *      "public" Session delivery would even mean) — fail closed on
 *      that uncertainty rather than guess. `"nostr"`/`"activitypub"`/
 *      `"atproto"` remain eligible IN PRINCIPLE (subject to check 2/3
 *      below); this file does not claim any of the three has a working
 *      outbound Publisher today (only Nostr does, per the prior
 *      review's own §01 finding) — an eligible-but-undeliverable target
 *      simply produces an inert Outbox intent, which is this
 *      codebase's own normal, designed behavior for a not-yet-wired
 *      protocol.
 *   2. The author is NOT the anonymous-local fallback
 *      (`./fedos_board_runtime_author_authority.ts`). An
 *      anonymous-local author has no real cryptographic identity on
 *      ANY protocol — there is nothing to sign an outbound event AS,
 *      on any target. Rejecting this is what Alpha 633's own "eligible
 *      local author確認" requirement means concretely.
 *   3. The author's OWN protocol matches the target's protocol
 *      (Alpha 635's own "Signing eligibilityとAuthor authorityの整合を
 *      確認する" requirement) — an author resolved with `protocol:
 *      "nostr"` (the only real, non-anonymous identity this codebase
 *      can produce today, per `resolvePublicAuthorReference()`) is
 *      eligible for a `"nostr"` target, but NOT `"activitypub"`/
 *      `"atproto"` targets, since no per-protocol identity resolution
 *      for those exists anywhere in this codebase yet — attempting
 *      to federate under an identity the author does not actually hold
 *      on that protocol is exactly the "imported author impersonation"
 *      Alpha 635 forbids. This rule extends uniformly to every
 *      protocol, including ones with no live Publisher today, so no
 *      special-casing is needed as real per-protocol identity
 *      resolution is added later — a target simply becomes reachable
 *      the moment `resolvePublicAuthorReference()` itself can resolve
 *      an author on that protocol.
 */

import type { FedosBoardAuthorReference } from "../fedos_board_author.js";
import type { FedosBoardOutboundProtocol, FedosBoardOutboxTarget } from "../outbox/fedos_board_outbox_types.js";
import { FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER } from "./fedos_board_runtime_author_authority.js";

/** Every outbound protocol this Arc's own Outbound Eligibility gate ever allows for PUBLIC mode. `"session"` is deliberately excluded — see this file's own header. */
export const FEDOS_BOARD_RUNTIME_PUBLIC_ELIGIBLE_PROTOCOLS: readonly FedosBoardOutboundProtocol[] = [
  "nostr",
  "activitypub",
  "atproto",
];

function isAnonymousLocalAuthor(author: FedosBoardAuthorReference): boolean {
  return (
    author.identityId === null &&
    author.protocol === "fedos" &&
    author.publicIdentifier === FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER
  );
}

/**
 * Fail-closed: `true` only when EVERY check in this file's own header
 * passes. Never throws, never derives anything from a `FedosBoardPost`
 * or its `source` field (neither is a parameter here).
 */
export function isEligibleForPublicOutboundTarget(
  author: FedosBoardAuthorReference,
  target: FedosBoardOutboxTarget,
): boolean {
  if (!(FEDOS_BOARD_RUNTIME_PUBLIC_ELIGIBLE_PROTOCOLS as readonly string[]).includes(target.protocol)) {
    return false;
  }
  if (isAnonymousLocalAuthor(author)) {
    return false;
  }
  return author.protocol === target.protocol;
}

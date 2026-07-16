/**
 * Secure Runtime Alpha 665 ("Nostr Eligibility") / Alpha 666
 * ("ActivityPub / ATProto / Session Eligibility") — Stages 5/6 of the
 * Alpha 641–680 Public Identity, Conversation Policy & Application
 * Runtime Integration Arc.
 *
 * Evaluation order — every check fail-closed, in this fixed sequence:
 *
 *   1. `policy.mode !== "public"` -> `"unsupported-conversation-mode"`.
 *      (Structurally unreachable in V1 today — no
 *      `FedosConversationPolicyAuthority` this Arc ships ever resolves
 *      a non-`"public"` mode — kept as a real, first check anyway so a
 *      future private-mode Policy Authority cannot accidentally reach
 *      an outbound intent through this evaluator without this line
 *      catching it.)
 *   2. `policy.federationEligibility !== "allowed"` -> `"conversation-local-only"`.
 *   3. `target.protocol` not in `nostr`/`activitypub`/`atproto` (i.e.
 *      `"session"`, or any future non-recognized value) ->
 *      `"unsupported-target"`. `"session"` is EXCLUDED from public
 *      fan-out (Alpha 666's own "Session public fanout: prohibited"),
 *      continuing Alpha 633's own identical exclusion unchanged.
 *   4. `authorResolution.outcome !== "resolved"` -> `"anonymous-author"`.
 *      Both `"anonymous-local"` AND `"unavailable"`/`"conflict"` all
 *      fail this check identically — none of the three is a real,
 *      controllable identity.
 *   5. `authorResolution.author.protocol !== target.protocol` ->
 *      `"protocol-mismatch"` (Alpha 635's own "author protocol must
 *      match target protocol" rule, continued unchanged — an author
 *      resolved as `"nostr"` is never eligible for an `"activitypub"`/
 *      `"atproto"` target, which would otherwise be exactly the
 *      "imported author impersonation" this Arc forbids).
 *   6. Per-protocol final check:
 *      - `"nostr"`: Alpha 649's own confirmed blocker — no safe
 *        signing-authority-to-identity key-control check exists
 *        anywhere in this codebase today
 *        (`src/nostr/sign/fedos_nostr_signing_authority.ts` exposes
 *        `signEvent(accountIndex, ...)` only, no
 *        `accountIndex`-to-`publicIdentifier` mapping of any kind) ->
 *        ALWAYS `"identity-not-controlled"`, fail closed, never
 *        weakened to "matching strings is good enough."
 *      - `"activitypub"`/`"atproto"`: no Publisher implementation
 *        exists for either anywhere in this codebase (confirmed,
 *        Alpha 661) -> ALWAYS `"unsupported-target"`.
 *
 * The concrete, honest consequence of steps 3 and 6 together: **every**
 * real target this evaluator is ever asked about is `"ineligible"`
 * today — `"nostr"` fails at step 6 (`"identity-not-controlled"`),
 * `"activitypub"`/`"atproto"` fail at step 6 (`"unsupported-target"`),
 * and `"session"` fails at step 3 (`"unsupported-target"`). This is not
 * a bug in this evaluator — it is the accurate, fail-closed statement
 * of this codebase's own current capability (Alpha 649's own recorded
 * blocker), and is exactly why Alpha 680 recommends a dedicated future
 * Arc to close it.
 */

import { isEligibleForPublicOutboundTarget } from "../fedos_board_runtime_outbound_eligibility.js";
import type { FedosOutboundEligibilityInput, FedosOutboundEligibilityResult } from "./fedos_outbound_eligibility_types.js";

const NOSTR_CAPABLE_PROTOCOLS = new Set(["nostr", "activitypub", "atproto"]);

export function evaluateFedosOutboundEligibility(input: FedosOutboundEligibilityInput): FedosOutboundEligibilityResult {
  if (input.policy.mode !== "public") {
    return { outcome: "ineligible", reason: "unsupported-conversation-mode" };
  }
  if (input.policy.federationEligibility !== "allowed") {
    return { outcome: "ineligible", reason: "conversation-local-only" };
  }
  if (!NOSTR_CAPABLE_PROTOCOLS.has(input.target.protocol)) {
    // Covers "session" (Alpha 666's own explicit prohibition) and any
    // future, not-yet-recognized protocol value alike.
    return { outcome: "ineligible", reason: "unsupported-target" };
  }
  if (input.authorResolution.outcome !== "resolved") {
    return { outcome: "ineligible", reason: "anonymous-author" };
  }
  // Reuses Alpha 633's own existing, unmodified structural checks
  // (protocol recognized for fan-out + author-not-anonymous + author
  // protocol == target protocol) as a second, independent confirmation
  // of steps 3/4/5 above -- never as a replacement for the per-protocol
  // step 6 checks below, which Alpha 633's own file never performed.
  if (!isEligibleForPublicOutboundTarget(input.authorResolution.author, input.target)) {
    return { outcome: "ineligible", reason: "protocol-mismatch" };
  }

  if (input.target.protocol === "nostr") {
    // Alpha 649/665: no safe key-control check exists -- fail closed,
    // always, until a future Arc adds one.
    return { outcome: "ineligible", reason: "identity-not-controlled" };
  }

  // "activitypub" / "atproto": no Publisher implementation exists for
  // either (Alpha 666/661) -- always unsupported.
  return { outcome: "ineligible", reason: "unsupported-target" };
}

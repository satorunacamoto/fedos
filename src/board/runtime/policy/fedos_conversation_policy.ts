/**
 * Secure Runtime Alpha 653 ("Conversation Policy Axes") / Alpha 655
 * ("Public Policy V1") / Alpha 657 ("Policy Validation") — Stages 3/5/7
 * of the Alpha 641–680 Public Identity, Conversation Policy &
 * Application Runtime Integration Arc.
 *
 * Policy is modeled as DISTINCT axes (Alpha 653's own required rule —
 * never collapsed into one enum):
 *   - `mode` — `FedosConversationMode` (`./fedos_conversation_mode.ts`).
 *   - `discoverability` — may this conversation appear in a public
 *     query/listing?
 *   - `readAccess` — who may read it.
 *   - `writeAccess` — who may create a root post/reply in it.
 *   - `inviteAuthority` — who may invite a participant.
 *   - `federationEligibility` — may an outbound delivery intent ever be
 *     created for a post in this conversation?
 *
 * V1 SUPPORTED values only (Alpha 655's own exact answers):
 *   - may it appear in public queries? — yes, when `discoverability`
 *     is `"listed"`; `FedosBoardRuntime`'s own read methods (Alpha
 *     632) apply no policy filter themselves in V1, since public mode
 *     has nothing to hide (Alpha 658) — `discoverability` is recorded
 *     here as a structural placeholder for a future query gate, not
 *     enforced by any query path this Arc ships.
 *   - may anyone with Board access read it? — yes, `readAccess: "public"`
 *     is the only V1 value.
 *   - who may create root posts / replies? — anyone, when
 *     `writeAccess: "public"` (the only value any V1
 *     `FedosConversationPolicyAuthority` this Arc ships ever resolves;
 *     `"restricted"` remains closed vocabulary for a future Arc that
 *     also ships real membership — see Alpha 653's own "do not
 *     introduce membership merely to support restricted" rule).
 *   - may outbound delivery intents be created? — only when
 *     `federationEligibility: "allowed"` AND every other Outbound
 *     Eligibility check passes (Phase C).
 *   - which target protocols are potentially allowed? — decided
 *     entirely by `evaluateFedosOutboundEligibility()` (Phase C), never
 *     by this file.
 *
 * No moderation, rate limit, or membership enforcement is implied or
 * implemented by any field here.
 */

import type { FedosConversationMode } from "./fedos_conversation_mode.js";

export type FedosConversationDiscoverability = "listed" | "unlisted";
export type FedosConversationReadAccess = "public";
export type FedosConversationWriteAccess = "public" | "restricted";
export type FedosConversationInviteAuthority = "none";
export type FedosConversationFederationEligibility = "allowed" | "local-only";

export interface FedosConversationPolicy {
  readonly mode: FedosConversationMode;
  readonly discoverability: FedosConversationDiscoverability;
  readonly readAccess: FedosConversationReadAccess;
  readonly writeAccess: FedosConversationWriteAccess;
  readonly inviteAuthority: FedosConversationInviteAuthority;
  readonly federationEligibility: FedosConversationFederationEligibility;
}

const DISCOVERABILITY_VALUES: readonly FedosConversationDiscoverability[] = ["listed", "unlisted"];
const WRITE_ACCESS_VALUES: readonly FedosConversationWriteAccess[] = ["public", "restricted"];
const FEDERATION_ELIGIBILITY_VALUES: readonly FedosConversationFederationEligibility[] = ["allowed", "local-only"];

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Alpha 657 ("Policy Validation") — pure, closed-vocabulary validation.
 * Fails closed (`null`) for: any unknown field, any missing field, any
 * value outside its own axis's closed vocabulary, `mode !== "public"`
 * (no `"private-group"`/`"direct"` policy is constructible in this
 * Arc), and `writeAccess === "restricted"` (V1 has no membership
 * authority that could ever honor a restriction — accepting the value
 * here without one would be a policy promising enforcement that does
 * not exist). No network, no storage mutation, no identity mutation,
 * no inference of permissions from a display name (none is ever read).
 * Returns a deep-frozen copy, never the caller's own reference.
 */
export function validateFedosConversationPolicy(candidate: unknown): FedosConversationPolicy | null {
  if (!isNonEmptyObject(candidate)) return null;
  const keys = Object.keys(candidate).sort();
  const expectedKeys = [
    "discoverability",
    "federationEligibility",
    "inviteAuthority",
    "mode",
    "readAccess",
    "writeAccess",
  ];
  if (keys.length !== expectedKeys.length || !keys.every((key, index) => key === expectedKeys[index])) {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  if (value.mode !== "public") return null;
  if (typeof value.discoverability !== "string" || !DISCOVERABILITY_VALUES.includes(value.discoverability as FedosConversationDiscoverability)) {
    return null;
  }
  if (value.readAccess !== "public") return null;
  if (typeof value.writeAccess !== "string" || !WRITE_ACCESS_VALUES.includes(value.writeAccess as FedosConversationWriteAccess)) {
    return null;
  }
  if (value.writeAccess === "restricted") return null; // Alpha 653: no membership authority exists to honor this yet.
  if (value.inviteAuthority !== "none") return null;
  if (
    typeof value.federationEligibility !== "string" ||
    !FEDERATION_ELIGIBILITY_VALUES.includes(value.federationEligibility as FedosConversationFederationEligibility)
  ) {
    return null;
  }

  return Object.freeze({
    mode: "public",
    discoverability: value.discoverability as FedosConversationDiscoverability,
    readAccess: "public",
    writeAccess: "public",
    inviteAuthority: "none",
    federationEligibility: value.federationEligibility as FedosConversationFederationEligibility,
  });
}

/**
 * The one fixed policy every V1 `FedosConversationPolicyAuthority` this
 * Arc ships resolves (`./fedos_conversation_policy_authority.ts`).
 * Federation is `"allowed"` here at the POLICY layer — Phase C's own
 * Outbound Eligibility Evaluator is what actually still fails every
 * real target closed today (Alpha 665/666), so this policy value alone
 * never causes an outbound delivery to succeed by itself.
 */
export const FEDOS_CONVERSATION_POLICY_PUBLIC_V1: FedosConversationPolicy = Object.freeze({
  mode: "public",
  discoverability: "listed",
  readAccess: "public",
  writeAccess: "public",
  inviteAuthority: "none",
  federationEligibility: "allowed",
});

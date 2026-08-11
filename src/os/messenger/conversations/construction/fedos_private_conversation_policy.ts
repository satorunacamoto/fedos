/**
 * Secure Runtime Alpha 896 ("Private Policy V1") / Alpha 897 ("Policy
 * Validator Compatibility") — Stages 6-7 of Phase A of the Alpha 891–930
 * Private Conversation Draft Construction and Readiness Runtime Arc.
 *
 * The exact initial policies for `private-group` and `direct` drafts, and
 * the SEPARATE validator/factories that construct them — without
 * weakening the public validator. `validateFedosConversationPolicy`
 * (`../../board/runtime/policy/fedos_conversation_policy.ts`, Alpha 657)
 * stays byte-for-byte unchanged: it still rejects every non-`"public"`
 * mode, every non-`"public"` `readAccess`, `writeAccess === "restricted"`,
 * and every non-`"none"` `inviteAuthority` — so Public Runtime validation
 * is untouched. Private policies are validated ONLY by
 * `validateFedosPrivateConversationPolicy` below, an ADDITIVE sibling, per
 * Alpha 897's own "extend via a separate validator, do not weaken the
 * public one globally" instruction.
 *
 * Alpha 897 also asks for three explicit factories —
 * `createPublicConversationPolicy()`, `createPrivateGroupDraftPolicy()`,
 * `createDirectDraftPolicy()` — each named, each returning a frozen
 * `FedosConversationPolicy`, none accepting a free-form policy bag.
 *
 * Exact axis values (Alpha 896), NONE inferred from mode alone:
 *
 * | axis | private-group | direct |
 * |---|---|---|
 * | mode | private-group | direct |
 * | discoverability | unlisted | unlisted |
 * | readAccess | members-only | members-only |
 * | writeAccess | restricted | restricted |
 * | inviteAuthority | owner-and-moderators | none |
 * | federationEligibility | local-only | local-only |
 *
 * `federationEligibility` is FIXED `"local-only"` for BOTH modes in V1 —
 * NOT a caller choice. No real private-delivery protocol exists (this
 * Arc's Absolute Prohibitions; `18_protocol_delivery.md`), so recording
 * `"allowed"` intent on a draft that can never be delivered would be
 * actively misleading. A future Arc that ships private delivery may widen
 * this honestly.
 *
 * This file makes NO claim that Policy provides encryption (Alpha 896's
 * own rule) — `FedosConversationPolicy` has no encryption axis; encryption
 * readiness is an entirely separate concern
 * (`../readiness/fedos_conversation_encryption_readiness_authority.ts`).
 */

import {
  FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
  type FedosConversationDiscoverability,
  type FedosConversationFederationEligibility,
  type FedosConversationInviteAuthority,
  type FedosConversationPolicy,
  type FedosConversationReadAccess,
  type FedosConversationWriteAccess,
} from "../../board/runtime/policy/fedos_conversation_policy.js";
import type { FedosPrivateConversationPolicyReference } from "./fedos_conversation_draft_record.js";

/** Alpha 897 — the public factory. Returns the same fixed public policy Public Runtime already resolves. */
export function createPublicConversationPolicy(): FedosConversationPolicy {
  return FEDOS_CONVERSATION_POLICY_PUBLIC_V1;
}

/** Alpha 896 — the exact private-group draft policy. Frozen; every axis explicit. */
export function createPrivateGroupDraftPolicy(): FedosConversationPolicy {
  return Object.freeze({
    mode: "private-group",
    discoverability: "unlisted",
    readAccess: "members-only",
    writeAccess: "restricted",
    inviteAuthority: "owner-and-moderators",
    federationEligibility: "local-only",
  });
}

/** Alpha 896 — the exact direct draft policy. Frozen; every axis explicit. */
export function createDirectDraftPolicy(): FedosConversationPolicy {
  return Object.freeze({
    mode: "direct",
    discoverability: "unlisted",
    readAccess: "members-only",
    writeAccess: "restricted",
    inviteAuthority: "none",
    federationEligibility: "local-only",
  });
}

/** Resolves the fixed policy for a draft's stored policy reference (Alpha 896). Deterministic — used by the read facade (Alpha 925). */
export function resolveFedosPrivateConversationPolicy(
  policyReference: FedosPrivateConversationPolicyReference,
): FedosConversationPolicy {
  return policyReference === "private-group-draft-v1" ? createPrivateGroupDraftPolicy() : createDirectDraftPolicy();
}

const DISCOVERABILITY_VALUES: readonly FedosConversationDiscoverability[] = ["listed", "unlisted"];
const READ_ACCESS_VALUES: readonly FedosConversationReadAccess[] = ["public", "members-only"];
const WRITE_ACCESS_VALUES: readonly FedosConversationWriteAccess[] = ["public", "restricted"];
const INVITE_AUTHORITY_VALUES: readonly FedosConversationInviteAuthority[] = ["none", "owner-and-moderators"];
const FEDERATION_ELIGIBILITY_VALUES: readonly FedosConversationFederationEligibility[] = ["allowed", "local-only"];

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Alpha 897 — the ADDITIVE private-mode validator. Fails closed (`null`)
 * for anything a `private-group`/`direct` draft policy must not be:
 * unknown/missing field, non-private mode, non-`"unlisted"`
 * discoverability, non-`"members-only"` read, non-`"restricted"` write,
 * an `inviteAuthority` illegal for the mode (`direct` must be `"none"`;
 * `private-group` must be `"owner-and-moderators"`), or a
 * `federationEligibility` other than `"local-only"`. Returns a
 * deep-frozen copy, never the caller's own reference. Never throws.
 */
export function validateFedosPrivateConversationPolicy(candidate: unknown): FedosConversationPolicy | null {
  if (!isNonEmptyObject(candidate)) return null;
  const keys = Object.keys(candidate).sort();
  const expectedKeys = ["discoverability", "federationEligibility", "inviteAuthority", "mode", "readAccess", "writeAccess"];
  if (keys.length !== expectedKeys.length || !keys.every((key, index) => key === expectedKeys[index])) {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  if (value.mode !== "private-group" && value.mode !== "direct") return null;
  if (typeof value.discoverability !== "string" || !DISCOVERABILITY_VALUES.includes(value.discoverability as FedosConversationDiscoverability)) {
    return null;
  }
  if (value.discoverability !== "unlisted") return null;
  if (typeof value.readAccess !== "string" || !READ_ACCESS_VALUES.includes(value.readAccess as FedosConversationReadAccess)) return null;
  if (value.readAccess !== "members-only") return null;
  if (typeof value.writeAccess !== "string" || !WRITE_ACCESS_VALUES.includes(value.writeAccess as FedosConversationWriteAccess)) return null;
  if (value.writeAccess !== "restricted") return null;
  if (typeof value.inviteAuthority !== "string" || !INVITE_AUTHORITY_VALUES.includes(value.inviteAuthority as FedosConversationInviteAuthority)) {
    return null;
  }
  const expectedInvite: FedosConversationInviteAuthority = value.mode === "private-group" ? "owner-and-moderators" : "none";
  if (value.inviteAuthority !== expectedInvite) return null;
  if (
    typeof value.federationEligibility !== "string" ||
    !FEDERATION_ELIGIBILITY_VALUES.includes(value.federationEligibility as FedosConversationFederationEligibility)
  ) {
    return null;
  }
  if (value.federationEligibility !== "local-only") return null;

  return Object.freeze({
    mode: value.mode,
    discoverability: "unlisted",
    readAccess: "members-only",
    writeAccess: "restricted",
    inviteAuthority: expectedInvite,
    federationEligibility: "local-only",
  });
}

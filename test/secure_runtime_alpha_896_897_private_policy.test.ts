/**
 * Secure Runtime Alpha 896/897 — private policy V1 and validator
 * compatibility, plus the default (unavailable) encryption readiness.
 */

import { describe, it, expect } from "vitest";
import {
  createDirectDraftPolicy,
  createPrivateGroupDraftPolicy,
  createPublicConversationPolicy,
  resolveFedosPrivateConversationPolicy,
  validateFedosPrivateConversationPolicy,
} from "../src/os/messenger/conversations/construction/fedos_private_conversation_policy.js";
import {
  FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
  validateFedosConversationPolicy,
} from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy.js";
import {
  UnavailableFedosConversationEncryptionReadinessAuthority,
} from "../src/os/messenger/conversations/readiness/fedos_conversation_encryption_readiness_authority.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

describe("Alpha 896 — exact private policies", () => {
  it("private-group draft policy has the exact axis values", () => {
    expect(createPrivateGroupDraftPolicy()).toEqual({
      mode: "private-group",
      discoverability: "unlisted",
      readAccess: "members-only",
      writeAccess: "restricted",
      inviteAuthority: "owner-and-moderators",
      federationEligibility: "local-only",
    });
  });

  it("direct draft policy has the exact axis values, invite authority none", () => {
    expect(createDirectDraftPolicy()).toEqual({
      mode: "direct",
      discoverability: "unlisted",
      readAccess: "members-only",
      writeAccess: "restricted",
      inviteAuthority: "none",
      federationEligibility: "local-only",
    });
  });

  it("resolves policy deterministically from the stored reference", () => {
    expect(resolveFedosPrivateConversationPolicy("private-group-draft-v1").mode).toBe("private-group");
    expect(resolveFedosPrivateConversationPolicy("direct-draft-v1").mode).toBe("direct");
  });

  it("public factory returns the fixed public policy, unchanged", () => {
    expect(createPublicConversationPolicy()).toBe(FEDOS_CONVERSATION_POLICY_PUBLIC_V1);
  });
});

describe("Alpha 897 — validator compatibility", () => {
  it("the private validator accepts the private policies", () => {
    expect(validateFedosPrivateConversationPolicy(createPrivateGroupDraftPolicy())).not.toBeNull();
    expect(validateFedosPrivateConversationPolicy(createDirectDraftPolicy())).not.toBeNull();
  });

  it("the private validator rejects a public policy and a mismatched invite authority", () => {
    expect(validateFedosPrivateConversationPolicy(FEDOS_CONVERSATION_POLICY_PUBLIC_V1)).toBeNull();
    expect(
      validateFedosPrivateConversationPolicy({ ...createDirectDraftPolicy(), inviteAuthority: "owner-and-moderators" }),
    ).toBeNull();
    expect(validateFedosPrivateConversationPolicy({ ...createPrivateGroupDraftPolicy(), federationEligibility: "allowed" })).toBeNull();
  });

  it("the PUBLIC validator is unchanged — still rejects private values, still accepts public", () => {
    expect(validateFedosConversationPolicy(createPrivateGroupDraftPolicy())).toBeNull();
    expect(validateFedosConversationPolicy(createDirectDraftPolicy())).toBeNull();
    const publicPolicy = validateFedosConversationPolicy({
      mode: "public",
      discoverability: "listed",
      readAccess: "public",
      writeAccess: "public",
      inviteAuthority: "none",
      federationEligibility: "allowed",
    });
    expect(publicPolicy).not.toBeNull();
    expect(publicPolicy!.mode).toBe("public");
  });
});

describe("Alpha 924 — default encryption readiness is unavailable", () => {
  it("always returns unavailable, no override path", () => {
    const authority = new UnavailableFedosConversationEncryptionReadinessAuthority();
    expect(authority.evaluateEncryptionReadiness("private-draft::direct::x" as FedosConversationId).state).toBe("unavailable");
  });
});

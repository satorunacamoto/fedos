import { describe, it, expect } from "vitest";
import {
  validateFedosConversationPolicy,
  FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
} from "../src/board/runtime/policy/fedos_conversation_policy.js";

/**
 * Secure Runtime Alpha 657 ("Policy Validation") — Stage 7 of the Alpha
 * 641-680 Arc.
 */
describe("Secure Runtime Alpha 657 -- Policy Validation", () => {
  it("1. the fixed V1 public policy validates successfully and round-trips unchanged", () => {
    const result = validateFedosConversationPolicy(FEDOS_CONVERSATION_POLICY_PUBLIC_V1);
    expect(result).toEqual(FEDOS_CONVERSATION_POLICY_PUBLIC_V1);
  });

  it("2. mode 'private-group' fails closed to null", () => {
    const result = validateFedosConversationPolicy({ ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, mode: "private-group" });
    expect(result).toBeNull();
  });

  it("3. mode 'direct' fails closed to null", () => {
    const result = validateFedosConversationPolicy({ ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, mode: "direct" });
    expect(result).toBeNull();
  });

  it("4. writeAccess 'restricted' fails closed -- no membership authority exists to honor it", () => {
    const result = validateFedosConversationPolicy({ ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, writeAccess: "restricted" });
    expect(result).toBeNull();
  });

  it("5. an unknown extra field fails closed", () => {
    const result = validateFedosConversationPolicy({ ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, encrypted: true });
    expect(result).toBeNull();
  });

  it("6. a missing field fails closed", () => {
    const { inviteAuthority: _unused, ...withoutInviteAuthority } = FEDOS_CONVERSATION_POLICY_PUBLIC_V1;
    const result = validateFedosConversationPolicy(withoutInviteAuthority);
    expect(result).toBeNull();
  });

  it("7. an out-of-vocabulary discoverability value fails closed", () => {
    const result = validateFedosConversationPolicy({ ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, discoverability: "hidden" });
    expect(result).toBeNull();
  });

  it("8. non-object input (null, array, primitive) fails closed, never throws", () => {
    expect(validateFedosConversationPolicy(null)).toBeNull();
    expect(validateFedosConversationPolicy([])).toBeNull();
    expect(validateFedosConversationPolicy("public")).toBeNull();
    expect(validateFedosConversationPolicy(undefined)).toBeNull();
  });

  it("9. the returned policy is frozen -- not the caller's own reference", () => {
    const candidate = { ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1 };
    const result = validateFedosConversationPolicy(candidate);
    expect(result).not.toBe(candidate);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("10. federationEligibility 'local-only' is accepted -- distinct axis from writeAccess/mode", () => {
    const result = validateFedosConversationPolicy({ ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, federationEligibility: "local-only" });
    expect(result?.federationEligibility).toBe("local-only");
  });
});

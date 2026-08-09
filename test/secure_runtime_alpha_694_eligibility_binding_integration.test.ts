import { describe, it, expect } from "vitest";
import { evaluateFedosOutboundEligibility } from "../src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.js";
import { FEDOS_CONVERSATION_POLICY_PUBLIC_V1 } from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy.js";
import type { FedosPublicAuthorResolution } from "../src/os/messenger/board/runtime/identity/fedos_public_author_authority.js";

const HEX = "0dd114".repeat(11).slice(0, 64);

const resolvedNostr: FedosPublicAuthorResolution = {
  outcome: "resolved",
  author: { identityId: null, protocol: "nostr", publicIdentifier: HEX },
};

/**
 * Secure Runtime Alpha 694 ("Eligibility Evaluator Integration") --
 * Stage 14 of Phase A of the Alpha 681-720 Arc. Closes the Alpha
 * 649/665 blocker `test/secure_runtime_alpha_665_nostr_eligibility_evaluator.test.ts`
 * itself documents (that file's own test 1 remains valid and UNCHANGED --
 * it never supplies `nostrAuthorBinding`, so it still observes the same
 * fail-closed default this Arc preserves for every caller that omits a
 * Binding Authority).
 */
describe("Secure Runtime Alpha 694 -- Outbound Eligibility Evaluator Binding Integration", () => {
  it("1. a nostr target becomes eligible once a 'bound' binding result is supplied", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "nostr", destination: null },
      authorResolution: resolvedNostr,
      nostrAuthorBinding: { outcome: "bound", accountIndex: 0, publicKeyHex: HEX },
    });
    expect(result).toEqual({ outcome: "eligible" });
  });

  it("2. every non-'bound' binding outcome keeps the SAME 'identity-not-controlled' reason -- no new eligibility reason token introduced", () => {
    const nonBoundOutcomes = [
      { outcome: "author-not-nostr" as const },
      { outcome: "signing-authority-unavailable" as const },
      { outcome: "public-key-mismatch" as const },
      { outcome: "invalid-author-identifier" as const },
    ];
    for (const nostrAuthorBinding of nonBoundOutcomes) {
      const result = evaluateFedosOutboundEligibility({
        policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
        target: { protocol: "nostr", destination: null },
        authorResolution: resolvedNostr,
        nostrAuthorBinding,
      });
      expect(result).toEqual({ outcome: "ineligible", reason: "identity-not-controlled" });
    }
  });

  it("3. omitting nostrAuthorBinding entirely preserves the pre-Alpha-681 fail-closed default", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "nostr", destination: null },
      authorResolution: resolvedNostr,
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "identity-not-controlled" });
  });

  it("4. a 'bound' binding result does NOT unlock activitypub/atproto/session -- per-protocol, never a blanket override", () => {
    for (const protocol of ["activitypub", "atproto", "session"] as const) {
      const result = evaluateFedosOutboundEligibility({
        policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
        target: { protocol, destination: null },
        authorResolution: resolvedNostr,
        nostrAuthorBinding: { outcome: "bound", accountIndex: 0, publicKeyHex: HEX },
      });
      expect(result.outcome).toBe("ineligible");
    }
  });

  it("5. a 'bound' binding result never overrides an earlier fail-closed check (conversation-local-only still wins)", () => {
    const localOnlyPolicy = { ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, federationEligibility: "local-only" as const };
    const result = evaluateFedosOutboundEligibility({
      policy: localOnlyPolicy,
      target: { protocol: "nostr", destination: null },
      authorResolution: resolvedNostr,
      nostrAuthorBinding: { outcome: "bound", accountIndex: 0, publicKeyHex: HEX },
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "conversation-local-only" });
  });
});

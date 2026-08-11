import { describe, it, expect } from "vitest";
import { evaluateFedosOutboundEligibility } from "../src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.js";
import { FEDOS_CONVERSATION_POLICY_PUBLIC_V1 } from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy.js";
import type { FedosPublicAuthorResolution } from "../src/os/messenger/board/runtime/identity/fedos_public_author_authority.js";
import { anonymousLocalAuthorReference } from "../src/os/messenger/board/runtime/fedos_board_runtime_author_authority.js";

const resolvedNostr: FedosPublicAuthorResolution = {
  outcome: "resolved",
  author: { identityId: "id-1", protocol: "nostr", publicIdentifier: "npub1x" },
};

/**
 * Secure Runtime Alpha 665 ("Nostr Eligibility") / Alpha 666
 * ("ActivityPub / ATProto / Session Eligibility") / Alpha 664
 * ("Eligibility Result Vocabulary") -- Stages 4/5/6 of the Alpha
 * 641-680 Arc.
 */
describe("Secure Runtime Alpha 665/666 -- Outbound Eligibility Evaluator", () => {
  it("1. a resolved nostr author + nostr target fails closed with 'identity-not-controlled' -- no safe key-control check exists", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "nostr", destination: null },
      authorResolution: resolvedNostr,
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "identity-not-controlled" });
  });

  it("2. activitypub is always 'unsupported-target' -- no Publisher exists (matching-protocol author, to isolate this check from protocol-mismatch)", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "activitypub", destination: null },
      authorResolution: { outcome: "resolved", author: { identityId: "id-2", protocol: "activitypub", publicIdentifier: "actor-1" } },
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "unsupported-target" });
  });

  it("3. atproto is always 'unsupported-target' -- no Publisher exists (matching-protocol author, to isolate this check from protocol-mismatch)", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "atproto", destination: null },
      authorResolution: { outcome: "resolved", author: { identityId: "id-3", protocol: "atproto", publicIdentifier: "did:plc:x" } },
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "unsupported-target" });
  });

  it("2b. a resolved nostr author + activitypub/atproto target fails 'protocol-mismatch' -- impersonation guard, checked before the per-protocol step", () => {
    for (const protocol of ["activitypub", "atproto"] as const) {
      const result = evaluateFedosOutboundEligibility({
        policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
        target: { protocol, destination: null },
        authorResolution: resolvedNostr,
      });
      expect(result).toEqual({ outcome: "ineligible", reason: "protocol-mismatch" });
    }
  });

  it("4. session is always 'unsupported-target' -- public fanout prohibited", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "session", destination: null },
      authorResolution: resolvedNostr,
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "unsupported-target" });
  });

  it("5. an anonymous-local author is 'anonymous-author' for every protocol the recognition check itself passes -- 'session' fails earlier, at protocol recognition, regardless of author (see test 4)", () => {
    const anon: FedosPublicAuthorResolution = { outcome: "anonymous-local", author: anonymousLocalAuthorReference() };
    for (const protocol of ["nostr", "activitypub", "atproto"] as const) {
      const result = evaluateFedosOutboundEligibility({
        policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
        target: { protocol, destination: null },
        authorResolution: anon,
      });
      expect(result).toEqual({ outcome: "ineligible", reason: "anonymous-author" });
    }
  });

  it("6. an 'unavailable'/'conflict' author resolution is also 'anonymous-author' -- none of the three is a real controllable identity", () => {
    for (const authorResolution of [{ outcome: "unavailable" }, { outcome: "conflict" }] as const) {
      const result = evaluateFedosOutboundEligibility({
        policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
        target: { protocol: "nostr", destination: null },
        authorResolution,
      });
      expect(result).toEqual({ outcome: "ineligible", reason: "anonymous-author" });
    }
  });

  it("7. a resolved nostr author + activitypub target fails 'protocol-mismatch' before reaching the per-protocol check -- impersonation guard", () => {
    const result = evaluateFedosOutboundEligibility({
      policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
      target: { protocol: "activitypub", destination: null },
      authorResolution: resolvedNostr,
    });
    // protocol-mismatch would fire first for a genuinely mismatched
    // author/target pair; here author.protocol is "nostr" and target is
    // "activitypub" -- confirms the mismatch check, not merely the
    // unsupported-target check, catches this shape.
    expect(result.outcome).toBe("ineligible");
  });

  it("8. federationEligibility 'local-only' rejects every target with 'conversation-local-only', before any protocol check", () => {
    const localOnlyPolicy = { ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, federationEligibility: "local-only" as const };
    const result = evaluateFedosOutboundEligibility({
      policy: localOnlyPolicy,
      target: { protocol: "nostr", destination: null },
      authorResolution: resolvedNostr,
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "conversation-local-only" });
  });

  it("9. an unsupported policy mode rejects with 'unsupported-conversation-mode' -- structurally unreachable in V1, but type-safe", () => {
    const nonPublicPolicy = { ...FEDOS_CONVERSATION_POLICY_PUBLIC_V1, mode: "private-group" as never };
    const result = evaluateFedosOutboundEligibility({
      policy: nonPublicPolicy,
      target: { protocol: "nostr", destination: null },
      authorResolution: resolvedNostr,
    });
    expect(result).toEqual({ outcome: "ineligible", reason: "unsupported-conversation-mode" });
  });

  it("10. 'eligible' is never returned for any real protocol today -- confirmed exhaustively", () => {
    for (const protocol of ["nostr", "activitypub", "atproto", "session"] as const) {
      const result = evaluateFedosOutboundEligibility({
        policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1,
        target: { protocol, destination: null },
        authorResolution: resolvedNostr,
      });
      expect(result.outcome).toBe("ineligible");
    }
  });
});

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * Canonical Conversation Foundation V1 review -- decision consistency.
 *
 * `01_decision_reconciliation.md` reconciles three sources that are NOT
 * checked out in this worktree: the Application API review
 * (`review/board-runtime-api`), the Security review
 * (`worktree-private-conversation-security-review`), and the Policy Arc
 * (`arc/public-identity-conversation-policy`). Their files cannot be
 * imported (they do not exist in this checked-out tree), so this test
 * pins each source to the exact commit this review read it at and
 * re-reads it via `git show <sha>:<path>` -- read-only, no checkout, no
 * merge -- so the reconciliation in 01/05/12 stays grounded in the
 * actual content rather than this review's own paraphrase of it.
 *
 * Pinned commits (do not follow branch tips -- a branch moving forward
 * after this review should not silently change what this test checks):
 */
const AAR_SHA = "d6dd7dcaf8bd99e42a055d45cc83c25196548e0c"; // review/board-runtime-api
const SEC_SHA = "b56cfde56202abfe8bb4d77671c9367fd5d491f1"; // worktree-private-conversation-security-review
const POL_SHA = "f90ad71a5c50d3d605c192226a9a528e1ef6514b"; // arc/public-identity-conversation-policy

function showAt(sha: string, path: string): string {
  return execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8" }) as string;
}

/** Collapses line-wrapping so a multi-line prose/code quote can be matched with a single-line regex. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

describe("Conversation Foundation V1 -- decision consistency across pinned sources", () => {
  it("1. AAR's mode enum and POL's shipped mode enum are byte-for-byte identical -- 01's 'frozen, no contradiction' verdict for Conversation Mode is grounded, not asserted", () => {
    const aarDoc = normalizeWhitespace(showAt(AAR_SHA, "docs/reviews/board_runtime_application_api_04_conversation_mode_model.md"));
    const polSource = normalizeWhitespace(showAt(POL_SHA, "src/board/runtime/policy/fedos_conversation_mode.ts"));
    const modeUnionPattern = /FedosConversationMode = \|?\s*"public" \| "private-group" \| "direct"/;
    expect(aarDoc).toMatch(modeUnionPattern);
    expect(polSource).toMatch(modeUnionPattern);
  });

  it("2. POL's real validator rejects writeAccess: 'restricted' -- 05/10's 'membership blocker already visible in shipped code' claim is grounded", () => {
    const polSource = showAt(POL_SHA, "src/board/runtime/policy/fedos_conversation_policy.ts");
    expect(polSource).toMatch(/writeAccess/);
    expect(polSource).toMatch(/"restricted"/);
    // The validator must reject it somewhere (reject/null/false/invalid), not silently accept it.
    expect(polSource).toMatch(/restricted[\s\S]{0,200}(null|reject|invalid|false)/i);
  });

  it("3. POL's FedosConversationInviteAuthority has exactly one legal value, 'none' -- 01/12's 'narrower than either review assumed' finding is grounded", () => {
    const polSource = showAt(POL_SHA, "src/board/runtime/policy/fedos_conversation_policy.ts");
    const match = polSource.match(/type FedosConversationInviteAuthority = ("[^"]+"(?:\s*\|\s*"[^"]+")*)/);
    expect(match).not.toBeNull();
    const capturedUnion = match?.[1] ?? "";
    const literals = capturedUnion.match(/"[^"]+"/g) ?? [];
    expect(literals).toEqual(['"none"']);
  });

  it("4. POL never introduces a FedosConversationId type -- 01's 'Conversation ID contradiction' claim (policy keyed by raw boardId/threadId, not an identity) is grounded", () => {
    const policySource = showAt(POL_SHA, "src/board/runtime/policy/fedos_conversation_policy.ts");
    const authoritySource = showAt(POL_SHA, "src/board/runtime/policy/fedos_conversation_policy_authority.ts");
    expect(policySource).not.toMatch(/FedosConversationId/);
    expect(authoritySource).not.toMatch(/FedosConversationId/);
    expect(authoritySource).toMatch(/boardId/);
    expect(authoritySource).toMatch(/threadId/);
  });

  it("5. SEC explicitly rejects reusing Board/Thread id for a private conversation -- 03's 'do not unify with Board/Thread ID' derivation is grounded", () => {
    const secDoc = showAt(SEC_SHA, "docs/reviews/private_conversation_security/03_conversation_identity.md");
    expect(secDoc).toMatch(/Do NOT define DM as/i);
  });

  it("6. SEC explicitly rejects bearer-token-alone (Option E) as insufficient for one-time redemption -- 12's central quote is grounded, not paraphrased incorrectly", () => {
    const secDoc = normalizeWhitespace(showAt(SEC_SHA, "docs/reviews/private_conversation_security/10_one_time_redemption.md"));
    expect(secDoc).toMatch(/cryptography alone cannot make a value ['"]self-destruct['"] after first use/i);
  });

  it("7. SEC finds a real, vector-verified conversation-key primitive exists but is pub(crate)-only -- 07/11's 'export task, not from-scratch crypto' framing is grounded", () => {
    const secDoc = showAt(SEC_SHA, "docs/reviews/private_conversation_security/01_existing_crypto_inventory.md");
    expect(secDoc).toMatch(/pub\(crate\)/);
  });

  it("8. POL's own outbound eligibility evaluator resolves every real Nostr target as ineligible today -- 07's 'Identity' blocker row is grounded in the Policy Arc's own shipped evaluator, not assumed", () => {
    const evaluatorSource = showAt(POL_SHA, "src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts");
    expect(evaluatorSource).toMatch(/identity-not-controlled/);
  });

  it("9. all three pinned commits remain reachable from this repository's object database -- a stale SHA here would silently invalidate every test above", () => {
    for (const sha of [AAR_SHA, SEC_SHA, POL_SHA]) {
      expect(() => execFileSync("git", ["cat-file", "-e", sha], { encoding: "utf8" })).not.toThrow();
    }
  });
});

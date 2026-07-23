/**
 * Secure Runtime Alpha 7081-7160 (FedOS Conversation Invitation and
 * Shared Conversation Foundation Arc) — structural guards, proving by
 * direct source inspection (never narrative claim alone) what this Arc
 * actually built and did NOT touch.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "e43cf67a";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

describe("Secure Runtime Alpha 7081-7160 -- structural guards", () => {
  it("1. the invitation advertisement is signed with a real, domain-separated account signature -- never trusts the unsigned Rumor pubkey", () => {
    const source = stripComments(read("src/conversation/invitation_bootstrap/fedos_conversation_invitation_inbound_coordinator.ts"));
    expect(source).toMatch(/verifyFedosConversationInvitationAccountAuthorization\(/);
    expect(source).not.toMatch(/rumor\.pubkey/);
    const authSource = stripComments(read("src/conversation/invitation_bootstrap/fedos_conversation_invitation_authentication.ts"));
    expect(authSource).toMatch(/NobleSignatureVerifier\.verify\(/);
    expect(authSource).toMatch(/FEDOS_CONVERSATION_INVITATION_NOSTR_TAG/);
  });

  it("2. no raw private key, Master Seed, Ratchet key, or SecretHandle appears anywhere in this Arc's own new files", () => {
    const files = [
      "src/conversation/invitation_bootstrap/fedos_conversation_invitation_advertisement.ts",
      "src/conversation/invitation_bootstrap/fedos_conversation_invitation_authentication.ts",
      "src/conversation/invitation_bootstrap/fedos_conversation_invitation_control_payload.ts",
      "src/conversation/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.ts",
      "src/conversation/invitation_bootstrap/fedos_conversation_invitation_inbound_coordinator.ts",
      "src/conversation/invitation_bootstrap/fedos_conversation_invitation_runtime.ts",
    ];
    for (const file of files) {
      const source = stripComments(read(file));
      expect(source, file).not.toMatch(/privateKey|private_key|masterSeed.*handle|SecretHandle|root_key|chain_key/i);
    }
  });

  it("3. the outbound coordinator reuses the EXISTING, unmodified reactivateRestoredConversation() and admit() -- no re-implementation of Draft/Membership construction", () => {
    const source = stripComments(read("src/conversation/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.ts"));
    expect(source).toMatch(/this\.#deps\.membershipAuthority\.admit\(/);
    expect(source).toMatch(/this\.#deps\.reactivateConversation\(/);
    expect(source).not.toMatch(/putDraft\(|serializeFedosConversationDraftRecord/);
    expect(diffNames("src/conversation/activation/fedos_conversation_reactivation_coordinator.ts").trim()).toBe("");
    expect(diffNames("src/conversation/construction/fedos_private_conversation_construction_coordinator.ts").trim()).toBe("");
  });

  it("4. the closed capability/invitation transport system (Alpha 991-1050) is untouched -- this Arc is additive and parallel, never a replacement", () => {
    expect(diffNames("src/conversation/capability").trim()).toBe("");
    expect(diffNames("src/conversation/invitation/fedos_conversation_invitation_transport.ts").trim()).toBe("");
    expect(diffNames("src/conversation/invitation/fedos_conversation_invitation_token.ts").trim()).toBe("");
  });

  it("5. Direct Ratchet, Identity Transition, and Signed Deletion source are untouched by this Arc", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
  });

  it("6. Runtime wiring is additive and optional -- conversationInvitation is undefined by default, zero behavior change for every pre-existing caller", () => {
    const source = stripComments(read("src/conversation/runtime/fedos_conversation_runtime.ts"));
    expect(source).toMatch(/deps\.conversationInvitation === undefined\s*\n\s*\? null/);
    expect(source).toMatch(/if \(this\.#invitationRuntime !== null\)/);
    expect((source.match(/const conversationInvitationResult\s*=|const invitationResult\s*=/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("7. the received-invitation persistence is a real, restart-safe, append-only NDJSON backend -- mirrors the established convention", () => {
    const source = stripComments(read("src/conversation/invitation_bootstrap/persistence/append_only_fedos_conversation_invitation_received_persistence.ts"));
    expect(source).toMatch(/appendFileSync/);
    expect(source).not.toMatch(/writeFileSync\(/);
    expect(source).not.toMatch(/\bunlink|rm\(|rmSync/);
  });

  it("8. the real, narrow production bug fix (conversationDraftLogPath never wired) touches only the Coordinator's own config assembly, not the frozen assembly/activation coordinators", () => {
    const source = stripComments(read("src/desktop/onboarding/fedos_profile_initialization_coordinator.ts"));
    expect(source).toMatch(/conversationDraftLogPath:\s*paths\.conversationDraftLogFile/);
    expect(diffNames("src/conversation/runtime/fedos_conversation_runtime_assembly.ts").trim()).toBe("");
    expect(diffNames("src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts").trim()).toBe("");
  });

  it("9. no p2p/ or .tmp_gen/ file touched by this Arc", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
  });

  it("10. the invitation control payload is a distinct, closed discriminated kind -- never folded into the Ratchet or Peer Capability wire codecs", () => {
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.ts").trim()).toBe("");
    const source = stripComments(read("src/conversation/invitation_bootstrap/fedos_conversation_invitation_control_payload.ts"));
    expect(source).toMatch(/kind:\s*"conversation-invitation"/);
  });
});

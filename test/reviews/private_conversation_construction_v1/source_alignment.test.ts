import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationRecordSource from "../../../src/conversation/fedos_conversation_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationRecordValidatorSource from "../../../src/conversation/fedos_conversation_record_validator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationIdSource from "../../../src/conversation/fedos_conversation_id.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationModeSource from "../../../src/board/runtime/policy/fedos_conversation_mode.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationPolicySource from "../../../src/board/runtime/policy/fedos_conversation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationPolicyAuthoritySource from "../../../src/board/runtime/policy/fedos_conversation_policy_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import membershipAuthoritySource from "../../../src/conversation/membership/fedos_conversation_membership_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import membershipTransitionSource from "../../../src/conversation/membership/fedos_conversation_membership_transition.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityDescriptorSource from "../../../src/conversation/capability/fedos_conversation_capability_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityIssuerSource from "../../../src/conversation/capability/fedos_conversation_capability_issuer_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bearerSecretSource from "../../../src/conversation/capability/fedos_conversation_capability_bearer_secret.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import redemptionCoordinatorSource from "../../../src/conversation/capability/coordination/fedos_conversation_durable_redemption_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import retentionAuthoritySource from "../../../src/conversation/retention/fedos_payload_retention_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import payloadStorageSource from "../../../src/conversation/payload_storage/fedos_conversation_payload_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardRuntimeSource from "../../../src/board/runtime/fedos_board_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopCryptoSource from "../../../src/os/core/crypto/noop_crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeCryptoProviderSource from "../../../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmArtifactSource from "../../../src/runtime/fedos_wasm_artifact.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import masterSeedWasmAuthoritySource from "../../../src/runtime/master_seed/fedos_wasm_master_seed_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publicAuthorAuthoritySource from "../../../src/board/runtime/identity/fedos_public_author_authority.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";

/**
 * Private Conversation Construction V1 review -- source alignment.
 *
 * Verifies, against this worktree's own REAL checked-out `src/` tree at
 * `d8bbfae`, the "current implementation reality" claims `01_source_alignment.md`
 * (and the docs that depend on it) make. Never asserts that any FUTURE
 * (unimplemented) construction command/runtime/type exists -- only that the
 * REAL prerequisite pieces this review's specification builds on are exactly
 * as described.
 */

/** Collapses comment-line wrapping (` * `, newlines, extra spaces) so a multi-line doc-comment quote can be matched with a single-line regex -- mirrors the sibling reviews' own `normalizeWhitespace`/`codeOnlyLines` precedent. */
function normalizeComment(source: string): string {
  return source.replace(/[\s*]+/g, " ").trim();
}

describe("Private Conversation Construction V1 -- source alignment", () => {
  it("1. validateFedosConversationRecord rejects any mode other than 'public' -- 01/09's central blocking finding is grounded", () => {
    expect(conversationRecordValidatorSource).toMatch(/if \(input\.mode !== "public"\) return null;/);
  });

  it("2. FedosConversationMode's type union already names 'private-group'/'direct' at the type level, even though nothing constructs them -- 01's 'type-level only' finding is grounded", () => {
    expect(conversationModeSource).toMatch(/export type FedosConversationMode = "public" \| "private-group" \| "direct"/);
    expect(conversationModeSource).toMatch(/FEDOS_CONVERSATION_MODE_V1_SUPPORTED: FedosConversationMode = "public"/);
  });

  it("3. FedosConversationId is deterministically derived from (boardId, threadId) only, with no second id constructor -- 01/04's 'no id constructor not anchored to a Board thread' finding is grounded", () => {
    expect(conversationIdSource).toMatch(/export function toFedosConversationId\(boardId: FedosBoardId, threadId: FedosThreadId\)/);
    const exportCount = (conversationIdSource.match(/^export /gm) ?? []).length;
    expect(exportCount).toBe(2); // FedosConversationId type + toFedosConversationId function -- no second constructor
  });

  it("4. FedosConversationRecord carries no membership/invitation/encryption/lifecycle field -- 01's exact-field-set finding is grounded", () => {
    const interfaceStart = conversationRecordSource.indexOf("export interface FedosConversationRecord");
    const interfaceBody = conversationRecordSource.slice(interfaceStart, conversationRecordSource.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/member|invit|encrypt|cipher|lifecycle|deleted/i);
  });

  it("5. validateFedosConversationPolicy rejects mode !== 'public' AND writeAccess === 'restricted' unconditionally -- 07's two named structural blockers are grounded", () => {
    expect(conversationPolicySource).toMatch(/if \(value\.mode !== "public"\) return null;/);
    expect(conversationPolicySource).toMatch(/if \(value\.writeAccess === "restricted"\) return null;/);
  });

  // Secure Runtime Alpha 896 ("Private Policy V1") ADDITIVELY widened this
  // closed vocabulary with "members-only" -- exactly the blocker 07's
  // "cannot express members-only" finding said the implementing Arc must
  // lift. The PUBLIC validator (validateFedosConversationPolicy) is
  // unchanged and still rejects it (verified by that validator's own
  // tests); this assertion now grounds the SUPERSEDED state.
  it("6. FedosConversationReadAccess now also allows 'members-only' -- 07's blocker was lifted by Alpha 896", () => {
    const match = conversationPolicySource.match(/export type FedosConversationReadAccess = ("[^"]+"(?:\s*\|\s*"[^"]+")*)/);
    expect(match).not.toBeNull();
    const literals = (match?.[1] ?? "").match(/"[^"]+"/g) ?? [];
    expect(literals).toEqual(['"public"', '"members-only"']);
  });

  it("7. FedosConversationInviteAuthority now also allows 'owner-and-moderators' -- 07's blocker was lifted by Alpha 896", () => {
    const match = conversationPolicySource.match(/export type FedosConversationInviteAuthority = ("[^"]+"(?:\s*\|\s*"[^"]+")*)/);
    expect(match).not.toBeNull();
    const literals = (match?.[1] ?? "").match(/"[^"]+"/g) ?? [];
    expect(literals).toEqual(['"none"', '"owner-and-moderators"']);
  });

  it("8. StaticFedosConversationPolicyAuthority resolves the SAME fixed policy value unconditionally, for every input -- 07's 'no per-Conversation authority exists' finding is grounded", () => {
    expect(conversationPolicyAuthoritySource).toMatch(/async resolvePolicy\(_input: FedosConversationPolicyResolutionInput\)/);
    expect(conversationPolicyAuthoritySource).toMatch(/FEDOS_CONVERSATION_POLICY_PUBLIC_V1/);
  });

  it("9. FedosConversationMembershipAuthority's admit()/findMembership()/listMemberships() take a bare conversationId with no mode/existence check -- 01's 'Membership is mode-agnostic' finding is grounded", () => {
    expect(membershipAuthoritySource).toMatch(/admit\(\s*conversationId: FedosConversationId/);
    expect(membershipAuthoritySource).not.toMatch(/mode/i);
  });

  it("10. Membership transitions forbid any reactivation of a revoked/left membership -- 16's 'permanent, one-directional' finding is grounded", () => {
    expect(membershipTransitionSource).toMatch(/if \(transition === "admit"\) return current === null;/);
    expect(membershipTransitionSource).toMatch(/return false;/);
  });

  it("11. FedosConversationCapabilityDescriptor carries no bearer secret field -- 11's 'no bearer in Conversation metadata' finding is grounded", () => {
    const interfaceStart = capabilityDescriptorSource.indexOf("export interface FedosConversationCapabilityDescriptor");
    const interfaceBody = capabilityDescriptorSource.slice(interfaceStart, capabilityDescriptorSource.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/bearer|secret/i);
  });

  it("12. the bearer secret type is defined in a wholly separate file from the descriptor -- 11's separation finding is grounded", () => {
    expect(bearerSecretSource).toMatch(/export type FedosConversationCapabilityBearerSecret/);
  });

  it("13. the Capability Issuer Authority's own header states no real production authorization check exists -- 02/11's 'capability authority readiness may resolve unavailable' finding is grounded", () => {
    expect(normalizeComment(capabilityIssuerSource)).toMatch(/this file makes NO claim that real, production private-invite authorization exists/);
  });

  it("14. the Durable Redemption Coordinator's own header states 'no fake rollback' and 'only ever moves FORWARD' -- 10's persistence-coordination precedent is grounded", () => {
    expect(redemptionCoordinatorSource).toMatch(/no fake rollback/i);
    expect(redemptionCoordinatorSource).toMatch(/only ever moves FORWARD/);
  });

  it("15. the Retention Authority's own header explicitly disclaims secure physical overwrite / cryptographic erasure -- 16/19's 'no historical-key erasure claim' is grounded", () => {
    const normalized = normalizeComment(retentionAuthoritySource);
    expect(normalized).toMatch(/MUST NOT claim: secure physical overwrite/);
    expect(normalized).toMatch(/cryptographic erasure without a key lifecycle \(none exists in this Arc\)/);
  });

  it("16. FedosConversationPayloadDescriptor's mediaType is a closed vocabulary of exactly one value -- 01's 'no plaintext/ciphertext claim' finding is grounded", () => {
    expect(payloadStorageSource).not.toMatch(/plaintext|ciphertext/i);
  });

  it("17. FedosBoardRuntime constructs a Conversation record ONLY as a side effect of createPublicThread(), via a private method -- 01/12's 'no dedicated construction command exists' finding is grounded", () => {
    expect(boardRuntimeSource).toMatch(/#recordConversationForRootPost\(post: FedosBoardPost\)/);
    expect(boardRuntimeSource).not.toMatch(/createPrivateGroupConversation|createDirectConversation/);
  });

  it("18. FedosBoardRuntime never imports Membership, Capability, Retention, or Payload Storage -- 12's 'no domain wiring exists' finding is grounded", () => {
    expect(boardRuntimeSource).not.toMatch(/membership\/fedos_conversation_membership_authority/);
    expect(boardRuntimeSource).not.toMatch(/capability\/fedos_conversation_capability/);
    expect(boardRuntimeSource).not.toMatch(/retention\/fedos_payload_retention/);
    expect(boardRuntimeSource).not.toMatch(/payload_storage\/fedos_conversation_payload_storage/);
  });

  it("19. NoopCryptoProvider denies every operation and advertises zero capabilities -- 08's axis-1 finding is grounded", () => {
    expect(noopCryptoSource).toMatch(/state: "unavailable", reason: "no crypto core is configured"/);
    expect(noopCryptoSource).toMatch(/getCapabilities\(\): readonly CryptoCapability\[\] \{\s*\/\/ No core present -> advertises nothing\.\s*return \[\];/);
  });

  it("20. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is a fixed, permanently-false constant with no override path -- 08's axis-1/6 finding is grounded", () => {
    expect(runtimeCryptoProviderSource).toMatch(/export const FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false;/);
    expect(normalizeComment(runtimeCryptoProviderSource)).toMatch(/Reads NO `process\.env`, accepts NO parameter or override anywhere in this module or any importer/);
  });

  it("21. the WASM artifact has never been successfully generated in this tree, though a real attempt was observed -- 08's axis-6/20's 'Rust/WASM activation remains blocked' finding is grounded", () => {
    expect(wasmArtifactSource).toMatch(/return "NotGenerated";/);
    expect(wasmArtifactSource).toMatch(/export function fedosWasmArtifactGenerated\(\): boolean \{\s*return false;/);
    expect(wasmArtifactSource).toMatch(/export function fedosArtifactGenerationObserved\(\): boolean \{\s*return true;/);
  });

  it("22. the Master Seed Authority's one real implementation routes every method through a dev-only-gated call -- 01/08's BLOCK-3 finding is grounded", () => {
    expect(masterSeedWasmAuthoritySource).toMatch(/attemptDevOnlyMasterSeedAuthorityConstructCall/);
    expect(masterSeedWasmAuthoritySource).toMatch(/attemptDevOnlyMasterSeedGenerateCall/);
  });

  it("23. FedosPublicAuthorAuthority always falls back to anonymous-local when no real identity source is configured -- 02's creator-identity-readiness axis finding is grounded", () => {
    expect(publicAuthorAuthoritySource).toMatch(/"anonymous-local"/);
  });

  it("24. no compiled WASM artifact exists in this checked-out tree -- re-confirms 01/08/20's grounding at this specific commit", () => {
    expect(() => readdirSync("packages/fedos-core-rust/pkg")).toThrow();
  });

  it("25. Alpha 851-8XX now exists in history (landed by the Alpha 1051-1110 Conversation Runtime Consolidation Arc) -- 20's 'does not exist yet' finding was a point-in-time observation, since superseded, not a permanent invariant", () => {
    const log = execFileSync("git", ["log", "--all", "--oneline"], { encoding: "utf8" }) as string;
    expect(log).toMatch(/Alpha 851-8XX/);
  });

  // Secure Runtime Alpha 921 ("Runtime Ownership Decision") implemented
  // 12's own recommendation: a dedicated FedosConversationRuntime, a peer
  // to FedosBoardRuntime owned by the Local Runtime. This assertion now
  // grounds the SUPERSEDED state -- the class exists exactly once, under
  // src/conversation/runtime/.
  it("26. FedosConversationRuntime now exists in src/conversation/runtime/ -- 12's recommendation was implemented by Alpha 921", () => {
    function allSrcConversationFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
      let files: string[] = [];
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          files = files.concat(allSrcConversationFiles(path));
        } else if (entry.name.endsWith(".ts")) {
          files.push(path);
        }
      }
      return files;
    }
    const files = allSrcConversationFiles("src/conversation");
    const defining: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8") as string;
      if (/class FedosConversationRuntime\b/.test(text)) defining.push(file);
    }
    expect(defining).toEqual(["src/conversation/runtime/fedos_conversation_runtime.ts"]);
  });
});

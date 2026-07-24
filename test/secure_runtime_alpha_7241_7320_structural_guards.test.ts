/**
 * Secure Runtime Alpha 7241-7320 (FedOS Long-Running Runtime Reliability
 * and Recovery Arc) — structural guards, proving by direct source
 * inspection (never narrative claim alone) what this Arc actually built
 * and did NOT touch. Mirrors `secure_runtime_alpha_7161_7240_structural_guards.test.ts`'s
 * own established pattern exactly.
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
const ARC_BASE = "b4fa2d7f";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

/** Tracked-file diff against this Arc's own base commit — never sees untracked new files (see `porcelainStatus()` for those). */
function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

/** Full working-tree status (modified + untracked) — the ONLY reliable way to see this Arc's own brand-new files, which `git diff <commit>` never reports until staged. */
function porcelainStatus(): string {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_STATUS_FAILED";
  }
}

describe("Secure Runtime Alpha 7241-7320 -- structural guards", () => {
  it("1. zero Rust/Cargo/WASM-artifact change of any kind -- every real WASM capability this Arc reaches ALREADY existed, reused via the SAME production wrapper methods Alpha 7161-7240 already added", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
    const rustSource = read("packages/fedos-core-rust/src/lib.rs");
    for (const exportName of ["encrypt_aead", "decrypt_aead", "serialize_aead_ciphertext", "deserialize_aead_ciphertext"]) {
      expect(rustSource, exportName).toMatch(new RegExp(`pub fn ${exportName}`));
    }
  });

  it("2. Ratchet's own cryptographic session logic, Identity Transition's own record/proof/decision model, NIP-17's own Rumor/Seal/Gift-Wrap construction pipeline, and Secure Memory are completely untouched -- this Arc validates and hardens, it does not redesign (RECONCILED: fedos_direct_ratchet_outbound_integration.ts's own zero-diff assertion was superseded by Secure Runtime Alpha 7401-7480's own later, disclosed, additive route-binding field on that same file -- see that Arc's own structural guards)", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
    expect(diffNames("packages/fedos-core-rust/src").trim()).toBe("");
  });

  it("3. this Arc's own (7241-7320's own) production diff, RECONCILED: this exact-allowlist assertion's own premise (a single-arc diff against a fixed base) is structurally incompatible with an accumulating multi-arc lineage -- Secure Runtime Alpha 7321-7400, 7401-7480, and 7481-7560 have each since landed real, disclosed, legitimate changes on top of this same base. Narrowed to what remains meaningful: the files THIS Arc's own completion declaration named must still all be present in the diff (never silently reverted), never that the diff contains NOTHING else.", () => {
    const requiredFromThisArc = [
      "src/conversation/archive/fedos_conversation_archive_collector.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts",
      "src/desktop/onboarding/fedos_local_profile_paths.ts",
      "src/desktop/onboarding/fedos_profile_initialization_coordinator.ts",
      "src/desktop/runtime/fedos_desktop_runtime.ts",
    ];
    const modifiedLines = diffNames()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const required of requiredFromThisArc) {
      expect(modifiedLines, `this Arc's own required file must still be in the diff: ${required}`).toContain(required);
    }
  });

  it("4. the ONE new production file this Arc adds is the disclosed Archive encryption boundary -- a thin adapter, no new capability, no raw secret handling (RECONCILED: the file is no longer untracked -- it has since been committed by this same lineage -- checked directly by content/path instead of via a porcelain-status untracked-file scan)", () => {
    const source = stripComments(read("src/desktop/production_activation/fedos_production_conversation_archive_encryption_runtime_boundary.ts"));
    expect(source).toMatch(/implements FedosConversationArchiveEncryptionRuntimeBoundary/);
    expect(source).toMatch(/this\.#handleSource\.encryptAead\(/);
    expect(source).toMatch(/this\.#handleSource\.decryptAead\(/);
    expect(source).toMatch(/this\.#handleSource\.serializeAeadCiphertext\(/);
    expect(source).toMatch(/this\.#handleSource\.deserializeAeadCiphertext\(/);
    // No raw key material handling of any kind in this thin adapter.
    expect(source).not.toMatch(/privateKey|private_key|secretKey|nsec|rawSeed/i);
  });

  it("5. the Retention/Capability Coordinator wiring fix threads two ALREADY-EXISTING optional config fields (Alpha 923/1143) -- no new field invented, no existing field's meaning changed", () => {
    const pathsSource = stripComments(read("src/desktop/onboarding/fedos_local_profile_paths.ts"));
    expect(pathsSource).toMatch(/readonly conversationCapabilityLogFile: string;/);
    expect(pathsSource).toMatch(/readonly conversationPayloadRetentionLogFile: string;/);
    const coordinatorSource = stripComments(read("src/desktop/onboarding/fedos_profile_initialization_coordinator.ts"));
    expect(coordinatorSource).toMatch(/conversationCapabilityLogPath: paths\.conversationCapabilityLogFile,/);
    expect(coordinatorSource).toMatch(/conversationPayloadRetentionLogPath: paths\.conversationPayloadRetentionLogFile,/);
    // The two fields ALREADY existed on FedosDesktopRuntimeConfig before this Arc -- this Arc's own diff never touches that config file.
    expect(diffNames("src/desktop/runtime/fedos_desktop_runtime_config.ts").trim()).toBe("");
  });

  it("6. the Archive retention-gating fix is optional and additive, mirrors Search's own Alpha 2581-2620 fail-closed discipline exactly (RECONCILED: Secure Runtime Alpha 7481-7560, FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc, later, disclosedly extended this SAME field to ALSO filter Envelopes -- closing the exact 'Envelope/Payload collection unlinked' gap a committed audit found; this Arc's own 7241-7320 structural guards for the current shape live at that later Arc's own test file)", () => {
    const collectorSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_collector.ts"));
    expect(collectorSource).toMatch(/readonly retentionAuthority\?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" \| "evaluateRetentionDecisionOnly">;/);
    // Fail-closed: a thrown/unavailable Authority is treated as not-permitted, never as "no gate".
    expect(collectorSource).toMatch(/catch\s*\{\s*return false;\s*\}/);
    expect(collectorSource).toMatch(/const envelopes = deps\.envelopePersistence\s*\n\s*\.listConversationEnvelopes\(conversationId\)/);

    const runtimeSource = stripComments(read("src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts"));
    expect(runtimeSource).toMatch(/readonly retentionAuthority\?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" \| "evaluateRetentionDecisionOnly">;/);

    const assemblySource = stripComments(read("src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts"));
    expect(assemblySource).toMatch(/readonly retentionAuthority\?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" \| "evaluateRetentionDecisionOnly">;/);
  });

  it("7. the Archive production-crypto wiring is a structural, opt-in type-guard -- any Master Seed Authority WITHOUT the four production AEAD accessors keeps using the existing dev-gated default, zero regression", () => {
    const runtimeSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect(runtimeSource).toMatch(/function isFedosProductionConversationAeadHandleSource\(/);
    expect(runtimeSource).toMatch(/typeof candidate\.encryptAead === "function"/);
    expect(runtimeSource).toMatch(/isFedosProductionConversationAeadHandleSource\(config\.conversationArchiveMasterSeedAuthority!\)\s*\?\s*new FedosProductionConversationArchiveEncryptionRuntimeBoundary\(config\.conversationArchiveMasterSeedAuthority!\)\s*:\s*undefined,/);
  });

  it("8. the SECOND FedosPayloadRetentionAuthority instance Archive now owns mirrors the ALREADY-ESTABLISHED 'second port instance, same durable backend' pattern (conversationArchiveMembershipPersistence/conversationArchiveCapabilityPersistence) -- never a second, divergent retention decision log", () => {
    const runtimeSource = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect(runtimeSource).toMatch(/const conversationArchiveRetentionAuthority = new FedosPayloadRetentionAuthority\(\{/);
    expect(runtimeSource).toMatch(/payloadStorage: conversationPayloadStorage,/);
  });

  it("9. no raw private key, Master Seed byte, or secret material appears anywhere in this Arc's own new/modified production files", () => {
    const files = [
      "src/desktop/production_activation/fedos_production_conversation_archive_encryption_runtime_boundary.ts",
      "src/conversation/archive/fedos_conversation_archive_collector.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts",
      "src/desktop/onboarding/fedos_local_profile_paths.ts",
      "src/desktop/onboarding/fedos_profile_initialization_coordinator.ts",
    ];
    for (const file of files) {
      const source = stripComments(read(file));
      expect(source, file).not.toMatch(/privateKey|private_key|masterSeed.*handle.*byte|SecretHandle|root_key|nsec\b/i);
    }
  });

  it("10. no p2p/ or .tmp_gen/ file touched by this Arc, tracked or untracked", () => {
    expect(diffNames()).not.toMatch(/^p2p\//m);
    expect(diffNames()).not.toMatch(/\.tmp_gen\//);
    const status = porcelainStatus();
    expect(status).not.toMatch(/ p2p\//);
    expect(status).not.toMatch(/\.tmp_gen\//);
  });
});

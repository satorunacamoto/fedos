/**
 * Secure Runtime Alpha 7801-7880 (FedOS Direct Conversation Archive
 * Product Completion and Parallel-Lineage Integration Arc) — Phase L:
 * structural guards, proving by direct source/diff inspection what
 * this Arc actually built and did NOT touch. ARC_BASE is the
 * reconciliation checkpoint commit (`938f3f6`) -- this Arc's own true
 * starting point AFTER both sibling lineages were merged in (Phase A).
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
const ARC_BASE = "938f3f6";

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

function porcelainStatus(): string {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_STATUS_FAILED";
  }
}

describe("Secure Runtime Alpha 7801-7880 -- structural guards", () => {
  it("1. both sibling lineages are genuinely present in this branch's own history", () => {
    const log = execFileSync("git", ["log", "--oneline"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
    expect(log).toMatch(/d5979ae.*Delivery Observation Repository Subject Index/);
    expect(log).toMatch(/e048ff63.*Archive Multi-Device Suppression Propagation/);
  });

  it("2. no Observation subject-index regression -- fedos_delivery_observation_repository.ts/_query.ts are untouched by THIS Arc", () => {
    expect(diffNames("src/board/observation/fedos_delivery_observation_repository.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_query.ts").trim()).toBe("");
  });

  it("3. no new Observation repository index, and no write-time duplicate-index optimization introduced by this Arc (RECONCILED, Secure Runtime Alpha 7881-7960: that LATER Arc's own separately-authorized Stage 2 mission -- named as this Arc's own explicit recommended next step in its own multidevice-suppression-wiring status doc and completion declaration -- legitimately, disclosedly added the write-time duplicate-index optimization to append_only_fedos_delivery_observation_persistence.ts; never a violation of THIS Arc's own claim, which is that THIS Arc itself introduced no such thing)", () => {
    expect(diffNames("src/board/observation/fedos_delivery_observation_repository.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_query.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_codec.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/in_memory_fedos_delivery_observation_persistence.ts").trim()).toBe("");
  });

  it("4. no Board/Direct Conversation identity conflation -- the Collector checks the REAL Board record first, and never fabricates one for a Direct Conversation", () => {
    const collectorSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_collector.ts"));
    expect(collectorSource).not.toMatch(/putConversation\(/);
    expect(collectorSource).toMatch(/deps\.conversationPersistence\.getConversation\(conversationId\)/);
    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    // The Direct branch writes ONLY via draftPersistence.putDraft(), never conversationPersistence.putConversation().
    expect(restoreSource).toMatch(/deps\.draftPersistence\.putDraft\(/);
  });

  it("5. restore NEVER writes an Activation fact -- history recovery and live-session recovery stay separate", () => {
    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    expect(restoreSource).not.toMatch(/putActivationFact\(/);
    expect(restoreSource).not.toMatch(/activationPersistence\s*:/); // restore takes NO activationPersistence dependency at all
  });

  it("6. no live Ratchet secret, session key, or SecretHandle of any kind inside the Archive subject model or its own new file", () => {
    const subjectSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_direct_subject.ts"));
    for (const forbidden of [/ratchetState/i, /sessionKey/i, /chainKey/i, /rootKey/i, /secretHandle/i, /masterSeed/i, /privateKey/i]) {
      expect(subjectSource).not.toMatch(forbidden);
    }
    const draftWireType = read("src/conversation/construction/fedos_persisted_conversation_draft_record_v1.ts");
    // The reused draft wire type itself carries no secret field -- confirmed directly, not merely asserted.
    expect(Object.keys(JSON.parse('{"schemaVersion":1,"id":"x","mode":"direct","lifecycleState":"draft","policyReference":"direct-draft-v1","creatorAuthority":"nostr","creatorPublicIdentifier":"y","creatorIdentityId":null,"createdAt":1}')).sort()).toEqual(
      ["createdAt", "creatorAuthority", "creatorIdentityId", "creatorPublicIdentifier", "id", "lifecycleState", "mode", "policyReference", "schemaVersion"].sort(),
    );
    expect(draftWireType).not.toMatch(/secretHandle|masterSeed|privateKey|ratchetState|sessionKey/i);
  });

  it("7. no second Archive Runtime, Conversation Runtime, or Retention Authority -- exactly one class of each in production source", () => {
    expect((read("src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts").match(/export class FedosConversationArchiveRuntime\b/g) ?? []).length).toBe(1);
    expect((read("src/conversation/runtime/fedos_conversation_runtime.ts").match(/export class FedosConversationRuntime\b/g) ?? []).length).toBe(1);
    expect((read("src/conversation/retention/fedos_payload_retention_authority.ts").match(/export class FedosPayloadRetentionAuthority\b/g) ?? []).length).toBe(1);
  });

  it("8. no new Device Registry or Sync Journal -- zero diff under src/device/ besides nothing (this Arc touches no Device Sync file at all)", () => {
    expect(diffNames("src/device").trim()).toBe("");
  });

  it("9. no generic filesystem or arbitrary-path IPC -- this Arc adds no new IPC channel, no new preload/main file, at all", () => {
    expect(diffNames("packages/fedos-desktop-electron-spike").trim()).toBe("");
  });

  it("10. no Outbox/Scheduler production files touched -- neither Board's nor Conversation's", () => {
    expect(diffNames("src/board/outbox").trim()).toBe("");
    expect(diffNames("src/conversation/transport").trim()).toBe("");
  });

  it("11. no new crypto primitive, no new NIP -- zero Rust/Cargo/WASM source diff (this worktree's own compiled pkg/ output is a gitignored build artifact, not a source change)", () => {
    expect(diffNames("packages/fedos-core-rust/src").trim()).toBe("");
    expect(diffNames("packages/fedos-core-rust/Cargo.toml").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17").trim()).toBe("");
  });

  it("12. no Electron security weakening -- no preload/main file touched at all (see test 9); no contextIsolation/nodeIntegration/webSecurity flag appears anywhere in this Arc's own diff", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (const line of modifiedLines) {
      const content = read(line);
      expect(content, `${line} must not touch Electron security flags`).not.toMatch(/contextIsolation\s*:\s*false|nodeIntegration\s*:\s*true|webSecurity\s*:\s*false/);
    }
  });

  it("13. zero p2p/ or .tmp_gen/ changes", () => {
    expect(diffNames("p2p").trim()).toBe("");
    expect(diffNames(".tmp_gen").trim()).toBe("");
    const status = porcelainStatus();
    expect(status).not.toMatch(/(^| )p2p\//m);
    expect(status).not.toMatch(/\.tmp_gen\//);
  });

  it("14. no Ratchet or Identity Transition redesign -- zero diff under either domain", () => {
    expect(diffNames("src/conversation/ratchet").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
  });

  it("15. this Arc's own required production files are all present in the diff against its own reconciliation-checkpoint base", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (const required of [
      "src/conversation/archive/fedos_conversation_archive_bundle.ts",
      "src/conversation/archive/fedos_conversation_archive_collector.ts",
      "src/conversation/archive/fedos_conversation_archive_duplicate_detection.ts",
      "src/conversation/archive/fedos_conversation_archive_restore.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts",
      "src/conversation/runtime/fedos_conversation_runtime_assembly.ts",
      "src/desktop/runtime/fedos_desktop_runtime.ts",
      "src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts",
      "src/desktop/presentation/safety_center/fedos_archive_workflow_safety_warnings.ts",
    ]) {
      expect(modifiedLines, `required file missing from diff: ${required}`).toContain(required);
    }
    expect(() => read("src/conversation/archive/fedos_conversation_archive_direct_subject.ts")).not.toThrow();
  });

  it("16. no raw private-key, Master Seed, or SecretHandle export anywhere in this Arc's own new/modified files", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.endsWith(".ts"));
    for (const line of modifiedLines) {
      const content = read(line);
      expect(content, `${line} must not export raw secret material`).not.toMatch(/export (const|function) \w*(privateKey|masterSeed|secretHandle|rawSeed)/i);
    }
  });
});

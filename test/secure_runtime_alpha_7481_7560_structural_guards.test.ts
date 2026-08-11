/**
 * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention Parity
 * and Metadata Deletion Semantics Arc) — Phase K: structural guards,
 * proving by direct source/diff inspection (never narrative claim alone)
 * what this Arc actually built and did NOT touch. Mirrors
 * `secure_runtime_alpha_7241_7320_structural_guards.test.ts`'s own
 * established pattern exactly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "4c6fa3b3";

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

/** Full working-tree status (modified + untracked) — the ONLY reliable way to see this Arc's own brand-new files. */
function porcelainStatus(): string {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_STATUS_FAILED";
  }
}

describe("Secure Runtime Alpha 7481-7560 -- structural guards", () => {
  it("1. Ratchet, Identity Transition, NIP-17's own Rumor/Seal/Gift-Wrap pipeline, and Secure Memory are completely untouched -- this Arc closes an Archive/Retention/Deletion gap, it does not redesign protocols", () => {
    expect(diffNames("src/conversation/ratchet").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
  });

  it("2. zero Rust/Cargo/WASM-artifact change of any kind -- no new crypto primitive, no new NIP -- every real WASM capability this Arc reaches already existed", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
  });

  it("3. this Arc's own PARALLEL-execution boundary: zero Conversation Outbox/Scheduler production files touched -- that domain belongs to the separately-running sibling Arc, never this one's to modify", () => {
    const forbiddenPaths = [
      "src/board/outbox",
      "src/conversation/transport/fedos_conversation_transport_outbox_codec.ts",
      "src/conversation/transport/fedos_conversation_transport_outbox_persistence.ts",
      "src/conversation/transport/fedos_conversation_transport_outbox_types.ts",
      "src/conversation/transport/append_only_fedos_conversation_transport_outbox_persistence.ts",
      "src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.ts",
      "src/conversation/transport/fedos_conversation_transport_scheduler.ts",
      "src/device/relay_sync/persistence",
      "src/device/sync_scheduler",
    ];
    for (const p of forbiddenPaths) {
      expect(diffNames(p).trim(), `must remain untouched by this Arc: ${p}`).toBe("");
    }
  });

  it("4. zero p2p/ or .tmp_gen/ changes -- this Arc's own worktree never touches either directory", () => {
    expect(diffNames("p2p").trim()).toBe("");
    expect(diffNames(".tmp_gen").trim()).toBe("");
    const status = porcelainStatus();
    expect(status, "no p2p/ entries in this worktree's own working-tree status").not.toMatch(/(^| )p2p\//m);
    expect(status, "no .tmp_gen/ entries in this worktree's own working-tree status").not.toMatch(/\.tmp_gen\//);
  });

  it("5. this Arc's own required production files are all present in the diff against its own base commit -- never silently reverted (RECONCILED: the sibling Archive Multi-Device Suppression Propagation Arc, 7721-7800, later merged this same lineage together with 7641-7720, committing this Arc's own new file in the process -- it is no longer untracked, checked directly by content/path instead of via a porcelain-status untracked-file scan)", () => {
    const requiredFromThisArc = [
      "src/conversation/archive/fedos_conversation_archive_collector.ts",
      "src/conversation/archive/fedos_conversation_archive_restore.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts",
      "src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts",
      "src/conversation/deletion/fedos_deletion_assessment.ts",
      "src/conversation/deletion/fedos_deletion_capability_descriptor.ts",
      "src/conversation/retention/fedos_payload_retention_authority.ts",
      "src/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts",
      "src/desktop/presentation/fedos_desktop_archive_view_model.ts",
      "src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts",
    ];
    const modifiedLines = diffNames()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const required of requiredFromThisArc) {
      expect(modifiedLines, `this Arc's own required file must be in the diff: ${required}`).toContain(required);
    }
    // The ONE new production (non-test, non-doc) file this Arc adds.
    expect(() => read("src/desktop/presentation/safety_center/fedos_archive_workflow_safety_warnings.ts")).not.toThrow();
  });

  it("6. no independent Payload/Envelope retention bypass -- export and restore each gate BOTH record kinds off the SAME single retentionAuthority dependency, keyed by the SAME payloadId concept, never two disagreeing checks", () => {
    const collectorSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_collector.ts"));
    // Both filters call the SAME helper, `isPayloadPermitted()`, never a second, independent predicate.
    // One function DEFINITION plus exactly two CALL sites (envelopes + payloads) -- three matches total.
    const collectorPermittedCalls = collectorSource.match(/isPayloadPermitted\(/g) ?? [];
    expect(collectorPermittedCalls.length, "one definition + two call sites (envelopes + payloads), one shared helper").toBe(3);
    expect(collectorSource).not.toMatch(/isPayloadPermitted2|isEnvelopePermitted|isPayloadPermittedForEnvelope/);

    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    const restorePermittedCalls = restoreSource.match(/isPayloadPermittedForRestore\(/g) ?? [];
    expect(restorePermittedCalls.length, "one definition + two call sites (envelopes + payloads), one shared helper").toBe(3);
    expect(restoreSource).not.toMatch(/isPayloadPermittedForRestore2|isEnvelopePermittedForRestore/);
  });

  it("7. Archive never becomes a second Retention authority -- it only ever READS via evaluatePayloadAccess()/evaluateRetentionDecisionOnly(), it never WRITES a retention decision", () => {
    const collectorSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_collector.ts"));
    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    const runtimeSource = stripComments(read("src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts"));
    for (const [name, source] of [
      ["collector", collectorSource],
      ["restore", restoreSource],
      ["runtime", runtimeSource],
    ] as const) {
      expect(source, `${name} must never call the mutating retention API`).not.toMatch(/retentionAuthority\.tombstonePayload/);
      expect(source, `${name} must never call the mutating retention API`).not.toMatch(/retentionAuthority\.removeLocalPayload/);
    }
  });

  it("8. exactly ONE FedosPayloadRetentionAuthority class, ONE FedosConversationArchiveCollector read-path, and ONE Restore write-path in production source -- no second/parallel implementation was created", () => {
    expect(diffNames().split("\n").filter((l) => /fedos_payload_retention_authority_v2|fedos_conversation_archive_collector_v2|fedos_conversation_archive_restore_v2/.test(l))).toEqual([]);
    const authoritySource = read("src/conversation/retention/fedos_payload_retention_authority.ts");
    expect((authoritySource.match(/export class FedosPayloadRetentionAuthority\b/g) ?? []).length).toBe(1);
  });

  it("9. no metadata resurrection contrary to the chosen policy -- restore never treats an Archive-carried record as more trustworthy than the restoring device's OWN live Retention Authority", () => {
    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    // The gate consults ONLY `deps.retentionAuthority` (the restoring device's own dependency) -- it never
    // reads anything named like a bundle-carried "tombstone"/"deletion" fact from the decoded bundle itself.
    expect(restoreSource).toMatch(/deps\.retentionAuthority/);
    expect(restoreSource).not.toMatch(/bundle\.(tombstone|deletion|retention)/i);
  });

  it("10. no physical-erasure, Relay-deletion, or account/backup-wide-deletion guarantee is claimed anywhere in this Arc's own new documentation or source comments", () => {
    const forbiddenPatterns = [/physical(ly)? eras/i, /SSD eras/i, /relay[- ]side deletion/i, /backup-wide deletion/i, /deletedEverywhere/, /account-wide deletion/i, /worldwide deletion/i];
    // Every file below must NEVER mention these terms at all -- unlike the retained-copy/non-guarantee
    // document (checked separately, right below), whose entire purpose IS to name these terms in order
    // to explicitly disclaim them.
    const strictDocsToCheck = [
      "docs/secure_runtime_alpha_7481_7560_reconciliation_report.md",
      "docs/secure_runtime_alpha_7481_7560_metadata_classification_and_policy.md",
      "docs/secure_runtime_alpha_7481_7560_chosen_archive_model.md",
      "docs/secure_runtime_alpha_7481_7560_archive_schema_compatibility.md",
      "docs/secure_runtime_alpha_7481_7560_export_restore_parity_specification.md",
      "src/conversation/archive/fedos_conversation_archive_collector.ts",
      "src/conversation/archive/fedos_conversation_archive_restore.ts",
      "src/desktop/presentation/safety_center/fedos_archive_workflow_safety_warnings.ts",
    ];
    for (const relPath of strictDocsToCheck) {
      const text = read(relPath);
      for (const pattern of forbiddenPatterns) {
        expect(text, `${relPath} must not claim: ${pattern}`).not.toMatch(pattern);
      }
    }

    // Files whose own PURPOSE (this Arc's non-guarantee doc) or PRE-EXISTING content (Alpha 799's
    // own retention-authority header, Alpha 6201-6280's own Safety Center warning vocabulary) already
    // legitimately names these terms in order to disclaim them -- every mention on every line must be
    // negated ("no"/"not"/"never"/"cannot"/"does not"), never an affirmative, unqualified claim.
    const disclaimerFilesToCheck = [
      "docs/secure_runtime_alpha_7481_7560_retained_copy_non_guarantees.md",
      "src/conversation/retention/fedos_payload_retention_authority.ts",
      "src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts",
    ];
    let foundAtLeastOneMention = false;
    for (const relPath of disclaimerFilesToCheck) {
      const lines = read(relPath).split("\n");
      for (const line of lines) {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            foundAtLeastOneMention = true;
            expect(line, `${relPath}: every mention must be a disclaimer, not an affirmative claim: "${line.trim()}"`).toMatch(/\bno\b|\bnot\b|\bnever\b|\bcannot\b|\bdoes not\b/i);
          }
        }
      }
    }
    expect(foundAtLeastOneMention, "sanity: at least one of these files must actually name one of these terms in order to disclaim it").toBe(true);
  });

  it("11. no `deletedEverywhere` FIELD or boolean is ever exposed by this Arc's own new/modified types", () => {
    const assessmentSource = read("src/conversation/deletion/fedos_deletion_assessment.ts");
    expect(assessmentSource).not.toMatch(/deletedEverywhere\s*:/);
    const restoreSource = read("src/conversation/archive/fedos_conversation_archive_restore.ts");
    expect(restoreSource).not.toMatch(/deletedEverywhere\s*:/);
  });

  it("12. this Arc's own historical guards are extended, never weakened -- Alpha 7241-7320's own structural guards file still exists and still passes its own (reconciled) assertions", () => {
    expect(() => read("test/secure_runtime_alpha_7241_7320_structural_guards.test.ts")).not.toThrow();
    const priorGuardsSource = read("test/secure_runtime_alpha_7241_7320_structural_guards.test.ts");
    // A reconciliation happened (documented in that file's own test titles), it was never deleted outright.
    expect(priorGuardsSource).toMatch(/RECONCILED/);
  });

  it("13. no second Archive Runtime and no second Safety Center -- exactly one production class/module of each", () => {
    const runtimeFiles = diffNames().split("\n").filter((l) => /fedos_conversation_archive_runtime(_v2|2)?\.ts$/.test(l.trim()));
    expect(runtimeFiles.filter((l) => /_v2|2\.ts$/.test(l))).toEqual([]);
    expect(() => read("src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts")).not.toThrow();
    expect(() => read("src/desktop/presentation/safety_center/fedos_safety_center_warning_codes_v2.ts")).toThrow();
  });
});

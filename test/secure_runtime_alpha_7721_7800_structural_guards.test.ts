/**
 * Secure Runtime Alpha 7721-7800 (FedOS Archive Multi-Device Suppression
 * Propagation Arc) — Phase N: structural guards, proving by direct
 * source/diff inspection (never narrative claim alone) what this Arc
 * actually built and did NOT touch. Mirrors
 * `secure_runtime_alpha_7481_7560_structural_guards.test.ts`'s own
 * established pattern exactly.
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
const ARC_BASE = "feff676";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

/** Tracked-file diff against this Arc's own base commit -- never sees untracked new files (see `porcelainStatus()` for those). */
function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

/** Full working-tree status (modified + untracked) -- the ONLY reliable way to see this Arc's own brand-new files. */
function porcelainStatus(): string {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_STATUS_FAILED";
  }
}

describe("Secure Runtime Alpha 7721-7800 -- structural guards", () => {
  it("1. Ratchet, Identity Transition, Signed Deletion Request/Acknowledgement, Delivery Observation indexing, and NIP-17's own Rumor/Seal/Gift-Wrap pipeline are completely untouched -- this Arc adds a new, additive suppression-propagation domain, it does not redesign any existing protocol", () => {
    expect(diffNames("src/conversation/ratchet").trim()).toBe("");
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
    expect(diffNames("src/conversation/deletion").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation_repository.ts").trim()).toBe("");
    expect(diffNames("src/board/observation/fedos_delivery_observation.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts").trim()).toBe("");
  });

  it("2. zero Rust/Cargo/WASM-artifact change of any kind -- no new crypto primitive, no new NIP -- every real cryptographic capability this Arc reaches (BIP-340 Schnorr signing) already existed", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
  });

  it("3. this Arc's own PARALLEL-execution boundary: zero Delivery Observation Repository indexing/query, Board/Conversation Outbox Scheduler, or Outbox retry/index production files touched -- that domain belongs to the separately-running sibling Arc (Delivery Observation Repository Subject Index and Query Scalability), never this one's to modify", () => {
    const forbiddenPaths = [
      "src/board/outbox",
      "src/conversation/transport/fedos_conversation_transport_outbox_codec.ts",
      "src/conversation/transport/fedos_conversation_transport_outbox_persistence.ts",
      "src/conversation/transport/fedos_conversation_transport_outbox_types.ts",
      "src/conversation/transport/append_only_fedos_conversation_transport_outbox_persistence.ts",
      "src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.ts",
      "src/conversation/transport/fedos_conversation_transport_scheduler.ts",
      "src/board/observation/fedos_delivery_observation_repository.ts",
      "src/board/observation/fedos_delivery_observation.ts",
      "src/board/observation/in_memory_fedos_delivery_observation_persistence.ts",
      "src/board/observation/append_only_fedos_delivery_observation_persistence.ts",
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

  it("5. this Arc's own required production files are all present -- either in the diff against its own base commit (modified) or in the working-tree status (brand new) -- never silently reverted", () => {
    const modifiedRequired = [
      "src/conversation/archive/fedos_conversation_archive_restore.ts",
      "src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts",
    ];
    const modifiedLines = diffNames()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const required of modifiedRequired) {
      expect(modifiedLines, `this Arc's own required modified file must be in the diff: ${required}`).toContain(required);
    }

    const newRequired = [
      "src/conversation/retention/fedos_archive_suppression_fact.ts",
      "src/conversation/retention/fedos_archive_suppression_fact_signing.ts",
      "src/conversation/retention/fedos_persisted_archive_suppression_observation_v1.ts",
      "src/conversation/retention/fedos_archive_suppression_observation_persistence.ts",
      "src/conversation/retention/in_memory_fedos_archive_suppression_observation_persistence.ts",
      "src/conversation/retention/append_only_fedos_archive_suppression_observation_persistence.ts",
      "src/conversation/retention/fedos_archive_suppression_observation_authority.ts",
      "src/conversation/retention/fedos_archive_suppression_local_bridge.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_wire_payload.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_event.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_status_aggregation.ts",
      "src/device/archive_suppression_sync/persistence/fedos_archive_suppression_inbound_dedup_persistence.ts",
      "src/device/archive_suppression_sync/persistence/append_only_fedos_archive_suppression_inbound_dedup_persistence.ts",
    ];
    const status = porcelainStatus();
    for (const required of newRequired) {
      // `git status --porcelain` collapses an ENTIRELY-untracked directory into one `?? dir/` line
      // rather than listing every file beneath it individually -- so a file's own exact line, OR
      // an untracked-directory line that is a real prefix of its path, both count as "present."
      // `read()` (which throws if the file is missing) is the final, unambiguous existence proof.
      const exactLineMatches = new RegExp(`\\?\\? ${required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(status);
      const parentDirLineMatches = status
        .split("\n")
        .some((line) => line.startsWith("?? ") && line.slice(3).trim().endsWith("/") && required.startsWith(line.slice(3).trim()));
      expect(exactLineMatches || parentDirLineMatches, `this Arc's own required NEW file must appear in working-tree status (directly or via its untracked parent directory): ${required}`).toBe(true);
      expect(() => read(required), `this Arc's own required NEW file must actually exist on disk: ${required}`).not.toThrow();
    }
  });

  it("6. no independent Archive restore bypass -- both the Envelope and the Payload restore loop gate off the SAME single shared helper, and that helper consults suppression via exactly ONE new optional dependency, never two disagreeing checks", () => {
    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    const permittedCalls = restoreSource.match(/isPayloadPermittedForRestore\(/g) ?? [];
    expect(permittedCalls.length, "one definition + two call sites (envelopes + payloads), one shared helper").toBe(3);
    expect(restoreSource).not.toMatch(/isPayloadPermittedForRestore2|isEnvelopePermittedForRestore/);
    // The suppression gate is OPTIONAL and ADDITIVE -- feff676's own retentionAuthority gate is untouched.
    expect(restoreSource).toMatch(/suppressionAuthority\?/);
    expect(restoreSource).toMatch(/deps\.retentionAuthority/);
  });

  it("7. Archive restore's own suppression gate only ever READS via evaluateSuppression() -- it never WRITES a suppression fact, and it never deletes/mutates local data itself", () => {
    const restoreSource = stripComments(read("src/conversation/archive/fedos_conversation_archive_restore.ts"));
    expect(restoreSource).not.toMatch(/suppressionAuthority\.recordSelfSuppression/);
    expect(restoreSource).not.toMatch(/suppressionAuthority\.recordImportedSuppression/);
    const inboundSource = stripComments(read("src/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts"));
    // The Inbound Handler's ONLY effect is a new, additive row in the Suppression Observation log --
    // it must never call payloadStorage/envelopePersistence/searchIndex directly.
    expect(inboundSource).not.toMatch(/payloadStorage\./);
    expect(inboundSource).not.toMatch(/envelopePersistence\./);
    expect(inboundSource).not.toMatch(/searchIndex\./);
  });

  it("8. exactly ONE FedosArchiveSuppressionObservationAuthority class, ONE Outbound Coordinator, and ONE Inbound Handler in production source -- no second/parallel implementation was created", () => {
    const status = porcelainStatus();
    expect(status).not.toMatch(/archive_suppression.*_v2|archive_suppression.*2\.ts/);
    const authoritySource = read("src/conversation/retention/fedos_archive_suppression_observation_authority.ts");
    expect((authoritySource.match(/export class FedosArchiveSuppressionObservationAuthority\b/g) ?? []).length).toBe(1);
    const outboundSource = read("src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts");
    expect((outboundSource.match(/export class FedosArchiveSuppressionOutboundCoordinator\b/g) ?? []).length).toBe(1);
    const inboundSource = read("src/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts");
    expect((inboundSource.match(/export class FedosArchiveSuppressionInboundHandler\b/g) ?? []).length).toBe(1);
  });

  it("9. no new Device Registry, no new Sync Journal, no new public NIP, no new general-purpose Device Sync protocol -- the Outbound Coordinator reuses the EXISTING, UNMODIFIED FedosDeviceRegistryPersistence and FedosDeviceRelaySyncPublisher directly, and the wire event stays a proprietary kind:1 route under a NEW marker tag, never a new NIP", () => {
    expect(diffNames("src/device/persistence/fedos_device_registry_persistence.ts").trim()).toBe("");
    expect(diffNames("src/device/persistence/in_memory_fedos_device_registry_persistence.ts").trim()).toBe("");
    expect(diffNames("src/conversation/fedos_sync_journal.ts").trim()).toBe("");
    expect(diffNames("src/device/relay_sync/fedos_device_relay_sync_publisher.ts").trim()).toBe("");
    expect(diffNames("src/device/relay_sync/fedos_device_relay_sync_inbound_handler.ts").trim()).toBe("");

    const outboundSource = stripComments(read("src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts"));
    expect(outboundSource).toMatch(/import\s*\{\s*FedosDeviceRelaySyncPublisher/);
    expect(outboundSource).not.toMatch(/class\s+FedosDeviceRelaySyncPublisher/);

    const eventSource = read("src/device/archive_suppression_sync/fedos_archive_suppression_event.ts");
    expect(eventSource).toMatch(/FIXED_NOSTR_KIND = 1/);
    // `kind` is always the fixed literal `FIXED_NOSTR_KIND` (=== 1) -- never a second, distinct numeric kind.
    expect((eventSource.match(/kind:\s*FIXED_NOSTR_KIND/g) ?? []).length).toBeGreaterThan(0);
    expect(eventSource).not.toMatch(/kind:\s*[02-9]/);
  });

  it("10. no message plaintext, no raw sender/recipient display metadata, no Master Seed, no private key/SecretHandle, no Ratchet/session-secret, and no Archive binary transfer anywhere in this Arc's own new wire/fact types", () => {
    const filesToCheck = [
      "src/conversation/retention/fedos_archive_suppression_fact.ts",
      "src/conversation/retention/fedos_archive_suppression_fact_signing.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_wire_payload.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_event.ts",
    ];
    const forbiddenFieldPatterns = [
      /plaintext\s*:/i,
      /ciphertext\s*:/i,
      /masterSeed/i,
      /privateKey\s*:/i,
      /secretHandle/i,
      /ratchetState/i,
      /sessionKey\s*:/i,
      /archiveBytes\s*:/i,
      /bytesBase64\s*:/i,
    ];
    for (const relPath of filesToCheck) {
      const text = read(relPath);
      for (const pattern of forbiddenFieldPatterns) {
        expect(text, `${relPath} must not carry: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("11. no global/physical/relay-side/backup-wide deletion guarantee is claimed anywhere in this Arc's own new documentation or source comments", () => {
    const forbiddenPatterns = [/physical(ly)? eras/i, /SSD eras/i, /relay[- ]side deletion/i, /backup-wide deletion/i, /deletedEverywhere/, /account-wide deletion/i, /worldwide deletion/i, /global(ly)? erase/i, /guarantee(s|d)? (that )?(all|every) [Dd]evice/];
    // Files whose own PURPOSE never needs to name these terms at all.
    const strictFilesToCheck = [
      "docs/secure_runtime_alpha_7721_7800_reconciliation_report.md",
      "docs/secure_runtime_alpha_7721_7800_threat_and_trust_model.md",
      "src/conversation/retention/fedos_archive_suppression_observation_authority.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_status_aggregation.ts",
    ];
    for (const relPath of strictFilesToCheck) {
      const text = read(relPath);
      for (const pattern of forbiddenPatterns) {
        expect(text, `${relPath} must not claim: ${pattern}`).not.toMatch(pattern);
      }
    }

    // `fedos_archive_suppression_fact.ts`'s own header legitimately names "physically erased" -- but
    // only ever to DISCLAIM it ("never a claim... Device physically erased anything"). Every mention
    // on every line must be negated, never an affirmative, unqualified claim.
    const disclaimerFilesToCheck = ["src/conversation/retention/fedos_archive_suppression_fact.ts"];
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

  it("12. every mention of a forbidden-sounding term inside this Arc's own Safety Center warning additions is a disclaimer (negated), never an affirmative claim", () => {
    const forbiddenPatterns = [/all devices/i, /every device/i, /deletion acknowledgement/i];
    const text = read("src/desktop/presentation/safety_center/fedos_safety_center_warning_codes.ts");
    const newWarningLines = text.split("\n").filter((line) =>
      /archive-suppression-sync-does-not-guarantee-all-devices-informed|archive-suppression-sync-is-not-recipient-deletion-acknowledgement|archive-suppression-requires-local-receipt-to-take-effect/.test(line),
    );
    expect(newWarningLines.length, "sanity: this Arc's own three new warning codes must actually be present").toBeGreaterThan(0);
    let foundAtLeastOneMention = false;
    for (const line of newWarningLines) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(line)) {
          foundAtLeastOneMention = true;
          expect(line, `every mention must be a disclaimer, not an affirmative claim: "${line.trim()}"`).toMatch(/\bnot\b|\bnever\b|\bdoes not\b|\bno\b/i);
        }
      }
    }
    expect(foundAtLeastOneMention, "sanity: at least one new warning line must actually name one of these terms in order to disclaim it").toBe(true);
  });

  it("13. this Arc's own historical structural guards are extended, never weakened -- Alpha 7481-7560's own structural guards file still exists and is untouched by this Arc", () => {
    expect(() => read("test/secure_runtime_alpha_7481_7560_structural_guards.test.ts")).not.toThrow();
    expect(diffNames("test/secure_runtime_alpha_7481_7560_structural_guards.test.ts").trim()).toBe("");
  });

  it("14. the Signed Deletion Acknowledgement Inbound Coordinator never imports or references this Arc's own Suppression types -- proven directly from source, not merely from Phase L's own behavioral test", () => {
    const ackInboundSource = stripComments(read("src/conversation/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.ts"));
    expect(ackInboundSource).not.toMatch(/ArchiveSuppression/);
    expect(ackInboundSource).not.toMatch(/archive_suppression/);
  });

  it("15. no automatic Signed Deletion approval was added -- the Deletion Request inbound approval surface (`executeApprovedLocalDeletion`) is completely untouched by this Arc", () => {
    expect(diffNames("src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.ts").trim()).toBe("");
  });
});

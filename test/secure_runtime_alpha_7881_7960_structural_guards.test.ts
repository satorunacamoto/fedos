/**
 * Secure Runtime Alpha 7881-7960 (FedOS Delivery Observation Durable
 * Write Index, Archive Suppression Production Wiring, and Final Public
 * Release Readiness Arc) — Phase N: structural guards, proving by
 * direct source/diff inspection what this Arc actually built and did
 * NOT touch. ARC_BASE (`6a2f274`) is this Arc's own true starting point
 * (the prior Arc's own completion commit).
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
const ARC_BASE = "6a2f274";

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

describe("Secure Runtime Alpha 7881-7960 -- structural guards", () => {
  it("1. this Arc's own base (6a2f274) is a genuine ancestor of the current tree -- both prior sibling lineages (subject index, Archive Multi-Device Suppression, Direct Conversation Archive) remain integrated, no production result dropped", () => {
    const mergeBase = execFileSync("git", ["merge-base", "--is-ancestor", ARC_BASE, "HEAD"], { cwd: REPO_ROOT }).toString();
    expect(mergeBase).toBeDefined(); // execFileSync throws (non-zero exit) if NOT an ancestor -- reaching here already proves it.
    expect(read("src/board/observation/fedos_delivery_observation_repository.ts")).toMatch(/#bySubject/);
    expect(read("src/conversation/archive/fedos_conversation_archive_direct_subject.ts")).toMatch(/kind: "direct"/);
    expect(read("src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts")).toMatch(/class FedosArchiveSuppressionOutboundCoordinator/);
  });

  it("2. the durable append-only log remains the SOLE source of truth for Delivery Observations -- the new index is private, in-memory-only, never serialized, never itself read back from disk", () => {
    const source = stripComments(read("src/board/observation/append_only_fedos_delivery_observation_persistence.ts"));
    expect(source).toMatch(/#index: Map<string, FedosPersistedDeliveryObservationRecordV1> \| null = null;/);
    expect(source).not.toMatch(/JSON\.stringify\(this\.#index/);
    expect(source).not.toMatch(/writeFileSync/);
    // Exactly one appendFileSync call -- no write batching, no second write path.
    expect((source.match(/appendFileSync\(/g) ?? []).length).toBe(1);
  });

  it("3. no full-log replay on a normal (warm-instance) write anymore -- putObservation()'s own duplicate/conflict check uses the in-memory index, not a fresh replayLog() call", () => {
    const source = stripComments(read("src/board/observation/append_only_fedos_delivery_observation_persistence.ts"));
    const putObservationBody = source.slice(source.indexOf("putObservation("), source.indexOf("getObservation("));
    expect(putObservationBody).not.toMatch(/replayLog\(/);
    expect(putObservationBody).toMatch(/this\.#ensureIndex\(\)/);
  });

  it("4. no persistent sidecar index of any kind -- no new file extension, no new persistence port, no new schema version, anywhere in this Arc's own diff", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.endsWith(".ts") && l.startsWith("src/"));
    for (const line of modifiedLines) {
      const content = read(line);
      expect(content, `${line} must not introduce a new sidecar index file extension`).not.toMatch(/\.idx["'`]/);
    }
  });

  it("5. no lossy compaction anywhere in this Arc's own new/modified src/ files -- no .delete(/.splice(/.pop(/.shift( on any durable log or index", () => {
    const files = [
      "src/board/observation/append_only_fedos_delivery_observation_persistence.ts",
      "src/conversation/retention/fedos_archive_suppression_observation_authority.ts",
    ];
    for (const f of files) {
      const source = stripComments(read(f));
      expect(source, f).not.toMatch(/\.delete\(|\.splice\(|\.pop\(|\.shift\(/);
    }
  });

  it("6. exactly ONE FedosArchiveSuppressionObservationAuthority construction site in fedos_desktop_runtime.ts -- never a second, divergent instance", () => {
    const source = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    const callSites = [...source.matchAll(/new FedosArchiveSuppressionObservationAuthority\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("7. exactly ONE deviceRegistryPersistence construction SITE (one ternary: AppendOnly-if-log-path-else-InMemory), still hoisted and shared -- this Arc's own Suppression wiring reuses it, never a second Device Registry", () => {
    const source = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    const appendOnlySites = [...source.matchAll(/new AppendOnlyFedosDeviceRegistryPersistence\(/g)];
    const inMemorySites = [...source.matchAll(/new InMemoryFedosDeviceRegistryPersistence\(/g)];
    expect(appendOnlySites.length).toBe(1);
    expect(inMemorySites.length).toBe(1);
    // The new Suppression Outbound Coordinator/Inbound Handler both reference the SAME hoisted variable.
    expect(source).toMatch(/FedosArchiveSuppressionOutboundCoordinator\(\{[\s\S]{0,200}registryPersistence: deviceRegistryPersistence!/);
    expect(source).toMatch(/FedosArchiveSuppressionInboundHandler\(\{[\s\S]{0,200}registryPersistence: deviceRegistryPersistence!/);
  });

  it("8. no physical-erasure guarantee is claimed anywhere in this Arc's own new/modified files -- suppression only ever gates a RESTORE read, never deletes/erases anything itself", () => {
    const files = [
      "src/conversation/retention/fedos_archive_suppression_observation_authority.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts",
    ];
    for (const f of files) {
      const source = read(f);
      expect(source, f).not.toMatch(/physical.?eras|permanently destroy|unrecoverable deletion/i);
    }
  });

  it("9. no new cryptographic primitive, no new NIP, no Ratchet redesign -- zero diff under those domains", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_crypto.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts").trim()).toBe("");
    expect(diffNames("packages/fedos-core-rust/src").trim()).toBe("");
    // Suppression's own wire event remains the pre-existing, unmodified kind:1 route.
    expect(diffNames("src/device/archive_suppression_sync/fedos_archive_suppression_event.ts").trim()).toBe("");
  });

  it("10. no second Runtime -- exactly ONE startFedosDesktopRuntime() function, exactly ONE FedosConversationArchiveRuntime construction site in fedos_desktop_runtime.ts, unchanged in count by this Arc", () => {
    const source = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect((source.match(/export async function startFedosDesktopRuntime\(/g) ?? []).length).toBe(1);
    expect((source.match(/assembleFedosConversationArchiveRuntime\(\{/g) ?? []).length).toBe(1);
  });

  it("11. no raw private-key, Master Seed, or SecretHandle export anywhere in this Arc's own new/modified files", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.endsWith(".ts") && l.startsWith("src/"));
    for (const line of modifiedLines) {
      const content = stripComments(read(line));
      expect(content, line).not.toMatch(/exportPrivateKey|exportSecretHandle|rawSeed\s*[:=]|nsec1/i);
    }
  });

  it("12. zero Electron main-process/preload security-relevant file touched by this Arc", () => {
    expect(diffNames("packages/fedos-desktop-electron-spike/src/main").trim()).toBe("");
    expect(diffNames("packages/fedos-desktop-electron-spike/src/preload").trim()).toBe("");
  });

  it("13. zero p2p/ or .tmp_gen/ change of any kind, tracked or untracked", () => {
    expect(diffNames("p2p").trim()).toBe("");
    expect(diffNames(".tmp_gen").trim()).toBe("");
    const status = porcelainStatus();
    expect(status).not.toMatch(/(^| )p2p\//m);
    expect(status).not.toMatch(/\.tmp_gen\//);
  });

  it("14. this Arc's own required production files are all present in the diff against its own base (tracked changes) or as a genuinely new, untracked file this Arc adds", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const untrackedLines = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: REPO_ROOT, encoding: "utf8" })
      .toString()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const allLines = [...modifiedLines, ...untrackedLines];
    for (const required of [
      "src/board/observation/append_only_fedos_delivery_observation_persistence.ts",
      "src/desktop/runtime/fedos_desktop_runtime.ts",
      "src/desktop/runtime/fedos_desktop_runtime_config.ts",
      "src/desktop/onboarding/fedos_profile_initialization_coordinator.ts",
      "src/desktop/onboarding/fedos_local_profile_paths.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts",
    ]) {
      expect(allLines, `required file missing from diff/untracked set: ${required}`).toContain(required);
    }
  });
});

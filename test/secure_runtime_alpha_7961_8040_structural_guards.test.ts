/**
 * Secure Runtime Alpha 7961-8040 (FedOS Secure Runtime Staged Master
 * Landing and Desktop Beta Release Candidate Arc) — structural guards.
 * ARC_BASE (`81b5f0d1`) is this Arc's own true starting point.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, existsSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "81b5f0d1";

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

describe("Secure Runtime Alpha 7961-8040 -- structural guards", () => {
  it("1. one canonical production lineage -- 81b5f0d1 remains an ancestor, no completed sibling capability dropped", () => {
    const mergeBase = execFileSync("git", ["merge-base", "--is-ancestor", ARC_BASE, "HEAD"], { cwd: REPO_ROOT }).toString();
    expect(mergeBase).toBeDefined(); // throws (non-zero exit) if NOT an ancestor -- reaching here already proves it.
    expect(read("src/board/observation/append_only_fedos_delivery_observation_persistence.ts")).toMatch(/#ensureIndex/);
    expect(read("src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts")).toMatch(/isConnected/);
  });

  it("2. no duplicate Runtime -- exactly one startFedosDesktopRuntime() function, unchanged in count by this Arc", () => {
    const source = read("src/desktop/runtime/fedos_desktop_runtime.ts");
    expect((source.match(/export async function startFedosDesktopRuntime\(/g) ?? []).length).toBe(1);
  });

  it("3. no second Device Registry/Sync stack introduced by this Arc's own relay-crash fix", () => {
    const source = read("src/desktop/runtime/fedos_desktop_runtime.ts");
    const appendOnlySites = [...source.matchAll(/new AppendOnlyFedosDeviceRegistryPersistence\(/g)];
    const inMemorySites = [...source.matchAll(/new InMemoryFedosDeviceRegistryPersistence\(/g)];
    expect(appendOnlySites.length).toBe(1);
    expect(inMemorySites.length).toBe(1);
  });

  it("4. no dev crypto path introduced or widened by this Arc -- zero diff under packages/fedos-core-rust/src", () => {
    expect(diffNames("packages/fedos-core-rust/src").trim()).toBe("");
  });

  it("5. no AUTOTEST dependency added for any user-facing feature by this Arc's own relay-crash fix", () => {
    const source = read("src/conversation/transport/relay/fedos_conversation_inbound_subscription.ts");
    expect(source).not.toMatch(/AUTOTEST/);
    const suppressionSource = read("src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts");
    expect(suppressionSource).not.toMatch(/AUTOTEST/);
  });

  it("6. no raw secret export anywhere in this Arc's own new/modified files", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && l.endsWith(".ts") && l.startsWith("src/"))
      // A file this old Arc's diff base once had at this path may since have
      // been relocated by a later, unrelated Arc (e.g. the OS Capability
      // Modularization file moves) — a path that no longer exists was
      // deleted/moved, not "added by this Arc with a raw secret export in
      // it", so there is nothing here to scan.
      .filter((l: string) => existsSync(join(REPO_ROOT, ...l.split("/"))));
    for (const line of modifiedLines) {
      const content = read(line);
      expect(content, line).not.toMatch(/exportPrivateKey|exportSecretHandle|rawSeed\s*[:=]|nsec1/i);
    }
  });

  it("7. no protocol/NIP/crypto redesign -- zero diff under Ratchet crypto core, NIP-17 wire, Secure Memory Rust source", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_crypto.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts").trim()).toBe("");
    expect(diffNames("src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts").trim()).toBe("");
  });

  it("8. zero p2p/ or .tmp_gen/ change of any kind by this Arc", () => {
    expect(diffNames("p2p").trim()).toBe("");
    expect(diffNames(".tmp_gen").trim()).toBe("");
  });

  it("9. this Arc's own required files are all present in the diff against its own base", () => {
    const modifiedLines = diffNames()
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
    for (const required of [
      "src/conversation/transport/relay/fedos_conversation_inbound_subscription.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts",
      "docs/secure_runtime_alpha_7961_8040_stage0_canonical_tip_reconciliation_report.md",
    ]) {
      expect(modifiedLines, `required file missing from diff: ${required}`).toContain(required);
    }
  });
});

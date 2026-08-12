/**
 * Secure Runtime Alpha 5961-6040 — Phase Q: structural exclusion guards.
 * Mirrors this repo's own established "source-text import scan over a
 * whole domain directory" style
 * (`test/secure_runtime_alpha_5401_5480_structural_exclusion_guards.test.ts`,
 * `test/secure_runtime_alpha_5801_5880_structural_guards.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_reason.js";

declare const process: { cwd(): string };

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir) as string[]) {
    const full = join(dir, entry);
    if ((entry as string).endsWith(".ts")) {
      out.push(full);
      continue;
    }
    try {
      out.push(...collectTsFiles(full));
    } catch {
      /* not a directory */
    }
  }
  return out;
}

const PEER_INTEGRATION_DIR = join(process.cwd(), "src", "conversation", "identity_transition", "peer_integration");

const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /\/archive\//,
  /\/search\//,
  /sync_journal/i,
  /\/desktop\//,
  /electron/i,
  /fedos_conversation_membership/,
  /fedos_direct_ratchet_session_reset_authority/,
  /fedos_direct_ratchet_reset_coordinator/,
  /fedos_master_seed_authority/,
  /fedos_wasm_master_seed_authority/,
  /fedos_wasm_nostr_signing_authority/,
];

describe("Alpha 5961-6040 — Peer Integration domain import exclusions", () => {
  const files = collectTsFiles(PEER_INTEGRATION_DIR);

  it("finds a non-empty, real domain directory (the guard itself is not vacuous)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("no source file imports Archive/Search/Sync/Electron-Desktop, Conversation Membership, or any live Master-Seed/session-reset-mutation/WASM-signing authority", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8") as string;
      const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        for (const line of importLines) {
          expect(pattern.test(line), `${file} imports something matching ${pattern} in line: ${line}`).toBe(false);
        }
      }
    }
  });

  it("this Arc's own reset-authorization module ONLY reaches Ratchet state through establishSession() (the caller-injected outbound integration), never through the reset authority/coordinator directly", () => {
    const authorizationFile = files.find((f) => f.endsWith("fedos_identity_transition_ratchet_reset_authorization.ts"));
    expect(authorizationFile).toBeDefined();
    const source = readFileSync(authorizationFile!, "utf8") as string;
    expect(source).not.toMatch(/FedosDirectRatchetResetCoordinator/);
    expect(source).not.toMatch(/FedosDirectRatchetSessionResetAuthority/);
  });

  it("no file introduces a new cryptographic dependency beyond @noble/curves and @noble/hashes", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8") as string;
      const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
      for (const line of importLines) {
        const specifierMatch = line.match(/from\s+["']([^"']+)["']/);
        const specifier = specifierMatch === null ? "" : (specifierMatch[1] ?? "");
        const isRelativeImport = specifier.startsWith(".");
        const looksLikeCryptoLib = !isRelativeImport && /sodium|tweetnacl|elliptic|forge|openpgp|node-forge/i.test(specifier) && !specifier.includes("@noble");
        expect(looksLikeCryptoLib, `${file} appears to import an unapproved crypto dependency: ${line}`).toBe(false);
      }
    }
  });

  it("node:fs is confined to the named append-only persistence backends", () => {
    const allowedFsFiles = new Set([
      "append_only_fedos_identity_transition_peer_observation_persistence.ts",
      "append_only_fedos_identity_transition_ratchet_reset_link_persistence.ts",
      // Secure Runtime Alpha 6121-6200 (FedOS Identity Replacement User
      // Verification and Conversation Continuity UI Arc) — same
      // append-only discipline, three new durable fact domains.
      "append_only_fedos_identity_transition_manual_verification_persistence.ts",
      "append_only_fedos_identity_transition_conversation_continuity_persistence.ts",
      "append_only_fedos_identity_transition_local_decision_persistence.ts",
    ]);
    for (const file of files) {
      if ([...allowedFsFiles].some((name) => file.endsWith(name))) continue;
      const source = readFileSync(file, "utf8") as string;
      expect(source.includes("node:fs"), `${file} unexpectedly imports node:fs`).toBe(false);
    }
  });

  it("no file in this domain lives under p2p/ or .tmp_gen/", () => {
    for (const file of files) {
      expect(file).not.toMatch(/[\\/]p2p[\\/]/);
      expect(file).not.toMatch(/\.tmp_gen/);
    }
  });
});

describe("Alpha 5961-6040 — no automatic-migration/mutation vocabulary", () => {
  it("the new session reset reason value contains no 'auto'-flavored wording", () => {
    for (const reason of FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS) {
      expect(reason.toLowerCase()).not.toContain("auto");
    }
    expect(FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS).toContain("identity-transition");
  });
});

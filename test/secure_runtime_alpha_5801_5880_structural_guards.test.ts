/**
 * Secure Runtime Alpha 5801-5880 — Phase Q: structural exclusion guards.
 * Mirrors `test/secure_runtime_alpha_5401_5480_structural_exclusion_guards.test.ts`'s
 * own "source-text import scan over a whole domain directory" style.
 *
 * Proves this standalone, additive Identity Transition domain never
 * reaches into Private Transport, Archive, Search, the Electron/Desktop
 * shell, or any live Ratchet-mutation authority — everything this Arc's
 * own Absolute Prohibitions list forbids wiring into.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error node:fs has no type declarations without @types/node in this tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";

import {
  FEDOS_IDENTITY_TRANSITION_KNOWN_DEVICE_POLICIES,
  FEDOS_IDENTITY_TRANSITION_KNOWN_RATCHET_POLICIES,
} from "../src/conversation/identity_transition/fedos_identity_transition_vocabulary.js";

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

const DOMAIN_DIR = join(process.cwd(), "src", "conversation", "identity_transition");

const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /\/transport\//,
  /\/archive\//,
  /\/search\//,
  /sync_journal/i,
  /\/desktop\//,
  /electron/i,
  /fedos_direct_ratchet_session_reset_authority/,
  /fedos_ratchet_peer_capability_inbound_coordinator/,
  /fedos_ratchet_peer_capability_outbound_coordinator/,
  /fedos_nostr_signing_authority/,
  /fedos_wasm_nostr_signing_authority/,
  /fedos_master_seed_authority/,
  /fedos_wasm_master_seed_authority/,
];

describe("Alpha 5801-5880 — domain-wide import exclusions", () => {
  const files = collectTsFiles(DOMAIN_DIR);

  it("finds a non-empty, real domain directory (the guard itself is not vacuous)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("no source file in the Identity Transition domain imports Transport/Archive/Search/Sync/Electron/Desktop or any live signing/Master-Seed/Ratchet-mutation authority", () => {
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

  it("no source file introduces a new cryptographic dependency beyond @noble/curves and @noble/hashes (already-shipped production dependencies)", () => {
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

  it("no source file touches node:fs directly except the two named persistence backends (append-only I/O is confined)", () => {
    const allowedFsFiles = new Set(["append_only_fedos_identity_transition_fact_persistence.ts"]);
    for (const file of files) {
      if ([...allowedFsFiles].some((name) => file.endsWith(name))) continue;
      const source = readFileSync(file, "utf8") as string;
      expect(source.includes("node:fs"), `${file} unexpectedly imports node:fs`).toBe(false);
    }
  });
});

describe("Alpha 5801-5880 — closed policy vocabularies contain no automatic-mutation value", () => {
  it("Device policy never offers an auto-rebind value", () => {
    for (const value of FEDOS_IDENTITY_TRANSITION_KNOWN_DEVICE_POLICIES) {
      expect(value.toLowerCase()).not.toContain("auto");
    }
  });

  it("Ratchet policy never offers an automatic-reset value", () => {
    for (const value of FEDOS_IDENTITY_TRANSITION_KNOWN_RATCHET_POLICIES) {
      expect(value.toLowerCase()).not.toContain("auto");
    }
  });
});

describe("Alpha 5801-5880 — this Arc's own p2p/.tmp_gen exclusion", () => {
  it("no file in the Identity Transition domain lives under p2p/ or .tmp_gen/", () => {
    for (const file of collectTsFiles(DOMAIN_DIR)) {
      expect(file).not.toMatch(/[\\/]p2p[\\/]/);
      expect(file).not.toMatch(/\.tmp_gen/);
    }
  });
});

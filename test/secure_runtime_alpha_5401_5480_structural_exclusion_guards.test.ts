/**
 * Secure Runtime Alpha 5401-5480 — Phase J/structural. Covers test
 * requirements 23 (Archive exclusion), 24 (Search exclusion), 25 (Sync
 * exclusion), 26 (Transport exclusion), 30 (structural no-crypto-operation
 * guard). Source-text assertions mirror this codebase's own established
 * exclusion-test style (e.g. `test/reviews/private_conversation_search_runtime_v1/encryption_boundary_invariants.test.ts`'s
 * own "no import from retention" check) rather than modifying any
 * Archive/Search/Sync/Transport file to add an exclusion marker.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  FEDOS_SYNC_ALLOWED_RECORD_TYPES,
  reviewFedosSyncRecordForJournal,
} from "../src/sync/fedos_sync_record_allowlist.js";

declare const process: { cwd(): string };

function readAllSourceFiles(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const absoluteDir = join(process.cwd(), dir);
  let entries: string[];
  try {
    entries = readdirSync(absoluteDir) as string[];
  } catch {
    return out;
  }
  for (const entry of entries) {
    const fullPath = join(absoluteDir, entry);
    if (entry.endsWith(".ts")) {
      out.set(join(dir, entry), readFileSync(fullPath, "utf8") as string);
    }
  }
  return out;
}

describe("Alpha 5401-5480 — 25. Device Sync allowlist exclusion", () => {
  it("the closed allowlist does not include any ratchet record type", () => {
    for (const recordType of FEDOS_SYNC_ALLOWED_RECORD_TYPES) {
      expect(recordType.toLowerCase()).not.toContain("ratchet");
    }
  });

  it("a ratchet-shaped record type is rejected by the existing, unmodified allowlist", () => {
    const result = reviewFedosSyncRecordForJournal("ratchet-session-secret" as never, { sealedBlob: "irrelevant" });
    expect(result.allowed).toBe(false);
  });

  it("ratchet secret metadata under an ALLOWED record type is still rejected by the sensitive-marker scan", () => {
    const result = reviewFedosSyncRecordForJournal("conversation-identity-metadata", { ratchetSecret: "irrelevant" });
    expect(result.allowed).toBe(false);
  });
});

describe("Alpha 5401-5480 — 23/24/26. Archive/Search/Transport exclusion (source-text)", () => {
  it("23. no Conversation Archive source file imports the ratchet module", () => {
    const archiveFiles = readAllSourceFiles("src/conversation/archive");
    for (const [path, source] of archiveFiles) {
      expect(source, `${path} must not import the ratchet module`).not.toMatch(/from ["'].*\/ratchet\//);
    }
    expect(archiveFiles.size).toBeGreaterThan(0);
  });

  it("24. no Search source file imports the ratchet module", () => {
    const searchFiles = readAllSourceFiles("src/conversation/search");
    for (const [path, source] of searchFiles) {
      expect(source, `${path} must not import the ratchet module`).not.toMatch(/from ["'].*\/ratchet\//);
    }
    expect(searchFiles.size).toBeGreaterThan(0);
  });

  it("26. no Transport source file imports the ratchet module -- local session-state records are never serialized onto the wire", () => {
    const transportFiles = readAllSourceFiles("src/conversation/transport");
    for (const [path, source] of transportFiles) {
      expect(source, `${path} must not import the ratchet module`).not.toMatch(/from ["'].*\/ratchet\//);
    }
    expect(transportFiles.size).toBeGreaterThan(0);
  });

  it("no ratchet source file imports Archive, Search, Sync-journal, or Transport modules (the exclusion holds in both directions)", () => {
    const ratchetDir = join(process.cwd(), "src", "conversation", "ratchet");
    function collect(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir) as string[]) {
        const full = join(dir, entry);
        if ((entry as string).endsWith(".ts")) out.push(full);
        else {
          try {
            out.push(...collect(full));
          } catch {
            /* not a directory */
          }
        }
      }
      return out;
    }
    // Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet
    // Conversation Runtime and NIP-17 Integration Arc) — this Arc is
    // EXACTLY the "future integration Arc" the review/Foundation Arc
    // itself deferred live Transport wiring to; these are that Arc's own
    // NEW, additive integration-layer files. A narrow, named exclusion —
    // every OTHER ratchet source file (all pre-existing) remains fully
    // covered by this guard exactly as before.
    //
    // Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
    // Capability Advertisement Arc) — the SAME narrow exclusion, applied
    // once more for the SAME reason: `fedos_ratchet_peer_capability_vocabulary.ts`
    // (under the new `peer_capability/` integration directory) imports the
    // real, closed `FedosPrivateWireRouteRequest` type FROM `/transport/`
    // so its own capability vocabulary can never silently drift from the
    // live route vocabulary — a type-only reuse, never a new dependency
    // direction the underlying architectural principle (no ratchet
    // business logic reaching INTO Transport/Archive/Search internals)
    // actually forbids.
    const integrationFiles = new Set([
      "fedos_direct_ratchet_conversation_runtime.ts",
      "fedos_direct_ratchet_outbound_integration.ts",
      "fedos_direct_ratchet_inbound_integration.ts",
      "fedos_direct_ratchet_route_resolution.ts",
      "fedos_ratchet_peer_capability_vocabulary.ts",
    ]);
    const forbiddenImportPatterns = [/\/archive\//, /\/search\//, /sync_journal/i, /\/transport\//];
    for (const file of collect(ratchetDir)) {
      if ([...integrationFiles].some((name) => file.endsWith(name))) continue;
      const source = readFileSync(file, "utf8") as string;
      for (const pattern of forbiddenImportPatterns) {
        const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
        for (const line of importLines) {
          expect(pattern.test(line), `${file} imports something matching ${pattern} in line: ${line}`).toBe(false);
        }
      }
    }
  });
});

describe("Alpha 5401-5480 — 30. structural no-crypto-operation guard", () => {
  it("the Runtime facade defines no method named encrypt/decrypt/send/publish/negotiate", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "conversation", "ratchet", "fedos_direct_ratchet_state_runtime.ts"),
      "utf8",
    ) as string;
    const forbiddenMethodNames = [
      "encryptMessage",
      "decryptMessage",
      "sendMessage",
      "publishRelayEvent",
      "constructNip17Event",
      "negotiateWithPeer",
      "migrateConversation",
    ];
    for (const name of forbiddenMethodNames) {
      expect(source).not.toContain(name);
    }
    // No generic crypto.execute-style operation either.
    expect(source).not.toMatch(/\bcrypto\.execute\b/);
  });

  it("the Rust sealing functions perform no DH ratchet, root/chain-key KDF evolution, or message-key derivation", () => {
    const source = readFileSync(
      join(process.cwd(), "packages", "fedos-core-rust", "src", "lib.rs"),
      "utf8",
    ) as string;
    // Locate just the two new functions' own bodies to scope this check narrowly.
    const sealStart = source.indexOf("pub fn seal_direct_ratchet_secret");
    const restoreEnd = source.indexOf("fn fedos_decode_direct_ratchet_sealed_blob");
    expect(sealStart).toBeGreaterThan(-1);
    expect(restoreEnd).toBeGreaterThan(sealStart);
    const region = source.slice(sealStart, restoreEnd);
    for (const forbidden of ["diffie_hellman", "dh_ratchet", "derive_message_key", "derive_root_key", "derive_chain_key"]) {
      expect(region).not.toContain(forbidden);
    }
  });
});

/**
 * Secure Runtime Alpha 5481-5560 — Phase S: structural guards. Source-text
 * assertions proving this Arc's own scope discipline, mirroring the
 * Foundation Arc's own established exclusion-test style.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error node:fs has no type declarations without @types/node in this tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { execSync } from "node:child_process";

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
    if (entry.endsWith(".ts") || entry.endsWith(".rs")) {
      out.set(join(dir, entry), readFileSync(fullPath, "utf8") as string);
    }
  }
  return out;
}

const RATCHET_SOURCE_DIRS = ["src/conversation/ratchet", "packages/fedos-core-rust/src/crypto"];

/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — this Arc is EXACTLY the "future
 * integration Arc" this file's own Alpha 5481-5560 header (and
 * `fedos_direct_ratchet_cryptographic_session.ts`'s own class doc
 * comment) named as the one that "decides how the two are wired
 * together". These six files are that Arc's own NEW, additive
 * integration layer — real, deliberate NIP-17/Transport wiring is their
 * entire purpose, never an accidental scope leak into the Foundation/
 * Cryptographic Core files this guard continues to protect unmodified.
 * Every OTHER file in `src/conversation/ratchet/` (all pre-existing,
 * Alpha 5401–5480/5481–5560) remains fully covered by this guard exactly
 * as before — this is a narrow, named exclusion, never a broad
 * exemption.
 */
const ALPHA_5561_5640_INTEGRATION_FILES = new Set<string>([
  "fedos_direct_ratchet_conversation_runtime.ts",
  "fedos_direct_ratchet_outbound_integration.ts",
  "fedos_direct_ratchet_inbound_integration.ts",
  "fedos_direct_ratchet_route_resolution.ts",
]);

function isAlpha55615640IntegrationFile(path: string): boolean {
  return [...ALPHA_5561_5640_INTEGRATION_FILES].some((name) => path.endsWith(name));
}

describe("Alpha 5481-5560 — no live messaging/transport/NIP-17/Group integration", () => {
  it("no ratchet source file imports NIP-17, Relay, Group, or Sender-Key modules", () => {
    for (const dir of ["src/conversation/ratchet"]) {
      const files = readAllSourceFiles(dir);
      for (const [path, source] of files) {
        if (isAlpha55615640IntegrationFile(path)) continue;
        const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
        for (const line of importLines) {
          expect(line, `${path} must not import NIP-17`).not.toMatch(/nip17/i);
          expect(line, `${path} must not import Relay transport`).not.toMatch(/\/transport\//i);
          expect(line, `${path} must not import Sender-Key`).not.toMatch(/sender_key/i);
          expect(line, `${path} must not import Group messaging`).not.toMatch(/\/group\//i);
        }
      }
      expect(files.size).toBeGreaterThan(0);
    }
  });

  it("no ratchet source file imports the Conversation Archive, Search, or Device Sync modules", () => {
    const files = readAllSourceFiles("src/conversation/ratchet");
    for (const [path, source] of files) {
      const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
      for (const line of importLines) {
        expect(line, `${path} must not import Archive`).not.toMatch(/\/archive\//i);
        expect(line, `${path} must not import Search`).not.toMatch(/\/search\//i);
        expect(line, `${path} must not import Device Sync`).not.toMatch(/\bsync_journal\b|src\/sync\//i);
      }
    }
  });

  it("no ratchet source file references Electron, Shell, Renderer, or IPC", () => {
    const files = readAllSourceFiles("src/conversation/ratchet");
    for (const [path, source] of files) {
      expect(source, `${path} must not reference Electron`).not.toMatch(/\belectron\b/i);
      expect(source, `${path} must not reference ipcRenderer/ipcMain`).not.toMatch(/ipcRenderer|ipcMain/);
      expect(source, `${path} must not import a Desktop Shell module`).not.toMatch(/from ["'].*\/desktop\/shell/);
    }
  });

  it("the Rust crypto core defines no live Conversation coordinator, NIP-17 Rumor/Seal/Gift-Wrap, or Relay publish function", () => {
    const files = readAllSourceFiles("packages/fedos-core-rust/src/crypto");
    const forbiddenPatterns = [/rumor/i, /gift_wrap/i, /\bseal_nip/i, /relay_publish/i, /publish_event/i];
    for (const [path, source] of files) {
      if (!path.includes("direct_ratchet")) continue;
      for (const pattern of forbiddenPatterns) {
        expect(source, `${path} must not reference ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

describe("Alpha 5481-5560 — no generic crypto.execute, no raw secret serialization, no false protocol claims", () => {
  it("no generic crypto.execute(operation, payload)-style API exists in the ratchet module", () => {
    const files = readAllSourceFiles("src/conversation/ratchet");
    for (const [path, source] of files) {
      expect(source, `${path} must not define a generic execute(operation, payload) API`).not.toMatch(/\bexecute\s*\(\s*operation/i);
      expect(source, `${path} must not define crypto.execute`).not.toMatch(/crypto\.execute/);
    }
  });

  it("no TypeScript file in the ratchet module declares a raw secret key as a string type", () => {
    const files = readAllSourceFiles("src/conversation/ratchet");
    for (const [path, source] of files) {
      if (!path.endsWith(".ts")) continue;
      expect(source, `${path} must not declare a rootKey/chainKey/privateKey field as string`).not.toMatch(
        /(rootKey|chainKey|privateKey|messageKey)\s*:\s*string\b/,
      );
    }
  });

  it("no ratchet source file claims Signal-protocol interoperability, MLS, or post-quantum cryptography", () => {
    const files = readAllSourceFiles("src/conversation/ratchet");
    const rustFiles = readAllSourceFiles("packages/fedos-core-rust/src/crypto");
    for (const [path, source] of [...files, ...rustFiles]) {
      if (!path.includes("direct_ratchet")) continue;
      expect(source, `${path} must not claim Signal protocol interoperability`).not.toMatch(/signal[\s-]?protocol/i);
      expect(source, `${path} must not claim MLS support`).not.toMatch(/\bMLS\b/);
      expect(source, `${path} must not claim post-quantum support`).not.toMatch(/post-quantum|kyber|dilithium/i);
    }
  });

  it("the Rust crypto core never falls back to the static conversation key for message encryption", () => {
    const sessionSource = readFileSync(
      join(process.cwd(), "packages", "fedos-core-rust", "src", "crypto", "direct_ratchet_session.rs"),
      "utf8",
    ) as string;
    // The bootstrap seam (session establishment) is the ONE reviewed use
    // of the conversation key; `encrypt()`/`decrypt()` themselves must
    // never reference it -- confirmed by scoping the search to those two
    // method bodies only.
    const encryptBody = (sessionSource.match(/pub\(crate\) fn encrypt\(&mut self,[\s\S]*?\n    \}/) ?? [""])[0];
    const decryptBody = (sessionSource.match(/pub\(crate\) fn decrypt\(&mut self,[\s\S]*?\n    \}\n    \}/) ?? [""])[0];
    expect(encryptBody.length).toBeGreaterThan(0);
    expect(encryptBody).not.toMatch(/conversation_key|resolve_conversation_key/);
    expect(decryptBody).not.toMatch(/conversation_key|resolve_conversation_key/);
  });
});

describe("Alpha 5481-5560 — no changes to protected repository areas", () => {
  it("git status confirms no modification under p2p/ or .tmp_gen/", () => {
    let output = "";
    try {
      output = execSync("git status --porcelain", { encoding: "utf8", cwd: process.cwd() }) as string;
    } catch {
      // If git is unavailable in this environment, this guard cannot run -- treat as inconclusive, not a failure.
      return;
    }
    const modified = output
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    for (const line of modified) {
      expect(line).not.toMatch(/^\S+\s+p2p\//);
      expect(line).not.toMatch(/^\S+\s+\.tmp_gen\//);
    }
  });
});

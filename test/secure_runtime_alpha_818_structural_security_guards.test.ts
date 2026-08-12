import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRS = ["src/conversation/retention", "src/conversation/payload_storage"];

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

function readAll(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const dir of DIRS) {
    for (const name of readdirSync(dir) as string[]) {
      if (!name.endsWith(".ts")) continue;
      result[join(dir, name)] = codeOnlyLines(readFileSync(join(dir, name), "utf8") as string);
    }
  }
  return result;
}

/**
 * Secure Runtime Alpha 818 ("Structural Security Guards") -- Stage 28
 * of the Alpha 791-820 Conversation Retention & Private Payload
 * Storage Boundary Foundation Arc. Scans every file this Arc actually
 * added under `src/conversation/retention/`/`src/conversation/payload_storage/`
 * for every prohibited pattern this Arc's own instruction names,
 * mirroring `test/secure_runtime_alpha_638_structural_guards.test.ts`'s
 * own established scan pattern.
 */
describe("Secure Runtime Alpha 818 -- Structural Security Guards", () => {
  it("1. this Arc actually added files under both new directories -- sanity check the scan below is not vacuously trivial", () => {
    const files = readAll();
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(15);
  });

  it("2. no plaintext interpretation -- no 'JSON.parse(bytes)'/'toString()' call on payload bytes treating them as structured content", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/bytes\.toString\(\)|JSON\.parse\(.*bytes/);
    }
  });

  it("3. no crypto implementation -- no encrypt/decrypt/cipher/AEAD function, no src/crypto import", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/\bencrypt\(|\bdecrypt\(|src\/crypto|AeadKey|chacha20|aes256gcm/i);
    }
  });

  it("4. no p2p/ import anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/p2p\//);
    }
  });

  it("5. no GUI/rendering or Worker reference of any kind", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/document\.|innerHTML|React|render\(|src\/worker/i);
    }
  });

  it("6. no Membership/Capability dependency -- no import of a membership/capability/invitation module", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/membership|capability|invitation/i);
    }
  });

  it("7. no private-group/direct construction vocabulary", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/private-group|direct-message/i);
    }
  });

  it("8. no URL/token vocabulary -- capability tokens/URLs are explicitly out of this Arc's scope", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/\btoken\b|https?:\/\//i);
    }
  });

  it("9. no arbitrary filesystem path is ever derived from a payload id -- the append-only backend uses ONE fixed, caller-supplied file path, never a per-id filename", () => {
    const appendOnlySource = readFileSync(
      join("src/conversation/payload_storage", "append_only_fedos_conversation_payload_storage.ts"),
      "utf8",
    ) as string;
    expect(appendOnlySource).not.toMatch(/join\(.*\bid\b|readFileSync\(.*\bid\b|appendFileSync\(.*\bid\b/);
  });

  it("10. no secret in logs -- no console.log/console.error/console.warn call anywhere in either module", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/console\.(log|error|warn|debug|info)/);
    }
  });

  it("11. no physical erasure claim -- 'secure erase'/'SSD'/'overwrite'/'shred' vocabulary is absent from actual code", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/secure erase|\bSSD\b|overwrite|shred/i);
    }
  });

  it("12. no SQLite/database dependency of any kind", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/sqlite|\bSQL\b/i);
    }
  });

  it("13. no external dependency beyond node:fs/node:buffer and @noble/hashes (already a dependency) -- every import is relative, node:, or the one sanctioned @noble/hashes use", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/from ["'](?!\.\/|\.\.\/|node:|@noble\/hashes)/);
    }
  });

  it("14. no Ontology/Humanizer/AI vocabulary anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/ontology|humanizer/i);
    }
  });

  it("15. no Lightning/NIP-13/JA4/CrowdSec vocabulary anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/lightning|nip-13|\bja4\b|crowdsec/i);
    }
  });
});

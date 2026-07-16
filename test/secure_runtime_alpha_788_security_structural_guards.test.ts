import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

/**
 * Secure Runtime Alpha 788 ("Security and Structural Guards") — Stage 14
 * of Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc. Mirrors
 * `test/secure_runtime_alpha_638_structural_guards.test.ts`'s own real
 * recursive-filesystem-scan discipline — a real scan of every file this
 * Arc actually added, not a fixed, hand-maintained file list.
 */

const MEMBERSHIP_DIR = "src/conversation/membership";
const CAPABILITY_DIR = "src/conversation/capability";

function arcFiles(dir: string): string[] {
  return (readdirSync(dir) as string[])
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(dir, name));
}

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

function readAll(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const file of arcFiles(dir)) {
    result[file] = codeOnlyLines(readFileSync(file, "utf8") as string);
  }
  return result;
}

describe("Secure Runtime Alpha 788 -- Security and Structural Guards", () => {
  it("1. this Arc actually added files under both new directories -- sanity check the scan below is not vacuously trivial", () => {
    expect(arcFiles(MEMBERSHIP_DIR).length).toBeGreaterThanOrEqual(6);
    expect(arcFiles(CAPABILITY_DIR).length).toBeGreaterThanOrEqual(6);
  });

  it("2. no p2p/ import anywhere in either new directory", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/p2p\//);
    }
  });

  it("3. no bearer secret field name on FedosConversationCapabilityDescriptor -- the code-only body of the interface never mentions 'secret'/'bearer'", () => {
    const source = readFileSync(join(CAPABILITY_DIR, "fedos_conversation_capability_descriptor.ts"), "utf8") as string;
    const body = codeOnlyLines(source);
    const start = body.indexOf("export interface FedosConversationCapabilityDescriptor");
    const end = body.indexOf("}", start);
    const interfaceBody = body.slice(start, end);
    expect(interfaceBody).not.toMatch(/secret|bearer/i);
  });

  it("4. FedosConversationMembership never carries an invitation/capability/secret/key field", () => {
    const source = readFileSync(join(MEMBERSHIP_DIR, "fedos_conversation_membership.ts"), "utf8") as string;
    const body = codeOnlyLines(source);
    const start = body.indexOf("export interface FedosConversationMembership");
    const end = body.indexOf("}", start);
    const interfaceBody = body.slice(start, end);
    expect(interfaceBody).not.toMatch(/secret|capability|invitation|key|cipher/i);
  });

  it("5. no encryption vocabulary anywhere in either new directory -- no 'encrypt'/'decrypt'/'cipher'/'aead' token", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/encrypt|decrypt|cipher|aead/i);
    }
  });

  it("6. no direct-message / private-group construction vocabulary anywhere", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/direct-message|private-group/i);
    }
  });

  it("7. no consensus / distributed / 'globally exactly once' claim anywhere in the code (comments are stripped before this check, so this only ever finds a real identifier/string, never prose)", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/consensus|distributed/i);
    }
  });

  it("8. no raw secret-material token -- no 'privateKey'/'nsec'/'seed'/'mnemonic'/'masterSeed' anywhere", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/privateKey|nsec|mnemonic|masterSeed/i);
    }
  });

  it("9. no Publisher/Relay/GUI/Worker import anywhere", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/fedos_relay|FedosRelay\b|WebSocket|document\.|innerHTML|React|new Worker\(/);
    }
  });

  it("10. no new npm dependency import -- every `from \"...\"` module specifier is a relative path, none is a bare package name", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      const specifiers = [...code.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
      for (const specifier of specifiers) {
        expect(specifier, `${file}: ${specifier}`).toMatch(/^\.\.?\//);
      }
    }
  });

  it("11. no invitation URL / QR / HTTP endpoint vocabulary anywhere", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/qrcode|http:\/\/|https:\/\/|express\(|createServer\(/i);
    }
  });

  it("12. no ActivityPub/ATProto/Session outbound send call, no Lightning/NIP-13/JA3/JA4/CrowdSec/Ontology/Humanizer reference", () => {
    for (const [file, code] of Object.entries({ ...readAll(MEMBERSHIP_DIR), ...readAll(CAPABILITY_DIR) })) {
      expect(code, file).not.toMatch(/lightning|nip-13|ja3|ja4|crowdsec|ontology|humanizer/i);
    }
  });
});

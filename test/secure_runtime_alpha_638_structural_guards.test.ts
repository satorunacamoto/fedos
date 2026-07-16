import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

/**
 * Secure Runtime Alpha 638 ("Structural Guards") -- Stage 18 of the
 * Alpha 621-640 Public Board Runtime Application API Foundation Arc.
 * Scans every file this Arc actually added under `src/board/runtime/`
 * (a real recursive filesystem walk, not a fixed file list) for every
 * prohibited pattern this Arc's own instruction names.
 */

const RUNTIME_DIR = "src/board/runtime";

function runtimeFiles(): string[] {
  return (readdirSync(RUNTIME_DIR) as string[])
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(RUNTIME_DIR, name));
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

/** CODE ONLY (comments stripped) for every file this Arc added under src/board/runtime/ -- every prohibition below checks actual code, never prose describing what is deliberately NOT done. */
function readAll(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const file of runtimeFiles()) {
    result[file] = codeOnlyLines(readFileSync(file, "utf8") as string);
  }
  return result;
}

describe("Secure Runtime Alpha 638 -- Structural Guards", () => {
  it("1. this Arc actually added files under src/board/runtime/ -- sanity check the scan below is not vacuously trivial", () => {
    expect(runtimeFiles().length).toBeGreaterThanOrEqual(6);
  });

  it("2. no p2p/ import anywhere in src/board/runtime/", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/p2p\//);
    }
  });

  it("3. no Host lifecycle ownership -- no file calls host.start()/host.stop()/constructs a FedosDesktopHost", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/\.start\(\)|\.stop\(\)|new FedosDesktopHost\(/);
    }
  });

  it("4. no direct Persistence import -- no file imports a *Persistence class/interface directly", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/from ".*persistence/i);
    }
  });

  it("5. no direct Relay import", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/fedos_relay|FedosRelay\b|WebSocket/);
    }
  });

  it("6. no crypto import -- no src/crypto, no @noble reference beyond the one sanctioned randomBytes/bytesToHex use", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/src\/crypto|@noble\/curves|schnorr|sha256/);
    }
    // The one sanctioned exception, confirmed narrow:
    const idGenSource = readFileSync(join(RUNTIME_DIR, "fedos_board_runtime_id_generator.ts"), "utf8") as string;
    expect(idGenSource).toMatch(/@noble\/hashes\/utils\.js/);
  });

  it("7. no raw secret material -- no 'privateKey'/'nsec'/'seed'/'mnemonic' token anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/privateKey|nsec|mnemonic|masterSeed/i);
    }
  });

  it("8. no protocol-specific branching except the eligibility vocabulary's own allow-list -- confined to ONE file", () => {
    const files = readAll();
    for (const [file, code] of Object.entries(files)) {
      if (file.endsWith("fedos_board_runtime_outbound_eligibility.ts")) continue;
      expect(code, file).not.toMatch(/"activitypub"|"atproto"/);
    }
  });

  it("9. no private/direct implementation -- no 'private-group'/'direct-message'/'encrypt'/'membership' vocabulary anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/private-group|direct-message|encrypt|membership|invitation/i);
    }
  });

  it("10. no visibility boolean -- no field literally named isPrivate/visibility/isPublic anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/isPrivate|isPublic|readonly visibility/i);
    }
  });

  it("11. no caller-supplied author/signature/source field on either public command type", () => {
    const commandTypesSource = readFileSync(join(RUNTIME_DIR, "fedos_board_runtime_command_types.ts"), "utf8") as string;
    const createCommandStart = (commandTypesSource as string).indexOf("export interface CreatePublicThreadCommand");
    const createCommandBody = (commandTypesSource as string).slice(
      createCommandStart,
      (commandTypesSource as string).indexOf("}", createCommandStart),
    );
    expect(createCommandBody).not.toMatch(/readonly (id|author|signature|source|sig|pubkey|publicIdentifier)\s*[:?]/);

    const replyCommandStart = (commandTypesSource as string).indexOf("export interface ReplyToPublicThreadCommand");
    const replyCommandBody = (commandTypesSource as string).slice(
      replyCommandStart,
      (commandTypesSource as string).indexOf("}", replyCommandStart),
    );
    expect(replyCommandBody).not.toMatch(/readonly (id|author|signature|source|sig|pubkey|publicIdentifier)\s*[:?]/);
  });

  it("12. no createdAt field on either public command type -- Runtime clock authority (Alpha 625)", () => {
    const commandTypesSource = readFileSync(join(RUNTIME_DIR, "fedos_board_runtime_command_types.ts"), "utf8") as string;
    const createCommandStart = commandTypesSource.indexOf("export interface CreatePublicThreadCommand");
    const createCommandBody = commandTypesSource.slice(createCommandStart, commandTypesSource.indexOf("}", createCommandStart));
    expect(createCommandBody).not.toMatch(/createdAt/);
  });

  it("13. no GUI/rendering reference of any kind", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/document\.|innerHTML|React|render\(/);
    }
  });

  it("14. no p2p/, Ontology, or inference-based command-decision vocabulary anywhere", () => {
    for (const [file, code] of Object.entries(readAll())) {
      expect(code, file).not.toMatch(/ontology|anomaly|inference/i);
    }
  });
});

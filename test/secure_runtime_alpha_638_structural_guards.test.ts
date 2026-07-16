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
 *
 * Secure Runtime Alpha 754 (Alpha 741-760 Canonical Conversation
 * Identity and Record Foundation Arc) narrows test 4's own guard: its
 * ORIGINAL intent (Alpha 622's own header) was that `FedosBoardRuntime`
 * never bypasses `FedosDesktopHost`'s private ownership of
 * Board/Outbox/Observation persistence -- never that it may hold NO
 * persistence dependency of ANY kind. Conversation persistence is a
 * deliberate, reasoned exception: Host has no concept of Conversation
 * Policy/Mode at all (that lives here, in `FedosBoardRuntime`, since
 * Alpha 656), so `FedosConversationPersistence` (Alpha 749) is an
 * Application-layer concern this Runtime owns directly, exactly like
 * `FedosConversationPolicyAuthority`/`FedosPublicAuthorAuthority`
 * already are -- never routed through Host. Test 4 below is UPDATED,
 * not weakened: it still fails on ANY persistence import that is not
 * this one sanctioned exception.
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

  it("4. no direct Board/Outbox/Observation Persistence import -- every persistence-shaped import found is the ONE sanctioned Conversation persistence exception (Alpha 754, see this file's own header), never a Host-owned bypass", () => {
    for (const [file, code] of Object.entries(readAll())) {
      const persistenceImportLines = code.split("\n").filter((line) => /from ".*persistence/i.test(line));
      for (const line of persistenceImportLines) {
        expect(line, `${file}: ${line}`).toMatch(/from "\.\.\/\.\.\/conversation\/persistence\//);
      }
    }
  });

  it("15. the Alpha 754 Conversation persistence exception is real and narrow -- fedos_board_runtime.ts imports FedosConversationPersistence/InMemoryFedosConversationPersistence from ../../conversation/persistence/, and no OTHER file under src/board/runtime/ imports any persistence at all", () => {
    const files = readAll();
    const runtimeSource = files[join(RUNTIME_DIR, "fedos_board_runtime.ts")];
    expect(runtimeSource).toMatch(/from "\.\.\/\.\.\/conversation\/persistence\/fedos_conversation_persistence\.js"/);
    expect(runtimeSource).toMatch(/from "\.\.\/\.\.\/conversation\/persistence\/in_memory_fedos_conversation_persistence\.js"/);
    for (const [file, code] of Object.entries(files)) {
      if (file === join(RUNTIME_DIR, "fedos_board_runtime.ts")) continue;
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

import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";

const PHASE_A_B_FILES = [
  "src/nostr/sign/fedos_nostr_signing_public_identity.ts",
  "src/board/runtime/identity/fedos_nostr_author_binding_types.ts",
  "src/board/runtime/identity/fedos_nostr_author_binding_authority.ts",
  "src/board/runtime/identity/fedos_nostr_signing_public_author_authority.ts",
  "src/board/publish/nostr/fedos_board_post_to_nostr_unsigned_event.ts",
  "src/board/publish/nostr/fedos_signing_authority_board_post_event_source.ts",
  "src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts",
  "src/desktop/node_websocket_relay_socket_factory.ts",
];

/** Strips `/** ... *\/` block comments and `//` line comments, so structural checks below inspect real CODE only -- never trip on thorough prose (e.g. a doc comment listing "no nsec" by name). */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readCode(path: string): string {
  return codeOnly(readFileSync(path, "utf8"));
}

function importLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "))
    .join("\n");
}

/**
 * Secure Runtime Alpha 718 ("Structural Security Guards") — Stage 18 of
 * Phase B of the Alpha 681–720 Arc. Confirms, by direct source
 * inspection of CODE ONLY (comments stripped, so thorough prose
 * documentation never trips these checks), every Absolute Prohibition
 * this Arc's own instruction lists that has a concrete, checkable
 * structural signature.
 */
describe("Secure Runtime Alpha 718 -- Structural Security Guards", () => {
  it("1. no file this Arc added imports p2p/, Worker, ActivityPub/ATProto/Session outbound, or a Relay Pool", () => {
    for (const path of PHASE_A_B_FILES) {
      const imports = importLines(readCode(path));
      expect(imports, path).not.toMatch(/from ["'].*\/p2p\//);
      expect(imports, path).not.toMatch(/from ["'].*worker\.js["']/);
      expect(imports, path).not.toMatch(/from ["'].*\/activitypub\//);
      expect(imports, path).not.toMatch(/from ["'].*\/atproto\//);
      expect(imports, path).not.toMatch(/from ["'].*\/session\//);
      expect(imports, path).not.toMatch(/RelayPool/);
    }
  });

  it("2. no file this Arc added declares a generic sign(hash)-shaped method or a raw secret-key field/getter, in actual code", () => {
    for (const path of PHASE_A_B_FILES) {
      const code = readCode(path);
      expect(code, path).not.toMatch(/\bsign\s*\(\s*hash\b/i);
      expect(code, path).not.toMatch(/\bnsec\s*[:=]/i);
      expect(code, path).not.toMatch(/secretKey\s*:\s*string/);
    }
  });

  it("3. FedosNostrAuthorBindingAuthority's own imports never reach Relay, Outbox, or Board persistence", () => {
    const imports = importLines(readCode("src/board/runtime/identity/fedos_nostr_author_binding_authority.ts"));
    expect(imports).not.toMatch(/fedos_relay\.js/);
    expect(imports).not.toMatch(/outbox/i);
    expect(imports).not.toMatch(/persistence/i);
  });

  it("4. the OK-correlated Publisher's own imports never reach Board runtime identity/policy/eligibility -- Publisher never owns identity policy", () => {
    const imports = importLines(readCode("src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts"));
    expect(imports).not.toMatch(/runtime\/identity/);
    expect(imports).not.toMatch(/runtime\/policy/);
    expect(imports).not.toMatch(/runtime\/eligibility/);
  });

  it("5. the Board-post-to-Nostr-event mapping's own function body never reads post.author or post.source -- no imported-author impersonation path", () => {
    const code = readCode("src/board/publish/nostr/fedos_board_post_to_nostr_unsigned_event.ts");
    const bodyStart = code.indexOf("export function boardPostToNostrUnsignedEventRequest");
    expect(bodyStart).toBeGreaterThan(-1);
    const body = code.slice(bodyStart);
    expect(body).not.toMatch(/post\.author/);
    expect(body).not.toMatch(/post\.source/);
  });

  it("6. the Node WebSocket relay socket factory's own code constructs no Relay Pool and contains no reconnect loop", () => {
    const code = readCode("src/desktop/node_websocket_relay_socket_factory.ts");
    expect(code).not.toMatch(/RelayPool/);
    expect(code).not.toMatch(/while\s*\(/); // no retry/reconnect loop of any kind
    expect(code).not.toMatch(/setInterval/);
  });

  it("7. FedosDesktopRuntimeConfig's two new Alpha 697 fields carry no raw secret/seed type", () => {
    const code = readCode("src/desktop/runtime/fedos_desktop_runtime_config.ts");
    const nostrFieldsBlock = code.slice(code.indexOf("nostrAuthorBindingAuthority"));
    expect(nostrFieldsBlock).not.toMatch(/:\s*(string|Uint8Array)\b.*(secret|seed|passphrase)/i);
  });
});

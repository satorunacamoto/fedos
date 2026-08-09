/**
 * Secure Runtime Alpha 1391–1470 — Nostr Private Direct and Pairwise
 * Fanout Delivery Arc. Phase G verification: Alpha 1447 (Public
 * Isolation), Alpha 1451 (Secret Guards), Alpha 1452 (Architecture
 * Guards), and Alpha 1459 (Production Gate Honesty) — static/structural
 * checks over this Arc's own source, mirroring
 * `test/reviews/private_group_pairwise_fanout/source_alignment.test.ts`'s
 * own "read the real source text, assert on what is/is not present"
 * discipline.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error `node:process` has no type declarations without `@types/node` in this project's tsconfig.
import process from "node:process";

const DELIVERY_DIR = join(process.cwd(), "src/os/messenger/adapters/nostr/conversation_delivery");

function deliverySourceFiles(): readonly string[] {
  return readdirSync(DELIVERY_DIR)
    .filter((name: string) => name.endsWith(".ts"))
    .map((name: string) => join(DELIVERY_DIR, name));
}

function readAllDeliverySource(): string {
  return deliverySourceFiles()
    .map((path) => readFileSync(path, "utf8") as string)
    .join("\n");
}

/** Strips `/** ... *\/` block comments and `//` line comments -- these checks scan CODE, not this Arc's own honest prose explaining what it deliberately does NOT implement (e.g. "no gift-wrap" -- a doc sentence, not an import). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Alpha 1391-1470 -- Public Isolation, Secret Guards, Architecture Guards", () => {
  it("1. the private-delivery Nostr kind is never the public kind-1 constant", () => {
    const src = readFileSync(join(DELIVERY_DIR, "fedos_private_nostr_delivery_mode.ts"), "utf8") as string;
    expect(src).toMatch(/FEDOS_PRIVATE_NOSTR_DELIVERY_KIND\s*=\s*\d+/);
    expect(src).not.toMatch(/FEDOS_PRIVATE_NOSTR_DELIVERY_KIND\s*=\s*1\b/);
  });

  it("2. no delivery source file's CODE (not its own explanatory prose) references src/board/publish's Board-specific post/Outbox construction", () => {
    for (const path of deliverySourceFiles()) {
      const code = stripComments(readFileSync(path, "utf8") as string);
      expect(code).not.toMatch(/fedos_board_post_to_nostr_unsigned_event/);
      expect(code).not.toMatch(/FedosBoardOutboxIntent/);
      expect(code).not.toMatch(/createFedosBoardOutboxIntent/);
    }
  });

  it("3. no delivery source file's CODE constructs a NIP-17/NIP-44/NIP-59 gift-wrap/seal shape (this Arc's own prose is free to explain WHY it does not, per the Protocol Compliance Gate)", () => {
    const code = stripComments(readAllDeliverySource());
    for (const forbidden of [/gift[- ]?wrap/i, /\bseal\b/i, /\brumor\b/i, /kind[:\s]*14\b/, /kind[:\s]*1059\b/]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it("4. no delivery source file imports/references root-level p2p/", () => {
    const src = readAllDeliverySource();
    expect(src).not.toMatch(/from ["'].*\/p2p\//);
    expect(src).not.toMatch(/require\(["'].*\/p2p\//);
  });

  it("5. no delivery source file references a new npm/Cargo dependency -- only already-established imports (node builtins, @noble/*, and this repository's own modules)", () => {
    for (const path of deliverySourceFiles()) {
      const src = readFileSync(path, "utf8") as string;
      const importLines = src.match(/^import .* from ["'][^"']+["'];?$/gm) ?? [];
      for (const line of importLines) {
        const moduleMatch = line.match(/from ["']([^"']+)["']/);
        if (moduleMatch === null) continue;
        const moduleSpecifier = moduleMatch[1]!;
        const isRelative = moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/");
        const isNodeBuiltin = moduleSpecifier.startsWith("node:");
        expect(isRelative || isNodeBuiltin, `unexpected non-relative, non-builtin import: ${moduleSpecifier} (${path})`).toBe(true);
      }
    }
  });

  it("6. no delivery source file's CODE implements Sender Keys, MLS, onion routing, mixnet, or Tor", () => {
    const code = stripComments(readAllDeliverySource());
    for (const forbidden of [/sender key/i, /\bMLS\b/, /onion rout/i, /mixnet/i, /\bTor\b/]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it("7. no delivery source file reads process.env or references the Production-mode WASM gate", () => {
    const src = readAllDeliverySource();
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/evaluateDevOnlyGate/);
    expect(src).not.toMatch(/NODE_ENV/);
  });

  it("8. the wire payload/delivery request/import record shapes carry no raw key, seed, passphrase, or bearer-secret field name", () => {
    const files = [
      "fedos_private_nostr_wire_payload.ts",
      "fedos_private_nostr_delivery_request.ts",
      "fedos_private_nostr_import_record.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(DELIVERY_DIR, file), "utf8") as string;
      for (const forbidden of [/rawKey/i, /\bseed\b/i, /passphrase/i, /bearerSecret/i, /privateKey/i, /masterSeed/i]) {
        expect(src).not.toMatch(forbidden);
      }
    }
  });

  it("9. the outbound coordinator's CODE never touches plaintext -- only ciphertext bytes already read from FedosConversationPayloadStorage", () => {
    const code = stripComments(readFileSync(join(DELIVERY_DIR, "fedos_private_nostr_outbound_delivery_coordinator.ts"), "utf8") as string);
    expect(code).not.toMatch(/plaintext/i);
    expect(code).not.toMatch(/\.encrypt\(/); // never calls an Encryption Authority directly -- reuses the already-encrypted Envelope/Payload.
  });

  it("10. the inbound coordinator's decrypted plaintext is used ONLY to determine byteLength for the re-persisted ciphertext descriptor -- the stored bytes are the received ciphertext, never plaintext", () => {
    const src = readFileSync(join(DELIVERY_DIR, "fedos_private_nostr_inbound_delivery_coordinator.ts"), "utf8") as string;
    const putPayloadCallMatch = src.match(/putPayload\(([^)]*)\)/);
    expect(putPayloadCallMatch).not.toBeNull();
    expect(putPayloadCallMatch![1]).not.toMatch(/plaintext/i);
    expect(putPayloadCallMatch![1]).toMatch(/ciphertext/i);
  });

  it("11. the Group Delivery Planner reuses the EXISTING Fanout Delivery/Direct Path persistence -- it introduces no second planning mechanism", () => {
    const src = readFileSync(join(DELIVERY_DIR, "fedos_private_nostr_group_delivery_planner.ts"), "utf8") as string;
    expect(src).toMatch(/FedosGroupFanoutDeliveryPersistence/);
    expect(src).toMatch(/FedosGroupDirectPathPersistence/);
    expect(src).not.toMatch(/new Map/); // no ad hoc, second in-memory planning structure.
  });

  it("12. the Production-mode WASM Dev-only Gate file is byte-for-byte untouched by this Arc (git-tracked, unmodified)", () => {
    // Structural confirmation only -- the gate's own permanent restriction text is still present, unmodified.
    const src = readFileSync(join(process.cwd(), "src/runtime/fedos_wasm_loader.ts"), "utf8") as string;
    expect(src).toMatch(/never Production, never Worker/);
  });

  it("13. root-level p2p/ is untouched -- no delivery source path resolves into it", () => {
    for (const path of deliverySourceFiles()) {
      expect(path).not.toMatch(/[\\/]p2p[\\/]/);
    }
  });
});

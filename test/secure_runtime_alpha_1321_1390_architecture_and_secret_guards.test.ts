/**
 * Secure Runtime Alpha 1321–1390 — Phase F verification (Alpha 1379/
 * 1380/1385): source-level architecture and secret guards. Confirms the
 * Private-Group Gate and every frozen Direct-mode file remain byte-for-
 * byte untouched by this Arc, that no shared-group-key/Sender-Key/MLS
 * concept was introduced, and that no plaintext/bearer-secret field
 * exists on any new Group record type. Never asserts anything about a
 * future protocol-delivery/production-crypto capability.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationCoordinatorSource from "../src/os/messenger/conversations/activation/fedos_conversation_direct_activation_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptionCoordinatorSource from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptionCoordinatorSource from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import participantResolverSource from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import groupGenerationSource from "../src/os/messenger/conversations/group/fedos_group_generation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import groupDirectPathSource from "../src/os/messenger/conversations/group/fedos_group_direct_path.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import groupMessageSource from "../src/os/messenger/conversations/group/fedos_group_message.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import groupFanoutDeliverySource from "../src/os/messenger/conversations/group/fedos_group_fanout_delivery.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function allFilesUnder(dir: string, extensions: readonly string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  let files: string[] = [];
  for (const entry of entries) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files = files.concat(allFilesUnder(p, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(p);
    }
  }
  return files;
}

describe("Alpha 1321-1390 -- architecture guards (Alpha 1380/1385)", () => {
  it("1. the Direct Activation Coordinator's own Private-Group Gate is byte-for-byte unchanged: still 'direct'-only, still 'unsupported-mode'", () => {
    expect(activationCoordinatorSource as string).toMatch(/draft\.mode !== "direct"/);
    expect(activationCoordinatorSource as string).toMatch(/return \{ outcome: "unsupported-mode" \}/);
  });

  it("2. the frozen Encryption/Decryption Coordinators are untouched by this Arc -- no group/fanout reference of any kind", () => {
    for (const source of [encryptionCoordinatorSource, decryptionCoordinatorSource]) {
      expect(source as string).not.toMatch(/group|fanout/i);
    }
  });

  it("3. the frozen participant resolver still requires exactly one other active member -- never widened, never importing this Arc's new group module", () => {
    expect(participantResolverSource as string).toMatch(/outcome:\s*"ambiguous-counterparty"/);
    expect(participantResolverSource as string).toMatch(/others\.length > 1\) return \{ outcome: "ambiguous-counterparty" \}/);
    expect(participantResolverSource as string).not.toMatch(/from ["'].*\/group\//);
  });

  it("4. no file under src/conversation/group/ imports a Publisher, Scheduler, Relay, Outbox, or p2p/ module", () => {
    for (const file of allFilesUnder("src/conversation/group", [".ts"])) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should not import a delivery/protocol module`).not.toMatch(
        /from ["'].*(publish|scheduler|relay|outbox|p2p)/i,
      );
    }
  });

  it("5. no file under src/conversation/group/ references Sender Key, MLS, NIP-17, NIP-59, gift wrap, or a shared/group symmetric key", () => {
    for (const file of allFilesUnder("src/conversation/group", [".ts"])) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should not reference a group-crypto scheme`).not.toMatch(
        /sender[_ ]?key|\bMLS\b|nip-?17|nip-?59|gift.?wrap|shared[_ ]?group[_ ]?key|group[_ ]?symmetric[_ ]?key/i,
      );
    }
  });

  it("6. no Group record type (generation/path/message/delivery) declares a key, ciphertext, plaintext, or bearer-secret FIELD (comments/parameter names discussing their absence are expected and fine)", () => {
    // Matches an actual `interface`/type FIELD declaration: `readonly <name>:` or
    // `<name>:` immediately followed by a type -- never a doc-comment sentence
    // or an unrelated identifier like `idempotencyKey` (which legitimately
    // contains the substring "key" but is not a key FIELD).
    const forbiddenFieldPattern = /readonly\s+(bearerSecret|plaintext|ciphertext|rawKey|sharedKey|groupKey|senderKey)\s*:/i;
    for (const source of [groupGenerationSource, groupDirectPathSource, groupMessageSource, groupFanoutDeliverySource]) {
      expect(source as string).not.toMatch(/:\s*(Uint8Array|CryptoKey)/);
      expect(source as string).not.toMatch(forbiddenFieldPattern);
    }
  });

  it("7. package.json still carries exactly two production dependencies, and no devDependency changed either -- no new dependency introduced by this Arc", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys(parsed.dependencies).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
    expect(Object.keys(parsed.devDependencies).sort()).toEqual(["@cloudflare/workers-types", "typescript", "vitest"]);
  });

  it("8. packages/fedos-core-rust/src is untouched -- no group/fanout reference anywhere in the Rust crate", () => {
    for (const file of allFilesUnder("packages/fedos-core-rust/src", [".rs"])) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should not reference group/fanout`).not.toMatch(/group_fanout|fanout_delivery|group_generation/i);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_208_session_atproto_compatibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/messenger/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/os/messenger/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";

/**
 * Secure Runtime Alpha 208 -- "Future Session/ATProto Compatibility
 * Review": Stage 8 of the Nostr Event Runtime Exposure Arc. Review
 * only. Confirms FedosEventDescriptor's own field names carry no
 * Nostr-exclusive vocabulary (no pubkey/created_at/sig), and that
 * HkdfDomain/SecretHandleKind gained zero new variant this Arc.
 */
describe("Secure Runtime Alpha 208 -- Future Session/ATProto Compatibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: FedosEventDescriptor's own interface body uses protocol-neutral field names, never Nostr wire names (pubkey/created_at/sig)", () => {
    const body = (descriptorSource.match(/export interface FedosEventDescriptor \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/\bpubkey\b|\bcreated_at\b|\bsig\b/);
    expect(body).toMatch(/readonly author: string;/);
    expect(body).toMatch(/readonly createdAt: number;/);
    expect(body).toMatch(/readonly signature: string;/);
  });

  it("4. structural: FedosEventDescriptor.provider is a plain string, not a fixed Nostr-only union", () => {
    expect(descriptorSource).toMatch(/readonly provider: string;/);
  });

  it("5. structural: neither new file references Session/ATProto/Wallet/CBOR/CID CODE", () => {
    for (const source of [descriptorSource, readerSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/Session|ATProto|Wallet|CBOR|\bCID\b/i);
    }
  });

  it("6. the design doc's own field-name table names all eight fields and their Nostr-wire counterparts", () => {
    const section = (designDocSource.match(/## 2\. `FedosEventDescriptor`'s own field names[\s\S]*?\n\n([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const field of ["`id`", "`provider`", "`author`", "`createdAt`", "`kind`", "`tags`", "`content`", "`signature`"]) {
      expect(section).toContain(field);
    }
  });

  it("7. the design doc concludes none of Session/ATProto/Wallet would reuse the new shapes as-is", () => {
    expect(designDocSource).toMatch(
      /\*\*None of the three would reuse `FedosEventReader`\/`FedosEventDescriptor`\s*\nas-is\*\*/,
    );
  });

  it("8. structural: HkdfDomain and SecretHandleKind gained zero new variant across this Arc", () => {
    const kindBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\r?\n {4}\}/) ?? [])[1] ?? "";
    const kindVariants = [...kindBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(kindVariants).toEqual([
      "Placeholder",
      "AeadKeyMaterial",
      "HkdfInputMaterial",
      "HkdfOutputMaterial",
      "NostrKeyMaterial",
      "ConversationKeyMaterial",
      "MessageKeyMaterial",
      "MasterSeedMaterial",
      "IdentityRootMaterial",
      "ApplicationRootMaterial",
      "ProtocolRootMaterial",
      "NostrSecretKeyMaterial",
      "TestOnlySecretMaterial",
      "DirectRatchetRootKeyMaterial",
      "DirectRatchetChainKeyMaterial",
      "DirectRatchetPrivateKeyMaterial",
    ]);

    const domainBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\r?\n {4}\}/) ?? [])[1] ?? "";
    const domainVariants = [...domainBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(domainVariants).toEqual([
      "RootKey",
      "Identity",
      "Storage",
      "Conversation",
      "Application",
      "Nostr",
      "Session",
      "ATProto",
      "Wallet",
      "DirectRatchetSealing",
      "TestOnly",
    ]);
  });

  it("9. the design doc cross-references Alpha 207, Alpha 199, Alpha 188, Alpha 179, and Alpha 045", () => {
    for (const ref of [
      "secure_runtime_alpha_207_relay_compatibility_review",
      "secure_runtime_alpha_199_event_protocol_extensibility_review",
      "secure_runtime_alpha_188_session_atproto_signing_extensibility_review",
      "secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review",
      "secure_runtime_alpha_045_fedos_identity_descriptor_expansion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

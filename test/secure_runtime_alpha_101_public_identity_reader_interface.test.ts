import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_101_public_identity_reader_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerInterfaceSource from "../src/desktop/fedos_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderSource from "../src/os/core/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 101 -- "Public Identity Reader Interface":
 * Stage 1 of the Public Identity Source Foundation Arc. Adds
 * src/desktop/fedos_public_identity_reader.ts, exporting
 * FedosPublicIdentityReader -- a NEW, protocol-independent read
 * boundary, deliberately separate from FedosIdentityProvider and from
 * FedosNostrPublicIdentitySource. No implementation exists yet.
 */
describe("Secure Runtime Alpha 101 -- Public Identity Reader Interface", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_public_identity_reader\.ts`, and nothing else/,
    );
  });

  it("3. FedosPublicIdentityReader is the ONLY export from fedos_public_identity_reader.ts", () => {
    const exportNames = [...readerInterfaceSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosPublicIdentityReader"]);
  });

  it("4. the interface declares exactly one method with the exact signature", () => {
    expect(readerInterfaceSource).toMatch(
      /export interface FedosPublicIdentityReader \{\s*\n\s*readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null>;\s*\n\}/,
    );
  });

  it("5. the interface imports FedosIdentityDescriptor as a type-only import, and references no Nostr-specific Snapshot type IN CODE (comments legitimately name FedosNostrPublicIdentitySource for contrast)", () => {
    expect(readerInterfaceSource).toMatch(
      /import type \{ FedosIdentityDescriptor \} from "\.\.\/identity\/fedos_identity_descriptor\.js";/,
    );
    const codeOnly = readerInterfaceSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/FedosNostrPublicIdentitySnapshot|FedosNostrPublicIdentitySource/);
  });

  it("6. no secret key, signing, Relay, or WebSocket reference exists IN CODE (comments legitimately name these as forbidden guardrails)", () => {
    const codeOnly = readerInterfaceSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/nsec|seed|mnemonic|secretKey|privateKey/i);
    expect(codeOnly).not.toMatch(/\bsign\b|signature|verify/i);
    expect(codeOnly).not.toMatch(/Relay|WebSocket/);
  });

  it("7. no import of any nostr/relay.ts, nostr/ws_relay.ts, nostr/crypto.ts, nostr/signature.ts, or nostr/noble_signature.ts", () => {
    expect(readerInterfaceSource).not.toMatch(
      /from ".*nostr\/(relay|ws_relay|crypto|signature|noble_signature)\.js"/,
    );
  });

  it("8. the design doc's own responsibility boundary section names all four constraints", () => {
    const section = (designDocSource.match(/## 3\. Responsibility boundary([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*公開Identity取得のみ \(public identity retrieval only\):\*\*/);
    expect(section).toMatch(/\*\*秘密鍵禁止 \(secret key forbidden\):\*\*/);
    expect(section).toMatch(/\*\*署名禁止 \(signing forbidden\):\*\*/);
    expect(section).toMatch(/\*\*Relay禁止 \(Relay forbidden\):\*\*/);
  });

  it("9. the design doc's own 'does NOT do' list confirms no implementation exists yet and no src/identity/* file is modified", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement `FedosPublicIdentityReader` — no class\s*\n\s*conforming to it exists anywhere in this repository yet/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
  });

  it("10. RIPPLE (Secure Runtime Alpha 103): desktop_application.ts never referenced FedosPublicIdentityReader AS OF this Stage's own scope; Alpha 103 legitimately gave it a Reader field, reconfirmed here as the CURRENT state -- this Stage's own doc reference is still absent", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_101/);
    expect(desktopApplicationSource).toMatch(/FedosPublicIdentityReader/);
  });

  it("11. Regression: fedos_runtime_identity.ts and fedos_identity_provider.ts are completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_101/);
    expect(identityProviderSource).not.toMatch(/secure_runtime_alpha_101/);
    expect(identityProviderSource).not.toMatch(/FedosPublicIdentityReader/);
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to the new interface", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_101/);
      expect(source).not.toMatch(/FedosPublicIdentityReader/);
    }
  });
});

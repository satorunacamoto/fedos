import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_439_authority_persistence_ownership_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import authoritySource from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts?raw";

describe("Secure Runtime Alpha 439 -- Authority Persistence Ownership Review", () => {
  it("adopts Option E (no Host integration yet)", () => {
    expect(doc).toMatch(/\*\*Adopted\*\*/);
    expect(doc).toContain("No Host integration yet; authority/store remain injected boundaries");
  });

  it("rejects folding persistence into Board or FedosRuntimeIdentity", () => {
    expect(doc).toMatch(/Board persistence owns it \| \*\*Absolutely prohibited\*\*/);
    expect(doc).toMatch(/Do not overload `FedosRuntimeIdentity`/);
  });

  it("FedosWasmMasterSeedAuthority has no save/load/path method of any kind", () => {
    expect(authoritySource).not.toMatch(/\bsave\s*\(/);
    expect(authoritySource).not.toMatch(/\bload\s*\(/);
    expect(authoritySource).not.toMatch(/filePath|storagePath|defaultPath/);
  });
});

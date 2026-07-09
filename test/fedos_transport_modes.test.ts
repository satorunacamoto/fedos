import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import docSource from "../docs/fedos_transport_modes.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import onionDocSource from "../docs/fedos_onion_like_routing.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import marketplaceDocSource from "../docs/marketplace_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * FedOS Transport Modes — Design Review, docs only.
 *
 * `docs/fedos_transport_modes.md` separates anonymous-delivery
 * strategy into THREE modes (Quiet DM, Public Board, Legal Content
 * Distribution) for DMs, boards, and legal commerce respectively. It
 * adds NO code, NO cryptography, NO relay/payment client, and NO
 * Runtime/Worker connection of any kind -- this suite guards that the
 * document says what it must say, and that nothing in this repository
 * actually implements any part of it.
 */
describe("FedOS Transport Modes design review -- docs only, no implementation, no Runtime/Worker connection", () => {
  it("1. the document exists and is non-empty", () => {
    expect(typeof docSource).toBe("string");
    expect(docSource.length).toBeGreaterThan(1000);
  });

  it("2. names all three modes by their required titles", () => {
    expect(docSource).toMatch(/Quiet DM Mode/);
    expect(docSource).toMatch(/Public Board Mode/);
    expect(docSource).toMatch(/Legal Content Distribution Mode/);
  });

  it("3. Quiet DM Mode states all seven required properties", () => {
    expect(docSource).toMatch(/NIP-17/);
    expect(docSource).toMatch(/NIP-59/);
    expect(docSource).toMatch(/0[–-]1 hop|0 to 1 hop|zero.{0,10}one hop/i);
    expect(docSource).toMatch(/[Nn]otifications?\s*\|\s*\*\*None\*\*|None.{0,20}notification|no notification/i);
    expect(docSource).toMatch(/[Mm]ultipath/);
    expect(docSource).toMatch(/[Zz]ap/);
    expect(docSource).toMatch(/[Pp]eriodic pull/);
    expect(docSource).toMatch(/[Tt]iming concealment/);
  });

  it("4. Public Board Mode states all four required properties", () => {
    expect(docSource).toMatch(/[Mm]ultipath.{0,40}[Aa]llowed|[Aa]llowed.{0,10}mirror/);
    expect(docSource).toMatch(/[Nn]otifications?\s*\|\s*\*\*Allowed\*\*|[Aa]llowed.{0,20}[Nn]otification/);
    expect(docSource).toMatch(/EMSR/);
    expect(docSource).toMatch(/Ontology/);
    expect(docSource).toMatch(/[Ss]pam/);
    expect(docSource).toMatch(/abuse/i);
    expect(docSource).toMatch(/[Mm]andatory/);
  });

  it("5. Legal Content Distribution Mode states all five required properties", () => {
    expect(docSource).toMatch(/[Ll]egal content ONLY|[Ll]egal.{0,10}[Cc]ontent.{0,10}[Oo]nly/);
    expect(docSource).toMatch(/[Mm]irror/);
    expect(docSource).toMatch(/[Pp]ayment/);
    expect(docSource).toMatch(/[Cc]autious/i);
    expect(docSource).toMatch(/illegal-market framing|illegal market framing/i);
    expect(docSource).toMatch(/FORBIDDEN/);
    expect(docSource).toMatch(/buyer\/seller privacy/i);
    expect(docSource).toMatch(/not.{0,20}(the point|purpose)|never a marketed feature/i);
  });

  it("6. names forbidden framing/wording for Legal Content Distribution Mode", () => {
    expect(docSource).toMatch(/anonymous marketplace/i);
    expect(docSource).toMatch(/no KYC/i);
    expect(docSource).toMatch(/avoid taxes|off the books/i);
    expect(docSource).toMatch(/deniable_storage_research\.md/);
  });

  it("7. reconciles with existing onion-like routing and marketplace boundary docs without contradicting them", () => {
    expect(docSource).toMatch(/fedos_onion_like_routing\.md/);
    expect(docSource).toMatch(/does NOT adopt|not adopt/i);
    expect(docSource).toMatch(/marketplace_boundary\.md/);
    expect(marketplaceDocSource).toMatch(/No real payment/i);
    expect(docSource).toMatch(/no real payment/i);
    expect(onionDocSource).toMatch(/Gift Wrap/i);
  });

  it("8. includes a comparison table across all three modes", () => {
    expect(docSource).toMatch(/Quiet DM\s*\|\s*Public Board\s*\|\s*Legal Content Distribution/);
    expect(docSource).toMatch(/Hop count/);
    expect(docSource).toMatch(/Primary goal/);
  });

  it("9. explicitly disclaims implementation, payment, onion routing, and Runtime/Worker/WASM connection", () => {
    expect(docSource).toMatch(/does \*\*not\*\* implement NIP-17/i);
    expect(docSource).toMatch(/does \*\*not\*\* implement onion routing/i);
    expect(docSource).toMatch(/does \*\*not\*\* implement payment/i);
    expect(docSource).toMatch(/connect Runtime/i);
    expect(docSource).toMatch(/WebAssembly\.instantiate/);
    expect(docSource).toMatch(/import\(\)/);
    expect(docSource).toMatch(/add a Cargo or `package\.json` dependency/i);
  });

  it("10. no code anywhere in this repository implements these transport modes, a relay client, or a payment client", () => {
    expect(createRuntimeSource).not.toMatch(/quiet.?dm|transport.?mode/i);
    expect(workerSource).not.toMatch(/quiet.?dm|transport.?mode/i);
    expect(createRuntimeSource).not.toMatch(/fedos_transport_modes/i);
    expect(workerSource).not.toMatch(/fedos_transport_modes/i);
  });

  it("11. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(30);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(3);

    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("12. the document itself never writes real import()/WebAssembly code -- only names them as prohibited, in prose", () => {
    expect(docSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(docSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*import\(/);
  });
});

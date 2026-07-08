import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import docSource from "../docs/fedos_onion_like_routing.md?raw";
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
 * FedOS Onion-like Routing — Design Review, docs only.
 *
 * `docs/fedos_onion_like_routing.md` is a RESEARCH/DESIGN sketch of
 * nesting NIP-59 Gift Wrap layers for multi-hop delivery over Nostr
 * relays. It adds NO code, NO cryptography, NO relay client, and NO
 * Runtime/Worker connection of any kind — this suite guards that the
 * document says what it must say, and that nothing in this repository
 * actually implements any part of it.
 */
describe("FedOS Onion-like Routing design review — docs only, no implementation, no Runtime/Worker connection", () => {
  it("1. the document exists and is non-empty", () => {
    expect(typeof docSource).toBe("string");
    expect(docSource.length).toBeGreaterThan(1000);
  });

  it("2. states plainly that this is NOT a Tor alternative", () => {
    expect(docSource).toMatch(/NOT a Tor alternative|not.{0,20}Tor alternative/i);
    expect(docSource).toMatch(/\bTor\b/);
  });

  it("3. names this an onion-like RELAY ENVELOPE, distinct from onion ROUTING", () => {
    expect(docSource).toMatch(/onion-like/i);
    expect(docSource).toMatch(/relay envelope/i);
  });

  it("4. describes the NIP-59 Gift Wrap multi-layer nesting idea", () => {
    expect(docSource).toMatch(/NIP-59/);
    expect(docSource).toMatch(/Gift Wrap/i);
    expect(docSource).toMatch(/nest(ed|ing)?/i);
    expect(docSource).toMatch(/NIP-44/);
  });

  it("5. names what each hop can and cannot see", () => {
    expect(docSource).toMatch(/each hop/i);
    expect(docSource).toMatch(/does not see|not see/i);
    expect(docSource).toMatch(/ephemeral/i);
  });

  it("6. includes an illustrative A/B/C/D 3-hop example", () => {
    expect(docSource).toMatch(/A\s*(→|->)\s*B\s*(→|->)\s*C\s*(→|->)\s*D/);
    expect(docSource).toMatch(/GiftWrap_D/);
    expect(docSource).toMatch(/GiftWrap_C/);
    expect(docSource).toMatch(/GiftWrap_B/);
  });

  it("7. names both a relay-routing proposal and a FedOS peer-routing proposal", () => {
    expect(docSource).toMatch(/[Rr]elay routing/);
    expect(docSource).toMatch(/FedOS peer routing|peer routing/i);
    expect(docSource).toMatch(/dumb event stores|dumb.{0,20}relay/i);
  });

  it("8. states its relationship to existing NIP-17/NIP-59 work", () => {
    expect(docSource).toMatch(/NIP-17/);
    expect(docSource).toMatch(/nostr_dm_bridge\.md/);
    expect(docSource).toMatch(/nip44_wire_implementation_roadmap\.md/);
  });

  it("9. names all six required risk categories, without claiming any is solved", () => {
    expect(docSource).toMatch(/[Tt]iming correlation/);
    expect(docSource).toMatch(/[Ss]ize correlation|packet.{0,20}correlation/i);
    expect(docSource).toMatch(/[Mm]alicious relay/);
    expect(docSource).toMatch(/[Rr]elay auth/i);
    expect(docSource).toMatch(/[Ll]ogging/);
    expect(docSource).toMatch(/[Ss]pam.{0,10}abuse|abuse/i);
    expect(docSource).toMatch(/[Dd]elivery failure/);
    // These are risks, not claimed mitigations.
    expect(docSource).toMatch(/unsolved|not (designed|mitigated|solved)/i);
  });

  it("10. states the four required FedOS policy points", () => {
    expect(docSource).toMatch(/[Dd]ocs only/);
    expect(docSource).toMatch(/re-evaluate|reevaluate/i);
    expect(docSource).toMatch(/EMSR/);
    expect(docSource).toMatch(/Ontology/);
    expect(docSource).toMatch(/abuse.{0,30}observ/i);
    expect(docSource).toMatch(/separate protocol/i);
    expect(docSource).toMatch(/deletion.coordination|deletion-coordination/i);
  });

  it("11. explicitly disclaims implementation, cryptographic execution, and Runtime/Worker/WASM connection", () => {
    expect(docSource).toMatch(/does \*\*not\*\* implement/i);
    expect(docSource).toMatch(/execute any cryptographic operation/i);
    expect(docSource).toMatch(/connect Runtime/i);
    expect(docSource).toMatch(/WebAssembly\.instantiate/);
    expect(docSource).toMatch(/import\(\)/);
    expect(docSource).toMatch(/add a Cargo or `package\.json` dependency/i);
  });

  it("12. no code anywhere in this repository implements onion routing, a relay client, or gift-wrap nesting", () => {
    expect(createRuntimeSource).not.toMatch(/onion/i);
    expect(workerSource).not.toMatch(/onion/i);
    expect(createRuntimeSource).not.toMatch(/giftwrap|gift_wrap/i);
    expect(workerSource).not.toMatch(/giftwrap|gift_wrap/i);
  });

  it("13. Runtime and Worker are completely unaffected -- no reference to this design anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_onion/i);
    expect(workerSource).not.toMatch(/fedos_onion/i);
    expect(createRuntimeSource).not.toMatch(/initializeCrypto.*onion|onion.*initializeCrypto/i);
  });

  it("14. Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]/);

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
    expect(depLines.length).toBe(10);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("15. the document itself never writes real import()/WebAssembly code -- only names them as prohibited, in prose", () => {
    // The doc may legitimately name `import()`/`WebAssembly.instantiate` as prohibited
    // strings in prose; it must never contain an actual executable code fence doing so.
    expect(docSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(docSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*import\(/);
  });
});

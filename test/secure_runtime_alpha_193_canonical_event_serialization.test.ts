import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_193_canonical_event_serialization.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 193 -- "Canonical Event Serialization": Stage
 * 3 of the Nostr Event Foundation Arc (Alpha 191-200). IMPLEMENTS --
 * hand-written NIP-01 canonical JSON serializer, no new dependency,
 * no custom serialization rules.
 */
describe("Secure Runtime Alpha 193 -- Canonical Event Serialization", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself IMPLEMENTS, touching only lib.rs", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`/,
    );
  });

  it("3. the design doc's own §3 covers all five NIP-01-only rules", () => {
    const section = (designDocSource.match(/## 3\. Only NIP-01's own rule([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Fixed five-element array, literal `0` marker\.\*\*/);
    expect(section).toMatch(/\*\*Escaping — exactly NIP-01's own six characters, no others\.\*\*/);
    expect(section).toMatch(/\*\*One escaper for every string field\.\*\*/);
    expect(section).toMatch(/\*\*No whitespace, no line breaks\.\*\*/);
    expect(section).toMatch(/\*\*Numbers via `Display`, not a custom formatter\.\*\*/);
  });

  it("4. the design doc names the exact Alpha 196 tests it cites as executed proof", () => {
    const section = (designDocSource.match(/## 5\. Structural confirmation([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toContain("canonical_serialization_matches_the_nip01_five_element_array_shape");
    expect(section).toContain("canonical_content_escapes_exactly_the_six_nip01_characters");
    expect(section).toContain("canonical_content_passes_non_ascii_utf8_through_verbatim");
  });

  it("5. the design doc cross-references Alpha 192, 191, and 173", () => {
    for (const ref of [
      "secure_runtime_alpha_192_nostr_event_handle",
      "secure_runtime_alpha_191_nostr_event_model_inventory",
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: nostr_event_encoding module exists with the three documented functions", () => {
    const modMatch = libRsSource.match(/mod nostr_event_encoding \{([\s\S]*?)\r?\n {4}\}/);
    expect(modMatch).not.toBeNull();
    const body = modMatch?.[1] ?? "";
    expect(body).toMatch(/fn escape_json_string_internal\(value: &str\) -> String/);
    expect(body).toMatch(/fn serialize_tags_internal\(tags: &\[Vec<String>\]\) -> String/);
    expect(body).toMatch(
      /pub\(crate\) fn serialize_nostr_event_canonical_internal\(event: &FedosNostrEventHandle\) -> String/,
    );
  });

  it("7. structural: the escaper matches exactly the six NIP-01 characters, nothing else", () => {
    const fnMatch = libRsSource.match(
      /fn escape_json_string_internal\(value: &str\) -> String \{([\s\S]*?)\r?\n {8}\}/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch?.[1] ?? "";
    for (const escape of ["'\\n' => out.push_str(\"\\\\n\")", "'\"' => out.push_str(\"\\\\\\\"\")", "'\\\\' => out.push_str(\"\\\\\\\\\")"]) {
      expect(body).toContain(escape);
    }
    expect(body).toMatch(/other => out\.push\(other\)/);
  });

  it("8. structural: the format string produces the fixed five-element array with literal 0 marker, no whitespace", () => {
    expect(libRsSource).toContain('"[0,{},{},{},{},{}]"');
  });

  it("9. structural: serde/serde_json remain dev-dependencies-only, unchanged by this Stage", () => {
    const devDepsSection = (cargoTomlSource.match(/^\[dev-dependencies\]$([\s\S]*)/m) ?? [])[1] ?? "";
    expect(devDepsSection).toMatch(/^serde_json = /m);
    const prodDepsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    expect(prodDepsSection).not.toMatch(/^serde/m);
  });

  it("10. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_193/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

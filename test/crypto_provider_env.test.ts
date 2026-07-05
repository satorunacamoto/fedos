import { describe, it, expect } from "vitest";
import {
  FEDOS_CRYPTO_PROVIDER_NAMES,
  parseFedosCryptoProviderEnv,
} from "../src/runtime/crypto_provider_env.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import envSource from "../src/runtime/crypto_provider_env.ts?raw";

/**
 * Stage 281 — the shared `FEDOS_CRYPTO_PROVIDER` env parser
 * (`src/runtime/crypto_provider_env.ts`), used identically by
 * `src/runtime/runtime_crypto_config.ts` (Stage 282) and
 * `src/runtime/worker_crypto_config.ts` (Stage 283).
 */
describe("parseFedosCryptoProviderEnv", () => {
  it("1. undefined/null/empty/whitespace-only resolve to placeholder", () => {
    expect(parseFedosCryptoProviderEnv(undefined)).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv(null)).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv("")).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv("   ")).toBe("placeholder");
  });

  it("2. 'placeholder' and 'fedos' (optionally surrounded by whitespace) parse exactly", () => {
    expect(parseFedosCryptoProviderEnv("placeholder")).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv("fedos")).toBe("fedos");
    expect(parseFedosCryptoProviderEnv("  fedos  ")).toBe("fedos");
    expect(parseFedosCryptoProviderEnv("  placeholder  ")).toBe("placeholder");
  });

  it("3. unrecognized values fall back to placeholder", () => {
    for (const value of ["rust", "wasm", "unknown", "FEDOS", "Placeholder", "nip44"]) {
      expect(parseFedosCryptoProviderEnv(value)).toBe("placeholder");
    }
  });

  it("4. truthy-flag spellings (true/1/on/enabled) are NOT treated as fedos — they resolve to placeholder", () => {
    for (const value of ["true", "1", "on", "enabled", "yes", "TRUE", "ON"]) {
      expect(parseFedosCryptoProviderEnv(value)).toBe("placeholder");
    }
  });

  it("5. 'fedos-dev-only' and other variant names are NOT recognized — only the exact two literal strings are", () => {
    for (const value of ["fedos-dev-only", "fedos_placeholder", "fedosplaceholder", "fedos2"]) {
      expect(parseFedosCryptoProviderEnv(value)).toBe("placeholder");
    }
  });

  it("6. FEDOS_CRYPTO_PROVIDER_NAMES lists exactly the two allowed values", () => {
    expect(FEDOS_CRYPTO_PROVIDER_NAMES).toEqual(["placeholder", "fedos"]);
  });

  it("7. is pure — same input always returns the same output, and never throws", () => {
    expect(parseFedosCryptoProviderEnv("fedos")).toBe(parseFedosCryptoProviderEnv("fedos"));
    expect(() => parseFedosCryptoProviderEnv(undefined)).not.toThrow();
  });

  it("8. reads no process.env, and never IMPORTS RuntimeEnv (a doc comment merely names it structurally)", () => {
    const codeOnly = envSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/import[\s\S]*?RuntimeEnv/);
  });

  it("9. declares no pub-like exported class/side effect — pure functions and constants only", () => {
    expect(envSource).not.toMatch(/\bclass\s+/);
  });
});

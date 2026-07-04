import { describe, it, expect } from "vitest";
import {
  buildPayloadDiagnostics,
  renderPayloadDiagnostics,
  renderPayloadDiagnosticsFromPreview,
} from "../src/render/payload_diagnostics.js";
import type { PayloadPreviewDescriptor } from "../src/storage/encrypted_payload.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../src/render/payload_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

function descriptor(overrides: Partial<PayloadPreviewDescriptor> = {}): PayloadPreviewDescriptor {
  return {
    version: "v1",
    algorithm: "aes256gcm",
    aadDomain: "storage",
    encoding: "canonical_json_base64url_placeholder",
    transportKind: "nostr_event",
    status: "invalid_placeholder",
    payloadId: "payload-ref-xyz",
    ...overrides,
  };
}

describe("payload diagnostics (Stage 190)", () => {
  it("1. buildPayloadDiagnostics is pure and projects exactly the five expected fields", () => {
    const input = descriptor();
    const snapshot = JSON.parse(JSON.stringify(input));
    const diagnostics = buildPayloadDiagnostics(input);
    expect(input).toEqual(snapshot); // never mutated
    expect(diagnostics).toEqual({
      version: "v1",
      algorithm: "aes256gcm",
      encoding: "canonical_json_base64url_placeholder",
      transportKind: "nostr_event",
      validationStatus: "invalid_placeholder",
    });
  });

  it("2. buildPayloadDiagnostics drops aadDomain and payloadId", () => {
    const diagnostics = buildPayloadDiagnostics(descriptor());
    expect(diagnostics).not.toHaveProperty("aadDomain");
    expect(diagnostics).not.toHaveProperty("payloadId");
  });

  it("3. renderPayloadDiagnostics renders the five fields, escaped", () => {
    const html = renderPayloadDiagnostics(buildPayloadDiagnostics(descriptor()));
    expect(html).toContain("v1");
    expect(html).toContain("aes256gcm");
    expect(html).toContain("canonical_json_base64url_placeholder");
    expect(html).toContain("nostr_event");
    expect(html).toContain("invalid_placeholder");
  });

  it("4. renderPayloadDiagnosticsFromPreview matches the two-step pipeline", () => {
    const input = descriptor();
    expect(renderPayloadDiagnosticsFromPreview(input)).toBe(
      renderPayloadDiagnostics(buildPayloadDiagnostics(input)),
    );
  });

  it("5. source file never ACCESSES a ciphertext/nonce/plaintext/secret/raw-key field or byte buffer type — checked structurally, not as a bare word (the file's own honest reassurance copy legitimately names these words in prose)", () => {
    for (const forbidden of [
      /\.ciphertext\b/,
      /\.plaintext\b/,
      /\.nonce\b/,
      /\.secret\b/,
      /\.rawKey\b/,
      /\bUint8Array\b/,
      /\bArrayBuffer\b/,
      /\bpayment\b/i,
      /\bbuyer\b/i,
      /\bentitlement\b/i,
    ]) {
      expect(diagnosticsSource, `expected diagnosticsSource to not match ${forbidden}`).not.toMatch(
        forbidden,
      );
    }
  });

  it("6. not wired into Runtime or Worker in any way", () => {
    expect(diagnosticsSource).not.toMatch(/from\s+["'].*runtime/);
    expect(diagnosticsSource).not.toMatch(/from\s+["'].*worker/);
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/payload_diagnostics|buildPayloadDiagnostics|renderPayloadDiagnostics/);
    }
  });
});

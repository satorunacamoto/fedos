import { describe, it, expect } from "vitest";
import {
  renderEncryptedPayloadPreview,
  renderEncryptedPayloadPreviewPage,
} from "../src/render/encrypted_payload_preview.js";
import type { PayloadPreviewDescriptor } from "../src/storage/encrypted_payload.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import previewSource from "../src/render/encrypted_payload_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

// Strips `/** ... */` and `//` comment lines before scanning — this
// file's own doc comments legitimately name "payment"/"buyer"/
// "entitlement" in prose (listing what the descriptor type does NOT
// carry), which would otherwise false-positive a bare-word check.
const previewCodeOnly = previewSource
  .replace(/\/\*\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line: string) => !/^\s*\/\//.test(line))
  .join("\n");

function descriptor(overrides: Partial<PayloadPreviewDescriptor> = {}): PayloadPreviewDescriptor {
  return {
    version: "v1",
    algorithm: "chacha20poly1305",
    aadDomain: "conversation",
    encoding: "canonical_json_base64url_placeholder",
    transportKind: "storage",
    status: "valid_placeholder",
    payloadId: "payload-ref-123",
    ...overrides,
  };
}

describe("renderEncryptedPayloadPreview (Stage 189)", () => {
  it("1. renders the seven expected fields", () => {
    const html = renderEncryptedPayloadPreview(descriptor());
    expect(html).toContain("v1");
    expect(html).toContain("chacha20poly1305");
    expect(html).toContain("conversation");
    expect(html).toContain("canonical_json_base64url_placeholder");
    expect(html).toContain("payload-ref-123");
    expect(html).toContain("storage");
    expect(html).toContain("valid_placeholder");
  });

  it("2. renders '(none)' when payloadId is absent", () => {
    const { payloadId, ...rest } = descriptor();
    const html = renderEncryptedPayloadPreview(rest);
    expect(html).toContain("(none)");
  });

  it("3. HTML-escapes a hostile payloadId", () => {
    const html = renderEncryptedPayloadPreview(
      descriptor({ payloadId: `<script>alert("x")</script>` }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("4. renders Export/Download/Copy/Decrypt as permanently disabled buttons", () => {
    const html = renderEncryptedPayloadPreview(descriptor());
    for (const action of ["export", "download", "copy", "decrypt"]) {
      const re = new RegExp(`class="encrypted-payload-preview-${action}-button"[^>]*disabled`);
      expect(html, `expected a disabled ${action} button`).toMatch(re);
    }
  });

  it("5. renderEncryptedPayloadPreviewPage renders a note plus every descriptor's preview", () => {
    const html = renderEncryptedPayloadPreviewPage([descriptor(), descriptor({ payloadId: "other-ref" })]);
    expect(html).toContain("Encrypted payload preview");
    expect(html).toContain("payload-ref-123");
    expect(html).toContain("other-ref");
    expect((html.match(/encrypted-payload-preview-decrypt-button/g) ?? []).length).toBe(2);
  });

  it("6. never renders a forbidden word as a FIELD VALUE (inside a <dd> cell) — the fixed reassurance note is the one deliberate exception", () => {
    const html = renderEncryptedPayloadPreviewPage([descriptor()]);
    const values = [...html.matchAll(/<dd>(.*?)<\/dd>/g)].map((m) => (m[1] ?? "").toLowerCase());
    for (const value of values) {
      for (const forbidden of [
        "ciphertext",
        "nonce",
        "plaintext",
        "secret",
        "payment",
        "buyer",
        "entitlement",
        "tag",
        "chat",
        "body",
        "message",
      ]) {
        expect(value, `expected <dd> value "${value}" to not contain "${forbidden}"`).not.toContain(
          forbidden,
        );
      }
    }
  });

  it("7. source file never ACCESSES a ciphertext/nonce/plaintext/secret/raw-key field or byte buffer type — checked structurally, not as a bare word (the file's own honest reassurance copy and doc comments legitimately name these words in prose)", () => {
    for (const forbidden of [/\.ciphertext\b/, /\.plaintext\b/, /\.nonce\b/, /\.secret\b/, /\.rawKey\b/, /\bUint8Array\b/, /\bArrayBuffer\b/]) {
      expect(previewSource, `expected previewSource to not match ${forbidden}`).not.toMatch(forbidden);
    }
    // payment/buyer/entitlement are checked against CODE only (comments
    // stripped) — this file's own module doc comment legitimately lists
    // them in prose as fields the descriptor type does NOT carry.
    for (const forbidden of [/\bpayment\b/i, /\bbuyer\b/i, /\bentitlement\b/i]) {
      expect(previewCodeOnly, `expected previewCodeOnly to not match ${forbidden}`).not.toMatch(
        forbidden,
      );
    }
  });

  it("8. not wired into Runtime or Worker in any way", () => {
    expect(previewSource).not.toMatch(/from\s+["'].*runtime/);
    expect(previewSource).not.toMatch(/from\s+["'].*worker/);
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/encrypted_payload_preview|renderEncryptedPayloadPreview/);
    }
  });
});

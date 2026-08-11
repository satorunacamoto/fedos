import { describe, it, expect } from "vitest";
import { LocalMediaStore } from "../src/os/commerce/catalog/local_media_store.js";
import {
  computeCommerceMediaContentHash,
  verifyCommerceMediaContentAddress,
} from "../src/os/commerce/catalog/product_media_content_address.js";

const PNG_BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const OTHER_PNG_BYTES = new Uint8Array([9, 8, 7]);
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "video/mp4", "application/pdf"];

function newStore(maxBytes = 1_000_000): LocalMediaStore {
  return new LocalMediaStore(maxBytes, SUPPORTED_TYPES);
}

describe("computeCommerceMediaContentHash / verifyCommerceMediaContentAddress", () => {
  it("1. is deterministic — same bytes always hash the same", () => {
    const a = computeCommerceMediaContentHash(PNG_BYTES);
    const b = computeCommerceMediaContentHash(Uint8Array.from(PNG_BYTES));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("2. different bytes hash differently", () => {
    expect(computeCommerceMediaContentHash(PNG_BYTES)).not.toBe(computeCommerceMediaContentHash(OTHER_PNG_BYTES));
  });

  it("3. TAMPER DETECTION: verifyCommerceMediaContentAddress rejects bytes that don't match the claimed checksum", () => {
    const realChecksum = computeCommerceMediaContentHash(PNG_BYTES);
    expect(verifyCommerceMediaContentAddress(PNG_BYTES, realChecksum)).toBe(true);

    // Simulate a tampered/modified ciphertext arriving alongside the ORIGINAL claimed checksum.
    const tamperedBytes = Uint8Array.from(PNG_BYTES);
    tamperedBytes[0] = (tamperedBytes[0] ?? 0) ^ 0xff;
    expect(verifyCommerceMediaContentAddress(tamperedBytes, realChecksum)).toBe(false);
  });

  it("4. rejects a wrong/unrelated hash reference", () => {
    expect(verifyCommerceMediaContentAddress(PNG_BYTES, "0".repeat(64))).toBe(false);
    expect(verifyCommerceMediaContentAddress(PNG_BYTES, "not-a-hash")).toBe(false);
  });
});

describe("LocalMediaStore.put", () => {
  it("5. stores bytes and derives the key from their content hash — content-addressing is structural, not caller-chosen", () => {
    const store = newStore();
    const result = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") throw new Error("unreachable");
    expect(result.metadata.key).toBe(computeCommerceMediaContentHash(PNG_BYTES));
    expect(result.metadata.checksum).toBe(result.metadata.key);
    expect(result.metadata.sizeBytes).toBe(PNG_BYTES.length);
  });

  it("6. re-storing the exact same bytes + contentType is idempotent (already-present)", () => {
    const store = newStore();
    store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    const second = store.put({ bytes: Uint8Array.from(PNG_BYTES), contentType: "image/png" });
    expect(second.outcome).toBe("already-present");
  });

  it("7. the same bytes claimed under a different contentType is a conflict, never silently picks a winner", () => {
    const store = newStore();
    store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    const conflict = store.put({ bytes: PNG_BYTES, contentType: "image/jpeg" });
    expect(conflict.outcome).toBe("conflict");
  });

  it("8. OVERSIZED MEDIA: rejects bytes over the required, explicit maxPayloadByteLength policy", () => {
    const store = newStore(3);
    const result = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(result.outcome).toBe("oversized");
    expect(store.exists(computeCommerceMediaContentHash(PNG_BYTES))).toBe(false);
  });

  it("9. UNSUPPORTED MIME: rejects a contentType outside the explicit policy allowlist", () => {
    const store = newStore();
    const result = store.put({ bytes: PNG_BYTES, contentType: "application/x-executable" });
    expect(result.outcome).toBe("unsupported-content-type");
  });
});

describe("LocalMediaStore.get / exists / metadata / remove", () => {
  it("10. get() returns a defensive copy — mutating it never affects the store", () => {
    const store = newStore();
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");

    const first = store.get(stored.metadata.key);
    expect(first).not.toBeNull();
    if (first === null) throw new Error("unreachable");
    first.bytes[0] = 255;

    const second = store.get(stored.metadata.key);
    expect(second?.bytes[0]).toBe(PNG_BYTES[0]);
  });

  it("11. MISSING MEDIA: get()/metadata() return null for an unknown key, never throw", () => {
    const store = newStore();
    expect(store.get("unknown-key")).toBeNull();
    expect(store.metadata("unknown-key")).toBeNull();
    expect(store.exists("unknown-key")).toBe(false);
  });

  it("12. OFFLINE/UNAVAILABLE MEDIA (simulated via a not-yet-stored key): a caller sees a clean miss, not an exception", () => {
    const store = newStore();
    const neverStoredKey = computeCommerceMediaContentHash(new Uint8Array([42, 42, 42]));
    expect(() => store.get(neverStoredKey)).not.toThrow();
    expect(store.get(neverStoredKey)).toBeNull();
  });

  it("13. remove() reports whether something was actually removed, and the object is gone afterward", () => {
    const store = newStore();
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");

    expect(store.remove(stored.metadata.key)).toBe(true);
    expect(store.exists(stored.metadata.key)).toBe(false);
    expect(store.get(stored.metadata.key)).toBeNull();
    expect(store.remove(stored.metadata.key)).toBe(false);
  });

  it("14. metadata() returns descriptor fields without needing to copy any bytes", () => {
    const store = newStore();
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");
    expect(store.metadata(stored.metadata.key)).toEqual(stored.metadata);
  });
});

describe("LocalMediaStore determinism/isolation", () => {
  it("15. independent instances never share state", () => {
    const storeOne = newStore();
    const storeTwo = newStore();
    storeOne.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(storeOne.exists(computeCommerceMediaContentHash(PNG_BYTES))).toBe(true);
    expect(storeTwo.exists(computeCommerceMediaContentHash(PNG_BYTES))).toBe(false);
  });
});

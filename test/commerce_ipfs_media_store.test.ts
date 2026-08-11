import { describe, it, expect } from "vitest";
import { IpfsMediaStore, InMemoryIpfsTransport } from "../src/os/commerce/catalog/ipfs_media_store.js";
import { computeCommerceMediaContentHash } from "../src/os/commerce/catalog/product_media_content_address.js";
import { UnavailableProductMediaEncryption, type ProductMediaEncryptionPort } from "../src/os/commerce/catalog/product_media_encryption.js";

/**
 * Commerce E2E Completion arc (Wave B, Agent I) — tests for
 * `IpfsMediaStore`/`InMemoryIpfsTransport`
 * (`../src/os/commerce/catalog/ipfs_media_store.ts`). Every test here uses
 * ONLY the deterministic in-memory fake transport — no real IPFS node, no
 * network of any kind, per this arc's own constraints.
 */

const PNG_BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const OTHER_PNG_BYTES = new Uint8Array([9, 8, 7]);
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "video/mp4", "application/pdf"];

function newStore(
  transport: InMemoryIpfsTransport = new InMemoryIpfsTransport(),
  maxBytes = 1_000_000,
  encryption?: ProductMediaEncryptionPort,
): IpfsMediaStore {
  return new IpfsMediaStore(transport, maxBytes, SUPPORTED_TYPES, encryption);
}

/** A trivial ALWAYS-SUCCEEDS fake `ProductMediaEncryptionPort`, for tests that need `putProtected()` to actually succeed — never a real crypto primitive, deliberately just XORs a fixed byte so ciphertext != plaintext. */
class FakeAlwaysSucceedsEncryption implements ProductMediaEncryptionPort {
  async encrypt(plaintext: Uint8Array): Promise<Uint8Array | null> {
    const out = Uint8Array.from(plaintext);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) ^ 0xaa;
    return out;
  }
}

class FakeAlwaysFailsEncryption implements ProductMediaEncryptionPort {
  async encrypt(_plaintext: Uint8Array): Promise<Uint8Array | null> {
    return null;
  }
}

describe("IpfsMediaStore.put / get -- basic MediaStorePort parity with LocalMediaStore", () => {
  it("1. stores bytes and derives the key from the transport's own content-addressed CID", () => {
    const store = newStore();
    const result = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") throw new Error("unreachable");
    expect(result.metadata.key).toBe(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`);
    expect(result.metadata.checksum).toBe(computeCommerceMediaContentHash(PNG_BYTES));
    expect(result.metadata.sizeBytes).toBe(PNG_BYTES.length);
  });

  it("2. re-storing the exact same bytes + contentType is idempotent (already-present)", () => {
    const store = newStore();
    store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    const second = store.put({ bytes: Uint8Array.from(PNG_BYTES), contentType: "image/png" });
    expect(second.outcome).toBe("already-present");
  });

  it("3. the same bytes claimed under a different contentType is a conflict, never silently picks a winner", () => {
    const store = newStore();
    store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    const conflict = store.put({ bytes: PNG_BYTES, contentType: "image/jpeg" });
    expect(conflict.outcome).toBe("conflict");
  });

  it("4. OVERSIZED MEDIA: rejects bytes over the required, explicit maxPayloadByteLength policy, and never reaches the transport", () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 3);
    const result = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(result.outcome).toBe("oversized");
    expect(transport.cat(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`)).toBeNull();
  });

  it("5. UNSUPPORTED MIME: rejects a contentType outside the explicit policy allowlist", () => {
    const store = newStore();
    const result = store.put({ bytes: PNG_BYTES, contentType: "application/x-executable" });
    expect(result.outcome).toBe("unsupported-content-type");
  });

  it("6. get() returns a defensive copy — mutating it never affects the store or the transport", () => {
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

  it("7. remove() reports whether something was actually removed, and the object is gone afterward", () => {
    const store = newStore();
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");

    expect(store.remove(stored.metadata.key)).toBe(true);
    expect(store.exists(stored.metadata.key)).toBe(false);
    expect(store.get(stored.metadata.key)).toBeNull();
    expect(store.remove(stored.metadata.key)).toBe(false);
  });

  it("8. metadata() returns descriptor fields without needing to fetch any bytes", () => {
    const store = newStore();
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");
    expect(store.metadata(stored.metadata.key)).toEqual(stored.metadata);
  });

  it("9. independent instances never share state", () => {
    const storeOne = newStore();
    const storeTwo = newStore();
    const first = storeOne.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (first.outcome !== "stored") throw new Error("unreachable");
    expect(storeOne.exists(first.metadata.key)).toBe(true);
    expect(storeTwo.exists(first.metadata.key)).toBe(false);
  });

  it("10. best-effort pin: a successful put() results in the CID being pinned on the transport", () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport);
    const result = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (result.outcome !== "stored") throw new Error("unreachable");
    expect(transport.isPinned(result.metadata.key)).toBe(true);
  });
});

describe("IpfsMediaStore -- acceptance failure cases (§16/§29)", () => {
  it("11. MISSING MEDIA: get() on a nonexistent/never-stored CID fails closed to null, never throws", () => {
    const store = newStore();
    expect(() => store.get("fake-cid:does-not-exist")).not.toThrow();
    expect(store.get("fake-cid:does-not-exist")).toBeNull();
    expect(store.exists("fake-cid:does-not-exist")).toBe(false);
    expect(store.metadata("fake-cid:does-not-exist")).toBeNull();
  });

  it("12. WRONG CONTENT FOR A CID: a misbehaving/compromised node returning tampered bytes is detected and rejected, never returned", () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport);
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");

    // Simulate a compromised IPFS node: the SAME CID now resolves to DIFFERENT bytes.
    transport.corruptStoredBytes(stored.metadata.key, OTHER_PNG_BYTES);

    expect(store.get(stored.metadata.key)).toBeNull();
  });

  it("13. OFFLINE/UNAVAILABLE TRANSPORT: put() fails cleanly (never throws) when the backend is offline", () => {
    const transport = new InMemoryIpfsTransport({ simulateOffline: true });
    const store = newStore(transport);
    expect(() => store.put({ bytes: PNG_BYTES, contentType: "image/png" })).not.toThrow();
    const result = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(result.outcome).toBe("failed");
  });

  it("14. OFFLINE/UNAVAILABLE TRANSPORT: get() fails cleanly (never throws) when the backend goes offline after a successful put", () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport);
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");

    transport.setSimulateOffline(true);
    expect(() => store.get(stored.metadata.key)).not.toThrow();
    expect(store.get(stored.metadata.key)).toBeNull();
  });

  it("15. a transport whose add()/cat() THROW (contract violation) is still handled cleanly, never propagates", () => {
    const throwingTransport: InMemoryIpfsTransport = new InMemoryIpfsTransport();
    throwingTransport.add = () => {
      throw new Error("simulated transport bug");
    };
    const store = newStore(throwingTransport);
    expect(() => store.put({ bytes: PNG_BYTES, contentType: "image/png" })).not.toThrow();
    expect(store.put({ bytes: PNG_BYTES, contentType: "image/png" }).outcome).toBe("failed");
  });

  it('16. "local-only" network profile forbids put()/get() even when the transport itself is healthy', () => {
    const transport = new InMemoryIpfsTransport();
    const store = new IpfsMediaStore(transport, 1_000_000, SUPPORTED_TYPES, new UnavailableProductMediaEncryption(), "local-only");
    expect(store.put({ bytes: PNG_BYTES, contentType: "image/png" }).outcome).toBe("failed");

    // Store something via a permissive store sharing the same transport, then prove the local-only store still refuses to read it.
    const permissiveStore = newStore(transport);
    const stored = permissiveStore.put({ bytes: PNG_BYTES, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");
    expect(store.get(stored.metadata.key)).toBeNull();
  });
});

describe("IpfsMediaStore.putProtected / putPublic -- encrypt-first enforcement", () => {
  it("17. putProtected() with the default UnavailableProductMediaEncryption REFUSES to store anything -- fails closed, never touches the transport with plaintext", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport); // default encryption = UnavailableProductMediaEncryption
    const result = await store.putProtected(PNG_BYTES, "image/png");
    expect(result.outcome).toBe("failed");
    // Prove the plaintext bytes were never handed to the transport under their own plaintext CID.
    expect(transport.cat(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`)).toBeNull();
  });

  it("18. putProtected() with an encryption Port that fails (returns null) ALSO refuses to store — never a silent plaintext fallback", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysFailsEncryption());
    const result = await store.putProtected(PNG_BYTES, "image/png");
    expect(result.outcome).toBe("failed");
    expect(transport.cat(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`)).toBeNull();
  });

  it("19. putProtected() with a real (fake, always-succeeds) encryption Port stores CIPHERTEXT, never the plaintext bytes, under a CID derived from the ciphertext", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption());
    const result = await store.putProtected(PNG_BYTES, "image/png");
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") throw new Error("unreachable");

    // The plaintext's OWN would-be CID was never used/stored.
    expect(result.metadata.key).not.toBe(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`);

    const retrieved = store.get(result.metadata.key);
    expect(retrieved).not.toBeNull();
    if (retrieved === null) throw new Error("unreachable");
    expect(Buffer.from(retrieved.bytes).equals(Buffer.from(PNG_BYTES))).toBe(false);
  });

  it("20. putPublic() stores plaintext bytes directly, retrievable as-is (mirrors LocalMediaStore's own public-media posture)", () => {
    const store = newStore();
    const result = store.putPublic(PNG_BYTES, "image/png");
    expect(result.outcome).toBe("stored");
    if (result.outcome !== "stored") throw new Error("unreachable");
    expect(result.metadata.key).toBe(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`);

    const retrieved = store.get(result.metadata.key);
    expect(retrieved).not.toBeNull();
    expect(Buffer.from(retrieved!.bytes).equals(Buffer.from(PNG_BYTES))).toBe(true);
  });
});

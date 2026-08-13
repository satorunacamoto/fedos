import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { IpfsMediaStore, InMemoryIpfsTransport, type IpfsTransport } from "../src/os/commerce/catalog/ipfs_media_store.js";
import { computeCommerceMediaContentHash } from "../src/os/commerce/catalog/product_media_content_address.js";
import { UnavailableProductMediaEncryption, type ProductMediaEncryptionPort } from "../src/os/commerce/catalog/product_media_encryption.js";
import { UnavailableProductMediaDecryption, type ProductMediaDecryptionPort } from "../src/os/commerce/catalog/product_media_decryption.js";
import { WasmProductMediaEncryption } from "../src/os/commerce/catalog/wasm_product_media_encryption.js";
import { WasmProductMediaDecryption } from "../src/os/commerce/catalog/wasm_product_media_decryption.js";

/**
 * Commerce E2E Completion arc (Wave B, Agent I) + Commerce FINAL Closure
 * arc (Agent M, `getProtected()`/default-encryption tests) — tests for
 * `IpfsMediaStore`/`InMemoryIpfsTransport`
 * (`../src/os/commerce/catalog/ipfs_media_store.ts`). Every test here uses
 * ONLY the deterministic in-memory fake transport — no real IPFS node, no
 * network of any kind, per this arc's own constraints.
 */

const REAL_WASM_ARTIFACT_PRESENT = existsSync(
  new URL("../packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm", import.meta.url),
);

const PNG_BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const OTHER_PNG_BYTES = new Uint8Array([9, 8, 7]);
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "video/mp4", "application/pdf"];

function newStore(
  transport: InMemoryIpfsTransport = new InMemoryIpfsTransport(),
  maxBytes = 1_000_000,
  encryption?: ProductMediaEncryptionPort,
  decryption?: ProductMediaDecryptionPort,
): IpfsMediaStore {
  return new IpfsMediaStore(transport, maxBytes, SUPPORTED_TYPES, encryption, "direct", Date.now, decryption);
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

/** The exact inverse XOR of `FakeAlwaysSucceedsEncryption` above — round-trips a ciphertext it produced back to the original plaintext. Never a real crypto primitive. */
class FakeAlwaysSucceedsDecryption implements ProductMediaDecryptionPort {
  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array | null> {
    const out = Uint8Array.from(ciphertext);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) ^ 0xaa;
    return out;
  }
}

class FakeAlwaysFailsDecryption implements ProductMediaDecryptionPort {
  async decrypt(_ciphertext: Uint8Array): Promise<Uint8Array | null> {
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

  it('16. BLOCKER 4 FIX (Buyer Discovery + Digital Content Delivery mega-arc, Agent M): "local-only" still forbids put()/get() for a transport that HONESTLY declares requiresNetwork: true, even when otherwise healthy -- the real network-egress gate is preserved unweakened', () => {
    const networkTransport: IpfsTransport = {
      requiresNetwork: true,
      add: (bytes) => `fake-cid:${computeCommerceMediaContentHash(bytes)}`,
      cat: () => PNG_BYTES,
      pin: () => true,
    };
    const store = new IpfsMediaStore(networkTransport, 1_000_000, SUPPORTED_TYPES, new UnavailableProductMediaEncryption(), "local-only");
    expect(store.put({ bytes: PNG_BYTES, contentType: "image/png" }).outcome).toBe("failed");
    // get()'s identical network-access check is not separately exercised
    // here for the network-requiring-transport case: `#index` is private
    // per-instance (test 9), and this store's own put() above already
    // failed, so it structurally has no entry to look up -- asserting
    // `get()` returns `null` here would only re-prove the unrelated
    // "unknown key" path, not the network gate itself. `evaluateNetworkAccess()`
    // is still called identically in both put() and get() (this file's own
    // source), so this one behavioral proof on put() covers the shared gate
    // logic honestly, without a misleading second assertion.
  });

  it('16b. BLOCKER 4 FIX (this arc): "local-only" now PERMITS put()/get() against the real, always-local InMemoryIpfsTransport -- this is exactly commerceMediaStoreFor()\'s own real construction (transport=InMemoryIpfsTransport, networkProfile="local-only"), proving a seller\'s own local protected-media store genuinely durably stores/retrieves under the app\'s real default profile', () => {
    const transport = new InMemoryIpfsTransport();
    const store = new IpfsMediaStore(transport, 1_000_000, SUPPORTED_TYPES, new UnavailableProductMediaEncryption(), "local-only");
    const stored = store.put({ bytes: PNG_BYTES, contentType: "image/png" });
    expect(stored.outcome).toBe("stored");
    if (stored.outcome !== "stored") throw new Error("unreachable");
    const retrieved = store.get(stored.metadata.key);
    expect(retrieved).not.toBeNull();
    expect(Buffer.from(retrieved!.bytes).equals(Buffer.from(PNG_BYTES))).toBe(true);
  });

  it('16c. NEGATIVE CONTROL evidence (see this arc\'s own final report for the "temporarily revert, confirm the old failure" transcript) -- documents the exact pre-fix assertion that used to hold and no longer does: evaluateNetworkAccess(profile, true) unconditionally, regardless of the transport, made every "local-only" put()/get() fail even for a purely local transport. This test asserts the CORRECTED behavior (mirrors 16b) so a future accidental revert of the Blocker 4 fix fails this suite immediately.', () => {
    const transport = new InMemoryIpfsTransport();
    const store = new IpfsMediaStore(transport, 1_000_000, SUPPORTED_TYPES, new UnavailableProductMediaEncryption(), "local-only");
    expect(store.put({ bytes: PNG_BYTES, contentType: "image/png" }).outcome).not.toBe("failed");
  });
});

describe("IpfsMediaStore.putProtected / putPublic -- encrypt-first enforcement", () => {
  it("17. putProtected() with the DEFAULT (real) WasmProductMediaEncryption, and no injected/unlocked Master Seed Authority, STILL REFUSES to store anything -- fails closed exactly like UnavailableProductMediaEncryption did, never touches the transport with plaintext (Commerce FINAL Closure arc, Agent M: the default class changed from UnavailableProductMediaEncryption to WasmProductMediaEncryption -- see ipfs_media_store.ts's own header -- but its OBSERVABLE behavior here is unchanged: no real, unlocked authority means it still fails closed)", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport); // default encryption = WasmProductMediaEncryption(), default (empty, un-booted) authority
    const result = await store.putProtected(PNG_BYTES, "image/png");
    // Buyer Discovery + Digital Content Delivery mega-arc (Coordinator
    // validation-gate fix): this used to assert the bare `"failed"` that
    // `putProtected()` shared with `put()`'s own storage/network failures.
    // The refusal itself is UNCHANGED (nothing stored, no plaintext ever
    // reaches the transport -- still asserted below); only the outcome NAME
    // is now specific enough for a caller to tell an encryption outage from
    // a storage outage. See `IpfsMediaStoreProtectedPutResult`.
    expect(result.outcome).toBe("encryption-unavailable");
    // Prove the plaintext bytes were never handed to the transport under their own plaintext CID.
    expect(transport.cat(`fake-cid:${computeCommerceMediaContentHash(PNG_BYTES)}`)).toBeNull();
  });

  it('17b. REGRESSION GUARD for the same fix: an encryption failure and a STORAGE failure are no longer the same outcome string -- a caller can distinguish "nothing was encrypted" from "nothing was stored" without guessing. (The live bug this guards: a real seller saw "protected content storage failed: failed" for a pure encryption outage, with no way for anyone to tell which half had failed.)', async () => {
    const encryptionFailure = await newStore(new InMemoryIpfsTransport(), 1_000_000, new FakeAlwaysFailsEncryption()).putProtected(PNG_BYTES, "image/png");
    // A transport that cannot store anything, with encryption that WORKS.
    const offlineTransport = new InMemoryIpfsTransport({ simulateOffline: true });
    const storageFailure = await newStore(offlineTransport, 1_000_000, new FakeAlwaysSucceedsEncryption()).putProtected(PNG_BYTES, "image/png");
    expect(encryptionFailure.outcome).toBe("encryption-unavailable");
    expect(storageFailure.outcome).toBe("failed");
    expect(encryptionFailure.outcome).not.toBe(storageFailure.outcome);
  });


  it("18. putProtected() with an encryption Port that fails (returns null) ALSO refuses to store — never a silent plaintext fallback", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysFailsEncryption());
    const result = await store.putProtected(PNG_BYTES, "image/png");
    // See test 17's own note on why this outcome name changed; the refusal
    // and the "never a plaintext fallback" guarantee are unchanged.
    expect(result.outcome).toBe("encryption-unavailable");
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

describe("IpfsMediaStore.getProtected -- decrypt-first, fail-closed read path (Commerce FINAL Closure arc, Agent M)", () => {
  it("21. getProtected() on a MISSING key fails closed to null without ever calling decrypt()", async () => {
    const decryption = new FakeAlwaysFailsDecryption();
    const decryptSpy = vi.spyOn(decryption, "decrypt");
    const store = newStore(undefined, 1_000_000, new FakeAlwaysSucceedsEncryption(), decryption);
    const result = await store.getProtected("fake-cid:does-not-exist");
    expect(result).toBeNull();
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it("22. getProtected() with the default (real) WasmProductMediaDecryption, and no injected/unlocked Master Seed Authority, fails closed to null -- same posture as putProtected()'s own default (test 17)", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption()); // decryption omitted -> default WasmProductMediaDecryption()
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");

    const result = await store.getProtected(putResult.metadata.key);
    expect(result).toBeNull();
  });

  it("23. getProtected() with a decryption Port that fails (returns null) never returns ciphertext mislabeled as plaintext", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption(), new FakeAlwaysFailsDecryption());
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");

    const result = await store.getProtected(putResult.metadata.key);
    expect(result).toBeNull();
  });

  it("24. getProtected() with matching (fake) encryption/decryption Ports round-trips back to the ORIGINAL plaintext, byte for byte", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption(), new FakeAlwaysSucceedsDecryption());
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");

    const result = await store.getProtected(putResult.metadata.key);
    expect(result).not.toBeNull();
    expect(Buffer.from(result as Uint8Array).equals(Buffer.from(PNG_BYTES))).toBe(true);
  });

  it("25. TAMPERED CIPHERTEXT: getProtected() fails closed even with a working decryption Port, because get()'s own content-address re-check runs FIRST and rejects the corrupted bytes before decrypt() is ever reached", async () => {
    const transport = new InMemoryIpfsTransport();
    const decryption = new FakeAlwaysSucceedsDecryption();
    const decryptSpy = vi.spyOn(decryption, "decrypt");
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption(), decryption);
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");

    transport.corruptStoredBytes(putResult.metadata.key, OTHER_PNG_BYTES);

    const result = await store.getProtected(putResult.metadata.key);
    expect(result).toBeNull();
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it("26. WRONG KEY (simulated): a decryption Port that cannot authenticate this particular ciphertext (e.g. a different profile's key) fails closed to null, exactly like any other decrypt failure", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption(), new FakeAlwaysFailsDecryption());
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");
    expect(await store.getProtected(putResult.metadata.key)).toBeNull();
  });

  it("27. a decryption Port that THROWS is still handled cleanly, never propagates out of getProtected()", async () => {
    const transport = new InMemoryIpfsTransport();
    const throwingDecryption: ProductMediaDecryptionPort = {
      async decrypt(): Promise<Uint8Array | null> {
        throw new Error("simulated decrypt bug");
      },
    };
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption(), throwingDecryption);
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");
    await expect(store.getProtected(putResult.metadata.key)).resolves.toBeNull();
  });

  it("28. UnavailableProductMediaDecryption (explicitly injected) always fails closed, mirroring UnavailableProductMediaEncryption exactly", async () => {
    const transport = new InMemoryIpfsTransport();
    const store = newStore(transport, 1_000_000, new FakeAlwaysSucceedsEncryption(), new UnavailableProductMediaDecryption());
    const putResult = await store.putProtected(PNG_BYTES, "image/png");
    if (putResult.outcome !== "stored") throw new Error("unreachable");
    expect(await store.getProtected(putResult.metadata.key)).toBeNull();
  });

  it.skipIf(!REAL_WASM_ARTIFACT_PRESENT)(
    "29. [only runs if packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm exists] REAL end-to-end round trip: putProtected() (real WasmProductMediaEncryption) -> getProtected() (real WasmProductMediaDecryption), sharing ONE real, freshly-generated Master Seed Authority instance, recovers the EXACT original plaintext -- proves the full protected-media pipeline (plaintext -> local encryption -> ciphertext -> content addressing -> storage -> content-address re-check -> decryption -> plaintext) with genuine Rust/WASM AEAD under the CommerceMedia domain, not a fake.",
    async () => {
      const { FedosWasmLoaderSkeleton } = await import("../src/os/core/vault/wasm/fedos_wasm_loader.js");
      const { FedosWasmMasterSeedAuthority } = await import(
        "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js"
      );
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        const loader = new FedosWasmLoaderSkeleton();
        loader.planLoad();
        const importResult = await loader.attemptDevOnlyJsGlueImport();
        expect(importResult.succeeded, JSON.stringify(importResult)).toBe(true);
        const wasmInit = await loader.attemptDevOnlyWasmInitialization();
        expect(wasmInit.succeeded, JSON.stringify(wasmInit)).toBe(true);

        const authority = new FedosWasmMasterSeedAuthority(loader);
        const generated = await authority.generate();
        expect(generated).toBe(true);

        // ONE shared authority instance, exactly mirroring
        // `fedos_conversation_production_crypto_authority_factory.ts`'s own
        // "one Master Seed Authority instance, shared across every Authority
        // that needs it" pattern -- never two separate/unrelated Master Seeds.
        const encryption = new WasmProductMediaEncryption(authority);
        const decryption = new WasmProductMediaDecryption(authority);

        const transport = new InMemoryIpfsTransport();
        const store = new IpfsMediaStore(transport, 1_000_000, SUPPORTED_TYPES, encryption, "direct", Date.now, decryption);

        const plaintext = new TextEncoder().encode("a real product photo's real plaintext bytes, end to end");
        const putResult = await store.putProtected(plaintext, "image/png");
        expect(putResult.outcome, JSON.stringify(putResult)).toBe("stored");
        if (putResult.outcome !== "stored") throw new Error("unreachable");

        // The stored ciphertext is genuinely NOT the plaintext.
        const rawStored = store.get(putResult.metadata.key);
        expect(rawStored).not.toBeNull();
        expect(Buffer.from(rawStored!.bytes).equals(Buffer.from(plaintext))).toBe(false);

        const recovered = await store.getProtected(putResult.metadata.key);
        expect(recovered).not.toBeNull();
        expect(Buffer.from(recovered as Uint8Array).equals(Buffer.from(plaintext))).toBe(true);

        // A SECOND, independent (never-generated) authority's key must NOT decrypt this ciphertext.
        const otherLoader = new FedosWasmLoaderSkeleton();
        otherLoader.planLoad();
        await otherLoader.attemptDevOnlyJsGlueImport();
        await otherLoader.attemptDevOnlyWasmInitialization();
        const otherAuthority = new FedosWasmMasterSeedAuthority(otherLoader);
        expect(await otherAuthority.generate()).toBe(true);
        const wrongKeyDecryption = new WasmProductMediaDecryption(otherAuthority);
        const wrongKeyResult = await wrongKeyDecryption.decrypt(rawStored!.bytes);
        expect(wrongKeyResult).toBeNull();
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    },
  );
});

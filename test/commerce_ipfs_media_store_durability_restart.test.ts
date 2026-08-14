import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IpfsMediaStore } from "../src/os/commerce/catalog/ipfs_media_store.js";
import { DurableIpfsTransport } from "../src/os/commerce/catalog/persistence/durable_ipfs_transport.js";
import { DurableIpfsMediaStoreIndex } from "../src/os/commerce/catalog/persistence/durable_ipfs_media_store_index.js";
import type { ProductMediaEncryptionPort } from "../src/os/commerce/catalog/product_media_encryption.js";
import type { ProductMediaDecryptionPort } from "../src/os/commerce/catalog/product_media_decryption.js";

/**
 * Real Digital Delivery mega-arc (Coordinator, protected-media-byte-
 * durability closure) — THE LOAD-BEARING REGRESSION TEST for
 * `docs/commerce/PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md`, at the exact
 * layer the live E2E failure actually happens: `IpfsMediaStore` itself,
 * not just the raw transport in isolation. Reproduces the precise
 * documented sequence — attach protected content, persist, DESTROY the
 * seller's storage adapter instance, RECONSTRUCT it (a real process
 * restart's own effect on `commerceMediaStoreFor()`'s module-level
 * singleton), then redeem — and proves it now round-trips.
 *
 * WHY THIS TEST EXISTS SEPARATELY FROM `commerce_durable_ipfs_transport.test.ts`:
 * a durable TRANSPORT alone is necessary but not sufficient.
 * `IpfsMediaStore` keeps its OWN private metadata index (`contentType`/
 * `checksum`/`sizeBytes`/`storedAt`), rebuilt EMPTY on every construction,
 * and its `get()`/`metadata()`/`getProtected()` all check that index FIRST
 * — returning a miss WITHOUT EVER CALLING THE TRANSPORT if the entry is
 * absent (`ipfs_media_store.ts`, `get()`/`metadata()`). A test that only
 * exercised `DurableIpfsTransport` in isolation could pass while the real,
 * shipped composition (`IpfsMediaStore` wrapping it) still returned
 * `content-checksum-mismatch` after a restart — this test proves the
 * WHOLE wrapped store, both durability seams together, the same way the
 * real `commerceMediaStoreFor()` composes them.
 *
 * `IpfsMediaStore`'s own bare `put()`/`get()` (unauthenticated bytes) are
 * used here rather than `putProtected()`/`getProtected()`'s real WASM
 * encryption, matching `commerce_ipfs_media_store.test.ts`'s own
 * established "trivial fake XOR encryption" discipline for the protected
 * variant — never a real crypto primitive, deliberately, so this suite
 * stays fast and has no WASM-artifact precondition; the checksum/index
 * durability property under test is identical either way (`put()` itself
 * is exactly what `putProtected()` calls once encryption has already
 * finished, per `ipfs_media_store.ts`'s own header).
 */

const REAL_CONTENT = new TextEncoder().encode("this is the real, protected purchased content, byte for byte");
const SUPPORTED_TYPES = ["application/pdf"];
const MAX_BYTES = 1_000_000;

/** Mirrors `commerce_ipfs_media_store.test.ts`'s own fake — never a real crypto primitive, deliberately just XORs a fixed byte so ciphertext != plaintext, round-trips exactly. */
class FakeAlwaysSucceedsEncryption implements ProductMediaEncryptionPort {
  async encrypt(plaintext: Uint8Array): Promise<Uint8Array | null> {
    const out = Uint8Array.from(plaintext);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) ^ 0xaa;
    return out;
  }
}
class FakeAlwaysSucceedsDecryption implements ProductMediaDecryptionPort {
  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array | null> {
    const out = Uint8Array.from(ciphertext);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) ^ 0xaa;
    return out;
  }
}

const dirs: string[] = [];
function freshStorageDir(): { blobDir: string; indexFilePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fedos-ipfs-media-store-restart-"));
  dirs.push(dir);
  return { blobDir: join(dir, "media_blobs"), indexFilePath: join(dir, "media_index.ndjson") };
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function newDurableStore(paths: { blobDir: string; indexFilePath: string }): IpfsMediaStore {
  return new IpfsMediaStore(
    new DurableIpfsTransport(paths.blobDir),
    MAX_BYTES,
    SUPPORTED_TYPES,
    new FakeAlwaysSucceedsEncryption(),
    "local-only",
    Date.now,
    new FakeAlwaysSucceedsDecryption(),
    new DurableIpfsMediaStoreIndex(paths.indexFilePath),
  );
}

describe("IpfsMediaStore + DurableIpfsTransport/DurableIpfsMediaStoreIndex -- the exact live restart gap, closed", () => {
  it("BEFORE/AFTER regression: attach protected content -> persist -> DESTROY the store instance -> RECONSTRUCT -> redeem -- now genuinely round-trips (this exact sequence against the OLD in-memory-only composition returned content-checksum-mismatch/null; see docs/commerce/PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md)", async () => {
    const paths = freshStorageDir();

    // "Bob's process, session 1" -- attach real protected content.
    const sellerSession1 = newDurableStore(paths);
    const putResult = await sellerSession1.putProtected(REAL_CONTENT, "application/pdf");
    expect(putResult.outcome).toBe("stored");
    const key = (putResult as { outcome: "stored"; metadata: { key: string } }).metadata.key;

    // "Bob's process exits, then restarts" -- a brand-new IpfsMediaStore instance,
    // brand-new DurableIpfsTransport instance, brand-new DurableIpfsMediaStoreIndex
    // instance -- zero shared in-memory state with sellerSession1, exactly like a
    // real process restart (commerceMediaStoreFor()'s module-level singleton reset).
    const sellerSession2 = newDurableStore(paths);

    // The metadata index survived the restart (the finding this test exists to prove).
    expect(sellerSession2.metadata(key)).not.toBeNull();
    expect(sellerSession2.metadata(key)!.checksum).toBe(sellerSession1.metadata(key)!.checksum);

    // "Alice's redeem request, served by Bob's restarted process" -- the exact call
    // applyInboundPrivateMediaReleaseRequestNonFatal() makes via getProtectedContent.
    const redeemed = await sellerSession2.getProtected(key);
    expect(redeemed).toEqual(REAL_CONTENT);
  });

  it("the metadata checksum recorded before restart is EXACTLY what a fresh instance recovers -- not just \"some truthy value\" (a real content-identity gate compares this field byte-for-byte)", async () => {
    const paths = freshStorageDir();
    const sellerSession1 = newDurableStore(paths);
    const putResult = await sellerSession1.putProtected(REAL_CONTENT, "application/pdf");
    const metadataBeforeRestart = (putResult as { outcome: "stored"; metadata: { key: string; checksum: string; contentType: string; sizeBytes: number } }).metadata;

    const sellerSession2 = newDurableStore(paths);
    const metadataAfterRestart = sellerSession2.metadata(metadataBeforeRestart.key);

    expect(metadataAfterRestart).toEqual(metadataBeforeRestart);
  });

  it("multiple restarts in a row (mirrors a real seller closing/reopening the app repeatedly between listing an item and it eventually selling) never lose or corrupt the object", async () => {
    const paths = freshStorageDir();
    const session1 = newDurableStore(paths);
    const putResult = await session1.putProtected(REAL_CONTENT, "application/pdf");
    const key = (putResult as { outcome: "stored"; metadata: { key: string } }).metadata.key;

    for (let restart = 0; restart < 5; restart++) {
      const session = newDurableStore(paths);
      const redeemed = await session.getProtected(key);
      expect(redeemed, `restart #${restart}`).toEqual(REAL_CONTENT);
    }
  });

  it("a genuinely missing/never-attached key is an honest miss after restart too -- never a false success (mirrors the mandate's own \"missing content never produces false completion\" negative-control requirement)", async () => {
    const paths = freshStorageDir();
    const session1 = newDurableStore(paths);
    // Nothing ever put() in session 1.
    const session2 = newDurableStore(paths);
    expect(await session2.getProtected("fake-cid:" + "0".repeat(64))).toBeNull();
    expect(session1.metadata("fake-cid:" + "0".repeat(64))).toBeNull();
  });

  it("PROFILE ISOLATION: two independent sellers (two separate profile directories) never see each other's protected content, even across restarts", async () => {
    const bobPaths = freshStorageDir();
    const alicePaths = freshStorageDir();

    const bobSession1 = newDurableStore(bobPaths);
    const putResult = await bobSession1.putProtected(REAL_CONTENT, "application/pdf");
    const key = (putResult as { outcome: "stored"; metadata: { key: string } }).metadata.key;

    // Alice's own profile, own fresh store -- never constructed from Bob's paths.
    const aliceSession = newDurableStore(alicePaths);
    expect(aliceSession.metadata(key)).toBeNull();
    expect(await aliceSession.getProtected(key)).toBeNull();

    // Sanity: Bob's own restart still works, unaffected by Alice's isolated store existing.
    const bobSession2 = newDurableStore(bobPaths);
    expect(await bobSession2.getProtected(key)).toEqual(REAL_CONTENT);
  });
});

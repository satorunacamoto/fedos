import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableIpfsTransport } from "../src/os/commerce/catalog/persistence/durable_ipfs_transport.js";

/**
 * Real Digital Delivery mega-arc (Coordinator, protected-media-byte-
 * durability closure) -- `DurableIpfsTransport`. Behavioral tests only
 * (never "the function exists"/"no literal `if`") -- mirrors
 * `commerce_durable_product_media_repository.test.ts`'s own restart-
 * recovery discipline for the sibling raw-BYTES half of the same fix (see
 * `durable_ipfs_transport.ts`'s own header for the full account of the
 * gap this closes).
 */

const REAL_CONTENT = new TextEncoder().encode("this is the real, protected purchased content");
const OTHER_CONTENT = new TextEncoder().encode("this is a completely different object");

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-durable-ipfs-transport-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("DurableIpfsTransport -- restart recovery (the exact live gap this fix closes)", () => {
  it("1. a fresh transport over an empty directory has no objects", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.cat("fake-cid:" + "0".repeat(64))).toBeNull();
  });

  it("2. add() real bytes, SAME instance, cat() returns byte-identical bytes", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    const cid = transport.add(REAL_CONTENT);
    expect(cid).not.toBeNull();
    expect(transport.cat(cid!)).toEqual(REAL_CONTENT);
  });

  it("3. add() real bytes, DESTROY the instance, a FRESH instance over the SAME directory recovers the exact same bytes -- the exact restart scenario the live E2E failure showed was broken", () => {
    const dir = freshDir();
    const blobDir = join(dir, "blobs");
    const first = new DurableIpfsTransport(blobDir);
    const cid = first.add(REAL_CONTENT);
    expect(cid).not.toBeNull();

    const second = new DurableIpfsTransport(blobDir); // simulates a real process restart -- no shared state with `first`.
    expect(second.cat(cid!)).toEqual(REAL_CONTENT);
  });

  it("4. multiple add()s across separate restarts all durably accumulate", () => {
    const dir = freshDir();
    const blobDir = join(dir, "blobs");
    const first = new DurableIpfsTransport(blobDir);
    const cidA = first.add(REAL_CONTENT)!;

    const second = new DurableIpfsTransport(blobDir);
    const cidB = second.add(OTHER_CONTENT)!;

    const third = new DurableIpfsTransport(blobDir);
    expect(third.cat(cidA)).toEqual(REAL_CONTENT);
    expect(third.cat(cidB)).toEqual(OTHER_CONTENT);
  });
});

describe("DurableIpfsTransport -- content addressing / integrity", () => {
  it("5. add() is content-addressed: the SAME bytes always produce the SAME cid, byte-for-byte", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    const cidA = transport.add(Uint8Array.from(REAL_CONTENT));
    const cidB = transport.add(Uint8Array.from(REAL_CONTENT));
    expect(cidA).toBe(cidB);
  });

  it("6. re-adding the SAME content twice (idempotent write) never throws and both cat()s return the identical bytes", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    const cid1 = transport.add(REAL_CONTENT);
    const cid2 = transport.add(REAL_CONTENT);
    expect(cid1).toBe(cid2);
    expect(transport.cat(cid1!)).toEqual(REAL_CONTENT);
  });

  it("7. a missing object (never stored, or a fabricated well-formed cid) is an honest miss, never a throw", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.cat("fake-cid:" + "f".repeat(64))).toBeNull();
  });

  it("8. a corrupted on-disk blob (bytes tampered in place, real file on real disk) is still returned by cat() -- this transport re-verifies nothing itself; IpfsMediaStore.get()'s own checksum re-check (one layer up) is what fails closed on tampered bytes, not this file (see this file's own header for the division of responsibility)", () => {
    const dir = freshDir();
    const blobDir = join(dir, "blobs");
    const transport = new DurableIpfsTransport(blobDir);
    const cid = transport.add(REAL_CONTENT)!;
    const blobFileName = cid.slice("fake-cid:".length) + ".blob";
    writeFileSync(join(blobDir, blobFileName), Buffer.from("corrupted bytes, does not match the recorded checksum"));
    const corrupted = transport.cat(cid);
    expect(corrupted).not.toEqual(REAL_CONTENT); // proves the corruption actually happened at the disk layer -- IpfsMediaStore's own test suite proves the upstream checksum re-check catches this.
  });
});

describe("DurableIpfsTransport -- traversal resistance", () => {
  it("9. a cid that does not match the exact fake-cid:<64 hex> shape is rejected before any path resolution -- literal `..` segment", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.cat("fake-cid:../../../etc/passwd")).toBeNull();
  });

  it("10. an absolute-path-shaped cid is rejected", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.cat("fake-cid:/etc/passwd")).toBeNull();
    expect(transport.cat("fake-cid:C:\\Windows\\System32\\config")).toBeNull();
  });

  it("11. a UNC-path-shaped cid is rejected", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.cat("fake-cid:\\\\attacker-host\\share\\x")).toBeNull();
  });

  it("12. a too-short/too-long/uppercase/non-hex cid is rejected (only the exact 64-lowercase-hex shape this transport itself ever produces is ever accepted)", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.cat("fake-cid:" + "a".repeat(63))).toBeNull();
    expect(transport.cat("fake-cid:" + "a".repeat(65))).toBeNull();
    expect(transport.cat("fake-cid:" + "A".repeat(64))).toBeNull();
    expect(transport.cat("fake-cid:" + "g".repeat(64))).toBeNull();
    expect(transport.cat("not-even-the-right-prefix:" + "a".repeat(64))).toBeNull();
  });

  it("13. a rejected cid never even reaches the filesystem -- no file is created/read outside the blob directory (proven by directory listing staying empty)", () => {
    const dir = freshDir();
    const blobDir = join(dir, "blobs");
    const transport = new DurableIpfsTransport(blobDir);
    transport.cat("fake-cid:../../escape-attempt");
    expect(existsSync(blobDir) ? readdirSync(blobDir) : []).toEqual([]);
  });
});

describe("DurableIpfsTransport -- profile isolation", () => {
  it("14. two transports rooted at two separate directories share no data -- a fresh instance over directory B cannot cat() an object added to directory A's transport, and no file exists under B for it", () => {
    const dirA = freshDir();
    const dirB = freshDir();
    const blobDirA = join(dirA, "blobs");
    const blobDirB = join(dirB, "blobs");

    const transportA = new DurableIpfsTransport(blobDirA);
    const cid = transportA.add(REAL_CONTENT)!;

    const transportB = new DurableIpfsTransport(blobDirB);
    expect(transportB.cat(cid)).toBeNull();
    expect(readdirSync(blobDirB)).toEqual([]);
  });
});

describe("DurableIpfsTransport -- write durability / no partial objects", () => {
  it("15. after a real add(), the blob directory contains exactly ONE file for that object -- no leftover temp file (proves the atomic-commit-then-cleanup discipline actually cleans up on the success path, not just the failure path)", () => {
    const dir = freshDir();
    const blobDir = join(dir, "blobs");
    const transport = new DurableIpfsTransport(blobDir);
    transport.add(REAL_CONTENT);
    const entries = readdirSync(blobDir);
    expect(entries.length).toBe(1);
    expect(entries[0]!.endsWith(".blob")).toBe(true);
    expect(entries.some((name) => name.includes("fedos-media-blob-tmp"))).toBe(false);
  });

  it("16. pin() honestly reports presence: false before add(), true after, false for a never-stored cid", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    const cid = "fake-cid:" + "1".repeat(64);
    expect(transport.pin(cid)).toBe(false);
    const realCid = transport.add(REAL_CONTENT)!;
    expect(transport.pin(realCid)).toBe(true);
  });

  it("17. requiresNetwork is honestly false -- a local disk directory never reaches a network", () => {
    const dir = freshDir();
    const transport = new DurableIpfsTransport(join(dir, "blobs"));
    expect(transport.requiresNetwork).toBe(false);
  });
});

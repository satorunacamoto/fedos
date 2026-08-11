import { describe, it, expect, beforeEach, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { signMediaAccessGrant } from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import type { MediaAccessGrantPayload } from "../src/os/commerce/media_grant/media_access_grant_types.js";
import {
  AppendOnlyMediaAccessGrantPersistence,
  latestGrantVersion,
} from "../src/os/commerce/media_grant/media_access_grant_persistence.js";

const SELLER_KP = PersonaEpochSigningKeypair.generate();

function payload(overrides: Partial<MediaAccessGrantPayload> = {}): MediaAccessGrantPayload {
  return {
    formatVersion: 1,
    mediaId: "media-1",
    productId: "product-1",
    buyerPubkey: "b".repeat(64),
    orderId: "order-1",
    issuerPubkey: SELLER_KP.publicKeyHex,
    grantVersion: 1,
    revoked: false,
    validFrom: 1_000,
    validUntil: null,
    issuedAt: 1_000,
    ...overrides,
  };
}

function envelope(overrides: Partial<MediaAccessGrantPayload> = {}) {
  const p = payload(overrides);
  return signMediaAccessGrant(p, SELLER_KP, { issuer: SELLER_KP.publicKeyHex, issuedAt: p.issuedAt });
}

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-media-grant-persistence-"));
  filePath = join(dir, "media_access_grants.ndjson");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("AppendOnlyMediaAccessGrantPersistence", () => {
  it("starts empty for a nonexistent file (ENOENT is not corruption)", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    expect(store.listGrants()).toEqual([]);
  });

  it("putGrant inserts, then reports already-present for a byte-identical duplicate", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    const e = envelope();
    expect(store.putGrant(e)).toBe("inserted");
    expect(store.putGrant(e)).toBe("already-present");
    expect(store.listGrants()).toHaveLength(1);
  });

  it("keeps MULTIPLE versions for the same (mediaId, buyerPubkey, orderId) triple -- revocation-as-new-version, never overwritten", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    const v1 = envelope({ grantVersion: 1 });
    const v2 = envelope({ grantVersion: 2, revoked: true });
    expect(store.putGrant(v1)).toBe("inserted");
    expect(store.putGrant(v2)).toBe("inserted");
    const all = store.listGrants();
    expect(all).toHaveLength(2);
    expect(latestGrantVersion(all, "media-1", "b".repeat(64), "order-1")).toBe(2);
  });

  it("reports conflict for two DIFFERENT envelopes claiming the identical (mediaId, buyerPubkey, orderId, grantVersion) key", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    const v1a = envelope({ grantVersion: 1, revoked: false });
    expect(store.putGrant(v1a)).toBe("inserted");
    // Same grantVersion=1, but a DIFFERENT signed envelope (different issuedAt/signature) for the same triple.
    const v1b = signMediaAccessGrant(payload({ grantVersion: 1, issuedAt: 2_000 }), SELLER_KP, {
      issuer: SELLER_KP.publicKeyHex,
      issuedAt: 2_000,
    });
    expect(store.putGrant(v1b)).toBe("conflict");
    expect(store.listGrants()).toHaveLength(1); // the conflicting record was never appended
  });

  it("fails closed (throws) on a corrupt/unparseable log line", () => {
    appendFileSync(filePath, "{ this is not valid JSON\n", "utf8");
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    expect(() => store.listGrants()).toThrow();
  });

  it("fails closed (throws) on a structurally off-schema JSON line", () => {
    appendFileSync(filePath, JSON.stringify({ not: "a grant envelope" }) + "\n", "utf8");
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    expect(() => store.listGrants()).toThrow();
  });

  it("does NOT verify signatures at the storage layer -- a structurally well-formed but cryptographically bogus envelope is stored as-is (business-rule verification is evaluateMediaAccessGrant()'s job)", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    const e = envelope();
    const bogusSignature = { ...e, signature: "0".repeat(128) };
    expect(store.putGrant(bogusSignature)).toBe("inserted");
    expect(store.listGrants()).toHaveLength(1);
  });

  it("latestGrantVersion returns 0 for an unknown triple", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    store.putGrant(envelope({ grantVersion: 1 }));
    expect(latestGrantVersion(store.listGrants(), "media-999", "b".repeat(64), "order-1")).toBe(0);
  });

  it("different (mediaId, buyerPubkey, orderId) triples never collide even with adversarially chosen ids", () => {
    const store = new AppendOnlyMediaAccessGrantPersistence(filePath);
    // "a,b" + "c" vs "a" + "b,c" style collision attempt across the JSON-array key encoding.
    const eA = envelope({ mediaId: "a,b", buyerPubkey: "c".repeat(64), orderId: "order-x", grantVersion: 1 });
    const eB = envelope({ mediaId: "a", buyerPubkey: "c".repeat(64), orderId: "b,c-order-x", grantVersion: 1 });
    expect(store.putGrant(eA)).toBe("inserted");
    expect(store.putGrant(eB)).toBe("inserted");
    expect(store.listGrants()).toHaveLength(2);
  });
});

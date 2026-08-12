import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DurableSealedSigningKeyStore,
  resolveCommerceMediaGrantSigningKeypair,
  COMMERCE_MEDIA_GRANT_SIGNING_KEY_PURPOSE,
} from "../src/os/commerce/media_grant/persistence/durable_media_grant_signing_key_store.js";
import { FakeFedosDirectRatchetSealingAuthority } from "./support/fake_direct_ratchet_sealing_authority.js";

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) — durability tests for the merchant media-grant-signing
 * keypair, mirroring `test/commerce_receipt_issuer_signing_key_durability.test.ts`'s
 * own precedent exactly (same shared foundation underneath).
 */

const SUBJECT = "claimed-seller-pubkey-a".repeat(2).slice(0, 64);

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-media-grant-signer-"));
  dir = d;
  return d;
}

describe("resolveCommerceMediaGrantSigningKeypair — first-ever resolve", () => {
  it("mints+seals a fresh keypair at generation 0 when createIfAbsent is true", async () => {
    const filePath = join(freshDir(), "media_grant_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const store = new DurableSealedSigningKeyStore(filePath);

    const result = await resolveCommerceMediaGrantSigningKeypair(authority, store, SUBJECT, true, 1_000);
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created" && result.outcome !== "restored") throw new Error("unreachable");
    expect(result.generation).toBe(0);
    expect(result.keypair.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

    const persisted = store.latestFor(SUBJECT);
    expect(persisted?.purpose).toBe(COMMERCE_MEDIA_GRANT_SIGNING_KEY_PURPOSE);
    expect(persisted?.publicKeyHex).toBe(result.keypair.publicKeyHex);
  });

  it("createIfAbsent=false with nothing sealed yet -> 'not-found', never mints as a side effect of a read-only query", async () => {
    const filePath = join(freshDir(), "media_grant_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const store = new DurableSealedSigningKeyStore(filePath);
    const result = await resolveCommerceMediaGrantSigningKeypair(authority, store, SUBJECT, false, 1_000);
    expect(result.outcome).toBe("not-found");
    expect(store.latestFor(SUBJECT)).toBeUndefined();
  });
});

describe("resolveCommerceMediaGrantSigningKeypair — restart recovery", () => {
  it("a SECOND resolve over a FRESH store instance restores the SAME publicKeyHex", async () => {
    const filePath = join(freshDir(), "media_grant_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();

    const store1 = new DurableSealedSigningKeyStore(filePath);
    const launch1 = await resolveCommerceMediaGrantSigningKeypair(authority, store1, SUBJECT, true, 1_000);
    expect(launch1.outcome).toBe("created");
    if (launch1.outcome !== "created") throw new Error("unreachable");

    const store2 = new DurableSealedSigningKeyStore(filePath);
    const launch2 = await resolveCommerceMediaGrantSigningKeypair(authority, store2, SUBJECT, true, 2_000);
    expect(launch2.outcome).toBe("restored");
    if (launch2.outcome !== "restored") throw new Error("unreachable");
    expect(launch2.keypair.publicKeyHex).toBe(launch1.keypair.publicKeyHex);
    expect(launch2.generation).toBe(0);
  });

  it("DIFFERENT claimed subjectIds get DIFFERENT, unrelated keypairs (never a shared/global identity)", async () => {
    const filePath = join(freshDir(), "media_grant_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const store = new DurableSealedSigningKeyStore(filePath);

    const a = await resolveCommerceMediaGrantSigningKeypair(authority, store, "seller-a".repeat(8), true, 1_000);
    const b = await resolveCommerceMediaGrantSigningKeypair(authority, store, "seller-b".repeat(8), true, 1_000);
    if (a.outcome !== "created" || b.outcome !== "created") throw new Error("unreachable");
    expect(a.keypair.publicKeyHex).not.toBe(b.keypair.publicKeyHex);
  });
});

describe("resolveCommerceMediaGrantSigningKeypair — fails closed, never fabricates a replacement identity", () => {
  it("a tampered sealed record resolves to 'corrupted', never a silently-working keypair", async () => {
    const filePath = join(freshDir(), "media_grant_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const store1 = new DurableSealedSigningKeyStore(filePath);
    const created = await resolveCommerceMediaGrantSigningKeypair(authority, store1, SUBJECT, true, 1_000);
    expect(created.outcome).toBe("created");

    const raw = readFileSync(filePath, "utf8");
    const record = JSON.parse(raw.trim()) as { sealedBlob: string; [key: string]: unknown };
    const lastChar = record.sealedBlob.slice(-1);
    record.sealedBlob = record.sealedBlob.slice(0, -1) + (lastChar === "0" ? "1" : "0");
    writeFileSync(filePath, JSON.stringify(record) + "\n", "utf8");

    const store2 = new DurableSealedSigningKeyStore(filePath);
    const result = await resolveCommerceMediaGrantSigningKeypair(authority, store2, SUBJECT, true, 2_000);
    expect(result.outcome).toBe("corrupted");
  });

  it("no sealing authority (null) -> 'sealing-unavailable' on first-ever resolve, never fabricates a key", async () => {
    const filePath = join(freshDir(), "media_grant_signing_keys.ndjson");
    const store = new DurableSealedSigningKeyStore(filePath);
    const result = await resolveCommerceMediaGrantSigningKeypair(null, store, SUBJECT, true, 1_000);
    expect(result.outcome).toBe("sealing-unavailable");
    expect(store.latestFor(SUBJECT)).toBeUndefined();
  });
});

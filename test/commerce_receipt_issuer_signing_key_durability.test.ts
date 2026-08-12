import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DurableSealedSigningKeyStore,
  resolveReceiptIssuerSigningKeypair,
  COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE,
} from "../src/os/trust/issuer/durable_receipt_issuer_signing_key_store.js";
import { verifyFedosTrustSignatureOverBytes, type FedosTrustSigningKeypair } from "../src/os/trust/envelope/fedos_trust_signing_keypair.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { createSingleIssuerFedosTrustPolicy } from "../src/os/trust/policy/index.js";
import {
  computeFedosTrustArtifactDigestHexSha256,
  issueFedosTrustContractArtifactProof,
  verifyFedosTrustContractArtifactProof,
} from "../src/os/trust/contracts/index.js";
import {
  canonicalizeTradeReceiptProofPayloadV1,
  type TradeReceiptProofPayload,
} from "../src/os/commerce/receipt/receipt_types.js";
import { FakeFedosDirectRatchetSealingAuthority } from "./support/fake_direct_ratchet_sealing_authority.js";

/**
 * NOTE ON IMPORT CHOICE: this file imports the `contracts/`/`policy/`
 * sub-barrels directly (never `../src/os/trust/index.js` or
 * `../src/os/commerce/receipt/commerce_trust_receipt_adapter.js`, which
 * re-exports the FULL `os/trust` barrel including `qr/`) because the `qr/`
 * submodule's `qrcode` dependency is not installed in this shared-worktree
 * environment (confirmed pre-existing and unrelated to this closure: the
 * ALREADY-EXISTING, unmodified `test/trust_signed_qr.test.ts` fails
 * identically with "Failed to load url qrcode"). This module builds the
 * signed envelope with the SAME underlying `issueFedosTrustContractArtifactProof`/
 * `verifyFedosTrustContractArtifactProof` primitives
 * `commerce_trust_receipt_adapter.ts` itself calls, over the SAME
 * `TradeReceiptProofPayload` canonicalization (`receipt_types.ts`, pure,
 * zero Trust import) — a real, meaningful exercise of the envelope
 * sign/verify + `FedosTrustPolicy` path, without depending on the
 * environment's unrelated missing QR dependency.
 */
function issueTestTradeReceiptEnvelope(
  payload: TradeReceiptProofPayload,
  keypair: FedosTrustSigningKeypair,
  issuer: string,
  issuedAt: number,
) {
  const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(
    new TextEncoder().encode(canonicalizeTradeReceiptProofPayloadV1(payload)),
  );
  return issueFedosTrustContractArtifactProof(
    { artifactDigestHex, metadata: { ...payload } },
    { issuer, issuedAt, keypair },
  );
}

/**
 * FedOS Commerce FINAL P1 Closure (Agent K2) — durability tests for the
 * Receipt-issuer signing keypair (`resolveReceiptIssuerSigningKeypair`,
 * `src/os/trust/issuer/durable_receipt_issuer_signing_key_store.ts`), the
 * shared foundation it wires
 * (`src/os/core/vault/wasm/fedos_sealed_signing_key_store.ts`), and the
 * concrete "a receipt signed before a restart still verifies after one"
 * property `commerceReceiptSigningState()`
 * (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`)
 * depends on. Uses `FakeFedosDirectRatchetSealingAuthority`
 * (`test/support/fake_direct_ratchet_sealing_authority.ts`) — the SAME
 * deterministic, real-AEAD-shaped test double the Secure Runtime Alpha
 * 5401-5480 arc already established for exercising this exact sealing port,
 * never a full real-WASM authority (that headline proof belongs to a
 * different, already-existing test file — see this fake's own header).
 *
 * SECRET SAFETY: no test in this file ever logs, prints, or asserts the
 * value of a raw secret-key `Uint8Array` — only derived `publicKeyHex`
 * strings, boolean verify outcomes, and opaque `sealedBlob` strings are
 * ever read or compared.
 */

const ISSUER_ID = "fedos-commerce-e2e-demo-merchant";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function freshDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dir = d;
  return d;
}

function tradePayload(overrides: Partial<TradeReceiptProofPayload> = {}): TradeReceiptProofPayload {
  return {
    kind: "trade_completion",
    orderId: "order-1",
    productRef: "product-1",
    buyerRef: "b".repeat(64),
    sellerRef: "s".repeat(64),
    completedAt: 1_000,
    formatVersion: 1,
    ...overrides,
  };
}

describe("resolveReceiptIssuerSigningKeypair — first-ever resolve", () => {
  it("returns 'created' at generation 0; the resolved keypair signs and verifies against its own publicKeyHex", async () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const store = new DurableSealedSigningKeyStore(filePath);

    const result = await resolveReceiptIssuerSigningKeypair(authority, store, ISSUER_ID);
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.generation).toBe(0);
    expect(result.keypair.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

    const bytes = new TextEncoder().encode("hello receipt issuer");
    const sigHex = bytesToHex(result.keypair.signBytes(bytes));
    expect(verifyFedosTrustSignatureOverBytes(result.keypair.publicKeyHex, bytes, sigHex)).toBe(true);

    const persisted = store.latestFor(ISSUER_ID);
    expect(persisted?.generation).toBe(0);
    expect(persisted?.publicKeyHex).toBe(result.keypair.publicKeyHex);
    expect(persisted?.purpose).toBe(COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE);
  });
});

describe("resolveReceiptIssuerSigningKeypair — restart recovery (two-launch simulation)", () => {
  it("a SECOND resolve against a FRESH store instance over the SAME file restores the SAME publicKeyHex, and a signature from launch 1 still verifies under launch 2's identity (and vice versa)", async () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();

    // ---- "Launch 1": process starts, no sealed record yet -> mint + seal.
    const store1 = new DurableSealedSigningKeyStore(filePath);
    const launch1 = await resolveReceiptIssuerSigningKeypair(authority, store1, ISSUER_ID);
    expect(launch1.outcome).toBe("created");
    if (launch1.outcome !== "created") throw new Error("unreachable");
    const tradeAMessage = new TextEncoder().encode("trade-A");
    const tradeASigHex = bytesToHex(launch1.keypair.signBytes(tradeAMessage));

    // ---- "Launch 2" (restart): brand-new store instance replays the SAME
    // file from scratch -- no in-memory state carried over.
    const store2 = new DurableSealedSigningKeyStore(filePath);
    const launch2 = await resolveReceiptIssuerSigningKeypair(authority, store2, ISSUER_ID);
    expect(launch2.outcome).toBe("restored");
    if (launch2.outcome !== "restored") throw new Error("unreachable");
    expect(launch2.generation).toBe(0);
    expect(launch2.keypair.publicKeyHex).toBe(launch1.keypair.publicKeyHex);

    // Trade A, signed before the restart, verifies against the identity
    // resolved AFTER the restart.
    expect(verifyFedosTrustSignatureOverBytes(launch2.keypair.publicKeyHex, tradeAMessage, tradeASigHex)).toBe(true);

    // Trade B, signed AFTER the restart, verifies against the identity
    // resolved BEFORE it -- both keypair objects are the same live issuer
    // identity, not two different ones that happen to share a public key.
    const tradeBMessage = new TextEncoder().encode("trade-B");
    const tradeBSigHex = bytesToHex(launch2.keypair.signBytes(tradeBMessage));
    expect(verifyFedosTrustSignatureOverBytes(launch1.keypair.publicKeyHex, tradeBMessage, tradeBSigHex)).toBe(true);
  });
});

describe("resolveReceiptIssuerSigningKeypair — fails closed, never fabricates a replacement identity", () => {
  it("a tampered sealed record (simulating ciphertext tamper or a wrong Master Seed binding) resolves to 'corrupted', never a silently-working keypair", async () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();

    const store1 = new DurableSealedSigningKeyStore(filePath);
    const created = await resolveReceiptIssuerSigningKeypair(authority, store1, ISSUER_ID);
    expect(created.outcome).toBe("created");

    // Tamper the persisted sealedBlob directly on disk -- flips one hex
    // character, changing the ciphertext/tag without altering the record's
    // structural shape (so `DurableSealedSigningKeyStore`'s own structural
    // validation still accepts the LINE; only the sealing authority's own
    // AEAD-shaped authentication check, exercised inside
    // `resolveReceiptIssuerSigningKeypair`, must reject the CONTENT).
    const raw: string = readFileSync(filePath, "utf8");
    const record = JSON.parse(raw.trim()) as { sealedBlob: string; [key: string]: unknown };
    const lastChar = record.sealedBlob.slice(-1);
    record.sealedBlob = record.sealedBlob.slice(0, -1) + (lastChar === "0" ? "1" : "0");
    writeFileSync(filePath, JSON.stringify(record) + "\n", "utf8");

    const store2 = new DurableSealedSigningKeyStore(filePath);
    const result = await resolveReceiptIssuerSigningKeypair(authority, store2, ISSUER_ID);
    expect(result.outcome).toBe("corrupted");
    if (result.outcome === "corrupted") {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("no sealing authority available (null) on first-ever resolve -> 'sealing-unavailable', never fabricates a key", async () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const store = new DurableSealedSigningKeyStore(filePath);
    const result = await resolveReceiptIssuerSigningKeypair(null, store, ISSUER_ID);
    expect(result.outcome).toBe("sealing-unavailable");
    expect(store.latestFor(ISSUER_ID)).toBeUndefined();
  });

  it("no sealing authority available (null) when a sealed record ALREADY exists -> 'sealing-unavailable', never returns a restored key without authenticating it", async () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const store1 = new DurableSealedSigningKeyStore(filePath);
    const created = await resolveReceiptIssuerSigningKeypair(authority, store1, ISSUER_ID);
    expect(created.outcome).toBe("created");

    const store2 = new DurableSealedSigningKeyStore(filePath);
    const result = await resolveReceiptIssuerSigningKeypair(null, store2, ISSUER_ID);
    expect(result.outcome).toBe("sealing-unavailable");
  });
});

describe("DurableSealedSigningKeyStore — fails closed on disk corruption", () => {
  it("a corrupted/truncated (non-JSON) line in the NDJSON file makes the constructor throw", () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    writeFileSync(filePath, "not valid json at all\n", "utf8");
    expect(() => new DurableSealedSigningKeyStore(filePath)).toThrow();
  });

  it("a persisted line with an unrecognized schemaVersion makes the constructor throw", () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const badRecord = {
      schemaVersion: 2,
      purpose: COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE,
      subjectId: ISSUER_ID,
      keyId: "receipt-issuer",
      generation: 0,
      publicKeyHex: "a".repeat(64),
      sealedBlob: "deadbeef",
      createdAt: 1_000,
    };
    writeFileSync(filePath, JSON.stringify(badRecord) + "\n", "utf8");
    expect(() => new DurableSealedSigningKeyStore(filePath)).toThrow();
  });
});

describe("commerceReceiptSigningState()-equivalent: FedosTrustPolicy built from a restored resolution", () => {
  it("a receipt signed under launch 1's ('created') keypair verifies VALID against a policy built from launch 2's ('restored') publicKeyHex, and vice versa", async () => {
    const filePath = join(freshDir("fedos-receipt-issuer-"), "receipt_issuer_signing_keys.ndjson");
    const authority = new FakeFedosDirectRatchetSealingAuthority();

    // Launch 1: mint + seal, then issue Trade A's receipt.
    const store1 = new DurableSealedSigningKeyStore(filePath);
    const launch1 = await resolveReceiptIssuerSigningKeypair(authority, store1, ISSUER_ID);
    expect(launch1.outcome).toBe("created");
    if (launch1.outcome !== "created") throw new Error("unreachable");
    const tradeAEnvelope = issueTestTradeReceiptEnvelope(tradePayload({ orderId: "order-A" }), launch1.keypair, ISSUER_ID, 1_000);

    // Launch 2 (restart): fresh store instance restores the same identity,
    // EXACTLY like `commerceReceiptSigningState()` builds
    // `commerceReceiptPolicy` from the resolved keypair every process
    // launch.
    const store2 = new DurableSealedSigningKeyStore(filePath);
    const launch2 = await resolveReceiptIssuerSigningKeypair(authority, store2, ISSUER_ID);
    expect(launch2.outcome).toBe("restored");
    if (launch2.outcome !== "restored") throw new Error("unreachable");
    expect(launch2.keypair.publicKeyHex).toBe(launch1.keypair.publicKeyHex);

    const policyFromLaunch2 = createSingleIssuerFedosTrustPolicy({
      issuerId: ISSUER_ID,
      keys: [{ keyId: launch2.keypair.publicKeyHex, publicKeyHex: launch2.keypair.publicKeyHex }],
    });

    // Trade A (signed pre-restart) verifies VALID against the post-restart policy.
    const verifiedA = verifyFedosTrustContractArtifactProof(tradeAEnvelope, policyFromLaunch2);
    expect(verifiedA.artifactSignature).toBe("VALID");

    // Trade B, signed AFTER the restart under launch 2's keypair, verifies
    // VALID against a policy built from launch 1's own publicKeyHex --
    // confirming both directions of the same live issuer identity.
    const tradeBEnvelope = issueTestTradeReceiptEnvelope(tradePayload({ orderId: "order-B" }), launch2.keypair, ISSUER_ID, 2_000);
    const policyFromLaunch1 = createSingleIssuerFedosTrustPolicy({
      issuerId: ISSUER_ID,
      keys: [{ keyId: launch1.keypair.publicKeyHex, publicKeyHex: launch1.keypair.publicKeyHex }],
    });
    const verifiedB = verifyFedosTrustContractArtifactProof(tradeBEnvelope, policyFromLaunch1);
    expect(verifiedB.artifactSignature).toBe("VALID");
  });
});

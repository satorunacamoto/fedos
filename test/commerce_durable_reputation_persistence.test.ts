import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurablePersonaEpochRegistry } from "../src/os/commerce/reputation/persistence/durable_persona_epoch_registry.js";
import { DurableTradeCompletionAttestationStore } from "../src/os/commerce/reputation/persistence/durable_trade_completion_attestation_store.js";
import { createPersonaEpoch } from "../src/os/commerce/reputation/persona_epoch_registry.js";
import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { signTradeCompletionAttestation } from "../src/os/commerce/reputation/attestation_sign_verify.js";
import { computeTradeRefDigestHex, generateTradeRefSaltHex } from "../src/os/commerce/reputation/trade_ref_digest.js";
import type { PersonaEpoch } from "../src/os/commerce/reputation/persona_epoch.js";
import type { TradeCompletionAttestationEnvelope } from "../src/os/commerce/reputation/attestation_sign_verify.js";
import type { TradeCompletionAttestationPayload } from "../src/os/commerce/reputation/attestation_types.js";

/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Reputation domain durability:
 * `DurablePersonaEpochRegistry` and
 * `DurableTradeCompletionAttestationStore`.
 */

function validTradeCompletionPayload(
  attestorEpochKeyPublicHex: string,
  overrides: Partial<TradeCompletionAttestationPayload> = {},
): TradeCompletionAttestationPayload {
  return {
    attestorEpochKeyPublicHex,
    subjectEpochId: "2".repeat(32),
    tradeRefDigestHex: computeTradeRefDigestHex("order-1", generateTradeRefSaltHex()),
    category: "digital_good",
    outcome: "completed_as_agreed",
    completedAt: 1_000,
    formatVersion: 1,
    ...overrides,
  };
}

function fixtureEnvelope(orderIdSeed = "order-1"): { envelope: TradeCompletionAttestationEnvelope; attestorRealPubkey: string } {
  const kp = PersonaEpochSigningKeypair.generate();
  const payload = validTradeCompletionPayload(kp.publicKeyHex, {
    tradeRefDigestHex: computeTradeRefDigestHex(orderIdSeed, generateTradeRefSaltHex()),
  });
  const envelope = signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
  return { envelope, attestorRealPubkey: "d".repeat(64) };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("DurablePersonaEpochRegistry -- restart recovery", () => {
  it("1. a missing log file replays to empty state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const registry = new DurablePersonaEpochRegistry(join(dir, "epochs.ndjson"));
    expect(registry.list()).toEqual([]);
  });

  it("2. register() then a FRESH instance over the same file recovers the exact same epoch", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    const { epoch } = createPersonaEpoch(1_000, 2_000);
    new DurablePersonaEpochRegistry(path).register(epoch);

    const restarted = new DurablePersonaEpochRegistry(path);
    expect(restarted.findById(epoch.epochId)).toEqual(epoch);
    expect(restarted.isCurrentlyValid(epoch.epochId, 1_500)).toBe(true);
  });

  it("3. re-registering the identical epoch is an idempotent no-op, even across a restart", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    const { epoch } = createPersonaEpoch(1_000, 2_000);
    let registry: DurablePersonaEpochRegistry = new DurablePersonaEpochRegistry(path);
    registry.register(epoch);

    registry = new DurablePersonaEpochRegistry(path);
    expect(() => registry.register(epoch)).not.toThrow();
    expect(registry.list()).toHaveLength(1);
  });

  it("4. re-registering the SAME epochId with different content throws", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    const { epoch } = createPersonaEpoch(1_000, 2_000);
    const registry = new DurablePersonaEpochRegistry(path);
    registry.register(epoch);
    const conflicting: PersonaEpoch = { ...epoch, validUntil: epoch.validUntil + 500 };
    expect(() => registry.register(conflicting)).toThrow();
  });
});

describe("DurablePersonaEpochRegistry -- fail-closed on corruption", () => {
  it("1. a truncated final line throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    const { epoch } = createPersonaEpoch(1_000, 2_000);
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, epoch }) + "\n", "utf8");
    appendFileSync(path, '{"schemaVersion":1,"epoch":{"epochId":"ab', "utf8");
    expect(() => new DurablePersonaEpochRegistry(path)).toThrow();
  });

  it("2. an unknown/future schemaVersion throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    const { epoch } = createPersonaEpoch(1_000, 2_000);
    appendFileSync(path, JSON.stringify({ schemaVersion: 2, epoch }) + "\n", "utf8");
    expect(() => new DurablePersonaEpochRegistry(path)).toThrow();
  });

  it("3. a duplicate epochId with conflicting content throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    const { epoch } = createPersonaEpoch(1_000, 2_000);
    const conflicting: PersonaEpoch = { ...epoch, validUntil: epoch.validUntil + 999 };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, epoch }) + "\n", "utf8");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, epoch: conflicting }) + "\n", "utf8");
    expect(() => new DurablePersonaEpochRegistry(path)).toThrow();
  });

  it("4. a non-JSON line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-epoch-"));
    const path = join(dir, "epochs.ndjson");
    writeFileSync(path, "??not json??\n", "utf8");
    expect(() => new DurablePersonaEpochRegistry(path)).toThrow();
  });
});

describe("DurableTradeCompletionAttestationStore -- restart recovery / duplicate-issuance prevention", () => {
  it("1. a missing log file replays to empty state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const store = new DurableTradeCompletionAttestationStore(join(dir, "attestations.ndjson"));
    expect(store.list()).toEqual([]);
    expect(store.hasAttestedOrder("order-1", "d".repeat(64))).toBe(false);
  });

  it("2. record() then a FRESH instance over the same file recovers the exact same attestation", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    const { envelope, attestorRealPubkey } = fixtureEnvelope();
    new DurableTradeCompletionAttestationStore(path).record("order-1", attestorRealPubkey, envelope);

    const restarted = new DurableTradeCompletionAttestationStore(path);
    expect(restarted.findByOrder("order-1")).toEqual([envelope]);
    expect(restarted.hasAttestedOrder("order-1", attestorRealPubkey)).toBe(true);
  });

  it("3. THE CORE GUARANTEE -- after a restart, the SAME (orderId, attestor) pair cannot record a second attestation", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    const { envelope, attestorRealPubkey } = fixtureEnvelope();
    new DurableTradeCompletionAttestationStore(path).record("order-1", attestorRealPubkey, envelope);

    // Simulate a process restart -- a fresh instance over the same file.
    const restarted = new DurableTradeCompletionAttestationStore(path);
    expect(restarted.hasAttestedOrder("order-1", attestorRealPubkey)).toBe(true);

    const { envelope: secondEnvelope } = fixtureEnvelope();
    expect(() => restarted.record("order-1", attestorRealPubkey, secondEnvelope)).toThrow(RangeError);
    // The rejected second attempt must never have been durably written.
    expect(restarted.findByOrder("order-1")).toEqual([envelope]);
    expect(new DurableTradeCompletionAttestationStore(path).findByOrder("order-1")).toEqual([envelope]);
  });

  it("4. a different attestor for the same order is a distinct, allowed record", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    const first = fixtureEnvelope();
    const second = fixtureEnvelope();
    const store = new DurableTradeCompletionAttestationStore(path);
    store.record("order-1", "buyer-real-pubkey", first.envelope);
    store.record("order-1", "seller-real-pubkey", second.envelope);

    const restarted = new DurableTradeCompletionAttestationStore(path);
    expect(restarted.findByOrder("order-1")).toHaveLength(2);
  });
});

describe("DurableTradeCompletionAttestationStore -- fail-closed on corruption", () => {
  it("1. a truncated final line throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    const { envelope, attestorRealPubkey } = fixtureEnvelope();
    appendFileSync(
      path,
      JSON.stringify({ schemaVersion: 1, orderId: "order-1", attestorRealPubkey, envelope }) + "\n",
      "utf8",
    );
    appendFileSync(path, '{"schemaVersion":1,"orderId":"order-2","attestorRealPubkey":"ab', "utf8");
    expect(() => new DurableTradeCompletionAttestationStore(path)).toThrow();
  });

  it("2. an unknown/future schemaVersion throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    const { envelope, attestorRealPubkey } = fixtureEnvelope();
    appendFileSync(
      path,
      JSON.stringify({ schemaVersion: 5, orderId: "order-1", attestorRealPubkey, envelope }) + "\n",
      "utf8",
    );
    expect(() => new DurableTradeCompletionAttestationStore(path)).toThrow();
  });

  it("3. a duplicate (orderId, attestor) dedupe key with conflicting envelope content throws on construction -- the fail-closed replay-time half of the duplicate-issuance guarantee", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    const { envelope, attestorRealPubkey } = fixtureEnvelope();
    const { envelope: differentEnvelope } = fixtureEnvelope();
    appendFileSync(
      path,
      JSON.stringify({ schemaVersion: 1, orderId: "order-1", attestorRealPubkey, envelope }) + "\n",
      "utf8",
    );
    appendFileSync(
      path,
      JSON.stringify({ schemaVersion: 1, orderId: "order-1", attestorRealPubkey, envelope: differentEnvelope }) + "\n",
      "utf8",
    );
    expect(() => new DurableTradeCompletionAttestationStore(path)).toThrow();
  });

  it("4. a non-JSON line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-attestation-"));
    const path = join(dir, "attestations.ndjson");
    writeFileSync(path, "totally not json\n", "utf8");
    expect(() => new DurableTradeCompletionAttestationStore(path)).toThrow();
  });
});

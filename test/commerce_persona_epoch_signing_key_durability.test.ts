import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE,
  DurableSealedSigningKeyStore,
  resolvePersonaEpochSigningKeypair,
  sealNextGenerationPersonaEpochSigningKeypair,
} from "../src/os/commerce/reputation/persistence/durable_persona_epoch_signing_key_store.js";
import { verifyPersonaEpochSignatureOverBytes } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { FakeFedosDirectRatchetSealingAuthority } from "./support/fake_direct_ratchet_sealing_authority.js";

/**
 * FedOS Commerce FINAL P1 Closure (Agent K1) — durable, sealed-at-rest
 * custody for the Persona Epoch signing keypair
 * (`durable_persona_epoch_signing_key_store.ts`). Follows the exact
 * mkdtempSync/rmSync-per-test convention `commerce_durable_reputation_persistence.test.ts`
 * (Agent D, Commerce Durability arc) already established for this same
 * `os/commerce/reputation/persistence/` directory, and reuses the SAME
 * `FakeFedosDirectRatchetSealingAuthority` (`test/support/
 * fake_direct_ratchet_sealing_authority.ts`) every prior sealed-secret
 * arc's own orchestration-level unit tests already use as their fake
 * sealing authority — never a bespoke fake invented just for this file.
 *
 * SECRET SAFETY: no test in this file ever reads, prints, or asserts on a
 * raw secret key byte. `PersonaEpochSigningKeypair` never exposes one (see
 * that class's own header); every assertion below only ever touches
 * `publicKeyHex`, signatures, outcomes, and non-secret record metadata
 * (`keyId`/`generation`/`purpose`/`sealedBlob` — an opaque ciphertext
 * string, not key material).
 */

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function freshStorePath(): string {
  dir = mkdtempSync(join(tmpdir(), "fedos-persona-epoch-signing-key-"));
  return join(dir, "persona_epoch_signing_keys.ndjson");
}

const SUBJECT_A = "a".repeat(64);
const SUBJECT_B = "b".repeat(64);
const SUBJECT_C = "c".repeat(64);
const SUBJECT_D = "d".repeat(64);
const SUBJECT_E = "e".repeat(64);
const SUBJECT_F = "f".repeat(64);
const SUBJECT_G = "1".repeat(64);
const SUBJECT_H = "2".repeat(64);

describe("resolvePersonaEpochSigningKeypair -- first-ever resolve (mint + seal)", () => {
  it("1. mints and seals a fresh keypair at generation 0; the keypair works (sign/verify roundtrips)", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const candidateEpochId = "1".repeat(32);

    const result = await resolvePersonaEpochSigningKeypair(authority, store, SUBJECT_A, true, candidateEpochId, 1_000);
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.generation).toBe(0);
    expect(result.epochId).toBe(candidateEpochId);

    const message = new TextEncoder().encode("commerce persona epoch signing key durability");
    const signatureHex = bytesToHex(result.keypair.signBytes(message));
    expect(verifyPersonaEpochSignatureOverBytes(result.keypair.publicKeyHex, message, signatureHex)).toBe(true);

    const record = store.latestFor(SUBJECT_A);
    expect(record).toBeDefined();
    expect(record?.generation).toBe(0);
    expect(record?.keyId).toBe(candidateEpochId);
    expect(record?.subjectId).toBe(SUBJECT_A);
    expect(record?.purpose).toBe(COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE);
    expect(record?.publicKeyHex).toBe(result.keypair.publicKeyHex);
  });

  it("1b. createIfAbsent=false with nothing sealed yet returns 'not-found' and mints/persists nothing", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);
    const authority = new FakeFedosDirectRatchetSealingAuthority();

    const result = await resolvePersonaEpochSigningKeypair(authority, store, SUBJECT_A, false, "9".repeat(32), 1_000);
    expect(result.outcome).toBe("not-found");
    expect(store.latestFor(SUBJECT_A)).toBeUndefined();
  });
});

describe("resolvePersonaEpochSigningKeypair -- restart recovery", () => {
  it("2. a second resolve, via a FRESH store instance over the SAME file, restores the exact same keypair", async () => {
    const filePath = freshStorePath();
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const candidateEpochId = "2".repeat(32);

    const storeBeforeRestart = new DurableSealedSigningKeyStore(filePath);
    const first = await resolvePersonaEpochSigningKeypair(authority, storeBeforeRestart, SUBJECT_B, true, candidateEpochId, 1_000);
    expect(first.outcome).toBe("created");
    if (first.outcome !== "created") throw new Error("unreachable");

    // Simulate a process restart: a brand-new `DurableSealedSigningKeyStore`
    // instance, fresh in-memory state, pointed at the SAME file.
    const storeAfterRestart = new DurableSealedSigningKeyStore(filePath);
    const second = await resolvePersonaEpochSigningKeypair(
      authority,
      storeAfterRestart,
      SUBJECT_B,
      false,
      "unused-candidate-epoch-id",
      2_000,
    );
    expect(second.outcome).toBe("restored");
    if (second.outcome !== "restored") throw new Error("unreachable");
    expect(second.generation).toBe(0);
    expect(second.epochId).toBe(candidateEpochId);
    expect(second.keypair.publicKeyHex).toBe(first.keypair.publicKeyHex);

    const message = new TextEncoder().encode("restart roundtrip");
    const signatureHex = bytesToHex(second.keypair.signBytes(message));
    expect(verifyPersonaEpochSignatureOverBytes(second.keypair.publicKeyHex, message, signatureHex)).toBe(true);
  });
});

describe("resolvePersonaEpochSigningKeypair -- fail-closed on tamper/unavailability", () => {
  it("3. a sealing authority that fails to restore (tamper / wrong Master Seed) yields 'corrupted', never a working keypair", async () => {
    const filePath = freshStorePath();
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const candidateEpochId = "3".repeat(32);

    const storeBeforeRestart = new DurableSealedSigningKeyStore(filePath);
    const created = await resolvePersonaEpochSigningKeypair(authority, storeBeforeRestart, SUBJECT_C, true, candidateEpochId, 1_000);
    expect(created.outcome).toBe("created");

    // Simulate tamper / a different Master Seed than the one this key was
    // sealed under: the SAME fake authority instance, now made to fail
    // closed on every call (mirrors `FedosWasmMasterSeedAuthority`'s own
    // "wrong key -> AEAD authentication failure -> null" behavior).
    authority.failClosed = true;
    const storeAfterRestart = new DurableSealedSigningKeyStore(filePath);
    const result = await resolvePersonaEpochSigningKeypair(authority, storeAfterRestart, SUBJECT_C, false, "unused", 2_000);
    expect(result.outcome).toBe("corrupted");
    if (result.outcome === "corrupted") {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("4. a null sealing authority yields 'sealing-unavailable', never throws, never persists anything", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);

    const result = await resolvePersonaEpochSigningKeypair(null, store, SUBJECT_D, true, "4".repeat(32), 1_000);
    expect(result.outcome).toBe("sealing-unavailable");
    expect(store.latestFor(SUBJECT_D)).toBeUndefined();
  });

  it("4b. a non-null authority missing the sealing methods is also treated as 'sealing-unavailable'", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);
    const nonSealingAuthority = {};

    const result = await resolvePersonaEpochSigningKeypair(nonSealingAuthority, store, SUBJECT_E, true, "5".repeat(32), 1_000);
    expect(result.outcome).toBe("sealing-unavailable");
    expect(store.latestFor(SUBJECT_E)).toBeUndefined();
  });

  it("4c. an authority whose seal call itself fails yields 'seal-failed', never a thrown error, never a partial record", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    authority.failClosed = true;

    const result = await resolvePersonaEpochSigningKeypair(authority, store, SUBJECT_F, true, "6".repeat(32), 1_000);
    expect(result.outcome).toBe("seal-failed");
    expect(store.latestFor(SUBJECT_F)).toBeUndefined();
  });
});

describe("DurableSealedSigningKeyStore -- fail-closed on corrupt/unknown-schema records", () => {
  it("5. a corrupt (non-JSON / truncated) line makes the store constructor throw", () => {
    const filePath = freshStorePath();
    writeFileSync(filePath, "{this is not valid json\n", "utf8");
    expect(() => new DurableSealedSigningKeyStore(filePath)).toThrow();
  });

  it("6. an unknown/wrong schemaVersion in a persisted line makes the store constructor throw", () => {
    const filePath = freshStorePath();
    const wrongSchemaRecord = {
      schemaVersion: 2,
      purpose: COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE,
      subjectId: SUBJECT_A,
      keyId: "1".repeat(32),
      generation: 0,
      publicKeyHex: "a".repeat(64),
      sealedBlob: "deadbeef",
      createdAt: 1_000,
    };
    writeFileSync(filePath, JSON.stringify(wrongSchemaRecord) + "\n", "utf8");
    expect(() => new DurableSealedSigningKeyStore(filePath)).toThrow();
  });
});

describe("Rotation -- explicit, never automatic (arc scope)", () => {
  it("7. sealing a next generation never deletes or overwrites the previous generation's record", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);
    const authority = new FakeFedosDirectRatchetSealingAuthority();
    const epochId0 = "7".repeat(32);
    const epochId1 = "8".repeat(32);

    const gen0 = await resolvePersonaEpochSigningKeypair(authority, store, SUBJECT_G, true, epochId0, 1_000);
    expect(gen0.outcome).toBe("created");
    if (gen0.outcome !== "created") throw new Error("unreachable");
    expect(gen0.generation).toBe(0);

    const gen1 = await sealNextGenerationPersonaEpochSigningKeypair(authority, store, SUBJECT_G, epochId1, 2_000);
    expect(gen1.outcome).toBe("created");
    if (gen1.outcome !== "created") throw new Error("unreachable");
    expect(gen1.generation).toBe(1);
    expect(gen1.keypair.publicKeyHex).not.toBe(gen0.keypair.publicKeyHex);

    const latest = store.latestFor(SUBJECT_G);
    expect(latest?.generation).toBe(1);
    expect(latest?.keyId).toBe(epochId1);

    const history = store.historyFor(SUBJECT_G);
    expect(history.length).toBe(2);
    expect(history[0]?.generation).toBe(0);
    expect(history[0]?.keyId).toBe(epochId0);
    expect(history[1]?.generation).toBe(1);
    expect(history[1]?.keyId).toBe(epochId1);
  });

  it("8. sealNextGenerationPersonaEpochSigningKeypair starts at generation 0 for a subject with nothing sealed yet", async () => {
    const filePath = freshStorePath();
    const store = new DurableSealedSigningKeyStore(filePath);
    const authority = new FakeFedosDirectRatchetSealingAuthority();

    const result = await sealNextGenerationPersonaEpochSigningKeypair(authority, store, SUBJECT_H, "9".repeat(32), 1_000);
    expect(result.outcome).toBe("created");
    if (result.outcome === "created") expect(result.generation).toBe(0);
  });
});

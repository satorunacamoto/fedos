/**
 * TEST-ONLY. Secure Runtime Alpha 5401-5480 — a deterministic, in-memory
 * `FedosDirectRatchetSealingAuthority` stand-in, mirroring this
 * codebase's own "orchestration-level, uses a fake sealer" precedent
 * (the Sender-Key sealed-persistence lineage's own restart-recovery
 * test, read-only reference). Used ONLY for Runtime-orchestration unit
 * tests (lifecycle, counters, skipped-key bounds, persistence wiring) --
 * the headline sealed-persistence proof uses the REAL WASM-backed
 * `FedosWasmMasterSeedAuthority` instead
 * (`test/secure_runtime_alpha_5401_5480_direct_ratchet_sealing_authority.test.ts`,
 * `test/secure_runtime_alpha_5401_5480_real_vertical_slice.test.ts`).
 *
 * Seals by XOR-folding the plaintext with a deterministic keystream
 * derived (via a trivial, NON-cryptographic hash) from the FULL binding
 * tuple -- reversible only when the SAME tuple is supplied again, so
 * this fake still exercises "wrong device/account/conversation/generation
 * fails closed" and "tamper fails closed" behavior without touching any
 * real cryptographic primitive.
 */
import type { FedosDirectRatchetSealingAuthority } from "../../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.js";

function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function keystream(context: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let seed = fnv1aHash(context);
  for (let i = 0; i < length; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2545f491) >>> 0;
    out[i] = seed & 0xff;
  }
  return out;
}

function contextFor(localDeviceRef: string, remoteDeviceRef: string, conversationId: string, generation: number): string {
  return [localDeviceRef, remoteDeviceRef, conversationId, String(generation)].join("|");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** A 4-byte authentication tag over (context, plaintext) -- NOT cryptographic, but real AEAD-shaped authentication: a mismatched context OR a tampered ciphertext changes the recomputed tag, unlike a bare XOR cipher (which is trivially symmetric under any key). */
function tagFor(context: string, plaintext: Uint8Array): Uint8Array {
  const hash = fnv1aHash(context + "|" + bytesToHex(plaintext));
  return new Uint8Array([(hash >>> 24) & 0xff, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff]);
}

export class FakeFedosDirectRatchetSealingAuthority implements FedosDirectRatchetSealingAuthority {
  /** Set to `true` to make every subsequent call fail closed (simulating an authority that has gone unavailable). */
  public failClosed = false;

  async sealDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null> {
    if (this.failClosed) return null;
    const context = contextFor(localDeviceRef, remoteDeviceRef, conversationId, generation);
    const stream = keystream(context, secretBytes.length);
    const ciphertext = new Uint8Array(secretBytes.length);
    for (let i = 0; i < secretBytes.length; i++) ciphertext[i] = secretBytes[i]! ^ stream[i]!;
    const tag = tagFor(context, secretBytes);
    return bytesToHex(ciphertext) + bytesToHex(tag);
  }

  async restoreDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null> {
    if (this.failClosed) return null;
    if (sealedBlob.length < 8) return null;
    const ciphertextHex = sealedBlob.slice(0, sealedBlob.length - 8);
    const tagHex = sealedBlob.slice(sealedBlob.length - 8);
    const ciphertext = hexToBytes(ciphertextHex);
    const suppliedTag = hexToBytes(tagHex);
    if (ciphertext === null || suppliedTag === null) return null;

    const context = contextFor(localDeviceRef, remoteDeviceRef, conversationId, generation);
    const stream = keystream(context, ciphertext.length);
    const candidatePlaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) candidatePlaintext[i] = ciphertext[i]! ^ stream[i]!;

    // Authenticate: recompute the tag under THIS call's own context and
    // the candidate plaintext -- a wrong device/account/conversation/
    // generation OR a tampered ciphertext changes this tag, exactly
    // mirroring real AEAD's "authentication failure never distinguishes
    // wrong-key from tampered-ciphertext" property.
    const expectedTag = tagFor(context, candidatePlaintext);
    if (bytesToHex(expectedTag) !== bytesToHex(suppliedTag)) return null;
    return candidatePlaintext;
  }
}

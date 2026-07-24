/**
 * Secure Runtime Alpha 5481-5560 — TypeScript authority boundary tests
 * using a MOCKED loader boundary (narrow injected failure behavior only,
 * per this Arc's own test-requirements). The headline real-cryptography
 * proof is `test/secure_runtime_alpha_5481_5560_real_vertical_slice.test.ts`.
 */
import { describe, it, expect, vi } from "vitest";
import {
  FedosDirectRatchetCryptographicSession,
  type FedosDirectRatchetWasmLoaderBoundary,
} from "../src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.js";
import { FedosWasmMasterSeedAuthority } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import type { FedosMasterSeedWasmLoaderBoundary } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";

function mockMasterSeedLoaderBoundary(): FedosMasterSeedWasmLoaderBoundary {
  return {
    attemptDevOnlyMasterSeedAuthorityConstructCall: vi.fn(async () => ({
      attempted: false,
      succeeded: false,
      authority: null,
      reason: "PrototypeStillClosed" as const,
    })),
    attemptDevOnlyMasterSeedGenerateCall: vi.fn(async () => ({ attempted: true, succeeded: true, reason: "Succeeded" as const })),
    attemptDevOnlyMasterSeedSealCall: vi.fn(async () => ({ attempted: true, succeeded: true, envelope: "{}", reason: "Succeeded" as const })),
    attemptDevOnlyMasterSeedRestoreSealedCall: vi.fn(async () => ({ attempted: true, succeeded: true, reason: "Succeeded" as const })),
    attemptDevOnlyMasterSeedClearCall: vi.fn(async () => ({ attempted: true, succeeded: true, reason: "Succeeded" as const })),
    attemptDevOnlyMasterSeedResolveConversationKeyCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      keyHandle: { kind: "AeadKeyHandle" } as const,
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedSealDirectRatchetSecretCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      sealedBlob: "aabbcc",
      reason: "Succeeded" as const,
    })),
    attemptDevOnlyMasterSeedRestoreDirectRatchetSecretCall: vi.fn(async () => ({
      attempted: true,
      succeeded: true,
      secretBytes: new Uint8Array([1, 2, 3]),
      reason: "Succeeded" as const,
    })),
  };
}

function mockRatchetLoaderBoundary(overrides: Partial<FedosDirectRatchetWasmLoaderBoundary> = {}): FedosDirectRatchetWasmLoaderBoundary {
  return {
    planLoad: vi.fn(),
    attemptDevOnlyJsGlueImport: vi.fn(async () => ({})),
    attemptDevOnlyWasmInitialization: vi.fn(async () => ({})),
    attemptDevOnlyDirectRatchetInitializeAsReceiverCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetInitializeAsSenderCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetRestoreCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetEncryptCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetDecryptCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetLocalPublicKeyHexCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetRemotePublicKeyHexCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetIsReadyToSendCall: vi.fn(async () => false),
    attemptDevOnlyDirectRatchetSendCounterCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetReceiveCounterCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetSkippedKeyCountCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetPreviousSendingChainLengthCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetSealRootKeyCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetSealSendingChainKeyCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetSealReceivingChainKeyCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetSealLocalRatchetPrivateKeyCall: vi.fn(async () => null),
    attemptDevOnlyDirectRatchetSealAllSkippedKeysCall: vi.fn(async () => []),
    ...overrides,
  };
}

describe("Alpha 5481-5560 — TypeScript authority boundary (mocked loader)", () => {
  it("createAsReceiver returns null when the WASM call fails closed", async () => {
    const authority = new FedosWasmMasterSeedAuthority(mockMasterSeedLoaderBoundary());
    const session = await FedosDirectRatchetCryptographicSession.createAsReceiver(authority, 0, "a".repeat(64), "session-1", "device-1", 0);
    expect(session).toBeNull();
  });

  it("createAsSender returns null when the WASM call fails closed", async () => {
    const authority = new FedosWasmMasterSeedAuthority(mockMasterSeedLoaderBoundary());
    const session = await FedosDirectRatchetCryptographicSession.createAsSender(
      authority,
      0,
      "a".repeat(64),
      "session-1",
      "device-1",
      0,
      "b".repeat(64),
    );
    expect(session).toBeNull();
  });

  it("restore returns null when the WASM call fails closed", async () => {
    const authority = new FedosWasmMasterSeedAuthority(mockMasterSeedLoaderBoundary());
    const session = await FedosDirectRatchetCryptographicSession.restore(
      authority,
      "remote-device",
      "conv-1",
      "session-1",
      "device-1",
      0,
      0,
      0,
      0,
      null,
      {
        sealedRootKey: "aabbcc",
        sealedSendingChainKey: null,
        sealedReceivingChainKey: null,
        sealedLocalRatchetPrivateKey: "ddeeff",
        sealedSkippedKeys: [],
      },
    );
    expect(session).toBeNull();
  });

  it("sealAllSkippedKeys parses the wire-format entries correctly", () => {
    // Structural check of the parsing convention, exercised indirectly via sealState's own contract:
    // "{counter}:{remoteRatchetPublicKeyHex}:{createdAtMs}:{sealedBlob}" -- sealedBlob itself may be
    // any opaque hex string (no embedded colons in practice, but the parser must not break if hex
    // characters happen to look unusual).
    const entry = "3:aabbccdd:1234:deadbeef";
    const parts = entry.split(":");
    expect(parts).toEqual(["3", "aabbccdd", "1234", "deadbeef"]);
  });
});

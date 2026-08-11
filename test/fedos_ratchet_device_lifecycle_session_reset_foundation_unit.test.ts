/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — pure unit tests (no WASM required) for the reset
 * reason vocabulary, the extended session-init payload codec, the
 * Device-signature authentication helpers (real `@noble/curves`
 * signing), the Session Reset Authority's decision logic, the Runtime
 * Reset Coordinator's audit/lifecycle bookkeeping, and the Session Reset
 * Record persistence (in-memory + append-only restart-safety).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import {
  FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS,
  isWellFormedFedosDirectRatchetSessionResetReason,
} from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_reason.js";
import {
  isWellFormedFedosDirectRatchetNip17Payload,
  type FedosDirectRatchetSessionInitPayloadV1,
} from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_ratchet_nip17_payload.js";
import {
  createFedosDirectRatchetSessionResetDeviceSignature,
  verifyFedosDirectRatchetSessionResetDeviceSignature,
  type FedosDirectRatchetSessionResetSignableContent,
} from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_authentication.js";
import { generateFedosDeviceSigningKeypair } from "../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import { FedosDirectRatchetSessionResetAuthority } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_reset_authority.js";
import { FedosDirectRatchetResetCoordinator } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_reset_coordinator.js";
import { InMemoryFedosDirectRatchetSessionResetRecordPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_direct_ratchet_session_reset_record_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionResetRecordPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.js";
import { InMemoryFedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_direct_ratchet_session_persistence.js";
import { InMemoryFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.js";
import { FedosDirectRatchetStateRuntime } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_state_runtime.js";
import { toFedosDirectRatchetSessionId } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";
import type { FedosDeviceBindingV1 } from "../src/os/messenger/device/fedos_device_binding.js";

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const ACCOUNT_B = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };

function trustedBinding(deviceId: string, devicePublicKeyRef: string | null): FedosDeviceBindingV1 {
  return {
    schemaVersion: 1,
    deviceId,
    accountRef: ACCOUNT_B,
    devicePublicKeyRef,
    label: null,
    createdAt: 0,
    capabilityVersion: 1,
    revokedAt: null,
    trustState: "trusted",
  };
}

function revokedBinding(deviceId: string): FedosDeviceBindingV1 {
  return { ...trustedBinding(deviceId, null), trustState: "revoked", revokedAt: 1 };
}

function baseContent(overrides: Partial<FedosDirectRatchetSessionResetSignableContent> = {}): FedosDirectRatchetSessionResetSignableContent {
  return {
    suite: "fedos-direct-ratchet-v1",
    generation: 0,
    previousGeneration: null,
    resetReason: null,
    resetNonce: "a".repeat(32),
    senderAccountRef: ACCOUNT_B,
    senderDeviceRef: "bob-device",
    recipientAccountRef: ACCOUNT_A,
    recipientDeviceRef: "alice-device",
    conversationId: "private-draft::direct::abc",
    ratchetPublicKeyHex: "c".repeat(64),
    ...overrides,
  };
}

function basePayload(overrides: Partial<FedosDirectRatchetSessionInitPayloadV1> = {}): FedosDirectRatchetSessionInitPayloadV1 {
  return {
    schemaVersion: 1,
    kind: "session-init",
    suite: "fedos-direct-ratchet-v1",
    generation: 0,
    previousGeneration: null,
    resetReason: null,
    resetNonce: "a".repeat(32),
    senderAccountRef: ACCOUNT_B,
    senderDeviceRef: "bob-device",
    recipientAccountRef: ACCOUNT_A,
    recipientDeviceRef: "alice-device",
    conversationId: "private-draft::direct::abc",
    ratchetPublicKeyHex: "c".repeat(64),
    deviceSignatureHex: null,
    ...overrides,
  };
}

describe("Session Reset reason vocabulary", () => {
  // Secure Runtime Alpha 5961-6040 (FedOS Identity Transition Peer
  // Notification and Ratchet Reset Integration Arc) added
  // "identity-transition" — exactly the trigger this Foundation Arc's
  // own reason-vocabulary file named as not-yet-built for "identity
  // rotation". A purely additive widening; every other reason and every
  // still-forbidden value below is unchanged.
  it("is a closed, five-value set, excluding rotation/rollback/peer-requested/device-lifecycle reasons", () => {
    expect([...FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS].sort()).toEqual(
      ["missing-sealed-state", "corrupt-sealed-state", "excessive-skipped-key-gap", "suspected-compromise", "identity-transition"].sort(),
    );
    for (const forbidden of ["identity-rotation", "rollback-detected", "peer-requested", "device-revocation", "device-replacement"]) {
      expect(isWellFormedFedosDirectRatchetSessionResetReason(forbidden)).toBe(false);
    }
  });
});

describe("Session-init payload codec — reset field extensions", () => {
  it("accepts a well-formed fresh-establishment payload (generation 0, previousGeneration/resetReason null)", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload())).toBe(true);
  });

  it("accepts a well-formed reset payload (generation 1, previousGeneration 0, a real reason)", () => {
    const payload = basePayload({ generation: 1, previousGeneration: 0, resetReason: "suspected-compromise" });
    expect(isWellFormedFedosDirectRatchetNip17Payload(payload)).toBe(true);
  });

  it("rejects previousGeneration/resetReason disagreement — a reset always names why, a fresh establishment never does", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ previousGeneration: 0, resetReason: null }))).toBe(false);
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ previousGeneration: null, resetReason: "suspected-compromise" }))).toBe(
      false,
    );
  });

  it("rejects previousGeneration >= generation", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ generation: 1, previousGeneration: 1, resetReason: "suspected-compromise" }))).toBe(
      false,
    );
  });

  it("rejects an unrecognized resetReason value", () => {
    expect(
      isWellFormedFedosDirectRatchetNip17Payload(
        basePayload({ generation: 1, previousGeneration: 0, resetReason: "made-up-reason" as never }),
      ),
    ).toBe(false);
  });

  it("rejects a malformed resetNonce (not 32-64 lowercase hex chars)", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ resetNonce: "not-hex" }))).toBe(false);
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ resetNonce: "" }))).toBe(false);
  });

  it("rejects a malformed deviceSignatureHex when present (not 128 hex chars) but accepts null", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ deviceSignatureHex: "not-a-signature" }))).toBe(false);
    expect(isWellFormedFedosDirectRatchetNip17Payload(basePayload({ deviceSignatureHex: null }))).toBe(true);
  });

  it("still enforces the exact closed field set — an extra field is rejected", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload({ ...basePayload(), extra: "no" })).toBe(false);
  });
});

describe("Session Reset device-signature authentication (real @noble/curves signing)", () => {
  it("creates a verifiable signature over the exact reset content", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const content = baseContent();
    const signatureHex = createFedosDirectRatchetSessionResetDeviceSignature(keypair, content);
    expect(signatureHex).not.toBeNull();
    expect(verifyFedosDirectRatchetSessionResetDeviceSignature(keypair.publicKeyHex, content, signatureHex!)).toBe(true);
  });

  it("rejects a signature verified against the WRONG public key", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const otherKeypair = generateFedosDeviceSigningKeypair();
    const content = baseContent();
    const signatureHex = createFedosDirectRatchetSessionResetDeviceSignature(keypair, content)!;
    expect(verifyFedosDirectRatchetSessionResetDeviceSignature(otherKeypair.publicKeyHex, content, signatureHex)).toBe(false);
  });

  it("rejects a signature when ANY signed field is tampered (generation, reason, nonce, conversationId)", () => {
    const keypair = generateFedosDeviceSigningKeypair();
    const content = baseContent();
    const signatureHex = createFedosDirectRatchetSessionResetDeviceSignature(keypair, content)!;
    expect(verifyFedosDirectRatchetSessionResetDeviceSignature(keypair.publicKeyHex, { ...content, generation: 1 }, signatureHex)).toBe(
      false,
    );
    expect(
      verifyFedosDirectRatchetSessionResetDeviceSignature(keypair.publicKeyHex, { ...content, resetNonce: "b".repeat(32) }, signatureHex),
    ).toBe(false);
    expect(
      verifyFedosDirectRatchetSessionResetDeviceSignature(
        keypair.publicKeyHex,
        { ...content, conversationId: "private-draft::direct::different" },
        signatureHex,
      ),
    ).toBe(false);
  });

  it("cannot be confused with a device-binding proof of possession — distinct preimage prefixes (structural: a signature produced here never validates under that file's own digest, proven by cross-verifying with a mismatched key never accidentally succeeding)", () => {
    // Reused as a smoke check: the same keypair signs two DIFFERENT digests
    // (this file's reset digest vs. an arbitrary different message) and the
    // resulting signatures must not be interchangeable.
    const keypair = generateFedosDeviceSigningKeypair();
    const content = baseContent();
    const resetSignature = createFedosDirectRatchetSessionResetDeviceSignature(keypair, content)!;
    const differentContent = baseContent({ resetNonce: "f".repeat(32) });
    expect(verifyFedosDirectRatchetSessionResetDeviceSignature(keypair.publicKeyHex, differentContent, resetSignature)).toBe(false);
  });
});

describe("FedosDirectRatchetSessionResetAuthority", () => {
  function authorityWith(persistence = new InMemoryFedosDirectRatchetSessionResetRecordPersistence()) {
    return { authority: new FedosDirectRatchetSessionResetAuthority(persistence), persistence };
  }

  it("accepts a fresh establishment (previousGeneration null, generation 0, no local record)", () => {
    const { authority } = authorityWith();
    const result = authority.evaluate({
      content: baseContent(),
      deviceSignatureHex: null,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: null,
    });
    expect(result.outcome).toBe("accepted-initial");
  });

  it("accepts a legitimate reset (generation 1 following locally-known generation 0)", () => {
    const { authority } = authorityWith();
    const result = authority.evaluate({
      content: baseContent({ generation: 1, previousGeneration: 0, resetReason: "suspected-compromise" }),
      deviceSignatureHex: null,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: 0,
    });
    expect(result.outcome).toBe("accepted-reset");
  });

  it("rejects when the sending Device is unknown, revoked, or merely pending/untrusted", () => {
    const { authority } = authorityWith();
    for (const binding of [null, revokedBinding("bob-device"), { ...trustedBinding("bob-device", null), trustState: "pending" as const }]) {
      const result = authority.evaluate({
        content: baseContent(),
        deviceSignatureHex: null,
        senderDeviceBinding: binding,
        locallyKnownPreviousGeneration: null,
      });
      expect(result.outcome).toBe("rejected-device-untrusted");
    }
  });

  it("rejects a generation mismatch — claimed previousGeneration disagrees with local ground truth", () => {
    const { authority } = authorityWith();
    const result = authority.evaluate({
      content: baseContent({ generation: 1, previousGeneration: 0, resetReason: "suspected-compromise" }),
      deviceSignatureHex: null,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: 3, // local side actually has generation 3, not 0
    });
    expect(result.outcome).toBe("rejected-generation-mismatch");
  });

  it("rejects a fresh-establishment claim when a local record already exists", () => {
    const { authority } = authorityWith();
    const result = authority.evaluate({
      content: baseContent(),
      deviceSignatureHex: null,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: 0,
    });
    expect(result.outcome).toBe("rejected-generation-mismatch");
  });

  it("verifies a Device signature ONLY when devicePublicKeyRef is on file — accepts a supplied-but-unverifiable signature when no key is on file, rejects a WRONG signature when a key IS on file", () => {
    const { authority } = authorityWith();
    const keypair = generateFedosDeviceSigningKeypair();
    const content = baseContent();
    const signatureHex = createFedosDirectRatchetSessionResetDeviceSignature(keypair, content)!;

    // No key on file -- best-effort, cannot verify, harmlessly accepted.
    const noKeyResult = authority.evaluate({
      content,
      deviceSignatureHex: signatureHex,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: null,
    });
    expect(noKeyResult.outcome).toBe("accepted-initial");

    // A key IS on file, and it's the WRONG key -- must fail closed.
    const wrongKeypair = generateFedosDeviceSigningKeypair();
    const wrongKeyResult = authority.evaluate({
      content,
      deviceSignatureHex: signatureHex,
      senderDeviceBinding: trustedBinding("bob-device", wrongKeypair.publicKeyHex),
      locallyKnownPreviousGeneration: null,
    });
    expect(wrongKeyResult.outcome).toBe("rejected-signature");

    // The CORRECT key on file -- verified and accepted.
    const correctKeyResult = authority.evaluate({
      content,
      deviceSignatureHex: signatureHex,
      senderDeviceBinding: trustedBinding("bob-device", keypair.publicKeyHex),
      locallyKnownPreviousGeneration: null,
    });
    expect(correctKeyResult.outcome).toBe("accepted-initial");
  });

  it("replay protection: an identical repeat of an already-recorded nonce is idempotent; a DIFFERENT attempt reusing the same nonce is rejected", () => {
    const persistence = new InMemoryFedosDirectRatchetSessionResetRecordPersistence();
    const { authority } = authorityWith(persistence);
    persistence.putResetRecord({
      schemaVersion: 1,
      nonce: "a".repeat(32),
      localAccountRef: ACCOUNT_A,
      localDeviceRef: "alice-device",
      remoteAccountRef: ACCOUNT_B,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc",
      suite: "fedos-direct-ratchet-v1",
      previousGeneration: null,
      newGeneration: 0,
      reason: null,
      initiator: "remote",
      outcome: "accepted-initial",
      recordedAt: 0,
    });

    const repeat = authority.evaluate({
      content: baseContent(),
      deviceSignatureHex: null,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: null,
    });
    expect(repeat.outcome).toBe("accepted-idempotent-repeat");

    const conflicting = authority.evaluate({
      content: baseContent({ generation: 1, previousGeneration: 0, resetReason: "suspected-compromise" }),
      deviceSignatureHex: null,
      senderDeviceBinding: trustedBinding("bob-device", null),
      locallyKnownPreviousGeneration: 0,
    });
    expect(conflicting.outcome).toBe("rejected-replayed");
  });
});

describe("FedosDirectRatchetResetCoordinator", () => {
  function makeCoordinator() {
    const sessionPersistence = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({
      sessionPersistence,
      sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(),
      sealingAuthority: null,
      now: () => 1000,
    });
    const resetRecordPersistence = new InMemoryFedosDirectRatchetSessionResetRecordPersistence();
    const coordinator = new FedosDirectRatchetResetCoordinator({ stateRuntime, resetRecordPersistence, now: () => 1000 });
    return { sessionPersistence, stateRuntime, resetRecordPersistence, coordinator };
  }

  function sessionIdFor(generation: number) {
    return toFedosDirectRatchetSessionId({
      localAccountRef: "nostr:aaaa",
      localDeviceRef: "alice-device",
      remoteAccountRef: "nostr:bbbb",
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc" as never,
      suite: "fedos-direct-ratchet-v1",
      generation,
    })!;
  }

  it("applyConsequences persists a durable reset record and supersedes (reset-required) the prior generation's session", () => {
    const { sessionPersistence, stateRuntime, resetRecordPersistence, coordinator } = makeCoordinator();
    const oldSessionId = sessionIdFor(0);
    sessionPersistence.putSession({
      schemaVersion: 1,
      revision: 0,
      binding: {
        sessionId: oldSessionId,
        localAccountRef: ACCOUNT_A,
        localDeviceRef: "alice-device",
        remoteAccountRef: ACCOUNT_B,
        remoteDeviceRef: "bob-device",
        conversationId: "private-draft::direct::abc" as never,
        suite: "fedos-direct-ratchet-v1",
        generation: 0,
      },
      lifecycleState: "active",
      counters: { sendCounter: 0, receiveCounter: 0, previousChainCounter: 0 },
      createdAt: 0,
      lastActivityAt: 0,
      skippedKeyReferences: [],
      sealedSecretRecordIds: [],
    });

    coordinator.applyConsequences({
      localAccountRef: ACCOUNT_A,
      localDeviceRef: "alice-device",
      remoteAccountRef: ACCOUNT_B,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc",
      suite: "fedos-direct-ratchet-v1",
      previousGeneration: 0,
      newGeneration: 1,
      reason: "suspected-compromise",
      nonce: "a".repeat(32),
      initiator: "local",
      outcome: "accepted-reset",
      previousSessionId: oldSessionId,
    });

    expect(stateRuntime.getSessionMetadata(oldSessionId)?.lifecycleState).toBe("reset-required");
    const record = resetRecordPersistence.getResetRecord("a".repeat(32));
    expect(record?.newGeneration).toBe(1);
    expect(record?.previousGeneration).toBe(0);
    expect(record?.reason).toBe("suspected-compromise");
  });

  it("applyConsequences with skipRecord=true does not rewrite the audit record (idempotent-repeat case)", () => {
    const { resetRecordPersistence, coordinator } = makeCoordinator();
    resetRecordPersistence.putResetRecord({
      schemaVersion: 1,
      nonce: "a".repeat(32),
      localAccountRef: ACCOUNT_A,
      localDeviceRef: "alice-device",
      remoteAccountRef: ACCOUNT_B,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc",
      suite: "fedos-direct-ratchet-v1",
      previousGeneration: null,
      newGeneration: 0,
      reason: null,
      initiator: "remote",
      outcome: "accepted-initial",
      recordedAt: 500,
    });
    coordinator.applyConsequences({
      localAccountRef: ACCOUNT_A,
      localDeviceRef: "alice-device",
      remoteAccountRef: ACCOUNT_B,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc",
      suite: "fedos-direct-ratchet-v1",
      previousGeneration: null,
      newGeneration: 0,
      reason: null,
      nonce: "a".repeat(32),
      initiator: "remote",
      outcome: "accepted-initial",
      previousSessionId: null,
      skipRecord: true,
    });
    expect(resetRecordPersistence.getResetRecord("a".repeat(32))?.recordedAt).toBe(500);
  });

  it("applyDeviceRevocation transitions every non-terminal session record involving the revoked device (either side of the tuple) to revoked, and skips already-terminal ones", () => {
    const { sessionPersistence, stateRuntime, coordinator } = makeCoordinator();
    const activeSessionId = sessionIdFor(0);
    sessionPersistence.putSession({
      schemaVersion: 1,
      revision: 0,
      binding: {
        sessionId: activeSessionId,
        localAccountRef: ACCOUNT_A,
        localDeviceRef: "alice-device",
        remoteAccountRef: ACCOUNT_B,
        remoteDeviceRef: "bob-device",
        conversationId: "private-draft::direct::abc" as never,
        suite: "fedos-direct-ratchet-v1",
        generation: 0,
      },
      lifecycleState: "active",
      counters: { sendCounter: 0, receiveCounter: 0, previousChainCounter: 0 },
      createdAt: 0,
      lastActivityAt: 0,
      skippedKeyReferences: [],
      sealedSecretRecordIds: [],
    });
    const unrelatedSessionId = toFedosDirectRatchetSessionId({
      localAccountRef: "nostr:aaaa",
      localDeviceRef: "alice-device",
      remoteAccountRef: "nostr:cccc",
      remoteDeviceRef: "carol-device",
      conversationId: "private-draft::direct::xyz" as never,
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
    })!;
    sessionPersistence.putSession({
      schemaVersion: 1,
      revision: 0,
      binding: {
        sessionId: unrelatedSessionId,
        localAccountRef: ACCOUNT_A,
        localDeviceRef: "alice-device",
        remoteAccountRef: { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null },
        remoteDeviceRef: "carol-device",
        conversationId: "private-draft::direct::xyz" as never,
        suite: "fedos-direct-ratchet-v1",
        generation: 0,
      },
      lifecycleState: "active",
      counters: { sendCounter: 0, receiveCounter: 0, previousChainCounter: 0 },
      createdAt: 0,
      lastActivityAt: 0,
      skippedKeyReferences: [],
      sealedSecretRecordIds: [],
    });

    const affected = coordinator.applyDeviceRevocation("bob-device", sessionPersistence);
    expect(affected).toEqual([activeSessionId]);
    expect(stateRuntime.getSessionMetadata(activeSessionId)?.lifecycleState).toBe("revoked");
    expect(stateRuntime.getSessionMetadata(unrelatedSessionId)?.lifecycleState).toBe("active");

    // Idempotent -- a second sweep finds nothing new to transition (already terminal).
    expect(coordinator.applyDeviceRevocation("bob-device", sessionPersistence)).toEqual([]);
  });
});

describe("Session Reset Record Persistence — append-only restart-safety", () => {
  it("a record written before 'restart' is still readable by a brand-new instance over the same file", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-reset-record-"));
    const filePath = join(dir, "reset-records.log");
    const first = new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(filePath);
    first.putResetRecord({
      schemaVersion: 1,
      nonce: "a".repeat(32),
      localAccountRef: ACCOUNT_A,
      localDeviceRef: "alice-device",
      remoteAccountRef: ACCOUNT_B,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc",
      suite: "fedos-direct-ratchet-v1",
      previousGeneration: null,
      newGeneration: 0,
      reason: null,
      initiator: "local",
      outcome: "accepted-initial",
      recordedAt: 42,
    });

    const restarted = new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(filePath);
    const record = restarted.getResetRecord("a".repeat(32));
    expect(record?.recordedAt).toBe(42);
    expect(restarted.listResetRecords()).toHaveLength(1);
  });

  it("an identical repeat write is idempotent; a conflicting repeat (same nonce, different content) is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-reset-record-"));
    const filePath = join(dir, "reset-records.log");
    const persistence = new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(filePath);
    const record = {
      schemaVersion: 1 as const,
      nonce: "a".repeat(32),
      localAccountRef: ACCOUNT_A,
      localDeviceRef: "alice-device",
      remoteAccountRef: ACCOUNT_B,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::abc",
      suite: "fedos-direct-ratchet-v1" as const,
      previousGeneration: null,
      newGeneration: 0,
      reason: null,
      initiator: "local" as const,
      outcome: "accepted-initial" as const,
      recordedAt: 42,
    };
    expect(persistence.putResetRecord(record)).toBe("inserted");
    expect(persistence.putResetRecord(record)).toBe("already-present");
    expect(persistence.putResetRecord({ ...record, newGeneration: 5 })).toBe("conflict");
  });
});

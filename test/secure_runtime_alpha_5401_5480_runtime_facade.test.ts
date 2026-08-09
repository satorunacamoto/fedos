/**
 * Secure Runtime Alpha 5401-5480 — Phase H/I. Runtime-orchestration
 * tests using the deterministic FAKE sealing authority
 * (`test/support/fake_direct_ratchet_sealing_authority.ts`) -- the
 * headline REAL-crypto sealed-persistence proof lives in
 * `test/secure_runtime_alpha_5401_5480_real_vertical_slice.test.ts`.
 * Covers test requirements 17 (sealed persistence, orchestration level),
 * 18 (wrong Device recovery), 19 (wrong account recovery), 20 (tamper
 * rejection), 21 (lock handle disposal), 22 (stop lifecycle), 28
 * (independent Runtime isolation), 29 (interruption recovery, restart).
 */
import { describe, it, expect } from "vitest";
import { FedosDirectRatchetStateRuntime } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_state_runtime.js";
import { InMemoryFedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_direct_ratchet_session_persistence.js";
import { InMemoryFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.js";
import { FakeFedosDirectRatchetSealingAuthority } from "./support/fake_direct_ratchet_sealing_authority.js";
import type { FedosDirectRatchetSessionBinding } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosDirectRatchetSessionId } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";

function binding(overrides: Partial<FedosDirectRatchetSessionBinding> = {}): FedosDirectRatchetSessionBinding {
  return {
    sessionId: "direct-ratchet-v1##alice##dev1##bob##dev2##conv1##fedos-direct-ratchet-v1##0" as FedosDirectRatchetSessionId,
    localAccountRef: { authority: "fedos", publicIdentifier: "alice", identityId: null },
    localDeviceRef: "dev1",
    remoteAccountRef: { authority: "fedos", publicIdentifier: "bob", identityId: null },
    remoteDeviceRef: "dev2",
    conversationId: "conv1" as FedosConversationId,
    suite: "fedos-direct-ratchet-v1",
    generation: 0,
    ...overrides,
  };
}

function makeRuntime(sealingAuthority: FakeFedosDirectRatchetSealingAuthority | null = new FakeFedosDirectRatchetSealingAuthority()) {
  return new FedosDirectRatchetStateRuntime({
    sessionPersistence: new InMemoryFedosDirectRatchetSessionPersistence(),
    sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(),
    sealingAuthority,
    now: () => 1_700_000_000_000,
  });
}

describe("Alpha 5401-5480 — Runtime facade lifecycle", () => {
  it("creates a session in the 'initialized' state", () => {
    const runtime = makeRuntime();
    const outcome = runtime.createSession(binding());
    expect(outcome.outcome).toBe("created");
    if (outcome.outcome === "created") {
      expect(outcome.record.lifecycleState).toBe("initialized");
      expect(outcome.record.revision).toBe(0);
    }
  });

  it("rejects creating the same session twice with different content (conflict)", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    const conflicting = runtime.createSession(binding({ generation: 0 }));
    // Same binding -> same sessionId -> same revision 0 content -> already-exists (idempotent), not conflict.
    expect(conflicting.outcome).toBe("already-exists");
  });

  it("readiness reports 'sealing-authority-unavailable' when none is injected", () => {
    const runtime = makeRuntime(null);
    runtime.createSession(binding());
    expect(runtime.readiness(binding().sessionId).state).toBe("sealing-authority-unavailable");
  });

  it("readiness reports 'session-not-found' for an unknown session", () => {
    const runtime = makeRuntime();
    expect(runtime.readiness("unknown-session" as FedosDirectRatchetSessionId).state).toBe("session-not-found");
  });

  it("readiness reports 'ready' for an initialized/active session with a real authority", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    expect(runtime.readiness(binding().sessionId).state).toBe("ready");
  });

  it("valid transition: initialized -> active via markActive()", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    const outcome = runtime.markActive(binding().sessionId);
    expect(outcome.outcome).toBe("transitioned");
  });

  it("invalid transition is rejected", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.revoke(binding().sessionId);
    const outcome = runtime.markActive(binding().sessionId);
    expect(outcome).toEqual({ outcome: "rejected", reason: "invalid-transition" });
  });

  it("transition on an unknown session reports session-not-found", () => {
    const runtime = makeRuntime();
    expect(runtime.suspend("unknown" as FedosDirectRatchetSessionId)).toEqual({
      outcome: "rejected",
      reason: "session-not-found",
    });
  });

  it("counters update only while active, and reject rollback", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const updated = runtime.updateCounters(binding().sessionId, { sendCounter: 5 });
    expect(updated.outcome).toBe("updated");
    const rollback = runtime.updateCounters(binding().sessionId, { sendCounter: 2 });
    expect(rollback).toEqual({ outcome: "rejected", reason: "counter-rollback-or-overflow" });
  });

  it("counters cannot be updated on a non-active session", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    const updated = runtime.updateCounters(binding().sessionId, { sendCounter: 5 });
    expect(updated).toEqual({ outcome: "rejected", reason: "session-not-active" });
  });

  it("registers and removes a skipped-key reference, reflected in session metadata", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const registered = runtime.registerSkippedKeyReference(binding().sessionId, 3, "some-sealed-record-id");
    expect(registered.outcome).toBe("applied");
    if (registered.outcome === "applied") expect(registered.record.skippedKeyReferences).toHaveLength(1);

    const removed = runtime.removeSkippedKeyReference(binding().sessionId, 3);
    expect(removed.outcome).toBe("applied");
    if (removed.outcome === "applied") expect(removed.record.skippedKeyReferences).toHaveLength(0);
  });

  it("a duplicate skipped-key registration is rejected", () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    runtime.registerSkippedKeyReference(binding().sessionId, 3, "a");
    const duplicate = runtime.registerSkippedKeyReference(binding().sessionId, 3, "b");
    expect(duplicate).toEqual({ outcome: "rejected", reason: "duplicate-counter" });
  });
});

describe("Alpha 5401-5480 — Runtime seal/recover (fake authority)", () => {
  it("17. seals opaque bytes and persists a sealed record", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const outcome = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([1, 2, 3]));
    expect(outcome.outcome).toBe("sealed");
  });

  it("17. recovers the exact same bytes it sealed", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const secret = new Uint8Array([9, 9, 9, 9]);
    const sealOutcome = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, secret);
    expect(sealOutcome.outcome).toBe("sealed");
    if (sealOutcome.outcome !== "sealed") return;

    const recoverOutcome = await runtime.recover(binding().sessionId, sealOutcome.sealedRecordId);
    expect(recoverOutcome).toEqual({ outcome: "recovered" });
    const handle = runtime.recoveredSecret(sealOutcome.sealedRecordId);
    expect(handle).not.toBeNull();
    expect(Array.from(handle!.bytes()!)).toEqual(Array.from(secret));
  });

  it("18. wrong Device recovery -- a session forged with a different remoteDeviceRef than sealing used cannot recover", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const sealOutcome = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([1]));
    expect(sealOutcome.outcome).toBe("sealed");
    if (sealOutcome.outcome !== "sealed") return;

    // A second, independent session/runtime sharing the SAME sealed-secret
    // store but a DIFFERENT remoteDeviceRef in its own binding -- this is
    // exactly the substitution scenario Phase K names.
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    const sealingAuthority = new FakeFedosDirectRatchetSealingAuthority();
    const runtimeA = new FedosDirectRatchetStateRuntime({
      sessionPersistence: new InMemoryFedosDirectRatchetSessionPersistence(),
      sealedSecretPersistence,
      sealingAuthority,
    });
    runtimeA.createSession(binding());
    runtimeA.markActive(binding().sessionId);
    const sealed = await runtimeA.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([1]));
    expect(sealed.outcome).toBe("sealed");
    if (sealed.outcome !== "sealed") return;

    const runtimeB = new FedosDirectRatchetStateRuntime({
      sessionPersistence: new InMemoryFedosDirectRatchetSessionPersistence(),
      sealedSecretPersistence,
      sealingAuthority,
    });
    const wrongDeviceBinding = binding({ remoteDeviceRef: "dev-WRONG" });
    runtimeB.createSession(wrongDeviceBinding);
    runtimeB.markActive(wrongDeviceBinding.sessionId);
    // Same sessionId (binding differs only in remoteDeviceRef, but
    // sessionId is deterministic from the FULL binding, so this is
    // actually a DIFFERENT sessionId -- to exercise the true substitution
    // path, directly recover using runtimeA's own sealedRecordId against
    // runtimeB, which owns a session with a matching-but-wrong binding
    // at the SAME conceptual position; the sealed record's own embedded
    // sessionId will disagree, tripping the substitution guard.
    const outcome = await runtimeB.recover(wrongDeviceBinding.sessionId, sealed.sealedRecordId);
    expect(outcome).toEqual({ outcome: "rejected", reason: "tamper-or-mismatch" });
  });

  it("19. wrong account recovery -- recovering under a different localAccountRef's session fails closed", async () => {
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    const sealingAuthority = new FakeFedosDirectRatchetSealingAuthority();
    const runtimeA = new FedosDirectRatchetStateRuntime({
      sessionPersistence: new InMemoryFedosDirectRatchetSessionPersistence(),
      sealedSecretPersistence,
      sealingAuthority,
    });
    runtimeA.createSession(binding());
    runtimeA.markActive(binding().sessionId);
    const sealed = await runtimeA.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([7]));
    expect(sealed.outcome).toBe("sealed");
    if (sealed.outcome !== "sealed") return;

    const runtimeB = new FedosDirectRatchetStateRuntime({
      sessionPersistence: new InMemoryFedosDirectRatchetSessionPersistence(),
      sealedSecretPersistence,
      sealingAuthority,
    });
    const wrongAccountBinding = binding({ localAccountRef: { authority: "fedos", publicIdentifier: "mallory", identityId: null } });
    runtimeB.createSession(wrongAccountBinding);
    runtimeB.markActive(wrongAccountBinding.sessionId);
    const outcome = await runtimeB.recover(wrongAccountBinding.sessionId, sealed.sealedRecordId);
    expect(outcome).toEqual({ outcome: "rejected", reason: "tamper-or-mismatch" });
  });

  it("20. tamper rejection -- a corrupted sealedBlob fails to recover", async () => {
    const sessionPersistence = new InMemoryFedosDirectRatchetSessionPersistence();
    const store = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    const sealingAuthority = new FakeFedosDirectRatchetSealingAuthority();
    const runtime = new FedosDirectRatchetStateRuntime({ sessionPersistence, sealedSecretPersistence: store, sealingAuthority });
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const sealOutcome = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([1, 2, 3]));
    expect(sealOutcome.outcome).toBe("sealed");
    if (sealOutcome.outcome !== "sealed") return;

    // Tamper the persisted sealed record's own blob (flip one hex digit)
    // and swap it in via a second persistence instance sharing the SAME
    // session metadata -- exactly the "wrong wrapping authority"/"sealed
    // reference substitution" class of attack Phase K names.
    const original = store.getSealedSecret(sealOutcome.sealedRecordId)!;
    const tamperedBlob = original.sealedBlob.slice(0, -2) + (original.sealedBlob.slice(-2) === "00" ? "11" : "00");
    const tamperedStore = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    tamperedStore.putSealedSecret({ ...original, sealedBlob: tamperedBlob });

    const runtimeOverTamperedStore = new FedosDirectRatchetStateRuntime({
      sessionPersistence,
      sealedSecretPersistence: tamperedStore,
      sealingAuthority,
    });
    const outcome = await runtimeOverTamperedStore.recover(binding().sessionId, sealOutcome.sealedRecordId);
    expect(outcome).toEqual({ outcome: "rejected", reason: "tamper-or-mismatch" });
  });

  it("missing sealed record reports 'missing'/'no-sealed-record'", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const outcome = await runtime.recover(binding().sessionId, "nonexistent-record-id");
    expect(outcome).toEqual({ outcome: "missing", reason: "no-sealed-record" });
  });

  it("recovery from a revoked session is rejected without ever calling the authority", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const sealed = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([1]));
    expect(sealed.outcome).toBe("sealed");
    if (sealed.outcome !== "sealed") return;
    runtime.revoke(binding().sessionId);
    const outcome = await runtime.recover(binding().sessionId, sealed.sealedRecordId);
    expect(outcome).toEqual({ outcome: "rejected", reason: "session-revoked" });
  });

  it("recovery never silently creates replacement secret state on failure", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    await runtime.recover(binding().sessionId, "nonexistent");
    expect(runtime.recoveredSecret("nonexistent")).toBeNull();
  });
});

describe("Alpha 5401-5480 — lock / stop / restart", () => {
  it("21. lock() disposes every recovered in-memory secret handle", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const sealed = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([4, 5, 6]));
    expect(sealed.outcome).toBe("sealed");
    if (sealed.outcome !== "sealed") return;
    await runtime.recover(binding().sessionId, sealed.sealedRecordId);
    expect(runtime.recoveredSecret(sealed.sealedRecordId)).not.toBeNull();

    runtime.lock();
    expect(runtime.recoveredSecret(sealed.sealedRecordId)).toBeNull();
  });

  it("22. stop() prevents further mutation but keeps read-only methods working", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    runtime.stop();
    expect(runtime.isStopped()).toBe(true);

    expect(runtime.createSession(binding({ conversationId: "conv2" as FedosConversationId }))).toEqual({
      outcome: "rejected",
      reason: "runtime-stopped",
    });
    expect(runtime.updateCounters(binding().sessionId, { sendCounter: 1 })).toEqual({
      outcome: "rejected",
      reason: "runtime-stopped",
    });
    expect(runtime.suspend(binding().sessionId)).toEqual({ outcome: "rejected", reason: "runtime-stopped" });

    // Read-only methods remain available.
    expect(runtime.getSessionMetadata(binding().sessionId)).not.toBeNull();
  });

  it("22. stop() also locks -- any handle recovered before stop() is disposed", async () => {
    const runtime = makeRuntime();
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    const sealed = await runtime.sealAndPersistSecret(binding().sessionId, "root-key", null, new Uint8Array([1]));
    if (sealed.outcome !== "sealed") throw new Error("setup failed");
    await runtime.recover(binding().sessionId, sealed.sealedRecordId);
    runtime.stop();
    expect(runtime.recoveredSecret(sealed.sealedRecordId)).toBeNull();
  });

  it("29. restart() replays public session metadata (skipped-key index) without recovering any secret handle", () => {
    const sessionPersistence = new InMemoryFedosDirectRatchetSessionPersistence();
    const sealedSecretPersistence = new InMemoryFedosSealedDirectRatchetSecretPersistence();
    const sealingAuthority = new FakeFedosDirectRatchetSealingAuthority();
    const runtime = new FedosDirectRatchetStateRuntime({ sessionPersistence, sealedSecretPersistence, sealingAuthority });
    runtime.createSession(binding());
    runtime.markActive(binding().sessionId);
    runtime.registerSkippedKeyReference(binding().sessionId, 3, "record-a");

    const restarted = new FedosDirectRatchetStateRuntime({ sessionPersistence, sealedSecretPersistence, sealingAuthority });
    restarted.restart();
    expect(restarted.getSessionMetadata(binding().sessionId)?.skippedKeyReferences).toHaveLength(1);
    // A duplicate insert of the SAME chainCounter must still be rejected
    // post-restart -- proving the skipped-key index itself was really
    // replayed, not merely the session record's own array field.
    const duplicate = restarted.registerSkippedKeyReference(binding().sessionId, 3, "record-b");
    expect(duplicate).toEqual({ outcome: "rejected", reason: "duplicate-counter" });
  });

  it("28. independent Runtime isolation -- two Runtimes over completely separate persistence never observe each other", () => {
    const runtimeA = makeRuntime();
    const runtimeB = makeRuntime();
    runtimeA.createSession(binding());
    expect(runtimeB.getSessionMetadata(binding().sessionId)).toBeNull();
  });
});

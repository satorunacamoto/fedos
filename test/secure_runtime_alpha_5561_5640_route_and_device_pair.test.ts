/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase B/C: closed route vocabulary
 * and Device-pair session resolution, tested against real (non-fake)
 * Device registry/session persistence and a fake `FedosDirectRatchetSealingAuthority`
 * (no real crypto needed here — every function under test is pure
 * routing/policy logic over already-real, already-tested Foundation
 * ports).
 */
import { describe, it, expect } from "vitest";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDirectRatchetSessionPersistence } from "../src/conversation/ratchet/persistence/in_memory_fedos_direct_ratchet_session_persistence.js";
import { InMemoryFedosSealedDirectRatchetSecretPersistence } from "../src/conversation/ratchet/persistence/in_memory_fedos_sealed_direct_ratchet_secret_persistence.js";
import { FedosDirectRatchetStateRuntime } from "../src/conversation/ratchet/fedos_direct_ratchet_state_runtime.js";
import {
  resolveFedosDirectRatchetDevicePair,
  findCurrentFedosDirectRatchetSession,
} from "../src/conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.js";
import { resolveFedosDirectRatchetRoute } from "../src/conversation/ratchet/fedos_direct_ratchet_route_resolution.js";
import type { FedosDirectRatchetSealingAuthority } from "../src/conversation/ratchet/fedos_direct_ratchet_sealing_authority.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

/** Fake — only readiness/route-resolution policy is under test here, never real cryptography (see the Foundation Arc's own identical fake-sealing-authority-injection test pattern). */
const FAKE_SEALING_AUTHORITY: FedosDirectRatchetSealingAuthority = {
  sealDirectRatchetSecret: async () => "fake-sealed",
  restoreDirectRatchetSecret: async () => new Uint8Array(32),
};

const NOW = 1_720_000_000_000;
const ALICE: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const BOB: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const CONVERSATION_ID = "private-draft::direct::route-device-pair-test" as unknown as FedosConversationId;

function trustDevice(registry: InMemoryFedosDeviceRegistryPersistence, deviceId: string, accountRef: FedosDeviceBindingAccountRef): void {
  registry.putEvent({
    schemaVersion: 1,
    eventType: "registered",
    deviceId,
    accountAuthority: accountRef.authority,
    accountPublicIdentifier: accountRef.publicIdentifier,
    accountIdentityId: null,
    devicePublicKeyRef: null,
    label: null,
    initialTrustState: "pending",
    registeredAt: NOW,
  });
  registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: NOW });
}

function revokeDevice(registry: InMemoryFedosDeviceRegistryPersistence, deviceId: string): void {
  registry.putEvent({ schemaVersion: 1, eventType: "revoked", deviceId, revokedAt: NOW });
}

describe("Alpha 5561-5640 Phase C -- Device-pair ratchet session resolution", () => {
  it("resolves a session id for two trusted devices, canonically ordered regardless of which side is 'local'", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    trustDevice(registry, "bob-device", BOB);
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();

    const fromAlice = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    const fromBob = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: BOB,
      localDeviceRef: "bob-device",
      remoteAccountRef: ALICE,
      remoteDeviceRef: "alice-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    expect(fromAlice.outcome).toBe("resolved");
    expect(fromBob.outcome).toBe("resolved");
    if (fromAlice.outcome !== "resolved" || fromBob.outcome !== "resolved") return;
    // CRITICAL: both sides must compute the IDENTICAL session id string --
    // it is the Rust ratchet core's own HKDF context binding input.
    expect(fromAlice.sessionId).toBe(fromBob.sessionId);
  });

  it("fails closed for an unknown local Device", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "bob-device", BOB);
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "never-registered-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    expect(resolution).toEqual({ outcome: "local-device-unknown" });
  });

  it("fails closed for an unknown remote Device", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "never-registered-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    expect(resolution).toEqual({ outcome: "remote-device-unknown" });
  });

  it("denies a revoked remote Device unconditionally", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    trustDevice(registry, "bob-device", BOB);
    revokeDevice(registry, "bob-device");
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    expect(resolution).toEqual({ outcome: "remote-device-revoked" });
  });

  it("denies a revoked local Device unconditionally", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    trustDevice(registry, "bob-device", BOB);
    revokeDevice(registry, "alice-device");
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    expect(resolution).toEqual({ outcome: "local-device-revoked" });
  });

  it("a merely-'pending' (not yet trusted) Device is insufficient for ratchet participation", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    registry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId: "bob-device",
      accountAuthority: BOB.authority,
      accountPublicIdentifier: BOB.publicIdentifier,
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: NOW,
    });
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    expect(resolution).toEqual({ outcome: "remote-device-not-trusted" });
  });

  it("findCurrentFedosDirectRatchetSession finds the highest-generation record for the exact tuple, never a different tuple", () => {
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({ sessionPersistence: sessions, sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(), sealingAuthority: null });
    const binding = (generation: number) => ({
      sessionId: `direct-ratchet-v1##nostr:${"a".repeat(16)}##alice-device##nostr:${"b".repeat(16)}##bob-device##conv##fedos-direct-ratchet-v1##${generation}` as never,
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      suite: "fedos-direct-ratchet-v1" as const,
      generation,
    });
    stateRuntime.createSession(binding(0));
    stateRuntime.createSession(binding(1));
    const current = findCurrentFedosDirectRatchetSession(sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      suite: "fedos-direct-ratchet-v1",
    });
    expect(current?.binding.generation).toBe(1);

    // A DIFFERENT Conversation must never match.
    const otherConversation = findCurrentFedosDirectRatchetSession(sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: "private-draft::direct::a-different-conversation" as unknown as FedosConversationId,
      suite: "fedos-direct-ratchet-v1",
    });
    expect(otherConversation).toBeNull();
  });
});

describe("Alpha 5561-5640 Phase B -- closed ratchet route resolution", () => {
  function buildContext(registry: InMemoryFedosDeviceRegistryPersistence, sessions: InMemoryFedosDirectRatchetSessionPersistence, stateRuntime: FedosDirectRatchetStateRuntime) {
    return {
      deviceRegistry: registry,
      sessionPersistence: sessions,
      stateRuntime,
      devicePair: {
        localAccountRef: ALICE,
        localDeviceRef: "alice-device",
        remoteAccountRef: BOB,
        remoteDeviceRef: "bob-device",
        conversationId: CONVERSATION_ID,
      },
      legacyAdapterFor: () => ({ isAvailable: () => true }),
    };
  }

  it("the proprietary route resolves unaffected by ratchet state", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({ sessionPersistence: sessions, sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(), sealingAuthority: null });
    const decision = resolveFedosDirectRatchetRoute("fedos-private-v1", buildContext(registry, sessions, stateRuntime));
    expect(decision).toEqual({ route: "fedos-private-v1" });
  });

  it("requesting the ratchet route with no session yet fails closed to session-initialization-required, never falls back", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    trustDevice(registry, "bob-device", BOB);
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({ sessionPersistence: sessions, sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(), sealingAuthority: null });
    const decision = resolveFedosDirectRatchetRoute("nostr-nip17-v1-ratchet", buildContext(registry, sessions, stateRuntime));
    expect(decision).toEqual({ route: "unsupported", reason: "session-initialization-required" });
  });

  it("an active ratchet session resolves to the ratchet route with its sessionId", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    trustDevice(registry, "bob-device", BOB);
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({
      sessionPersistence: sessions,
      sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(),
      sealingAuthority: FAKE_SEALING_AUTHORITY,
    });

    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    if (resolution.outcome !== "resolved") throw new Error("expected resolved");
    stateRuntime.createSession({
      sessionId: resolution.sessionId,
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
    });
    stateRuntime.markActive(resolution.sessionId);

    const decision = resolveFedosDirectRatchetRoute("nostr-nip17-v1-ratchet", buildContext(registry, sessions, stateRuntime));
    expect(decision).toEqual({ route: "nostr-nip17-v1-ratchet", sessionId: resolution.sessionId });
  });

  it("downgrade-detected: an active ratchet session cannot be silently bypassed by requesting the static route", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    trustDevice(registry, "alice-device", ALICE);
    trustDevice(registry, "bob-device", BOB);
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({ sessionPersistence: sessions, sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(), sealingAuthority: null });

    const resolution = resolveFedosDirectRatchetDevicePair(registry, sessions, {
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      generation: 0,
    });
    if (resolution.outcome !== "resolved") throw new Error("expected resolved");
    stateRuntime.createSession({
      sessionId: resolution.sessionId,
      localAccountRef: ALICE,
      localDeviceRef: "alice-device",
      remoteAccountRef: BOB,
      remoteDeviceRef: "bob-device",
      conversationId: CONVERSATION_ID,
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
    });
    stateRuntime.markActive(resolution.sessionId);

    const decision = resolveFedosDirectRatchetRoute("fedos-private-v1", buildContext(registry, sessions, stateRuntime));
    expect(decision).toEqual({ route: "unsupported", reason: "downgrade-detected" });
  });

  it("an unknown route request fails closed", () => {
    const registry = new InMemoryFedosDeviceRegistryPersistence();
    const sessions = new InMemoryFedosDirectRatchetSessionPersistence();
    const stateRuntime = new FedosDirectRatchetStateRuntime({ sessionPersistence: sessions, sealedSecretPersistence: new InMemoryFedosSealedDirectRatchetSecretPersistence(), sealingAuthority: null });
    const decision = resolveFedosDirectRatchetRoute("something-nobody-ever-registered" as never, buildContext(registry, sessions, stateRuntime));
    expect(decision).toEqual({ route: "unsupported", reason: "unknown-route" });
  });
});

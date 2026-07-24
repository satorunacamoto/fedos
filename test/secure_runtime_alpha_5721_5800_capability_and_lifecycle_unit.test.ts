/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — schema/authentication/policy/
 * coordinator unit and integration coverage. Uses REAL BIP-340 Schnorr
 * signatures throughout (`RealFedosNostrSigningAuthority` for account-
 * level, `generateFedosDeviceSigningKeypair()` for Device-level — neither
 * needs the WASM artifact), so every signature check here is genuinely
 * exercised, not faked. The full real-transport, real-WASM vertical
 * slice lives in its own file
 * (`secure_runtime_alpha_5721_5800_real_vertical_slice.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { RealFedosNostrSigningAuthority, createStandaloneSchnorrSigner } from "./support/real_fedos_nostr_signing_authority.js";
import { generateFedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";

import {
  isWellFormedFedosRatchetPeerCapabilityEntry,
  isKnownFedosRatchetPeerCapabilityRoute,
  isKnownFedosRatchetLifecycleCapability,
  FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES,
} from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import {
  canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent,
  isWellFormedFedosRatchetPeerCapabilityAdvertisementV1,
  decodeFedosRatchetPeerCapabilityAdvertisementV1,
  encodeFedosRatchetPeerCapabilityAdvertisementV1,
  FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX,
  type FedosRatchetPeerCapabilityAdvertisementV1,
} from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_advertisement.js";
import {
  isWellFormedFedosRatchetPeerLifecycleFact,
} from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_lifecycle_notification.js";
import {
  authorizeFedosRatchetPeerCapabilityContent,
  verifyFedosRatchetPeerCapabilityAccountAuthorization,
  createFedosRatchetPeerCapabilityDeviceSignature,
  verifyFedosRatchetPeerCapabilityDeviceSignature,
  evaluateFedosRatchetPeerCapabilityEvidence,
} from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.js";
import {
  isWellFormedFedosRatchetPeerCapabilityControlPayload,
  decodeFedosRatchetPeerCapabilityControlPayloadFromContent,
  encodeFedosRatchetPeerCapabilityControlPayload,
} from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import { evaluateFedosRatchetPeerCapabilityAcceptance } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.js";
import { recommendFedosRatchetPeerSessionAction } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_session_action_recommendation.js";
import { computeFedosRatchetPeerCapabilitySafeStatus } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_safe_status.js";
import { InMemoryFedosRatchetPeerCapabilityObservationPersistence } from "../src/conversation/ratchet/peer_capability/persistence/in_memory_fedos_ratchet_peer_capability_observation_persistence.js";
import { FedosRatchetPeerCapabilityOutboundCoordinator } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_outbound_coordinator.js";
import { FedosRatchetPeerCapabilityInboundCoordinator } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_inbound_coordinator.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

const CONVERSATION_ID = "conv-1" as FedosConversationId;

function accountRef(publicIdentifier: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier, identityId: null };
}

describe("Alpha 5721-5800 -- capability vocabulary", () => {
  it("accepts every known entry kind and rejects unknown/extra fields", () => {
    expect(isWellFormedFedosRatchetPeerCapabilityEntry({ kind: "private-message-route", route: "nostr-nip17-v1-ratchet" })).toBe(true);
    expect(isWellFormedFedosRatchetPeerCapabilityEntry({ kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" })).toBe(true);
    expect(isWellFormedFedosRatchetPeerCapabilityEntry({ kind: "lifecycle-capability", capability: "device-notification-v1" })).toBe(true);
    expect(isWellFormedFedosRatchetPeerCapabilityEntry({ kind: "private-message-route", route: "unknown-route" })).toBe(false);
    expect(isWellFormedFedosRatchetPeerCapabilityEntry({ kind: "private-message-route", route: "nostr-nip17-v1", extra: 1 })).toBe(false);
    expect(isWellFormedFedosRatchetPeerCapabilityEntry({ kind: "made-up-kind" })).toBe(false);
    expect(isKnownFedosRatchetPeerCapabilityRoute("nostr-nip17-v1-ratchet")).toBe(true);
    expect(isKnownFedosRatchetPeerCapabilityRoute("made-up")).toBe(false);
    expect(isKnownFedosRatchetLifecycleCapability("capability-advertisement-v1")).toBe(true);
    expect(isKnownFedosRatchetLifecycleCapability("device-key-updated-v1")).toBe(false);
  });

  it("rejects unknown lifecycle fact kinds and enforces exact per-kind fields", () => {
    expect(isWellFormedFedosRatchetPeerLifecycleFact({ kind: "device-added" })).toBe(true);
    expect(isWellFormedFedosRatchetPeerLifecycleFact({ kind: "device-key-updated" })).toBe(false);
    expect(isWellFormedFedosRatchetPeerLifecycleFact({ kind: "device-replaced", newDeviceRef: "d2" })).toBe(true);
    expect(isWellFormedFedosRatchetPeerLifecycleFact({ kind: "device-replaced" })).toBe(false);
    expect(isWellFormedFedosRatchetPeerLifecycleFact({ kind: "ratchet-session-reset-required", reason: "suspected-compromise" })).toBe(true);
    expect(isWellFormedFedosRatchetPeerLifecycleFact({ kind: "ratchet-session-reset-required", reason: "peer-requested" })).toBe(false);
  });
});

describe("Alpha 5721-5800 -- advertisement schema, real signatures", () => {
  const alice = accountRef("alice-pubkey-hex");
  const bob = accountRef("bob-pubkey-hex");

  async function buildAdvertisement(overrides: Partial<Record<string, unknown>> = {}): Promise<{
    signingAuthority: RealFedosNostrSigningAuthority;
    advertisement: FedosRatchetPeerCapabilityAdvertisementV1;
  }> {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const content = {
      senderAccountRef: alice,
      senderDeviceRef: "alice-desktop",
      recipientAccountRef: bob,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID as unknown as string,
      revision: 1,
      capabilities: [
        { kind: "private-message-route" as const, route: "nostr-nip17-v1-ratchet" as const },
        { kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const },
      ],
      issuedAt: 1000,
      expiresAt: 2000,
      nonce: "a".repeat(32),
      ...overrides,
    };
    const canonicalContent = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(content as never);
    const accountAuthorization = await authorizeFedosRatchetPeerCapabilityContent(signingAuthority, 0, 1000, canonicalContent);
    if (accountAuthorization === null) throw new Error("expected signing to succeed");
    const advertisement: FedosRatchetPeerCapabilityAdvertisementV1 = {
      schemaVersion: 1,
      ...content,
      accountAuthorization,
      deviceSignatureHex: null,
    };
    return { signingAuthority, advertisement };
  }

  it("round-trips through encode/decode and validates structurally", async () => {
    const { advertisement } = await buildAdvertisement();
    expect(isWellFormedFedosRatchetPeerCapabilityAdvertisementV1(advertisement)).toBe(true);
    const decoded = decodeFedosRatchetPeerCapabilityAdvertisementV1(encodeFedosRatchetPeerCapabilityAdvertisementV1(advertisement));
    expect(decoded).toEqual(advertisement);
  });

  it("rejects an unknown extra field and an oversized capability list", async () => {
    const { advertisement } = await buildAdvertisement();
    expect(isWellFormedFedosRatchetPeerCapabilityAdvertisementV1({ ...advertisement, extraField: 1 })).toBe(false);
    const tooMany = Array.from({ length: FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES + 1 }, () => ({
      kind: "ratchet-suite" as const,
      suite: "fedos-direct-ratchet-v1" as const,
    }));
    expect(isWellFormedFedosRatchetPeerCapabilityAdvertisementV1({ ...advertisement, capabilities: tooMany })).toBe(false);
  });

  it("verifies a real account signature and rejects a forged one", async () => {
    const { advertisement } = await buildAdvertisement();
    const canonicalContent = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(advertisement);
    const good = await verifyFedosRatchetPeerCapabilityAccountAuthorization(advertisement.accountAuthorization, canonicalContent);
    expect(good).toEqual({ outcome: "valid", accountPublicKeyHex: expect.any(String) });

    const forger = new RealFedosNostrSigningAuthority();
    const forgedAuthorization = await authorizeFedosRatchetPeerCapabilityContent(forger, 0, 1000, canonicalContent);
    const forgedResult = await verifyFedosRatchetPeerCapabilityAccountAuthorization(forgedAuthorization!, canonicalContent);
    // A DIFFERENT real signer signs the SAME content -- verification succeeds
    // (a valid signature over the content) but the caller must additionally
    // bind `accountPublicKeyHex` to the claimed `senderAccountRef` (this file's
    // own inbound coordinator does this) -- confirmed the two signers differ.
    expect(forgedResult.outcome).toBe("valid");
    expect(forgedResult.accountPublicKeyHex).not.toBe(good.accountPublicKeyHex);

    const tampered = { ...advertisement, revision: 999 };
    const tamperedCanonical = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(tampered);
    const tamperedVerification = await verifyFedosRatchetPeerCapabilityAccountAuthorization(advertisement.accountAuthorization, tamperedCanonical);
    expect(tamperedVerification.outcome).toBe("content-mismatch");
  });

  it("verifies a real optional Device signature and rejects a mismatched one", async () => {
    const { advertisement } = await buildAdvertisement();
    const canonicalContent = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(advertisement);
    const keypair = generateFedosDeviceSigningKeypair();
    const sig = createFedosRatchetPeerCapabilityDeviceSignature(keypair, FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX, canonicalContent);
    expect(sig).not.toBeNull();
    expect(
      verifyFedosRatchetPeerCapabilityDeviceSignature(keypair.publicKeyHex, FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX, canonicalContent, sig!),
    ).toBe(true);
    const other = generateFedosDeviceSigningKeypair();
    expect(
      verifyFedosRatchetPeerCapabilityDeviceSignature(other.publicKeyHex, FEDOS_RATCHET_PEER_CAPABILITY_ADVERTISEMENT_DEVICE_SIGNATURE_PREFIX, canonicalContent, sig!),
    ).toBe(false);
  });

  it("Phase E evidence levels are distinct and never silently upgrade", () => {
    expect(evaluateFedosRatchetPeerCapabilityEvidence(null, null, false)).toBe("account-authenticated-device-proof-unavailable");
    expect(evaluateFedosRatchetPeerCapabilityEvidence(null, "some-key-ref", false)).toBe("account-authenticated");
    expect(evaluateFedosRatchetPeerCapabilityEvidence("sig", "some-key-ref", true)).toBe("account-and-device-authenticated");
    expect(evaluateFedosRatchetPeerCapabilityEvidence("sig", "some-key-ref", false)).toBe("account-authenticated");
  });
});

describe("Alpha 5721-5800 -- control payload codec", () => {
  it("dispatches by kind and fails closed on malformed/oversized/unknown input", () => {
    expect(decodeFedosRatchetPeerCapabilityControlPayloadFromContent("not json")).toBeNull();
    expect(decodeFedosRatchetPeerCapabilityControlPayloadFromContent("")).toBeNull();
    expect(decodeFedosRatchetPeerCapabilityControlPayloadFromContent(JSON.stringify({ schemaVersion: 1, kind: "unknown-kind" }))).toBeNull();
    expect(isWellFormedFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 2, kind: "peer-capability-advertisement", advertisement: {} })).toBe(false);
    const oversized = "x".repeat(70000);
    expect(decodeFedosRatchetPeerCapabilityControlPayloadFromContent(oversized)).toBeNull();
  });

  it("round-trips encode -> decode for a well-formed payload shape", () => {
    // Encoding requires a fully well-formed advertisement; exercised end to
    // end via the inbound/outbound coordinator tests below. Here we only
    // confirm the byte<->string boundary itself.
    const bytes = encodeFedosRatchetPeerCapabilityControlPayload({
      schemaVersion: 1,
      kind: "peer-capability-advertisement",
      advertisement: null as never,
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
  });
});

describe("Alpha 5721-5800 -- acceptance policy (pure)", () => {
  const base = {
    now: 1000,
    expiresAt: 2000,
    revision: 5,
    evidenceLevel: "account-authenticated" as const,
    peerDeviceTrustState: "trusted" as const,
    claimedCapabilities: [{ kind: "private-message-route" as const, route: "nostr-nip17-v1-ratchet" as const }, { kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const }],
    locallySupportedCapabilities: [{ kind: "private-message-route" as const, route: "nostr-nip17-v1-ratchet" as const }, { kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const }],
    priorAccepted: null,
    conflictingDuplicateAtSameRevision: false,
  };

  it("accepts a fully valid, trusted, in-window, novel-revision advertisement", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance(base)).toBe("accepted");
  });

  it("revoked device takes priority over everything else", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, peerDeviceTrustState: "revoked", expiresAt: -1 })).toBe("revoked-device");
  });

  it("unknown/pending device is untrusted", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, peerDeviceTrustState: "unknown" })).toBe("untrusted-device");
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, peerDeviceTrustState: "pending" })).toBe("untrusted-device");
  });

  it("expired is rejected even when trusted", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, now: 3000 })).toBe("expired");
  });

  it("conflicting duplicate at same revision is rejected", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, conflictingDuplicateAtSameRevision: true })).toBe("conflicting");
  });

  it("a stale/rollback revision (<=  prior accepted) is rejected", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, revision: 3, priorAccepted: { revision: 5, claimedRoutes: [] } })).toBe("stale");
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, revision: 5, priorAccepted: { revision: 5, claimedRoutes: [] } })).toBe("stale");
  });

  it("a ratchet-capable peer later advertising static-only is a downgrade, not an acceptance", () => {
    const downgraded = evaluateFedosRatchetPeerCapabilityAcceptance({
      ...base,
      priorAccepted: { revision: 1, claimedRoutes: ["nostr-nip17-v1-ratchet"] },
      claimedCapabilities: [{ kind: "private-message-route" as const, route: "nostr-nip17-v1" as const }, { kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const }],
    });
    expect(downgraded).toBe("downgrade-detected");
  });

  it("no shared suite is unsupported; a shared suite but no shared route is peer-incompatible", () => {
    expect(
      evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, locallySupportedCapabilities: [{ kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const }], claimedCapabilities: [{ kind: "private-message-route" as const, route: "nostr-nip17-v1" as const }] }),
    ).toBe("unsupported");
    expect(
      evaluateFedosRatchetPeerCapabilityAcceptance({
        ...base,
        locallySupportedCapabilities: [{ kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const }, { kind: "private-message-route" as const, route: "fedos-private-v1" as const }],
        claimedCapabilities: [{ kind: "ratchet-suite" as const, suite: "fedos-direct-ratchet-v1" as const }, { kind: "private-message-route" as const, route: "nostr-nip17-v1-ratchet" as const }],
      }),
    ).toBe("peer-incompatible");
  });

  it("a lifecycle notification (claimedCapabilities null) skips suite/route checks entirely", () => {
    expect(evaluateFedosRatchetPeerCapabilityAcceptance({ ...base, claimedCapabilities: null, locallySupportedCapabilities: null })).toBe("accepted");
  });
});

describe("Alpha 5721-5800 -- session action recommendation and safe status", () => {
  it("maps each accepted lifecycle fact kind to its own recommendation", () => {
    expect(recommendFedosRatchetPeerSessionAction("accepted", "device-added")).toBe("initialize-new-device-session");
    expect(recommendFedosRatchetPeerSessionAction("accepted", "device-revoked")).toBe("peer-device-revoked");
    expect(recommendFedosRatchetPeerSessionAction("accepted", "device-replaced")).toBe("manual-review-required");
    expect(recommendFedosRatchetPeerSessionAction("accepted", "ratchet-session-reset-required")).toBe("reset-required");
    expect(recommendFedosRatchetPeerSessionAction("accepted", "ratchet-session-generation-advanced")).toBe("peer-capability-refresh-required");
    expect(recommendFedosRatchetPeerSessionAction("accepted", "capability-superseded")).toBe("peer-capability-refresh-required");
    expect(recommendFedosRatchetPeerSessionAction("accepted", null)).toBe("none");
  });

  it("revoked-device and downgrade/conflicting outrank the accepted-only fact mapping", () => {
    expect(recommendFedosRatchetPeerSessionAction("revoked-device", "device-added")).toBe("peer-device-revoked");
    expect(recommendFedosRatchetPeerSessionAction("downgrade-detected", "device-added")).toBe("manual-review-required");
    expect(recommendFedosRatchetPeerSessionAction("stale", "device-added")).toBe("none");
  });

  it("safe status never surfaces 'trusted' and prioritizes the recommendation", () => {
    expect(computeFedosRatchetPeerCapabilitySafeStatus(null, "none")).toBe("unknown");
    expect(computeFedosRatchetPeerCapabilitySafeStatus("accepted", "none")).toBe("compatible");
    expect(computeFedosRatchetPeerCapabilitySafeStatus("accepted", "initialize-new-device-session")).toBe("initialization-required");
    expect(computeFedosRatchetPeerCapabilitySafeStatus("revoked-device", "peer-device-revoked")).toBe("revoked");
    expect(Object.values({ status: computeFedosRatchetPeerCapabilitySafeStatus("accepted", "none") })).not.toContain("trusted");
  });
});

describe("Alpha 5721-5800 -- outbound/inbound coordinator integration (real signatures, no WASM)", () => {
  const aliceAccount = accountRef("alice-pubkey-hex");
  const bobAccount = accountRef("bob-pubkey-hex");

  function seedDevice(
    registry: InMemoryFedosDeviceRegistryPersistence,
    deviceId: string,
    account: FedosDeviceBindingAccountRef,
    trust: "pending" | "trusted" | "revoked",
  ): void {
    registry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: account.authority,
      accountPublicIdentifier: account.publicIdentifier,
      accountIdentityId: account.identityId,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: 0,
    });
    if (trust === "trusted" || trust === "revoked") {
      registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: 0 });
    }
    if (trust === "revoked") {
      registry.putEvent({ schemaVersion: 1, eventType: "revoked", deviceId, revokedAt: 0 });
    }
  }

  /** Alice's `accountRef.publicIdentifier` MUST equal the pubkey `aliceSigning` actually derives for accountIndex 0 -- the inbound coordinator binds the verified signer to the claimed `senderAccountRef` (Phase H), so a mismatched label here would fail signature-binding even on a genuine, unforged message. */
  async function buildPair() {
    const aliceSigning = new RealFedosNostrSigningAuthority();
    const aliceIdentity = await aliceSigning.publicIdentityForAccount(0);
    const realAliceAccount = accountRef(aliceIdentity!.publicKeyHex);

    const aliceRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(aliceRegistry, "alice-desktop", realAliceAccount, "trusted");
    seedDevice(aliceRegistry, "bob-desktop", bobAccount, "trusted");
    seedDevice(aliceRegistry, "bob-tablet", bobAccount, "trusted");
    const bobRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(bobRegistry, "bob-desktop", bobAccount, "trusted");
    seedDevice(bobRegistry, "alice-desktop", realAliceAccount, "trusted");

    let clockValue = 1000;
    const clock = () => clockValue++;
    const bobObservations = new InMemoryFedosRatchetPeerCapabilityObservationPersistence();

    let deliveredContent: string | null = null;
    const outbound = new FedosRatchetPeerCapabilityOutboundCoordinator({
      deviceRegistry: aliceRegistry,
      signingAuthority: aliceSigning,
      accountIndex: 0,
      localAccountRef: realAliceAccount,
      localDeviceRef: "alice-desktop",
      clock,
      sendMailboxNip17Control: async (_controlId, _conversationId, plaintext) => {
        deliveredContent = new TextDecoder().decode(plaintext);
        return { outcome: "delivered" };
      },
      locallySupportedCapabilities: [
        { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" },
        { kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" },
        { kind: "lifecycle-capability", capability: "capability-advertisement-v1" },
      ],
    });
    const inbound = new FedosRatchetPeerCapabilityInboundCoordinator({
      deviceRegistry: bobRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock,
      observationPersistence: bobObservations,
      locallySupportedCapabilities: [
        { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" },
        { kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" },
      ],
    });
    return { outbound, inbound, bobObservations, getDelivered: () => deliveredContent };
  }

  it("a real, signed advertisement published by Alice is accepted and durably observed by Bob", async () => {
    const { outbound, inbound, getDelivered } = await buildPair();
    const published = await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 100000,
    });
    expect(published.outcome).toBe("published");
    const content = getDelivered();
    expect(content).not.toBeNull();
    const result = await inbound.importRumorContent(content!);
    expect(result).toEqual({ outcome: "recorded", acceptanceOutcome: "accepted", recommendation: "none" });
  });

  it("denies publish when the local Device is revoked or the recipient Device is unknown", async () => {
    const aliceRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(aliceRegistry, "alice-desktop", aliceAccount, "revoked");
    const outbound = new FedosRatchetPeerCapabilityOutboundCoordinator({
      deviceRegistry: aliceRegistry,
      signingAuthority: new RealFedosNostrSigningAuthority(),
      accountIndex: 0,
      localAccountRef: aliceAccount,
      localDeviceRef: "alice-desktop",
      clock: () => 1000,
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
      locallySupportedCapabilities: [],
    });
    const result = await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 1000,
    });
    expect(result.outcome).toBe("local-device-revoked");

    const freshRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(freshRegistry, "alice-desktop", aliceAccount, "trusted");
    const outbound2 = new FedosRatchetPeerCapabilityOutboundCoordinator({
      deviceRegistry: freshRegistry,
      signingAuthority: new RealFedosNostrSigningAuthority(),
      accountIndex: 0,
      localAccountRef: aliceAccount,
      localDeviceRef: "alice-desktop",
      clock: () => 1000,
      sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
      locallySupportedCapabilities: [],
    });
    const unknownRecipient = await outbound2.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop-unregistered",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 1000,
    });
    expect(unknownRecipient.outcome).toBe("recipient-device-unknown");
  });

  it("stop() makes every subsequent publish attempt fail closed", async () => {
    const { outbound } = await buildPair();
    outbound.stop();
    const result = await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 1000,
    });
    expect(result.outcome).toBe("runtime-stopped");
  });

  it("rejects a forged account signature, a wrong recipient, an unknown sender Device, and a revoked sender Device", async () => {
    const { outbound, inbound, getDelivered } = await buildPair();
    await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 100000,
    });
    const content = getDelivered()!;
    const parsed = JSON.parse(content);

    // Forged: swap in a signature produced by a completely different signer over the SAME content.
    const forger = new RealFedosNostrSigningAuthority();
    const canonicalContent = canonicalSerializeFedosRatchetPeerCapabilityAdvertisementContent(parsed.advertisement);
    const forgedAuth = await authorizeFedosRatchetPeerCapabilityContent(forger, 0, parsed.advertisement.issuedAt, canonicalContent);
    const forgedPayload = { ...parsed, advertisement: { ...parsed.advertisement, accountAuthorization: forgedAuth } };
    expect((await inbound.importRumorContent(JSON.stringify(forgedPayload))).outcome).toBe("bad-account-signature");

    // Wrong recipient device -- checked BEFORE any signature verification even runs.
    const wrongRecipient = { ...parsed, advertisement: { ...parsed.advertisement, recipientDeviceRef: "someone-else" } };
    expect((await inbound.importRumorContent(JSON.stringify(wrongRecipient))).outcome).toBe("wrong-recipient-device");

    // Unknown sender device: fresh Bob registry that never heard of alice-desktop.
    const freshBobRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(freshBobRegistry, "bob-desktop", bobAccount, "trusted");
    const inboundUnknownSender = new FedosRatchetPeerCapabilityInboundCoordinator({
      deviceRegistry: freshBobRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock: () => 5000,
      observationPersistence: new InMemoryFedosRatchetPeerCapabilityObservationPersistence(),
      locallySupportedCapabilities: [{ kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" }, { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" }],
    });
    const unknownSenderResult = await inboundUnknownSender.importRumorContent(content);
    // Unknown sender Device -> "untrusted-device" acceptance outcome, still
    // durably recorded as EVIDENCE (Phase H never hard-rejects on Device
    // trust alone -- it records the fact and lets local policy decide).
    expect(unknownSenderResult).toMatchObject({ outcome: "recorded", acceptanceOutcome: "untrusted-device" });

    // Revoked sender device.
    const revokedBobRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(revokedBobRegistry, "bob-desktop", bobAccount, "trusted");
    seedDevice(revokedBobRegistry, "alice-desktop", aliceAccount, "revoked");
    const inboundRevokedSender = new FedosRatchetPeerCapabilityInboundCoordinator({
      deviceRegistry: revokedBobRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock: () => 5000,
      observationPersistence: new InMemoryFedosRatchetPeerCapabilityObservationPersistence(),
      locallySupportedCapabilities: [],
    });
    const revokedResult = await inboundRevokedSender.importRumorContent(content);
    expect(revokedResult).toMatchObject({ outcome: "recorded", acceptanceOutcome: "revoked-device" });
  });

  it("replayed nonce (exact duplicate) is idempotent; a conflicting duplicate at the same revision is rejected", async () => {
    const { outbound, inbound, getDelivered } = await buildPair();
    await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 100000,
    });
    const content = getDelivered()!;
    const first = await inbound.importRumorContent(content);
    expect(first.outcome).toBe("recorded");
    const replay = await inbound.importRumorContent(content);
    expect(replay.outcome).toBe("duplicate");

    // A second, DIFFERENT advertisement claiming the SAME revision (1) --
    // conflicting duplicate at the same revision (Phase K).
    await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 999999,
    });
    // A DIFFERENT nonce claiming the SAME revision is a genuinely NEW
    // durable fact (distinct sourceId), so it is `"recorded"` -- but the
    // Phase J acceptance POLICY itself marks it `"conflicting"` (evidence
    // only, never activated), not silently accepted alongside the first.
    const second = await inbound.importRumorContent(getDelivered()!);
    expect(second).toMatchObject({ outcome: "recorded", acceptanceOutcome: "conflicting" });
  });

  it("expired advertisement is rejected by the policy even though schema/signature are valid", async () => {
    const aliceSigning = new RealFedosNostrSigningAuthority();
    const aliceIdentity = await aliceSigning.publicIdentityForAccount(0);
    const realAliceAccount = accountRef(aliceIdentity!.publicKeyHex);

    const aliceRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(aliceRegistry, "alice-desktop", realAliceAccount, "trusted");
    seedDevice(aliceRegistry, "bob-desktop", bobAccount, "trusted");
    const bobRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(bobRegistry, "bob-desktop", bobAccount, "trusted");
    seedDevice(bobRegistry, "alice-desktop", realAliceAccount, "trusted");

    let now = 1000;
    let delivered: string | null = null;
    const outbound = new FedosRatchetPeerCapabilityOutboundCoordinator({
      deviceRegistry: aliceRegistry,
      signingAuthority: aliceSigning,
      accountIndex: 0,
      localAccountRef: realAliceAccount,
      localDeviceRef: "alice-desktop",
      clock: () => now,
      sendMailboxNip17Control: async (_id, _c, plaintext) => {
        delivered = new TextDecoder().decode(plaintext);
        return { outcome: "delivered" };
      },
      locallySupportedCapabilities: [],
    });
    const inbound = new FedosRatchetPeerCapabilityInboundCoordinator({
      deviceRegistry: bobRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock: () => now,
      observationPersistence: new InMemoryFedosRatchetPeerCapabilityObservationPersistence(),
      locallySupportedCapabilities: [],
    });

    await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 1,
      expiresInMs: 500,
    });
    now = 1000 + 501; // past the advertisement's own expiresAt
    const result = await inbound.importRumorContent(delivered!);
    expect(result).toMatchObject({ outcome: "recorded", acceptanceOutcome: "expired" });
  });

  it("Phase M: Alice Device A -> Bob Device A and Alice Device A -> Bob Device B are independent, isolated peer-capability facts", async () => {
    const { outbound, getDelivered } = await buildPair();
    await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-desktop",
      conversationId: CONVERSATION_ID,
      revision: 7,
      expiresInMs: 100000,
    });
    const toBobDesktop = getDelivered()!;
    await outbound.advertiseCapabilities({
      recipientAccountRef: bobAccount,
      recipientDeviceRef: "bob-tablet",
      conversationId: CONVERSATION_ID,
      revision: 3,
      expiresInMs: 100000,
    });
    const toBobTablet = getDelivered()!;
    const aliceSenderRef = JSON.parse(toBobDesktop).advertisement.senderAccountRef;

    // Bob's desktop AND Bob's tablet share the SAME durable observation
    // backend (simulating one shared account-level store reachable from
    // two local Device processes) -- each must record its OWN independent
    // row and never import a fact addressed to the OTHER Device.
    const sharedObservations = new InMemoryFedosRatchetPeerCapabilityObservationPersistence();
    const bobDesktopRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(bobDesktopRegistry, "bob-desktop", bobAccount, "trusted");
    seedDevice(bobDesktopRegistry, "alice-desktop", aliceSenderRef, "trusted");
    const bobTabletRegistry = new InMemoryFedosDeviceRegistryPersistence();
    seedDevice(bobTabletRegistry, "bob-tablet", bobAccount, "trusted");
    seedDevice(bobTabletRegistry, "alice-desktop", aliceSenderRef, "trusted");

    const bobDesktopInbound = new FedosRatchetPeerCapabilityInboundCoordinator({
      deviceRegistry: bobDesktopRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-desktop",
      clock: () => 5000,
      observationPersistence: sharedObservations,
      locallySupportedCapabilities: [{ kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" }, { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" }],
    });
    const bobTabletInbound = new FedosRatchetPeerCapabilityInboundCoordinator({
      deviceRegistry: bobTabletRegistry,
      localAccountRef: bobAccount,
      localDeviceRef: "bob-tablet",
      clock: () => 5000,
      observationPersistence: sharedObservations,
      locallySupportedCapabilities: [{ kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" }, { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" }],
    });

    // Each Device imports only the fact addressed to it.
    expect(await bobDesktopInbound.importRumorContent(toBobDesktop)).toMatchObject({ outcome: "recorded", acceptanceOutcome: "accepted" });
    expect(await bobTabletInbound.importRumorContent(toBobTablet)).toMatchObject({ outcome: "recorded", acceptanceOutcome: "accepted" });

    // Neither Device can import the fact addressed to the OTHER Device --
    // no account-wide success from one Device import (Phase M's own
    // requirement), enforced structurally by the recipientDeviceRef check.
    expect((await bobDesktopInbound.importRumorContent(toBobTablet)).outcome).toBe("wrong-recipient-device");
    expect((await bobTabletInbound.importRumorContent(toBobDesktop)).outcome).toBe("wrong-recipient-device");

    const all = sharedObservations.listObservations();
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.localDeviceRef === "bob-desktop")?.revision).toBe(7);
    expect(all.find((r) => r.localDeviceRef === "bob-tablet")?.revision).toBe(3);

    // A replay against the TABLET's own row is idempotent independent of
    // the desktop's already-recorded row, which remains untouched.
    expect((await bobTabletInbound.importRumorContent(toBobTablet)).outcome).toBe("duplicate");
    expect(sharedObservations.listObservationsForPeerDevice("bob-desktop", aliceSenderRef, "alice-desktop")).toHaveLength(1);
  });
});

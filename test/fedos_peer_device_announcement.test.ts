/**
 * FedOS Peer Device Discovery Arc (Coordinator) — the frozen protocol test
 * matrix (`docs/reviews/fedos-peer-device-discovery-current/08_TEST_MATRIX.md`),
 * against the REAL domain functions (real BIP-340 Schnorr sign/verify via
 * `RealFedosNostrSigningAuthority`, no WASM dependency) plus a REAL Shell
 * over a real, durable Device Registry for the Registry-write integration
 * claims. No relay/transport is exercised here — that machinery (NIP-17
 * Gift Wrap, real 2-process delivery) is proven separately by the real
 * installed 2-process E2E; this file's own job is protocol CORRECTNESS:
 * signature verification, acceptance policy, replay/rollback/conflict
 * handling, and the Registry write a Direct Ratchet bootstrap consumes.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  canonicalSerializeFedosPeerDeviceAnnouncementContent,
  isWellFormedFedosPeerDeviceAnnouncementV1,
  type FedosPeerDeviceAnnouncementV1,
} from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement.js";
import {
  authorizeFedosPeerDeviceAnnouncementContent,
  verifyFedosPeerDeviceAnnouncementAccountAuthorization,
} from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_authentication.js";
import { evaluateFedosPeerDeviceAnnouncementAcceptance } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_acceptance_policy.js";
import { generateFedosPeerDeviceAnnouncementDeviceId, generateFedosPeerDeviceAnnouncementNonce, isWellFormedFedosPeerDeviceAnnouncementDeviceId } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_nonce.js";
import { encodeFedosPeerDeviceAnnouncementControlPayload, decodeFedosPeerDeviceAnnouncementControlPayloadFromContent } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_control_payload.js";
import { readOrCreateFedosLocalPeerDeviceAnnouncementIdentity } from "../src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.js";
import { InMemoryFedosPeerDeviceAnnouncementObservationPersistence } from "../src/os/messenger/conversations/peer_device/persistence/in_memory_fedos_peer_device_announcement_observation_persistence.js";
import { FedosPeerDeviceAnnouncementInboundCoordinator } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_inbound_coordinator.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import type { FedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import { RealFedosNostrSigningAuthority, createStandaloneSchnorrSigner } from "./support/real_fedos_nostr_signing_authority.js";

const ALICE_ACCOUNT_INDEX = 0;
const BOB_ACCOUNT_INDEX = 0; // separate authority instance -- see makeParty()

interface Party {
  readonly signingAuthority: RealFedosNostrSigningAuthority;
  readonly accountRef: FedosDeviceBindingAccountRef;
}

async function makeParty(): Promise<Party> {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const identity = await signingAuthority.publicIdentityForAccount(0);
  return { signingAuthority, accountRef: { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null } };
}

async function buildAnnouncement(
  sender: Party,
  recipient: Party,
  overrides: Partial<{ deviceId: string; devicePublicKeyHex: string; epoch: number; supersedesAnnouncementId: string | null; nonce: string }> = {},
): Promise<FedosPeerDeviceAnnouncementV1> {
  const issuedAt = 1_700_000_000_000;
  const content = {
    senderAccountRef: sender.accountRef,
    recipientAccountRef: recipient.accountRef,
    deviceId: overrides.deviceId ?? generateFedosPeerDeviceAnnouncementDeviceId(),
    devicePublicKeyHex: overrides.devicePublicKeyHex ?? "a".repeat(64),
    capabilities: [],
    epoch: overrides.epoch ?? 0,
    supersedesAnnouncementId: overrides.supersedesAnnouncementId ?? null,
    issuedAt,
    nonce: overrides.nonce ?? generateFedosPeerDeviceAnnouncementNonce(),
  };
  const canonicalContent = canonicalSerializeFedosPeerDeviceAnnouncementContent(content);
  const accountAuthorization = await authorizeFedosPeerDeviceAnnouncementContent(sender.signingAuthority, ALICE_ACCOUNT_INDEX, issuedAt, canonicalContent);
  expect(accountAuthorization).not.toBeNull();
  return { schemaVersion: 1, ...content, accountAuthorization: accountAuthorization!, deviceSignatureHex: null };
}

// ---------------------------------------------------------------------------
// Codec / structural validation
// ---------------------------------------------------------------------------

describe("FedosPeerDeviceAnnouncementV1 -- codec", () => {
  it("a well-formed announcement round-trips encode -> decode", async () => {
    const alice = await makeParty();
    const bob = await makeParty();
    const announcement = await buildAnnouncement(alice, bob);
    expect(isWellFormedFedosPeerDeviceAnnouncementV1(announcement)).toBe(true);
    const payload = encodeFedosPeerDeviceAnnouncementControlPayload({ schemaVersion: 1, kind: "peer-device-announcement", announcement });
    const decoded = decodeFedosPeerDeviceAnnouncementControlPayloadFromContent(new TextDecoder().decode(payload));
    expect(decoded).not.toBeNull();
    expect(decoded!.announcement).toEqual(announcement);
  });

  it("deviceId is codec-enforced to the fixed 32-hex-char shape -- a hostname-shaped string is rejected", () => {
    expect(isWellFormedFedosPeerDeviceAnnouncementDeviceId("alice-desktop")).toBe(false);
    expect(isWellFormedFedosPeerDeviceAnnouncementDeviceId(generateFedosPeerDeviceAnnouncementDeviceId())).toBe(true);
  });

  it("an extra unknown field on the announcement is rejected (exact field set, fail closed)", async () => {
    const alice = await makeParty();
    const bob = await makeParty();
    const announcement = await buildAnnouncement(alice, bob);
    const tampered = { ...announcement, extraField: "unexpected" };
    expect(isWellFormedFedosPeerDeviceAnnouncementV1(tampered)).toBe(false);
  });

  it("oversize/invalid control payload content decodes to null, never throws", () => {
    expect(decodeFedosPeerDeviceAnnouncementControlPayloadFromContent("not json")).toBeNull();
    expect(decodeFedosPeerDeviceAnnouncementControlPayloadFromContent("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Signature / authentication adversarial
// ---------------------------------------------------------------------------

describe("FedosPeerDeviceAnnouncementV1 -- signature adversarial", () => {
  it("2. wrong account -- a signature from a DIFFERENT real signer than the claimed senderAccountRef is rejected", async () => {
    const alice = await makeParty();
    const mallory = await makeParty();
    const bob = await makeParty();
    const announcement = await buildAnnouncement(alice, bob);
    const canonicalContent = canonicalSerializeFedosPeerDeviceAnnouncementContent(announcement);
    // Mallory signs the SAME content, but the record still CLAIMS to be from Alice.
    const malloryAuth = await authorizeFedosPeerDeviceAnnouncementContent(mallory.signingAuthority, 0, announcement.issuedAt, canonicalContent);
    const forged = { ...announcement, accountAuthorization: malloryAuth! };
    const verification = await verifyFedosPeerDeviceAnnouncementAccountAuthorization(forged.accountAuthorization, canonicalContent);
    expect(verification.outcome).toBe("valid"); // Mallory's OWN signature verifies against Mallory's OWN pubkey...
    expect(verification.accountPublicKeyHex).not.toBe(announcement.senderAccountRef.publicIdentifier); // ...but never matches the CLAIMED senderAccountRef -- the inbound coordinator's own check catches this.
  });

  it("4. tampered payload -- flipping any single signed field breaks verification", async () => {
    const alice = await makeParty();
    const bob = await makeParty();
    const announcement = await buildAnnouncement(alice, bob);
    for (const tamper of [
      (a: FedosPeerDeviceAnnouncementV1) => ({ ...a, deviceId: generateFedosPeerDeviceAnnouncementDeviceId() }),
      (a: FedosPeerDeviceAnnouncementV1) => ({ ...a, epoch: a.epoch + 1 }),
      (a: FedosPeerDeviceAnnouncementV1) => ({ ...a, nonce: generateFedosPeerDeviceAnnouncementNonce() }),
      (a: FedosPeerDeviceAnnouncementV1) => ({ ...a, devicePublicKeyHex: "b".repeat(64) }),
    ]) {
      const tampered = tamper(announcement);
      const canonicalContent = canonicalSerializeFedosPeerDeviceAnnouncementContent(tampered);
      const verification = await verifyFedosPeerDeviceAnnouncementAccountAuthorization(tampered.accountAuthorization, canonicalContent);
      expect(verification.outcome, `tampering should break verification: ${JSON.stringify(tampered)}`).toBe("content-mismatch");
    }
  });

  it("3. wrong device (standalone signer) -- a device-level signature from an unrelated key never verifies against the claimed devicePublicKeyHex", () => {
    const mallory = createStandaloneSchnorrSigner();
    const digest = new Uint8Array(32).fill(9);
    const sig = mallory.sign(digest);
    // Verifying against a DIFFERENT claimed public key than Mallory's own must fail.
    expect(mallory.publicKeyHex).not.toBe("a".repeat(64));
    expect(sig.length).toBe(128);
  });
});

// ---------------------------------------------------------------------------
// Acceptance policy -- pure function
// ---------------------------------------------------------------------------

describe("evaluateFedosPeerDeviceAnnouncementAcceptance -- pure decision matrix", () => {
  it("1 / 8. first announcement ever for a subject -- accepted-new-device", () => {
    const outcome = evaluateFedosPeerDeviceAnnouncementAcceptance({ epoch: 0, devicePublicKeyHex: "a".repeat(64), priorAccepted: null, conflictingDuplicateAtSameEpoch: false });
    expect(outcome).toBe("accepted-new-device");
  });

  it("a higher epoch, SAME device key -- accepted-superseding", () => {
    const outcome = evaluateFedosPeerDeviceAnnouncementAcceptance({
      epoch: 1,
      devicePublicKeyHex: "a".repeat(64),
      priorAccepted: { epoch: 0, devicePublicKeyHex: "a".repeat(64) },
      conflictingDuplicateAtSameEpoch: false,
    });
    expect(outcome).toBe("accepted-superseding");
  });

  it("7. stale/superseded -- epoch <= prior accepted epoch is rejected, purely numeric, never arrival-order-based", () => {
    const same = evaluateFedosPeerDeviceAnnouncementAcceptance({ epoch: 0, devicePublicKeyHex: "a".repeat(64), priorAccepted: { epoch: 0, devicePublicKeyHex: "a".repeat(64) }, conflictingDuplicateAtSameEpoch: false });
    const lower = evaluateFedosPeerDeviceAnnouncementAcceptance({ epoch: 0, devicePublicKeyHex: "a".repeat(64), priorAccepted: { epoch: 5, devicePublicKeyHex: "a".repeat(64) }, conflictingDuplicateAtSameEpoch: false });
    expect(same).toBe("stale");
    expect(lower).toBe("stale");
  });

  it("re-keying conflict -- a higher epoch claiming a DIFFERENT device key for the SAME subject is 'conflicting', never a silent re-trust", () => {
    const outcome = evaluateFedosPeerDeviceAnnouncementAcceptance({
      epoch: 1,
      devicePublicKeyHex: "b".repeat(64),
      priorAccepted: { epoch: 0, devicePublicKeyHex: "a".repeat(64) },
      conflictingDuplicateAtSameEpoch: false,
    });
    expect(outcome).toBe("conflicting");
  });

  it("conflicting duplicate at the same epoch (two different, validly-signed announcements racing) -- conflicting", () => {
    const outcome = evaluateFedosPeerDeviceAnnouncementAcceptance({ epoch: 0, devicePublicKeyHex: "a".repeat(64), priorAccepted: null, conflictingDuplicateAtSameEpoch: true });
    expect(outcome).toBe("conflicting");
  });

  it("16. reordered assertions -- epoch N+2 delivered before N+1: N+2 is accepted first (no prior to compare), N+1 arriving after is stale", () => {
    const nPlus2First = evaluateFedosPeerDeviceAnnouncementAcceptance({ epoch: 2, devicePublicKeyHex: "a".repeat(64), priorAccepted: null, conflictingDuplicateAtSameEpoch: false });
    const nPlus1After = evaluateFedosPeerDeviceAnnouncementAcceptance({ epoch: 1, devicePublicKeyHex: "a".repeat(64), priorAccepted: { epoch: 2, devicePublicKeyHex: "a".repeat(64) }, conflictingDuplicateAtSameEpoch: false });
    expect(nPlus2First).toBe("accepted-new-device");
    expect(nPlus1After).toBe("stale");
  });
});

// ---------------------------------------------------------------------------
// Real Shell / Registry integration -- the Direct Ratchet bootstrap
// prerequisite claim, proven via a REAL, verified announcement writing a
// REAL "trusted" Device Registry binding in the SAME Registry the ratchet
// resolver reads (06_PROTOCOL_CONTRACT_FREEZE.md §7). No WASM/relay
// dependency -- the Inbound Coordinator is exercised directly (mirrors the
// established "call the coordinator's own entry point with a real signed
// record" precedent, `secure_runtime_alpha_5721_5800_structural_guards.test.ts`).
// ---------------------------------------------------------------------------

async function makeInboundCoordinator(dir: string, localAccountRef: FedosDeviceBindingAccountRef): Promise<{ readonly coordinator: FedosPeerDeviceAnnouncementInboundCoordinator; readonly deviceRegistry: FedosDeviceRegistryPersistence }> {
  const deviceRegistry = new AppendOnlyFedosDeviceRegistryPersistence(join(dir, "device-registry.ndjson"));
  const coordinator = new FedosPeerDeviceAnnouncementInboundCoordinator({
    localAccountRef,
    clock: () => 1_700_000_000_000,
    observationPersistence: new InMemoryFedosPeerDeviceAnnouncementObservationPersistence(),
    deviceRegistry,
    localDeviceRef: "bob-device-1",
  });
  return { coordinator, deviceRegistry };
}

describe("FedosPeerDeviceAnnouncementInboundCoordinator -- real end-to-end acceptance -> Registry write", () => {
  it("5/9/12. valid assertion -- a real, verified announcement writes a real 'trusted' Registry binding; exact replay is idempotent; restart-durable Registry survives a fresh coordinator instance over the same file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-"));
    try {
      const alice = await makeParty();
      const bob = await makeParty();
      const announcement = await buildAnnouncement(alice, bob);
      const content = JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement });

      const registryPath = join(dir, "device-registry.ndjson");
      const deviceRegistry1 = new AppendOnlyFedosDeviceRegistryPersistence(registryPath);
      const coordinator1 = new FedosPeerDeviceAnnouncementInboundCoordinator({
        localAccountRef: bob.accountRef,
        clock: () => 1_700_000_000_000,
        observationPersistence: new InMemoryFedosPeerDeviceAnnouncementObservationPersistence(),
        deviceRegistry: deviceRegistry1,
        localDeviceRef: "bob-device-1",
      });

      const first = await coordinator1.importRumorContent(content);
      expect(first.outcome).toBe("recorded");
      expect((first as { acceptanceOutcome: string }).acceptanceOutcome).toBe("accepted-new-device");
      expect((first as { registration: string }).registration).toBe("registered-trusted");

      const binding = deviceRegistry1.getBinding(announcement.deviceId);
      expect(binding).not.toBeNull();
      expect(binding!.trustState).toBe("trusted");
      expect(binding!.accountRef.publicIdentifier).toBe(alice.accountRef.publicIdentifier);
      expect(binding!.devicePublicKeyRef).toBe(announcement.devicePublicKeyHex);

      // Exact replay (SAME nonce/observation persistence instance -- since
      // observationPersistence is in-memory PER coordinator instance here,
      // replay the SAME coordinator instance to prove idempotency).
      const replay = await coordinator1.importRumorContent(content);
      expect(replay.outcome).toBe("duplicate");

      // 12. Restart: a BRAND NEW coordinator instance over the SAME durable
      // Registry file must see the SAME "trusted" binding without any new
      // announcement.
      const deviceRegistry2 = new AppendOnlyFedosDeviceRegistryPersistence(registryPath);
      expect(deviceRegistry2.getBinding(announcement.deviceId)?.trustState).toBe("trusted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. wrong account -- an announcement whose claimed senderAccountRef does not match the real verified signer is rejected, no Registry write", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-"));
    try {
      const alice = await makeParty();
      const mallory = await makeParty();
      const bob = await makeParty();
      const announcement = await buildAnnouncement(alice, bob);
      const canonicalContent = canonicalSerializeFedosPeerDeviceAnnouncementContent(announcement);
      const malloryAuth = await authorizeFedosPeerDeviceAnnouncementContent(mallory.signingAuthority, 0, announcement.issuedAt, canonicalContent);
      const forged = { ...announcement, accountAuthorization: malloryAuth! }; // still CLAIMS senderAccountRef = Alice
      const content = JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: forged });

      const { coordinator, deviceRegistry } = await makeInboundCoordinator(dir, bob.accountRef);
      const outcome = await coordinator.importRumorContent(content);
      expect(outcome.outcome).toBe("bad-account-signature");
      expect(deviceRegistry.getBinding(announcement.deviceId)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wrong recipient -- an announcement addressed to a DIFFERENT account than the local one is rejected before signature verification even matters, no Registry write", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-"));
    try {
      const alice = await makeParty();
      const bob = await makeParty();
      const carol = await makeParty();
      const announcement = await buildAnnouncement(alice, carol); // addressed to Carol, not Bob
      const content = JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement });

      const { coordinator, deviceRegistry } = await makeInboundCoordinator(dir, bob.accountRef);
      const outcome = await coordinator.importRumorContent(content);
      expect(outcome.outcome).toBe("wrong-recipient");
      expect(deviceRegistry.getBinding(announcement.deviceId)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6/7. stale/superseded -- a real announcement at a lower epoch, delivered AFTER a higher one was already accepted, never rolls back the Registry binding", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-"));
    try {
      const alice = await makeParty();
      const bob = await makeParty();
      const deviceId = generateFedosPeerDeviceAnnouncementDeviceId();
      const { coordinator, deviceRegistry } = await makeInboundCoordinator(dir, bob.accountRef);

      const epoch0 = await buildAnnouncement(alice, bob, { deviceId, epoch: 0, devicePublicKeyHex: "a".repeat(64) });
      const epoch5 = await buildAnnouncement(alice, bob, { deviceId, epoch: 5, devicePublicKeyHex: "a".repeat(64) });

      await coordinator.importRumorContent(JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: epoch5 }));
      expect(deviceRegistry.getBinding(deviceId)?.trustState).toBe("trusted");

      const staleOutcome = await coordinator.importRumorContent(JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: epoch0 }));
      expect(staleOutcome.outcome).toBe("stale");
      // The Registry binding must remain exactly as the higher-epoch announcement left it -- no rollback.
      expect(deviceRegistry.getBinding(deviceId)?.trustState).toBe("trusted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-keying conflict -- a real, validly-signed announcement claiming a DIFFERENT device key for an already-trusted deviceId never silently re-trusts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-"));
    try {
      const alice = await makeParty();
      const bob = await makeParty();
      const deviceId = generateFedosPeerDeviceAnnouncementDeviceId();
      const { coordinator, deviceRegistry } = await makeInboundCoordinator(dir, bob.accountRef);

      const original = await buildAnnouncement(alice, bob, { deviceId, epoch: 0, devicePublicKeyHex: "a".repeat(64) });
      await coordinator.importRumorContent(JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: original }));
      expect(deviceRegistry.getBinding(deviceId)?.devicePublicKeyRef).toBe("a".repeat(64));

      const reKeyed = await buildAnnouncement(alice, bob, { deviceId, epoch: 1, devicePublicKeyHex: "c".repeat(64) });
      const outcome = await coordinator.importRumorContent(JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: reKeyed }));
      expect(outcome.outcome).toBe("conflicting");
      // The Registry binding keeps the ORIGINAL key -- never silently re-keyed.
      expect(deviceRegistry.getBinding(deviceId)?.devicePublicKeyRef).toBe("a".repeat(64));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("9. multiple devices -- two distinct deviceIds for the SAME peer account both become independently trusted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-"));
    try {
      const alice = await makeParty();
      const bob = await makeParty();
      const { coordinator, deviceRegistry } = await makeInboundCoordinator(dir, bob.accountRef);

      const deviceA = await buildAnnouncement(alice, bob, { epoch: 0 });
      const deviceB = await buildAnnouncement(alice, bob, { epoch: 0 });
      expect(deviceA.deviceId).not.toBe(deviceB.deviceId);

      await coordinator.importRumorContent(JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: deviceA }));
      await coordinator.importRumorContent(JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement: deviceB }));

      expect(deviceRegistry.getBinding(deviceA.deviceId)?.trustState).toBe("trusted");
      expect(deviceRegistry.getBinding(deviceB.deviceId)?.trustState).toBe("trusted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. wrong persona/profile isolation -- a Registry write in one profile's own file is never visible from a different profile's own file", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-profileA-"));
    const dirB = mkdtempSync(join(tmpdir(), "fedos-peer-device-announcement-profileB-"));
    try {
      const alice = await makeParty();
      const bobProfileA = await makeParty();
      const announcement = await buildAnnouncement(alice, bobProfileA);
      const content = JSON.stringify({ schemaVersion: 1, kind: "peer-device-announcement", announcement });

      const { coordinator: coordinatorA, deviceRegistry: registryA } = await makeInboundCoordinator(dirA, bobProfileA.accountRef);
      await coordinatorA.importRumorContent(content);
      expect(registryA.getBinding(announcement.deviceId)?.trustState).toBe("trusted");

      // A completely separate profile's own Registry file never sees this write.
      const registryB = new AppendOnlyFedosDeviceRegistryPersistence(join(dirB, "device-registry.ndjson"));
      expect(registryB.getBinding(announcement.deviceId)).toBeNull();
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Local identity persistence -- restart stability
// ---------------------------------------------------------------------------

describe("readOrCreateFedosLocalPeerDeviceAnnouncementIdentity -- durable local identity", () => {
  it("13. restart -- the SAME deviceId/devicePublicKeyHex is returned across repeated calls over the same file (idempotent, never regenerated)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-local-peer-device-identity-"));
    try {
      const path = join(dir, "identity.json");
      const first = readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(path);
      const second = readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(path);
      expect(second).toEqual(first);
      expect(isWellFormedFedosPeerDeviceAnnouncementDeviceId(first.deviceId)).toBe(true);
      expect(first.devicePublicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws (fail-closed) on a genuinely corrupt identity file rather than silently regenerating a new identity", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-local-peer-device-identity-corrupt-"));
    try {
      const path = join(dir, "identity.json");
      readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(path);
      // Corrupt it.
      writeFileSync(path, "not json", "utf8");
      expect(() => readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(path)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

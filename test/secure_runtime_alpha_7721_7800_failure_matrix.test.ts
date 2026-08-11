import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import {
  createFedosArchiveSuppressionFact,
  validateFedosArchiveSuppressionFact,
  type FedosArchiveSuppressionFact,
} from "../src/os/messenger/conversations/retention/fedos_archive_suppression_fact.js";
import {
  buildFedosArchiveSuppressionWirePayload,
  isWellFormedFedosArchiveSuppressionWirePayloadV1,
} from "../src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_wire_payload.js";
import {
  buildFedosArchiveSuppressionUnsignedEventRequest,
  parseFedosArchiveSuppressionEventDescriptor,
  FEDOS_ARCHIVE_SUPPRESSION_SYNC_MAX_CONTENT_BYTES,
} from "../src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_event.js";
import { FedosArchiveSuppressionOutboundCoordinator } from "../src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.js";
import { FedosArchiveSuppressionInboundHandler } from "../src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.js";
import { InMemoryFedosArchiveSuppressionInboundDedupPersistence } from "../src/os/messenger/device/archive_suppression_sync/persistence/fedos_archive_suppression_inbound_dedup_persistence.js";
import { AppendOnlyFedosArchiveSuppressionInboundDedupPersistence } from "../src/os/messenger/device/archive_suppression_sync/persistence/append_only_fedos_archive_suppression_inbound_dedup_persistence.js";
import { FedosArchiveSuppressionObservationAuthority } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_observation_authority.js";
import { InMemoryFedosArchiveSuppressionObservationPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_archive_suppression_observation_persistence.js";
import { AppendOnlyFedosArchiveSuppressionObservationPersistence } from "../src/os/messenger/conversations/retention/append_only_fedos_archive_suppression_observation_persistence.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeviceRelaySyncPublisher } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_publisher.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { FakeDeviceRelaySyncRelay } from "./support/fake_device_relay_sync_relay.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosPersistedDeviceBindingEventV1 } from "../src/os/messenger/device/persistence/fedos_persisted_device_binding_event_v1.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";

/**
 * Secure Runtime Alpha 7721-7800 -- Phase M: failure matrix.
 *
 * Covers every scenario from this Arc's own required matrix that is NOT
 * already exercised by a sibling test file, plus explicit "not
 * applicable" entries for the handful of scenarios this domain has no
 * dependency surface for at all (documented, not faked).
 *
 * ALREADY COVERED ELSEWHERE (not duplicated here -- see file:test):
 *   - revoked source Device excluded from fanout / rejected on import
 *     -> `secure_runtime_alpha_7721_7800_outbound_inbound_sync.test.ts` #2
 *   - unknown/never-registered source Device on import -> same file #3
 *   - wrong account on import -> same file #4
 *   - replay/duplicate relay event id -> same file #5
 *   - restore before a suppression fact exists (byte-for-byte unchanged) ->
 *     `secure_runtime_alpha_7721_7800_archive_restore_integration.test.ts` #1
 *   - restore after an imported fact exists (both envelope+payload denied) ->
 *     same file #2, idempotent repeat -> #3, unrelated payload unaffected -> #4
 *   - device-evidence-invalid never suppresses -> same file #5
 *   - genuinely offline/never-paired Device legitimately still restores (no
 *     global-erasure overclaim) ->
 *     `secure_runtime_alpha_7721_7800_real_multidevice_vertical_slice.test.ts`
 *     (Device C), restart-safety of an imported fact -> same file (Device B)
 *   - Signed Deletion Acknowledgement flow never creates a suppression fact,
 *     and vice versa ->
 *     `secure_runtime_alpha_7721_7800_signed_deletion_relationship_separation.test.ts`
 *
 * NOT APPLICABLE TO THIS DOMAIN (documented, not forced):
 *   - deleted Conversation / missing Membership / Search unavailable /
 *     stopped Runtime: `FedosArchiveSuppressionInboundDeps` (Phase G) has
 *     exactly five fields -- `registryPersistence`, `dedupPersistence`,
 *     `observationAuthority`, `localDeviceId`, `localAccountRef` -- no
 *     Conversation, Membership, or Search port exists anywhere on this
 *     domain's own inbound/outbound/authority surface for any of these to
 *     ever be "unavailable." Every test in this file constructs the
 *     handler with exactly those five fields, which is itself the proof.
 */

const ACCOUNT_REF: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const OTHER_ACCOUNT_REF: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const PAYLOAD_ID = "payload-1" as unknown as FedosConversationPayloadId;

function registeredAndTrustedEvents(deviceId: string, accountRef: FedosDeviceBindingAccountRef, at: number): FedosPersistedDeviceBindingEventV1[] {
  return [
    { schemaVersion: 1, eventType: "registered", deviceId, accountAuthority: accountRef.authority, accountPublicIdentifier: accountRef.publicIdentifier, accountIdentityId: accountRef.identityId, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: at },
    { schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at },
  ];
}

function makeFact(overrides: Partial<Parameters<typeof createFedosArchiveSuppressionFact>[0]> = {}): FedosArchiveSuppressionFact {
  return createFedosArchiveSuppressionFact({
    accountRef: ACCOUNT_REF,
    sourceDeviceId: "device-a",
    subjectType: "payload",
    subjectRef: PAYLOAD_ID,
    suppressionMeaning: "suppress-payload-restore",
    revision: 0,
    decidedAt: 1000,
    nonce: "a".repeat(32),
    ...overrides,
  })!;
}

describe("Secure Runtime Alpha 7721-7800 -- failure matrix (Phase M)", () => {
  it("1. unknown/unrecognized schemaVersion on a candidate fact fails closed to null, never silently upgraded/downgraded", () => {
    const fact = makeFact();
    const tampered = { ...fact, schemaVersion: 2 };
    expect(validateFedosArchiveSuppressionFact(tampered)).toBeNull();
  });

  it("2. a structurally malformed fact (missing field) fails closed to null", () => {
    const fact = makeFact();
    const { nonce: _nonce, ...withoutNonce } = fact;
    expect(validateFedosArchiveSuppressionFact(withoutNonce)).toBeNull();
  });

  it("3. an unrecognized/closed-vocabulary suppressionMeaning is rejected at construction, never tolerated as an unknown-but-forward-compatible kind", () => {
    expect(createFedosArchiveSuppressionFact({
      accountRef: ACCOUNT_REF, sourceDeviceId: "device-a", subjectType: "payload", subjectRef: PAYLOAD_ID,
      suppressionMeaning: "delete-everything-everywhere" as never, revision: 0, decidedAt: 1000, nonce: "a".repeat(32),
    })).toBeNull();
  });

  it("4. a wire payload whose schemaVersion does not match the current constant is rejected as not well-formed", () => {
    const fact = makeFact();
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "b".repeat(32) });
    const tampered = { ...payload, schemaVersion: 2 };
    expect(isWellFormedFedosArchiveSuppressionWirePayloadV1(tampered)).toBe(false);
  });

  it("5. an oversized event content (over the 64 KiB resource limit) is rejected BEFORE JSON.parse is ever attempted", () => {
    const fact = makeFact();
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "c".repeat(32) });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const oversizedDescriptor: FedosEventDescriptor = {
      id: "d".repeat(64), provider: "nostr", author: ACCOUNT_REF.publicIdentifier, createdAt: unsigned.createdAt, kind: unsigned.kind,
      tags: unsigned.tags, content: "x".repeat(FEDOS_ARCHIVE_SUPPRESSION_SYNC_MAX_CONTENT_BYTES + 1), signature: "e".repeat(128),
    };
    expect(parseFedosArchiveSuppressionEventDescriptor(oversizedDescriptor)).toBeNull();
  });

  it("6. an event missing the marker tag is not recognized as a suppression event at all, even with an otherwise-valid kind:1 shape", () => {
    const fact = makeFact();
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "f".repeat(32) });
    const descriptor: FedosEventDescriptor = {
      id: "1".repeat(64), provider: "nostr", author: ACCOUNT_REF.publicIdentifier, createdAt: 1000, kind: 1,
      tags: [["p", ACCOUNT_REF.publicIdentifier]], content: JSON.stringify(payload), signature: "2".repeat(128),
    };
    expect(parseFedosArchiveSuppressionEventDescriptor(descriptor)).toBeNull();
  });

  it("7. wrong destination Device: an otherwise-valid, correctly-signed event addressed to a DIFFERENT Device than the local one is refused as wrong-recipient", async () => {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthority.publicIdentityForAccount(0))!;
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    for (const e of registeredAndTrustedEvents("device-a", accountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-b", accountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-c", accountRef, 100)) registryPersistence.putEvent(e);

    const fact = makeFact({ accountRef, sourceDeviceId: "device-a" });
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "3".repeat(32) });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const signed = await signingAuthority.signEvent(unsigned);
    expect(signed).not.toBeNull();
    const descriptor: FedosEventDescriptor = { id: signed!.id, provider: "nostr", author: signed!.pubkey, createdAt: signed!.created_at, kind: signed!.kind, tags: signed!.tags, content: signed!.content, signature: signed!.sig };

    // Device C evaluates an event that was addressed (`targetDeviceId`) to Device B -- refused.
    const inboundC = new FedosArchiveSuppressionInboundHandler({
      registryPersistence, dedupPersistence: new InMemoryFedosArchiveSuppressionInboundDedupPersistence(),
      observationAuthority: new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() }),
      localDeviceId: "device-c", localAccountRef: accountRef,
    });
    const result = await inboundC.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("wrong-recipient");
  });

  it("8. forged/tampered outer content (the signature no longer matches the recomputed id) fails closed as invalid-signature, before any embedded claim is acted on", async () => {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthority.publicIdentityForAccount(0))!;
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    for (const e of registeredAndTrustedEvents("device-a", accountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-b", accountRef, 100)) registryPersistence.putEvent(e);

    const fact = makeFact({ accountRef, sourceDeviceId: "device-a" });
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "4".repeat(32) });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const signed = await signingAuthority.signEvent(unsigned);
    expect(signed).not.toBeNull();

    // The `id`/`sig` are unchanged, but `content` (and hence the embedded fact) has been
    // tampered post-signing -- a real signature can never validate a different payload.
    const forgedFact = makeFact({ accountRef, sourceDeviceId: "device-a", revision: 999 });
    const forgedPayload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact: forgedFact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "4".repeat(32) });
    const descriptor: FedosEventDescriptor = { id: signed!.id, provider: "nostr", author: signed!.pubkey, createdAt: signed!.created_at, kind: signed!.kind, tags: signed!.tags, content: JSON.stringify(forgedPayload), signature: signed!.sig };

    const inboundB = new FedosArchiveSuppressionInboundHandler({
      registryPersistence, dedupPersistence: new InMemoryFedosArchiveSuppressionInboundDedupPersistence(),
      observationAuthority: new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() }),
      localDeviceId: "device-b", localAccountRef: accountRef,
    });
    const result = await inboundB.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("invalid-signature");
  });

  it("9. an expired wire payload (now > expiresAt) is refused as expired, even though everything else about it is valid", async () => {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthority.publicIdentityForAccount(0))!;
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    for (const e of registeredAndTrustedEvents("device-a", accountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-b", accountRef, 100)) registryPersistence.putEvent(e);

    const fact = makeFact({ accountRef, sourceDeviceId: "device-a" });
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "5".repeat(32) });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const signed = await signingAuthority.signEvent(unsigned);
    const descriptor: FedosEventDescriptor = { id: signed!.id, provider: "nostr", author: signed!.pubkey, createdAt: signed!.created_at, kind: signed!.kind, tags: signed!.tags, content: signed!.content, signature: signed!.sig };

    const inboundB = new FedosArchiveSuppressionInboundHandler({
      registryPersistence, dedupPersistence: new InMemoryFedosArchiveSuppressionInboundDedupPersistence(),
      observationAuthority: new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() }),
      localDeviceId: "device-b", localAccountRef: accountRef,
    });
    const result = await inboundB.handleIncomingEvent({ descriptor, now: 2001 });
    expect(result.outcome).toBe("expired");
  });

  it("10. the outer routing sourceDeviceId and the embedded fact's own sourceDeviceId disagreeing is refused as invalid-signature (the envelope is claiming a different origin than the signed fact itself asserts)", async () => {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthority.publicIdentityForAccount(0))!;
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    for (const e of registeredAndTrustedEvents("device-a", accountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-x", accountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-b", accountRef, 100)) registryPersistence.putEvent(e);

    const fact = makeFact({ accountRef, sourceDeviceId: "device-a" }); // fact claims device-a
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-x", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "6".repeat(32) }); // envelope claims device-x
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const signed = await signingAuthority.signEvent(unsigned);
    const descriptor: FedosEventDescriptor = { id: signed!.id, provider: "nostr", author: signed!.pubkey, createdAt: signed!.created_at, kind: signed!.kind, tags: signed!.tags, content: signed!.content, signature: signed!.sig };

    const inboundB = new FedosArchiveSuppressionInboundHandler({
      registryPersistence, dedupPersistence: new InMemoryFedosArchiveSuppressionInboundDedupPersistence(),
      observationAuthority: new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() }),
      localDeviceId: "device-b", localAccountRef: accountRef,
    });
    const result = await inboundB.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("invalid-signature");
  });

  it("11. rollback: an OLDER revision for the same (subject, sourceDevice) than one already recorded is rejected -- an attacker/stale-replay cannot regress a suppression decision", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const newer = makeFact({ revision: 5, nonce: "a".repeat(32) });
    const older = makeFact({ revision: 2, nonce: "b".repeat(32) });
    expect(authority.recordImportedSuppression(newer, "account-only")).toBe("recorded");
    expect(authority.recordImportedSuppression(older, "account-only")).toBe("rollback-rejected");
  });

  it("12. conflicting duplicate: two DIFFERENT facts sharing the identical (accountRef, sourceDevice, subject, meaning, revision) -- and therefore the identical factId -- but differing content is flagged as a conflict, never silently overwritten", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const first = makeFact({ revision: 0, decidedAt: 1000, nonce: "a".repeat(32) });
    const conflicting = makeFact({ revision: 0, decidedAt: 1234, nonce: "b".repeat(32) }); // same factId, different decidedAt/nonce
    expect(first.factId).toBe(conflicting.factId);
    expect(authority.recordImportedSuppression(first, "account-only")).toBe("recorded");
    expect(authority.recordImportedSuppression(conflicting, "account-only")).toBe("conflict");
  });

  it("13. local-stronger-vs-imported-weaker: this Device's OWN self-authored decision at a higher revision is never regressed by a later-arriving imported fact at a lower revision", () => {
    const authority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const localDecision = makeFact({ revision: 3, nonce: "a".repeat(32) });
    expect(authority.recordSelfSuppression(localDecision)).toBe("recorded");
    expect(authority.evaluateSuppression(PAYLOAD_ID, "restore")).toBe("suppressed");

    const staleImport = makeFact({ revision: 1, nonce: "b".repeat(32) });
    expect(authority.recordImportedSuppression(staleImport, "device-verified")).toBe("rollback-rejected");
    // Still suppressed via the local decision -- the rejected import never weakened anything.
    expect(authority.evaluateSuppression(PAYLOAD_ID, "restore")).toBe("suppressed");
  });

  it("14. duplicate receipt of the identical relay event id is refused on the SECOND delivery, before any parsing is attempted", async () => {
    const dedup = new InMemoryFedosArchiveSuppressionInboundDedupPersistence();
    dedup.putImport({ schemaVersion: 1, relayEventId: "dup-event-id", factId: "irrelevant", importedAt: 500 });
    const inboundB = new FedosArchiveSuppressionInboundHandler({
      registryPersistence: new InMemoryFedosDeviceRegistryPersistence(), dedupPersistence: dedup,
      observationAuthority: new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() }),
      localDeviceId: "device-b", localAccountRef: ACCOUNT_REF,
    });
    const descriptor: FedosEventDescriptor = { id: "dup-event-id", provider: "nostr", author: "z".repeat(64), createdAt: 1000, kind: 1, tags: [], content: "{}", signature: "y".repeat(128) };
    const result = await inboundB.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("duplicate");
  });

  it("15. no-other-trusted-devices: fanOut() when the ONLY trusted Device on the account is the source Device itself produces zero targets, never a fabricated success", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryOnlySelfTrusted();
    const fact = makeFact();
    // A relay IS configured here (`FedosConversationRelaySet` refuses an empty set), but this
    // scenario returns before the Coordinator ever reaches the Publisher -- the relay is inert.
    const outbound = new FedosArchiveSuppressionOutboundCoordinator({
      registryPersistence, signingAuthority: new RealFedosNostrSigningAuthority(),
      publisher: new FedosDeviceRelaySyncPublisher(new FedosConversationRelaySet([new FakeDeviceRelaySyncRelay("wss://unused")])),
      observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
    });
    const result = await outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
    expect(result.outcome).toBe("no-other-trusted-devices");
    expect(result.targets).toHaveLength(0);
  });

  it("16. source-not-trusted at fanout time: a source Device that is itself revoked (or never registered) cannot fan out anything", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    // "device-a" is never registered at all.
    const fact = makeFact();
    const outbound = new FedosArchiveSuppressionOutboundCoordinator({
      registryPersistence, signingAuthority: new RealFedosNostrSigningAuthority(),
      publisher: new FedosDeviceRelaySyncPublisher(new FedosConversationRelaySet([new FakeDeviceRelaySyncRelay("wss://unused")])),
      observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
    });
    const result = await outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
    expect(result.outcome).toBe("source-not-trusted");
    expect(result.targets).toHaveLength(0);
  });

  it("17. wrong-account import: a fact whose accountRef does not match the local Device's own account is refused, regardless of an otherwise-valid signature", async () => {
    const signingAuthority = new RealFedosNostrSigningAuthority();
    const identity = (await signingAuthority.publicIdentityForAccount(0))!;
    const signerAccountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    for (const e of registeredAndTrustedEvents("device-a", signerAccountRef, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-b", signerAccountRef, 100)) registryPersistence.putEvent(e);

    const fact = makeFact({ accountRef: signerAccountRef, sourceDeviceId: "device-a" });
    const payload = buildFedosArchiveSuppressionWirePayload({ sourceDeviceId: "device-a", targetDeviceId: "device-b", fact, deviceEvidence: null, createdAt: 1000, expiresAt: 2000, deliveryId: "7".repeat(32) });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const signed = await signingAuthority.signEvent(unsigned);
    const descriptor: FedosEventDescriptor = { id: signed!.id, provider: "nostr", author: signed!.pubkey, createdAt: signed!.created_at, kind: signed!.kind, tags: signed!.tags, content: signed!.content, signature: signed!.sig };

    // Device B here belongs to a DIFFERENT local account than the one that signed the fact.
    const inboundB = new FedosArchiveSuppressionInboundHandler({
      registryPersistence, dedupPersistence: new InMemoryFedosArchiveSuppressionInboundDedupPersistence(),
      observationAuthority: new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() }),
      localDeviceId: "device-b", localAccountRef: OTHER_ACCOUNT_REF,
    });
    const result = await inboundB.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("wrong-account");
  });

  it("18. corrupt/truncated durable Suppression Observation log fails closed (throws) rather than silently dropping or fabricating recovered state", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7721-7800-failmatrix-"));
    try {
      const logPath = join(dir, "corrupt.ndjson");
      writeFileSync(logPath, '{"schemaVersion":1,"id":"x","truncated-mid-obj\n', "utf8");
      const persistence = new AppendOnlyFedosArchiveSuppressionObservationPersistence(logPath);
      expect(() => persistence.listObservations()).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("19. corrupt/truncated durable inbound-dedup log fails closed (throws) rather than silently permitting a replay to be re-imported", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7721-7800-failmatrix-"));
    try {
      const logPath = join(dir, "corrupt-dedup.ndjson");
      writeFileSync(logPath, '{"schemaVersion":1,"relayEventId":"x","truncated\n', "utf8");
      const persistence = new AppendOnlyFedosArchiveSuppressionInboundDedupPersistence(logPath);
      expect(() => persistence.getByRelayEventId("x")).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("20. transport unavailable: a configured Relay that never sends an OK (offline/unreachable) still produces a real per-target attempt record with published:false after the correlation timeout -- never a fabricated delivery, and never a thrown exception", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    for (const e of registeredAndTrustedEvents("device-a", ACCOUNT_REF, 100)) registryPersistence.putEvent(e);
    for (const e of registeredAndTrustedEvents("device-b", ACCOUNT_REF, 100)) registryPersistence.putEvent(e);
    const fact = makeFact();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const unreachableRelay = new FakeDeviceRelaySyncRelay("wss://unreachable", "timeout");
    await unreachableRelay.connect();
    const outbound = new FedosArchiveSuppressionOutboundCoordinator({
      registryPersistence, signingAuthority: new RealFedosNostrSigningAuthority(),
      publisher: new FedosDeviceRelaySyncPublisher(new FedosConversationRelaySet([unreachableRelay]), 20), // short correlation timeout so the test stays fast
      observationRepository,
    });
    const result = await outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
    expect(result.outcome).toBe("fanned-out");
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]!.targetDeviceId).toBe("device-b");
    expect(result.targets[0]!.published).toBe(false);
    expect(result.targets[0]!.relayOutcomes).toEqual([{ relayUrl: "wss://unreachable", outcome: "failed" }]);
  });
});

/** A minimal Registry stand-in with exactly ONE trusted Device (the source itself) on the account -- proving `fanOut()`'s own "no OTHER trusted device" outcome, not merely "no device at all." */
class InMemoryFedosDeviceRegistryOnlySelfTrusted extends InMemoryFedosDeviceRegistryPersistence {
  constructor() {
    super();
    for (const e of registeredAndTrustedEvents("device-a", ACCOUNT_REF, 100)) this.putEvent(e);
  }
}

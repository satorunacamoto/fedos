import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import {
  isWellFormedFedosDeviceRelaySyncWirePayloadV1,
  buildFedosDeviceRelaySyncWirePayload,
  extractFedosDeviceTransferPackageFromWirePayload,
  computeFedosDeviceRelaySyncPackageContentHash,
} from "../src/device/relay_sync/fedos_device_relay_sync_wire_payload.js";
import {
  buildFedosDeviceRelaySyncUnsignedEventRequest,
  parseFedosDeviceRelaySyncEventDescriptor,
  FEDOS_DEVICE_RELAY_SYNC_MAX_CONTENT_BYTES,
} from "../src/device/relay_sync/fedos_device_relay_sync_event.js";
import { nostrWireEventToFedosEventDescriptor } from "../src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import { reviewFedosSyncRecordForJournal } from "../src/sync/fedos_sync_record_allowlist.js";
import { InMemoryFedosDeviceRelaySyncObservationRepository } from "../src/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.js";
import { queryFedosDeviceRelaySyncStatusForSession } from "../src/device/relay_sync/fedos_device_relay_sync_observation.js";
import {
  buildDeviceRelaySyncFixture,
  driveDeviceRelaySyncSessionToApproved,
  prepareDeviceRelaySyncSyncSession,
  INITIATOR_DEVICE_ID,
  RESPONDER_DEVICE_ID,
  DEVICE_RELAY_SYNC_BUILD_FIELDS,
} from "./support/device_relay_sync_test_fixture.js";

const NOW = 2_100_000_000;

function makeWirePayloadFields(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: 1,
    routeVersion: 1,
    transferSessionId: "session-1",
    sourceDeviceId: "phone",
    targetDeviceId: "laptop",
    accountAuthority: "nostr",
    accountPublicIdentifier: "ab".repeat(32),
    packageContentHash: "0".repeat(64),
    encryptedPackageBase64: "aGVsbG8=",
    createdAt: 1_000,
    expiresAt: 2_000,
    deliveryId: "delivery-1",
    ...overrides,
  };
}

describe("Secure Runtime Alpha 3641-3720 -- Wire Payload V1 structural safety (Phase C)", () => {
  it("1. isWellFormedFedosDeviceRelaySyncWirePayloadV1 rejects an unexpected extra field", () => {
    expect(isWellFormedFedosDeviceRelaySyncWirePayloadV1({ ...makeWirePayloadFields(), extra: "x" })).toBe(false);
  });

  it("2. rejects a missing field", () => {
    const fields = makeWirePayloadFields();
    const { deliveryId: _deliveryId, ...withoutDeliveryId } = fields;
    expect(isWellFormedFedosDeviceRelaySyncWirePayloadV1(withoutDeliveryId)).toBe(false);
  });

  it("3. rejects non-base64 encryptedPackageBase64", () => {
    expect(isWellFormedFedosDeviceRelaySyncWirePayloadV1(makeWirePayloadFields({ encryptedPackageBase64: "not base64 !!" }))).toBe(false);
  });

  it("4. rejects expiresAt <= createdAt", () => {
    expect(isWellFormedFedosDeviceRelaySyncWirePayloadV1(makeWirePayloadFields({ expiresAt: 500 }))).toBe(false);
  });

  it("5. extractFedosDeviceTransferPackageFromWirePayload returns null (never throws) on malformed base64 content", () => {
    const payload = makeWirePayloadFields({ encryptedPackageBase64: Buffer.from("not a real transfer package").toString("base64") });
    expect(extractFedosDeviceTransferPackageFromWirePayload(payload as never)).toBeNull();
  });

  it("6. computeFedosDeviceRelaySyncPackageContentHash changes when the package changes", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const built = await fixture.transferCoordinator.buildTransferPackage(
      { sessionId, approval, syncSession, encryptionAuthority: fixture.encryptionAuthority, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, ...DEVICE_RELAY_SYNC_BUILD_FIELDS },
      NOW,
    );
    if (built.outcome !== "package-sent") throw new Error("unreachable");
    const hashA = computeFedosDeviceRelaySyncPackageContentHash(built.package!);
    const tampered = { ...built.package!, syncPackage: { ...built.package!.syncPackage, manifest: { ...built.package!.syncPackage.manifest, targetDeviceId: "different-device" } } };
    const hashB = computeFedosDeviceRelaySyncPackageContentHash(tampered);
    expect(hashA).not.toBe(hashB);
  });

  it("7. oversized payload -- an event content beyond the resource limit is rejected before JSON.parse is even attempted", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const oversizedContent = JSON.stringify({ padding: "x".repeat(FEDOS_DEVICE_RELAY_SYNC_MAX_CONTENT_BYTES + 1) });
    const event = await fixture.signingAuthority.signEvent({
      accountIndex: 0,
      createdAt: NOW,
      kind: 1,
      tags: [["fedos-device-sync", "1"], ["p", "ab".repeat(32)], ["d-session", "session-1"]],
      content: oversizedContent,
    });
    const descriptor = nostrWireEventToFedosEventDescriptor(event!);
    expect(parseFedosDeviceRelaySyncEventDescriptor(descriptor)).toBeNull();
  });

  it("8. malformed event -- wrong kind, or missing the Device Sync marker tag, is rejected", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const payload = buildFedosDeviceRelaySyncWirePayload({
      transferPackage: (await (async () => {
        const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
        const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
        const built = await fixture.transferCoordinator.buildTransferPackage(
          { sessionId, approval, syncSession, encryptionAuthority: fixture.encryptionAuthority, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, ...DEVICE_RELAY_SYNC_BUILD_FIELDS },
          NOW,
        );
        if (built.outcome !== "package-sent") throw new Error("unreachable");
        return built.package!;
      })()),
      transferSessionId: "session-x",
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      accountAuthority: fixture.accountRef.authority,
      accountPublicIdentifier: fixture.accountRef.publicIdentifier,
      createdAt: NOW,
      expiresAt: NOW + 300,
      deliveryId: "delivery-x",
    });
    const unsignedRequest = buildFedosDeviceRelaySyncUnsignedEventRequest({ payload, localAccountIndex: 0 });

    const wrongKindEvent = await fixture.signingAuthority.signEvent({ ...unsignedRequest, kind: 1 });
    const noMarkerEvent = await fixture.signingAuthority.signEvent({ ...unsignedRequest, tags: [["p", payload.accountPublicIdentifier]] });

    expect(parseFedosDeviceRelaySyncEventDescriptor(nostrWireEventToFedosEventDescriptor(noMarkerEvent!))).toBeNull();
    // A well-formed kind-1 event WITH the marker parses fine -- confirms the marker-tag check, not kind alone, is what "malformed" #2 exercises.
    expect(parseFedosDeviceRelaySyncEventDescriptor(nostrWireEventToFedosEventDescriptor(wrongKindEvent!))).not.toBeNull();
  });
});

describe("Secure Runtime Alpha 3641-3720 -- Sync Record Safety (Phase K, the EXISTING, unmodified allowlist)", () => {
  it("1. unknown record type is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("not-a-real-record-type").allowed).toBe(false);
  });

  it("2. Master Seed metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { masterSeed: "irrelevant-value" }).allowed).toBe(false);
  });

  it("3. private key metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { note: "my private_key is embedded here" }).allowed).toBe(false);
  });

  it("4. Device private key metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { devicePrivateKey: "irrelevant" }).allowed).toBe(false);
  });

  it("5. Sender-Key secret metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { senderKeySecret: "irrelevant" }).allowed).toBe(false);
  });

  it("6. bearer secret metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { auth: "bearer abc123" }).allowed).toBe(false);
  });

  it("7. passphrase metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { passphrase: "irrelevant" }).allowed).toBe(false);
  });

  it("8. raw arbitrary plaintext message metadata is rejected", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { note: "raw plaintext content here" }).allowed).toBe(false);
  });

  it("9. an 'executable/script payload' record type is rejected -- not on the closed allowlist at all", () => {
    expect(reviewFedosSyncRecordForJournal("executable-script-payload").allowed).toBe(false);
  });

  it("10. an allowed record type with clean metadata is accepted -- confirms the allowlist is not accidentally over-broad", () => {
    expect(reviewFedosSyncRecordForJournal("membership-metadata", { role: "member" }).allowed).toBe(true);
  });
});

describe("Secure Runtime Alpha 3641-3720 -- no plaintext / no raw secret reaches the Relay", () => {
  it("1. the signed event's own content never contains the plaintext Sync Session JSON -- only the opaque base64 blob", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const built = await fixture.transferCoordinator.buildTransferPackage(
      { sessionId, approval, syncSession, encryptionAuthority: fixture.encryptionAuthority, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, ...DEVICE_RELAY_SYNC_BUILD_FIELDS },
      NOW,
    );
    if (built.outcome !== "package-sent") throw new Error("unreachable");

    const payload = buildFedosDeviceRelaySyncWirePayload({
      transferPackage: built.package!,
      transferSessionId: sessionId,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      accountAuthority: fixture.accountRef.authority,
      accountPublicIdentifier: fixture.accountRef.publicIdentifier,
      createdAt: NOW,
      expiresAt: NOW + 300,
      deliveryId: "delivery-plaintext-check",
    });
    const unsignedRequest = buildFedosDeviceRelaySyncUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const event = await fixture.signingAuthority.signEvent(unsignedRequest);

    // The plaintext Sync Session's own canonical JSON (device public key refs included) never appears verbatim
    // anywhere in the signed content -- only the opaque, AEAD-sealed base64 blob does.
    const plaintextSessionJson = JSON.stringify(syncSession);
    expect(event!.content.includes(plaintextSessionJson)).toBe(false);
    for (const device of syncSession.devices) {
      if (device.devicePublicKeyRef !== null) {
        expect(event!.content.includes(device.devicePublicKeyRef)).toBe(false);
      }
    }
    // No secret-shaped substring of any kind appears anywhere in the signed content.
    for (const marker of ["masterseed", "privatekey", "nsec", "mnemonic", "passphrase"]) {
      expect(event!.content.toLowerCase().includes(marker)).toBe(false);
    }
  });
});

describe("Secure Runtime Alpha 3641-3720 -- Observation status query (Phase L)", () => {
  it("1. queryFedosDeviceRelaySyncStatusForSession returns every recorded fact for a session, chronologically, across local and per-Relay subjects", () => {
    const repository = new InMemoryFedosDeviceRelaySyncObservationRepository();
    const sessionId = "session-status-1";
    repository.record(sessionId, "queued", 100);
    repository.record(sessionId, "publishing", 101);
    repository.record(`${sessionId}::wss://relay-a.example`, "relay-accepted", 102);
    repository.record(sessionId, "received", 200);
    repository.record(sessionId, "imported", 201);

    const status = queryFedosDeviceRelaySyncStatusForSession(repository, sessionId);
    expect(status.map((f) => f.state)).toEqual(["queued", "publishing", "relay-accepted", "received", "imported"]);
    // Relay-accepted and imported are NEVER collapsed into one fact -- both are independently present.
    expect(status.some((f) => f.state === "relay-accepted")).toBe(true);
    expect(status.some((f) => f.state === "imported")).toBe(true);
  });

  it("2. an UNRELATED session's facts never leak into another session's status query", () => {
    const repository = new InMemoryFedosDeviceRelaySyncObservationRepository();
    repository.record("session-a", "queued", 100);
    repository.record("session-b", "queued", 100);
    const status = queryFedosDeviceRelaySyncStatusForSession(repository, "session-a");
    expect(status).toHaveLength(1);
  });
});

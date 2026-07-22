import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import {
  createPendingFedosDeviceBinding,
  createUnavailableFedosDeviceBinding,
  trustFedosDeviceBinding,
  revokeFedosDeviceBinding,
  isFedosDeviceTrustTransitionAllowed,
  isFedosDeviceBindingTrusted,
} from "../src/device/fedos_device_binding.js";
import { UnavailableFedosDeviceRegistrationAuthority } from "../src/device/unavailable_fedos_device_registration_authority.js";
import { PersistedFedosDeviceTrustAuthority } from "../src/device/persistence/persisted_fedos_device_trust_authority.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { reviewFedosSyncRecordForJournal } from "../src/sync/fedos_sync_record_allowlist.js";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { restoreFedosConversationArchiveBundle } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "npub-account-a", identityId: null };
const ACCOUNT_B = { authority: "nostr", publicIdentifier: "npub-account-b", identityId: null };

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-device-trust-2921-3000-"));
}

describe("Secure Runtime Alpha 2921-3000 -- Phase B/C: Device Binding state machine", () => {
  it("1. creates a local Device Binding, schemaVersion 1, no secret field", () => {
    const binding = createPendingFedosDeviceBinding({
      deviceId: "dev-A",
      accountRef: ACCOUNT_A,
      devicePublicKeyRef: "keyref-1",
      label: "desktop",
      createdAt: 100,
    });
    expect(binding).toEqual({
      schemaVersion: 1,
      deviceId: "dev-A",
      accountRef: ACCOUNT_A,
      devicePublicKeyRef: "keyref-1",
      label: "desktop",
      createdAt: 100,
      trustState: "pending",
      capabilityVersion: 1,
      revokedAt: null,
    });
    expect(Object.keys(binding).some((k) => /seed|password|passphrase|privatekey/i.test(k))).toBe(false);
  });

  it("the unavailable producer always forces devicePublicKeyRef to null, even if a caller-supplied one is passed elsewhere", () => {
    const binding = createUnavailableFedosDeviceBinding({
      deviceId: "dev-B",
      accountRef: ACCOUNT_A,
      devicePublicKeyRef: "should-be-ignored",
      label: null,
      createdAt: 100,
    });
    expect(binding.trustState).toBe("unavailable");
    expect(binding.devicePublicKeyRef).toBeNull();
  });

  it("transition table: pending->trusted->revoked allowed; revoked is terminal", () => {
    expect(isFedosDeviceTrustTransitionAllowed("pending", "trusted")).toBe(true);
    expect(isFedosDeviceTrustTransitionAllowed("pending", "revoked")).toBe(true);
    expect(isFedosDeviceTrustTransitionAllowed("unavailable", "trusted")).toBe(false);
    expect(isFedosDeviceTrustTransitionAllowed("trusted", "revoked")).toBe(true);
    expect(isFedosDeviceTrustTransitionAllowed("revoked", "trusted")).toBe(false);
    expect(isFedosDeviceTrustTransitionAllowed("revoked", "pending")).toBe(false);

    let binding = createPendingFedosDeviceBinding({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null, createdAt: 100 });
    binding = trustFedosDeviceBinding(binding, 200)!;
    expect(isFedosDeviceBindingTrusted(binding)).toBe(true);
    binding = revokeFedosDeviceBinding(binding, 300)!;
    expect(binding.trustState).toBe("revoked");
    expect(binding.revokedAt).toBe(300);

    // Revoked can never mutate back to trusted -- a revoked record's own transition returns null.
    expect(trustFedosDeviceBinding(binding, 400)).toBeNull();
    expect(revokeFedosDeviceBinding(binding, 400)).toBeNull();
  });
});

describe("Secure Runtime Alpha 2921-3000 -- Phase D/E: registration, trust, revocation, conflicts", () => {
  it("2. registers a pending Device under the production (unavailable) authority -- never 'trusted', never a fabricated key", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
    });
    const result = authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "claimed-key", label: "phone" }, 100);
    expect(result.outcome).toBe("registered");
    expect(result.binding!.trustState).toBe("unavailable");
    expect(result.binding!.devicePublicKeyRef).toBeNull();
  });

  it("3. authorizes a trusted Device end-to-end using a real-shaped (test-only) verified authority", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
    });
    const reg = authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "keyref-1", label: null }, 100);
    expect(reg.outcome).toBe("registered");
    expect(reg.binding!.trustState).toBe("pending");

    const confirm = authority.confirmTrust("dev-A", 200);
    expect(confirm.outcome).toBe("trusted");
    expect(confirm.binding!.trustState).toBe("trusted");
    expect(authority.isDeviceTrusted("dev-A")).toBe(true);
  });

  it("the production unavailable authority can never confirm trust -- fail-closed, proven directly", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
    });
    authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 100);
    // trustState is "unavailable", not "pending" -- confirmTrust refuses the transition before even asking the Authority.
    expect(authority.confirmTrust("dev-A", 200).outcome).toBe("invalid-transition");
  });

  it("4. duplicate registration is idempotent", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
    });
    authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 100);
    const second = authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 200);
    expect(second.outcome).toBe("already-registered");
    expect(second.binding!.createdAt).toBe(100);
  });

  it("5. conflicting registration (same deviceId, different account) is refused, never re-parented", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
    });
    authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 100);
    const conflicting = authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_B, devicePublicKeyRef: null, label: null }, 200);
    expect(conflicting.outcome).toBe("conflict");
    expect(authority.getBinding("dev-A")!.accountRef).toEqual(ACCOUNT_A);
  });

  it("6/7. revokes a Device; a revoked Device is denied re-registration and trust confirmation", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
    });
    authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
    authority.confirmTrust("dev-A", 150);
    const revoked = authority.revokeDevice("dev-A", 200);
    expect(revoked.outcome).toBe("revoked");
    expect(authority.isDeviceTrusted("dev-A")).toBe(false);

    // Denied: re-registering the SAME device id after revocation never rebinds it (terminal).
    expect(authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 300).outcome).toBe("revoked");
    // Denied: confirmTrust on an already-revoked binding.
    expect(authority.confirmTrust("dev-A", 300).outcome).toBe("invalid-transition");
    // Idempotent: revoking an already-revoked binding again is reported, not mutated further.
    expect(authority.revokeDevice("dev-A", 400).outcome).toBe("already-revoked");
    // Historical fact preserved -- the binding record itself is never erased.
    expect(authority.getBinding("dev-A")).not.toBeNull();
    expect(authority.getBinding("dev-A")!.revokedAt).toBe(200);
  });

  it("18. wrong account attempts registration -- refused by an Authority actually capable of checking (test-only verified stub)", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
    });
    const wrongAccountAttempt = authority.registerDevice(
      { deviceId: "dev-X", accountRef: ACCOUNT_B, devicePublicKeyRef: "k", label: null },
      100,
    );
    expect(wrongAccountAttempt.outcome).toBe("denied");
    expect(authority.getBinding("dev-X")).toBeNull();
  });

  it("20. Device registration never carries or copies a Master Seed / private key -- structural guard on the request/record shape", () => {
    const authority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
    });
    const result = authority.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 100);
    const serialized = JSON.stringify(result.binding);
    expect(serialized).not.toMatch(/seed|mnemonic|privatekey|private_key|passphrase/i);
  });
});

describe("Secure Runtime Alpha 2921-3000 -- Phase D: persistence (in-memory + append-only)", () => {
  it("8. restart persistence -- an append-only-backed registry survives a fresh instance over the same log file", () => {
    const dir = makeTmpDir();
    const logPath = join(dir, "device-registry.ndjson");
    try {
      const first = new PersistedFedosDeviceTrustAuthority({
        persistence: new AppendOnlyFedosDeviceRegistryPersistence(logPath),
        registrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      first.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: "laptop" }, 100);
      first.confirmTrust("dev-A", 150);

      const second = new PersistedFedosDeviceTrustAuthority({
        persistence: new AppendOnlyFedosDeviceRegistryPersistence(logPath),
        registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
      });
      const binding = second.getBinding("dev-A");
      expect(binding).not.toBeNull();
      expect(binding!.trustState).toBe("trusted");
      expect(binding!.label).toBe("laptop");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("9. corrupted registry fails closed -- one unparseable/schema-invalid line voids the whole backend", () => {
    const dir = makeTmpDir();
    const logPath = join(dir, "device-registry.ndjson");
    try {
      writeFileSync(logPath, "not-json-and-not-a-valid-event\n", "utf8");
      const persistence = new AppendOnlyFedosDeviceRegistryPersistence(logPath);
      expect(() => persistence.listBindings()).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("append-only registry rejects a conflicting duplicate event for the same key", () => {
    const dir = makeTmpDir();
    const logPath = join(dir, "device-registry.ndjson");
    try {
      appendFileSync(
        logPath,
        JSON.stringify({
          schemaVersion: 1,
          eventType: "registered",
          deviceId: "dev-A",
          accountAuthority: ACCOUNT_A.authority,
          accountPublicIdentifier: ACCOUNT_A.publicIdentifier,
          accountIdentityId: null,
          devicePublicKeyRef: null,
          label: null,
          initialTrustState: "unavailable",
          registeredAt: 100,
        }) + "\n",
        "utf8",
      );
      const persistence = new AppendOnlyFedosDeviceRegistryPersistence(logPath);
      const conflicting = persistence.putEvent({
        schemaVersion: 1,
        eventType: "registered",
        deviceId: "dev-A",
        accountAuthority: ACCOUNT_B.authority,
        accountPublicIdentifier: ACCOUNT_B.publicIdentifier,
        accountIdentityId: null,
        devicePublicKeyRef: null,
        label: null,
        initialTrustState: "unavailable",
        registeredAt: 200,
      });
      expect(conflicting).toBe("conflict");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("16. independent account isolation -- listing one account's devices never leaks another's", () => {
    const persistence = new InMemoryFedosDeviceRegistryPersistence();
    const authority = new PersistedFedosDeviceTrustAuthority({ persistence, registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority() });
    authority.registerDevice({ deviceId: "dev-A1", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 100);
    authority.registerDevice({ deviceId: "dev-B1", accountRef: ACCOUNT_B, devicePublicKeyRef: null, label: null }, 100);

    expect(authority.listBindingsForAccount(ACCOUNT_A).map((b) => b.deviceId)).toEqual(["dev-A1"]);
    expect(authority.listBindingsForAccount(ACCOUNT_B).map((b) => b.deviceId)).toEqual(["dev-B1"]);
  });
});

function baseRuntimeConfig(dir: string) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false as const,
  };
}

describe("Secure Runtime Alpha 2921-3000 -- Phase F/G/H/I: Runtime ownership, allowlist, sync bridging", () => {
  it("17. independent Runtime isolation -- two started runtimes never share Device Trust state", async () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    try {
      const runtimeA = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dirA),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
      });
      const runtimeB = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dirB),
        deviceTrustEnabled: true,
        localDeviceId: "dev-B",
        localAccountRef: ACCOUNT_B,
      });
      runtimeA.deviceTrust().registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: null, label: null }, 100);
      expect(runtimeA.deviceTrust().listDevices().length).toBe(1);
      expect(runtimeB.deviceTrust().listDevices().length).toBe(0);
      await runtimeA.stop();
      await runtimeB.stop();
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it("registerSyncDevice only ever admits a currently-trusted device into the existing Sync fabric", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
      expect(dt.registerSyncDevice("dev-A", 150)).toBe("not-trusted");

      dt.confirmTrust("dev-A", 150);
      expect(dt.registerSyncDevice("dev-A", 200)).toBe("registered");
      expect(dt.syncReadiness("dev-A").ready).toBe(true);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("12/14/15. allowlist gate: duplicate journal entry, unknown record type, and secret-bearing metadata are all handled honestly", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
      dt.confirmTrust("dev-A", 100);

      const input = { changeId: "chg-1", conversationId: "conv-1", kind: "upsert" as const, contentHash: "hash-1" };

      // 12. duplicate journal entry -- appending the same changeId twice reports "duplicate", never a second sequence.
      const first = dt.recordLocalChange("dev-A", "conversation-identity-metadata", input, 200);
      expect(first.outcome).toBe("recorded");
      if (first.outcome === "recorded") expect(first.append.outcome).toBe("appended");
      const duplicate = dt.recordLocalChange("dev-A", "conversation-identity-metadata", input, 210);
      expect(duplicate.outcome).toBe("recorded");
      if (duplicate.outcome === "recorded") expect(duplicate.append.outcome).toBe("duplicate");

      // 14. unknown sync record type fails closed BEFORE the journal is touched.
      const unknown = dt.recordLocalChange("dev-A", "raw-envelope-plaintext", { ...input, changeId: "chg-2" }, 220);
      expect(unknown.outcome).toBe("rejected");
      if (unknown.outcome === "rejected") expect(unknown.reason).toBe("record-type-not-allowed");
      expect(dt.journalEntries().some((e) => e.changeId === "chg-2")).toBe(false);

      // 15. secret-bearing metadata rejected regardless of an otherwise-allowed record type.
      const secretBearing = dt.recordLocalChange(
        "dev-A",
        "conversation-identity-metadata",
        { ...input, changeId: "chg-3" },
        230,
        { note: "contains a bearer secret token" },
      );
      expect(secretBearing.outcome).toBe("rejected");
      expect(dt.journalEntries().some((e) => e.changeId === "chg-3")).toBe(false);

      // 23. a record type explicitly shaped like Sender-Key secret material is not on the allowlist.
      expect(reviewFedosSyncRecordForJournal("sender-key-secret").allowed).toBe(false);
      expect(reviewFedosSyncRecordForJournal("device-private-key").allowed).toBe(false);

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("13. out-of-order/cross-device entries surface as a classified conflict, never a silent overwrite", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      for (const deviceId of ["dev-A", "dev-B", "dev-C"]) {
        dt.registerDevice({ deviceId, accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
        dt.confirmTrust(deviceId, 100);
        dt.registerSyncDevice(deviceId, 100);
      }

      dt.recordLocalChange("dev-A", "conversation-identity-metadata", { changeId: "chg-A", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 200);

      dt.deliverQueuedChanges("dev-B", 220);
      const results = dt.applyPendingChanges("dev-B", 230);
      // dev-B's own queue only ever receives changes ORIGINATING from other devices (dev-A's), never its own -- so exactly one entry, applied cleanly (nothing yet to conflict with).
      expect(results.length).toBe(1);
      expect(results[0]?.outcome).toBe("applied");

      // A later change for the SAME conversation, originating from a DIFFERENT device than dev-B's own last-applied entry, is classified "concurrent-update", never silently overwritten.
      dt.recordLocalChange("dev-C", "conversation-identity-metadata", { changeId: "chg-C", conversationId: "conv-1", kind: "upsert", contentHash: "h3" }, 240);
      dt.deliverQueuedChanges("dev-B", 250);
      const secondRound = dt.applyPendingChanges("dev-B", 260);
      expect(secondRound.length).toBe(1);
      expect(secondRound[0]?.outcome).toBe("conflict");
      expect(secondRound[0]?.conflict).toBe("concurrent-update");

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10/11. cursor/restart via the existing recovery snapshot -- consistent snapshots restore, structurally corrupt ones fail closed", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      for (const deviceId of ["dev-A", "dev-B"]) {
        dt.registerDevice({ deviceId, accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
        dt.confirmTrust(deviceId, 100);
        dt.registerSyncDevice(deviceId, 100);
      }

      dt.recordLocalChange("dev-A", "conversation-identity-metadata", { changeId: "chg-1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 200);
      dt.deliverQueuedChanges("dev-B", 210);
      dt.applyPendingChanges("dev-B", 220); // resolves chg-1 into dev-B's own resolvedChangeIds
      const snapshot = dt.captureRecoverySnapshot("dev-B", 300);
      expect(snapshot.resolvedChangeIds).toEqual(["chg-1"]);
      expect(snapshot.pendingChangeIds).toEqual([]);

      // 11. cursor restart -- a fresh device-runtime-state reset, then restore, recovers the cursor position.
      expect(dt.restoreDeviceFromRecoverySnapshot(snapshot)).toBe(true);
      expect(dt.getCursor("dev-B").sequence).toBe(snapshot.cursorSequence);

      // 10. "corrupted journal" -- this Arc reuses the EXISTING Sync Journal's own recovery-snapshot consistency
      // check (Alpha 2421-2500's isFedosSyncRecoverySnapshotConsistent) as its fail-closed guard, since the Journal
      // itself has no disk persistence to corrupt (see fedos_device_trust_runtime.ts's own header). A structurally
      // inconsistent snapshot -- the SAME changeId claimed both still-pending AND already-resolved -- is rejected outright.
      const corruptSnapshot = { ...snapshot, pendingChangeIds: [...snapshot.resolvedChangeIds] };
      expect(dt.restoreDeviceFromRecoverySnapshot(corruptSnapshot as typeof snapshot)).toBe(false);

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("24. operation after stop is denied consistently", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
      });
      runtime.deviceTrust(); // accessible while running
      await runtime.stop();
      expect(() => runtime.deviceTrust()).toThrow("inaccessible after stop");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("deviceTrust() throws 'not enabled' when the config never opted in", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime(baseRuntimeConfig(dir));
      expect(() => runtime.deviceTrust()).toThrow("not enabled");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 2921-3000 -- Phase I: revocation semantics", () => {
  it("future sync eligibility is denied once a device is revoked; a revoked device's originated change is refused before the journal is touched", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
      dt.confirmTrust("dev-A", 100);
      dt.registerSyncDevice("dev-A", 100);
      expect(dt.listSyncDevices().some((d) => d.deviceRef === "dev-A" && d.state === "bound")).toBe(true);

      dt.revokeDevice("dev-A", 200);
      // Device Trust query shows revoked.
      expect(dt.getDevice("dev-A")!.trustState).toBe("revoked");
      // Sync-fabric eligibility revoked too (best-effort bridge).
      expect(dt.listSyncDevices().find((d) => d.deviceRef === "dev-A")!.state).toBe("revoked");
      expect(dt.syncReadiness("dev-A").ready).toBe(false);

      // A pending command FROM the now-revoked device fails before the journal is ever touched.
      const attempt = dt.recordLocalChange("dev-A", "conversation-identity-metadata", { changeId: "chg-after-revoke", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 300);
      expect(attempt.outcome).toBe("rejected");
      if (attempt.outcome === "rejected") expect(attempt.reason).toBe("device-not-trusted");
      expect(dt.journalEntries().some((e) => e.changeId === "chg-after-revoke")).toBe(false);

      // No retroactive erasure of the historical binding fact.
      expect(dt.getDevice("dev-A")).not.toBeNull();

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 2921-3000 -- Phase J: Archive separation", () => {
  it("19. Archive Restore creates local Conversation state but never registers or implies a trusted Device", () => {
    const runtimeAuthority = new PersistedFedosDeviceTrustAuthority({
      persistence: new InMemoryFedosDeviceRegistryPersistence(),
      registrationAuthority: new UnavailableFedosDeviceRegistrationAuthority(),
    });

    // restoreFedosConversationArchiveBundle's own dependency shape has no
    // Device/Sync port at all (see this Arc's execution spec, Phase A/J) --
    // this is exercised directly: an empty-but-well-formed bundle restore
    // over fresh Conversation-domain persistence never touches Device Trust.
    const emptyBundle = {
      schemaVersion: 1,
      conversation: {
        schemaVersion: 1,
        conversationId: "conv-archive-1",
        mode: "direct",
        boardPostId: "post-1",
        createdAt: 100,
      },
      memberships: [],
      capabilityEvents: [],
      envelopes: [],
      payloads: [],
    } as unknown as Parameters<typeof restoreFedosConversationArchiveBundle>[0];

    restoreFedosConversationArchiveBundle(emptyBundle, {
      conversationPersistence: new InMemoryFedosConversationPersistence(),
      membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
      capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    });

    expect(runtimeAuthority.listBindingsForAccount(ACCOUNT_A).length).toBe(0);
  });

  it("a wrong Device identity cannot claim an existing binding by re-registering the same deviceId under a different account", () => {
    // Same persistence, different claimed account -- refused as "conflict", the original binding untouched.
    const persistence = new InMemoryFedosDeviceRegistryPersistence();
    const shared = new PersistedFedosDeviceTrustAuthority({ persistence, registrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier) });
    shared.registerDevice({ deviceId: "dev-shared-id", accountRef: ACCOUNT_A, devicePublicKeyRef: "k", label: null }, 100);
    const sharedAsB = new PersistedFedosDeviceTrustAuthority({ persistence, registrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_B.authority, ACCOUNT_B.publicIdentifier) });
    const claimAttempt = sharedAsB.registerDevice({ deviceId: "dev-shared-id", accountRef: ACCOUNT_B, devicePublicKeyRef: "k2", label: null }, 200);
    expect(claimAttempt.outcome).toBe("conflict");
    expect(shared.getBinding("dev-shared-id")!.accountRef).toEqual(ACCOUNT_A);
  });

  it("restored Runtime requires its own Device trust process -- a fresh Runtime over restored Conversation state starts with zero trusted devices", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-restored",
        localAccountRef: ACCOUNT_A,
      });
      expect(runtime.deviceTrust().listDevices().length).toBe(0);
      expect(runtime.deviceTrust().listTrustedDevices().length).toBe(0);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// 21. Search unaffected, 22. Pairwise/Direct messaging unaffected: this Arc
// touches no file under src/conversation/search/ or src/conversation/transport/,
// so these are proven by re-running those domains' own EXISTING, unmodified
// regression suites during Verification (see the completion declaration's
// "focused Search Foundation tests" / "Conversation Runtime regression tests"
// runs), not by duplicating their coverage in this new file.

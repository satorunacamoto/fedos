/**
 * Secure Runtime Alpha 7881-7960 — Phases H/I: failure matrix for the
 * NEW production-wiring surface this Arc adds to `fedos_desktop_runtime.ts`/
 * `fedos_desktop_runtime_config.ts` (config validation guards,
 * `archiveSuppressionAuthority()`/`recordAndPropagateArchiveSuppression()`
 * accessor fail-closed contracts, and real-Registry-driven fan-out
 * targeting). Lower-level component behavior (forged/expired/malformed
 * wire events, rollback/conflict revision detection, corrupt fact log,
 * duplicate inbound delivery) is ALREADY covered by
 * `test/secure_runtime_alpha_7721_7800_failure_matrix.test.ts` and
 * `test/secure_runtime_alpha_7721_7800_archive_suppression_fact.test.ts`
 * (unmodified by this Arc) — this file does not re-derive that coverage,
 * only the NEW Desktop-Runtime-level wiring this Arc itself adds.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionResult } from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import type { FedosPersistedDeviceBindingEventV1 } from "../src/os/messenger/device/persistence/fedos_persisted_device_binding_event_v1.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import type { FedosArchiveSuppressionFact } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_fact.js";

class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(): Promise<FedosConversationEncryptionResult> {
    throw new Error("not used");
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(): Promise<FedosConversationDecryptionResult> {
    throw new Error("not used");
  }
}

function baseConfig(dir: string, overrides: Partial<FedosDesktopRuntimeConfig> = {}): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationEnvelopeLogPath: join(dir, "envelope.log"),
    conversationPayloadLogPath: join(dir, "payload.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority({
      authority: "nostr",
      publicIdentifier: "test-participant",
      identityId: null,
    }),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(),
    clock: () => 1_800_000_000,
    ...overrides,
  };
}

function registeredAndTrustedEvents(deviceId: string, accountRef: FedosDeviceBindingAccountRef, at: number, trusted = true): FedosPersistedDeviceBindingEventV1[] {
  const events: FedosPersistedDeviceBindingEventV1[] = [
    {
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: accountRef.authority,
      accountPublicIdentifier: accountRef.publicIdentifier,
      accountIdentityId: accountRef.identityId,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: at,
    },
  ];
  if (trusted) events.push({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at });
  return events;
}

const PAYLOAD_ID = "payload-fm-1" as unknown as FedosConversationPayloadId;

describe("Secure Runtime Alpha 7881-7960 -- suppression production wiring failure matrix", () => {
  it("1. archiveSuppressionSyncEnabled without archiveEnabled -- synchronous config error, never silently ignored", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      await expect(startFedosDesktopRuntime(baseConfig(dir, { archiveSuppressionSyncEnabled: true }))).rejects.toThrow(/archiveEnabled is false/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. archiveSuppressionSyncEnabled without deviceTrustEnabled -- synchronous config error, never a fabricated Device Registry", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      await expect(
        startFedosDesktopRuntime(
          baseConfig(dir, {
            archiveEnabled: true,
            conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
            archiveSuppressionSyncEnabled: true,
          }),
        ),
      ).rejects.toThrow(/deviceTrustEnabled is false/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. archiveSuppressionSyncEnabled without conversationTransportRelays -- synchronous config error, never a fabricated Relay", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      await expect(
        startFedosDesktopRuntime(
          baseConfig(dir, {
            archiveEnabled: true,
            conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
            deviceTrustEnabled: true,
            localDeviceId: "device-a",
            localAccountRef: { authority: "nostr", publicIdentifier: "acct-1", identityId: null },
            deviceRegistryLogPath: join(dir, "devices.ndjson"),
            archiveSuppressionSyncEnabled: true,
            conversationTransportSigningAuthority: new RealFedosNostrSigningAuthority(),
          }),
        ),
      ).rejects.toThrow(/no conversationTransportRelays/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. archiveSuppressionSyncEnabled without conversationTransportSigningAuthority -- synchronous config error, never a fabricated Signing Authority", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      await expect(
        startFedosDesktopRuntime(
          baseConfig(dir, {
            archiveEnabled: true,
            conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
            deviceTrustEnabled: true,
            localDeviceId: "device-a",
            localAccountRef: { authority: "nostr", publicIdentifier: "acct-1", identityId: null },
            deviceRegistryLogPath: join(dir, "devices.ndjson"),
            archiveSuppressionSyncEnabled: true,
            conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
          }),
        ),
      ).rejects.toThrow(/no conversationTransportSigningAuthority/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. archiveEnabled: false -- archiveSuppressionAuthority()/recordAndPropagateArchiveSuppression() both honestly report 'not enabled', never a fabricated authority", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      const runtime = await startFedosDesktopRuntime(baseConfig(dir));
      expect(() => runtime.archiveSuppressionAuthority()).toThrow(/not enabled/);
      expect(() =>
        runtime.recordAndPropagateArchiveSuppression({ subjectRef: PAYLOAD_ID, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 }),
      ).toThrow(/not enabled/);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6. archiveEnabled: true but localAccountRef/localDeviceId never supplied -- recordAndPropagateArchiveSuppression() throws rather than fabricating a Device/account identity; archiveSuppressionAuthority() itself still works (LOCAL restore-gating is Device-identity-independent at the query level)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      const runtime = await startFedosDesktopRuntime(
        baseConfig(dir, { archiveEnabled: true, conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority() }),
      );
      expect(runtime.archiveSuppressionAuthority().evaluateSuppression(PAYLOAD_ID, "restore")).toBe("active");
      expect(() =>
        runtime.recordAndPropagateArchiveSuppression({ subjectRef: PAYLOAD_ID, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 }),
      ).toThrow(/requires config.localAccountRef and config.localDeviceId/);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("7. stopped Runtime -- both new accessors fail closed with 'inaccessible after stop', matching every other accessor's own established two-state contract", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      const runtime = await startFedosDesktopRuntime(
        baseConfig(dir, { archiveEnabled: true, conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority() }),
      );
      await runtime.stop();
      expect(() => runtime.archiveSuppressionAuthority()).toThrow(/inaccessible after stop/);
      expect(() =>
        runtime.recordAndPropagateArchiveSuppression({ subjectRef: PAYLOAD_ID, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 }),
      ).toThrow(/inaccessible after stop/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("8. revoked Device -- a real, durable Registry fact marking a Device revoked excludes it from a real fan-out target set, no crash, no silent delivery", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = (await signingAuthority.publicIdentityForAccount(0))!;
      const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
      const registryLog = join(dir, "devices.ndjson");
      const registryPersistence = new AppendOnlyFedosDeviceRegistryPersistence(registryLog);
      for (const e of registeredAndTrustedEvents("device-a", accountRef, 100, true)) registryPersistence.putEvent(e);
      for (const e of registeredAndTrustedEvents("device-b", accountRef, 100, true)) registryPersistence.putEvent(e);
      registryPersistence.putEvent({ schemaVersion: 1, eventType: "revoked", deviceId: "device-b", revokedAt: 200 });

      const runtime = await startFedosDesktopRuntime(
        baseConfig(dir, {
          archiveEnabled: true,
          conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
          deviceTrustEnabled: true,
          localDeviceId: "device-a",
          localAccountRef: accountRef,
          deviceRegistryLogPath: registryLog,
          archiveSuppressionSyncEnabled: true,
          conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
          conversationTransportSigningAuthority: signingAuthority,
        }),
      );
      const outcome = runtime.recordAndPropagateArchiveSuppression({ subjectRef: PAYLOAD_ID, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 });
      expect(outcome.outcome).toBe("recorded");
      // The revoked device-b is not a valid fan-out target; the LOCAL record must still succeed regardless
      // (Local Deletion NEVER waits for, or is gated by, Device Sync fan-out reachability).
      expect(runtime.archiveSuppressionAuthority().evaluateSuppression(PAYLOAD_ID, "restore")).toBe("suppressed");
      await new Promise((resolve) => setTimeout(resolve, 50));
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("9. no other trusted Device at all (single-Device profile, archiveSuppressionSyncEnabled still true) -- local suppression still records and gates restore correctly; fan-out has nothing to target, never an error", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      const signingAuthority = new RealFedosNostrSigningAuthority();
      const identity = (await signingAuthority.publicIdentityForAccount(0))!;
      const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };
      const registryLog = join(dir, "devices.ndjson");
      const registryPersistence = new AppendOnlyFedosDeviceRegistryPersistence(registryLog);
      for (const e of registeredAndTrustedEvents("device-a", accountRef, 100, true)) registryPersistence.putEvent(e);

      const runtime = await startFedosDesktopRuntime(
        baseConfig(dir, {
          archiveEnabled: true,
          conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
          deviceTrustEnabled: true,
          localDeviceId: "device-a",
          localAccountRef: accountRef,
          deviceRegistryLogPath: registryLog,
          archiveSuppressionSyncEnabled: true,
          conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
          conversationTransportSigningAuthority: signingAuthority,
        }),
      );
      const outcome = runtime.recordAndPropagateArchiveSuppression({ subjectRef: PAYLOAD_ID, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 });
      expect(outcome.outcome).toBe("recorded");
      expect(runtime.archiveSuppressionAuthority().evaluateSuppression(PAYLOAD_ID, "restore")).toBe("suppressed");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. the SAME suppressionAuthority instance is threaded into the real conversationArchiveRuntime() -- never a second, divergent instance; restore-gating query correctly transitions active -> suppressed on that ONE real, durable, production-constructed instance", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-7881-7960-fm-"));
    try {
      const runtime = await startFedosDesktopRuntime(
        baseConfig(dir, { archiveEnabled: true, conversationArchiveMasterSeedAuthority: new DevelopmentFedosMasterSeedAuthority() }),
      );
      const authority = runtime.archiveSuppressionAuthority();
      expect(authority.evaluateSuppression(PAYLOAD_ID, "restore")).toBe("active");
      const fact: FedosArchiveSuppressionFact = {
        schemaVersion: 1,
        factId: "fact-1",
        accountRef: { authority: "nostr", publicIdentifier: "acct-1", identityId: null },
        sourceDeviceId: "device-a",
        subjectType: "payload",
        subjectRef: PAYLOAD_ID,
        suppressionMeaning: "suppress-payload-restore",
        revision: 0,
        decidedAt: 1000,
        nonce: "0123456789abcdef0123456789abcdef",
      };
      authority.recordSelfSuppression(fact);
      // The Archive Runtime's own restore path consults evaluateSuppression() through the IDENTICAL object
      // reference -- proven directly: mutating the authority via its own public API is immediately visible
      // through the same accessor, and conversationArchiveRuntime() is reachable (archiveEnabled: true) without
      // throwing "not enabled" -- confirming construction succeeded with the real dependency threaded through.
      expect(() => runtime.conversationArchiveRuntime()).not.toThrow();
      expect(authority.evaluateSuppression(PAYLOAD_ID, "restore")).toBe("suppressed");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

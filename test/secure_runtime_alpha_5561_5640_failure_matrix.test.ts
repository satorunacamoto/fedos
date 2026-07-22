/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase P: a representative subset
 * of the failure matrix, driven directly against a real
 * `FedosConversationRuntime`'s own `directRatchet()` facade (real WASM
 * crypto, real Device registry/session persistence) with manually
 * constructed `FedosPrivateWireParsedRumor`s — bypassing the outer NIP-17
 * Rumor/Seal/Gift Wrap/Relay layer on purpose (that layer is already
 * proven by `test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`;
 * this file's own job is proving THIS Arc's own integration-layer
 * validation/rejection ordering).
 *
 * Not exhaustive against Phase P's full ~30-item list (see the
 * completion declaration for the honest coverage boundary) — this
 * covers: session establishment, unsupported suite, unknown session,
 * tampered ciphertext rejection, and genuine-message recovery afterward.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { createFedosConversationRuntime, type FedosConversationRuntime } from "../src/conversation/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationProductionCryptoGraph } from "../src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { FedosFixedPassphraseProvider } from "../src/runtime/master_seed/fedos_passphrase_provider.js";
import { FedosWasmMasterSeedAuthority } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";

import { AppendOnlyFedosConversationDraftPersistence } from "../src/conversation/construction/append_only_fedos_conversation_draft_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/conversation/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/conversation/activation/append_only_fedos_conversation_activation_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationEncryptionCoordinationPersistence } from "../src/conversation/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.js";
import { AppendOnlyFedosConversationConstructionCoordinationPersistence } from "../src/conversation/construction/coordination/append_only_fedos_conversation_construction_coordination_persistence.js";
import { PersistedFedosConversationCapabilityAuthority } from "../src/conversation/capability/persistence/persisted_fedos_conversation_capability_authority.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import {
  FedosSecureRandomCapabilityIdGenerator,
  FedosSecureRandomCapabilitySecretGenerator,
} from "../src/conversation/runtime/fedos_conversation_capability_generators.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosSecureRandomConstructionIdGenerator } from "../src/conversation/construction/fedos_private_conversation_construction_coordinator.js";
import { UnavailableFedosConversationEncryptionReadinessAuthority } from "../src/conversation/readiness/fedos_conversation_encryption_readiness_authority.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../src/conversation/invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationCapabilityDescriptor } from "../src/conversation/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationInvitationToken } from "../src/conversation/invitation/fedos_conversation_invitation_token.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { decodeFedosDirectRatchetNip17PayloadFromContent, encodeFedosDirectRatchetNip17PayloadToPlaintext } from "../src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.js";
import type { FedosPrivateWireParsedRumor } from "../src/conversation/transport/fedos_private_wire_adapter.js";
import type { FedosPrivateWireDeliveryQueueOutcome } from "../src/conversation/transport/fedos_private_wire_prepared_delivery.js";

// @ts-expect-error node:buffer has no type declarations without @types/node in this tsconfig.
import { Buffer } from "node:buffer";

declare const process: { cwd(): string; env: { NODE_ENV?: string; [key: string]: string | undefined } };

const WASM_PATH = join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust_bg.wasm");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH);
const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

const NOW = 1_720_000_000;
let ticker = NOW;
const clock = () => ticker++;

function invitationRevocationAuthorizationCheck(
  descriptor: FedosConversationCapabilityDescriptor,
  revoker: FedosConversationParticipantReference,
  membershipAuthority: PersistedFedosConversationMembershipAuthority,
): boolean {
  if (descriptor.issuer.authority === revoker.authority && descriptor.issuer.publicIdentifier === revoker.publicIdentifier) return true;
  const m = membershipAuthority.findMembership(descriptor.conversationId as FedosConversationId, revoker);
  return m !== null && m.state === "active" && (m.role === "owner" || m.role === "moderator");
}

function seedTrustedDevicePair(
  registryLogPath: string,
  selfAuthority: string,
  selfPublicIdentifier: string,
  selfDeviceId: string,
  peerAuthority: string,
  peerPublicIdentifier: string,
  peerDeviceId: string,
): void {
  const registry = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
  for (const [deviceId, authority, publicIdentifier] of [
    [selfDeviceId, selfAuthority, selfPublicIdentifier],
    [peerDeviceId, peerAuthority, peerPublicIdentifier],
  ] as const) {
    registry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: authority,
      accountPublicIdentifier: publicIdentifier,
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: NOW,
    });
    registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: NOW });
  }
}

suite("Alpha 5561-5640 Phase P -- representative failure matrix (REAL crypto, REAL WASM)", () => {
  it("session establishment, unsupported suite, unknown session, tampered ciphertext rejection, genuine recovery", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-5561-matrix-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));

      const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(join(backendDir, "draft.log"));
      const membershipAuthority = new PersistedFedosConversationMembershipAuthority(
        new AppendOnlyFedosConversationMembershipPersistence(join(backendDir, "membership.log")),
      );
      const coordinationPersistence = new AppendOnlyFedosConversationConstructionCoordinationPersistence(join(backendDir, "construction-coordination.log"));
      const capabilityAuthority = new PersistedFedosConversationCapabilityAuthority({
        persistence: new AppendOnlyFedosConversationCapabilityPersistence(join(backendDir, "capability.log")),
        idGenerator: new FedosSecureRandomCapabilityIdGenerator(),
        secretGenerator: new FedosSecureRandomCapabilitySecretGenerator(),
        existenceCheck: (id) => draftPersistence.getDraft(id) !== null,
        authorizationCheck: (id, issuer) => {
          const m = membershipAuthority.findMembership(id, issuer);
          return m !== null && m.state === "active" && (m.role === "owner" || m.role === "moderator");
        },
        membershipAuthority,
      });
      const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(join(backendDir, "activation.log"));
      const invitationRevocationRegistry = new InMemoryFedosConversationInvitationRevocationRegistry();

      async function buildParticipant(seedFileName: string, passphrase: string, ownDir: string) {
        const graph = await assembleFedosConversationProductionCryptoGraph({
          enabled: true,
          sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(join(seedDir, seedFileName)),
          passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode(passphrase)),
          accountIndex: 0,
          allowSeedCreation: true,
        });
        if (graph.outcome !== "available") throw new Error(`expected available, got ${graph.outcome}`);
        const resolution = graph.graph.creatorIdentityAuthority.resolveCreator();
        if (resolution.outcome !== "resolved") throw new Error("expected resolved creator");
        return {
          graph: graph.graph,
          participant: resolution.creator,
          masterSeedAuthority: graph.graph.masterSeedAuthority as unknown as FedosWasmMasterSeedAuthority,
          envelopePersistence: new AppendOnlyFedosConversationMessageEnvelopePersistence(join(ownDir, "envelope.log")),
          payloadStorage: new AppendOnlyFedosConversationPayloadStorage(join(ownDir, "payload.log"), 1_000_000),
        };
      }

      const alice = await buildParticipant("alice.seed", "alice-pass", mkdtempSync(join(root, "alice-")));
      const bob = await buildParticipant("bob.seed", "bob-pass", mkdtempSync(join(root, "bob-")));

      const aliceDeviceRef = "alice-device";
      const bobDeviceRef = "bob-device";
      const aliceRegistryLog = join(root, "alice-devices.log");
      const bobRegistryLog = join(root, "bob-devices.log");
      seedTrustedDevicePair(aliceRegistryLog, alice.participant.authority, alice.participant.publicIdentifier, aliceDeviceRef, bob.participant.authority, bob.participant.publicIdentifier, bobDeviceRef);
      seedTrustedDevicePair(bobRegistryLog, bob.participant.authority, bob.participant.publicIdentifier, bobDeviceRef, alice.participant.authority, alice.participant.publicIdentifier, aliceDeviceRef);

      let capturedControl: string | null = null;
      let capturedMessage: string | null = null;

      function buildRuntime(
        who: typeof alice,
        registryLog: string,
        localDeviceRef: string,
        remoteDeviceRef: string,
        sendControl: (controlId: string, conversationId: FedosConversationId, plaintext: Uint8Array, createdAt: number) => Promise<FedosPrivateWireDeliveryQueueOutcome>,
      ): FedosConversationRuntime {
        return createFedosConversationRuntime({
          draftPersistence,
          membershipAuthority,
          capabilityIssuerAuthority: capabilityAuthority,
          capabilityRedemptionAuthority: capabilityAuthority,
          invitationRevocationRegistry,
          invitationRevocationAuthorizationCheck: (descriptor, revoker) => invitationRevocationAuthorizationCheck(descriptor, revoker, membershipAuthority),
          coordinationPersistence,
          activationPersistence,
          envelopePersistence: who.envelopePersistence,
          payloadStorage: who.payloadStorage,
          retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
          encryptionCoordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(seedDir, `${who.participant.publicIdentifier}.enc-coord.log`)),
          creatorIdentityAuthority: who.graph.creatorIdentityAuthority,
          encryptionAuthority: who.graph.encryptionAuthority,
          decryptionAuthority: who.graph.decryptionAuthority,
          accountIndexAuthority: who.graph.accountIndexAuthority,
          nostrAuthorBindingAuthority: who.graph.nostrAuthorBindingAuthority,
          encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
          idGenerator: new FedosSecureRandomConstructionIdGenerator(),
          clock,
          directRatchet: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(registryLog),
            sealingAuthority: who.masterSeedAuthority,
            masterSeedAuthority: who.masterSeedAuthority,
            localDeviceRef,
            sendMailboxNip17Control: sendControl,
            messageDelivery: {
              remoteDeviceRef,
              sendMailboxNip17: async (_envelopeId, _conversationId, plaintext) => {
                capturedMessage = new TextDecoder().decode(plaintext);
                return { outcome: "queued", envelopeId: "envelope-1" };
              },
            },
          },
        });
      }

      const aliceRuntime = buildRuntime(alice, aliceRegistryLog, aliceDeviceRef, bobDeviceRef, async () => ({ outcome: "queued", envelopeId: "unused-control" }));
      const bobRuntime = buildRuntime(bob, bobRegistryLog, bobDeviceRef, aliceDeviceRef, async (_controlId, _conversationId, plaintext) => {
        capturedControl = new TextDecoder().decode(plaintext);
        return { outcome: "queued", envelopeId: "control-1" };
      });

      const created = aliceRuntime.createDirectDraft({ recipient: bob.participant });
      expect(created.outcome).toBe("draft-created");
      if (created.outcome !== "draft-created") return;
      const conversationId = created.draft.id;
      const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
      bobRuntime.redeemInvitation(token, bob.participant);
      await aliceRuntime.activateDirectConversation(conversationId);
      await bobRuntime.activateDirectConversation(conversationId);

      // Bob establishes the session (receiver role).
      const establish = await bobRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, aliceDeviceRef);
      expect(establish.outcome).toBe("initiated");
      expect(capturedControl).not.toBeNull();

      const initRumor: FedosPrivateWireParsedRumor = {
        envelopeId: "init-rumor-1",
        senderPublicKeyHex: bob.participant.publicIdentifier,
        recipientPublicKeyHex: alice.participant.publicIdentifier,
        createdAt: clock(),
        kind: 14,
        tags: [],
        content: capturedControl as unknown as string,
      };
      const initResult = await aliceRuntime.directRatchet()!.importRatchetPrivatePayload(initRumor, null);
      expect(initResult.outcome).toBe("session-established");
      expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");

      // 1. Unsupported suite.
      const decodedInit = decodeFedosDirectRatchetNip17PayloadFromContent(capturedControl as unknown as string);
      if (decodedInit === null || decodedInit.kind !== "session-init") throw new Error("expected session-init");
      const badSuiteContent = new TextDecoder().decode(
        encodeFedosDirectRatchetNip17PayloadToPlaintext({ ...decodedInit, suite: "not-a-real-suite" as never, generation: 1 }),
      );
      const badSuiteRumor: FedosPrivateWireParsedRumor = { ...initRumor, envelopeId: "bad-suite-1", content: badSuiteContent };
      expect(await aliceRuntime.directRatchet()!.importRatchetPrivatePayload(badSuiteRumor, null)).toEqual({ outcome: "unsupported-suite" });

      // 2. Unknown session (a "message" payload naming a sessionId nobody ever established).
      const unknownSessionContent = new TextDecoder().decode(
        encodeFedosDirectRatchetNip17PayloadToPlaintext({
          schemaVersion: 1,
          kind: "message",
          suite: "fedos-direct-ratchet-v1",
          generation: 0,
          sessionId: "direct-ratchet-v1##nostr:0000000000000000##ghost-device##nostr:1111111111111111##other-device##nowhere##fedos-direct-ratchet-v1##0",
          messageNumber: 0,
          wireMessageBase64: Buffer.from(new Uint8Array([1, 2, 3, 4])).toString("base64"),
        }),
      );
      const unknownSessionRumor: FedosPrivateWireParsedRumor = { ...initRumor, envelopeId: "unknown-session-1", content: unknownSessionContent };
      expect(await aliceRuntime.directRatchet()!.importRatchetPrivatePayload(unknownSessionRumor, null)).toEqual({ outcome: "unknown-session" });

      // 3. A real message, then tamper with its ciphertext.
      const sent = await aliceRuntime.sendDirectMessage({ conversationId, body: "real message for tamper test", replyToEnvelopeId: null });
      expect(sent.outcome).toBe("sent-locally");
      expect(capturedMessage).not.toBeNull();

      const decodedMessage = decodeFedosDirectRatchetNip17PayloadFromContent(capturedMessage as unknown as string);
      if (decodedMessage === null || decodedMessage.kind !== "message") throw new Error("expected message payload");

      const rawBytes = Buffer.from(decodedMessage.wireMessageBase64, "base64");
      const tampered = Buffer.from(rawBytes);
      const midpoint = Math.floor(tampered.length / 2);
      tampered[midpoint] = (tampered[midpoint] as number) ^ 0xff;
      const tamperedContent = new TextDecoder().decode(
        encodeFedosDirectRatchetNip17PayloadToPlaintext({ ...decodedMessage, wireMessageBase64: tampered.toString("base64") }),
      );
      const tamperedRumor: FedosPrivateWireParsedRumor = {
        envelopeId: "tampered-message-1",
        senderPublicKeyHex: alice.participant.publicIdentifier,
        recipientPublicKeyHex: bob.participant.publicIdentifier,
        createdAt: clock(),
        kind: 14,
        tags: [],
        content: tamperedContent,
      };
      expect(await bobRuntime.directRatchet()!.importRatchetPrivatePayload(tamperedRumor, null)).toEqual({ outcome: "decrypt-failed" });

      // 4. The GENUINE (untampered) message still decrypts correctly afterward.
      const genuineRumor: FedosPrivateWireParsedRumor = {
        envelopeId: "genuine-message-1",
        senderPublicKeyHex: alice.participant.publicIdentifier,
        recipientPublicKeyHex: bob.participant.publicIdentifier,
        createdAt: clock(),
        kind: 14,
        tags: [],
        content: capturedMessage as unknown as string,
      };
      const genuineResult = await bobRuntime.directRatchet()!.importRatchetPrivatePayload(genuineRumor, null);
      expect(genuineResult.outcome).toBe("imported");
      if (genuineResult.outcome === "imported") {
        const read = await bobRuntime.readDirectMessage({ conversationId, envelopeId: genuineResult.envelopeId });
        expect(read).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("real message for tamper test") });
      }
    });
  });
});

/**
 * Secure Runtime Alpha 7081-7160 — the honest real vertical slice.
 *
 * Alice and Bob are two genuinely independent real production profiles
 * (separate temp roots, separate Master Seeds, separate Draft/Membership/
 * received-invitation persistence — no shared backend of any kind), each
 * driven through the REAL `FedosProfileInitializationCoordinator` →
 * `startFedosDesktopRuntime()` chain, each connected to the SAME real,
 * RFC 6455 local WebSocket relay server fixture Alpha 7001-7080 already
 * built and proved (`test/support/fedos_real_local_websocket_relay_server.ts`).
 *
 * **A newer, deeper, pre-existing production blocker was discovered while
 * building this test** (documented in full in
 * `docs/secure_runtime_alpha_7081_7160_wire_adapter_gap_report.md`): the
 * real `NostrNip17V1WireAdapter` — the ONE component that actually wraps
 * ANY control/message plaintext (Peer Capability advertisements, Direct
 * Ratchet control messages, Identity Transition notifications, Signed
 * Deletion requests, and now Conversation Invitations) into a real NIP-17
 * Gift Wrap for Relay transport — is constructed by
 * `startFedosDesktopRuntime()` ONLY when `productionCryptoGraph !== null`
 * (`src/desktop/runtime/fedos_desktop_runtime.ts`, confirmed by direct
 * source read), which is population EXCLUSIVELY by the legacy,
 * `NODE_ENV`-gated `assembleFedosConversationProductionCryptoGraph()`
 * path — never by the real production Master Seed Authority path this
 * whole Arc, and the two immediately-prior Arcs, otherwise use throughout.
 * Confirmed: neither `fedos_electron_beta_main.cts` (the canonical
 * packaged entry point) nor `FedosProfileInitializationCoordinator` ever
 * sets `conversationProductionCrypto`/`conversationDirectMessageDeliveryRoute`
 * anywhere. **This means `sendMailboxNip17`/`sendMailboxNip17Control`
 * return `"route-unavailable"` for EVERY subsystem, through the REAL
 * packaged/Coordinator-driven production chain, today — not a defect
 * this Arc introduced, and not one this narrow Arc's own mandate
 * authorizes fixing** (building a real, non-dev-gated wire-adapter
 * construction path is a foundational crypto-wiring Arc of its own,
 * comparable in scope to the Direct Ratchet production capability Arc).
 *
 * Given this, this slice proves everything genuinely provable through
 * the REAL two-independent-profile chain — real signing (the REAL
 * production `FedosNostrSigningAuthority`), real verification (real
 * BIP-340 Schnorr), real optimistic Membership bootstrap on BOTH real
 * independent sides, real Draft persistence, real restart-safety — and,
 * for the ONE leg confirmed blocked upstream (relay-transported Gift
 * Wrap delivery), feeds Bob's own REAL inbound coordinator the EXACT
 * real, signed `FedosConversationInvitationAdvertisementV1` Alice's own
 * REAL outbound coordinator produced (never a fabricated or hand-crafted
 * record), the same way `receiveNip17Rumor()` would have called it had
 * the wire adapter delivered it live. This is NOT a fake relay or a fake
 * transport for the INVITATION FEATURE's own logic — every invitation-
 * specific line this Arc wrote runs for real; only the pre-existing,
 * disclosed, out-of-scope wire-adapter construction gap is substituted,
 * and this file's own header says so before a single assertion runs.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosProfileInitializationCoordinator, type FedosProfileInitializationDependencies } from "../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.js";
import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionNostrSigningAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { encodeFedosConversationInvitationControlPayload } from "../src/os/messenger/conversations/invitation_bootstrap/fedos_conversation_invitation_control_payload.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function makeRealProductionCoordinator(dir: string, relayUrl: string, appId: string): Promise<FedosProfileInitializationCoordinator> {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  expect(activation.masterSeedAuthority).toBeInstanceOf(FedosProductionMasterSeedAuthority);
  // Test-local type narrowing only, mirrors Alpha 6841-6920's own
  // established Phase M fix -- never widens a production interface.
  const masterSeedAuthority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const socketFactory = createNodeWebSocketRelaySocketFactory();
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority,
    privateTransportEnabled: true,
    conversationTransportRelays: [new WebSocketRelay(relayUrl, socketFactory)],
    conversationInvitationEnabled: true,
  };
  return new FedosProfileInitializationCoordinator(deps);
}

suite("Alpha 7081-7160 -- real vertical slice: Conversation Invitation between two independent real production profiles", () => {
  it("Alice invites Bob; both reach the identical conversationId with active Membership; a restart preserves everything", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer();
    try {
      const root = mkdtempSync(join(tmpdir(), "fedos-7081-"));
      const aliceDir = mkdtempSync(join(root, "alice-"));
      const bobDir = mkdtempSync(join(root, "bob-"));

      const aliceCoordinator = await makeRealProductionCoordinator(aliceDir, relay.url, "com.fedos.desktop.test.alice-7081");
      const aliceCreated = await aliceCoordinator.createProfile({ displayLabel: "Alice" }, fedosProfileUnlockSecretFromUtf8("alice-passphrase-7081"));
      expect(aliceCreated.outcome).toBe("ok");
      if (aliceCreated.outcome !== "ok") throw new Error("unreachable");
      const alicePublicIdentifier = aliceCreated.value.accountPublicIdentifier;

      const bobCoordinator = await makeRealProductionCoordinator(bobDir, relay.url, "com.fedos.desktop.test.bob-7081");
      const bobCreated = await bobCoordinator.createProfile({ displayLabel: "Bob" }, fedosProfileUnlockSecretFromUtf8("bob-passphrase-7081"));
      expect(bobCreated.outcome).toBe("ok");
      if (bobCreated.outcome !== "ok") throw new Error("unreachable");
      const bobPublicIdentifier = bobCreated.value.accountPublicIdentifier;
      expect(bobPublicIdentifier).not.toBe(alicePublicIdentifier);

      // Real relay connections: both peers' real production Runtimes independently connected.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(relay.connectionCount()).toBeGreaterThanOrEqual(2);

      const aliceRuntime = aliceCoordinator.runningRuntime();
      const bobRuntime = bobCoordinator.runningRuntime();
      expect(aliceRuntime).not.toBeNull();
      expect(bobRuntime).not.toBeNull();

      // 1: Alice creates a brand-new Direct conversation and signs a real invitation
      // (real Membership bootstrap on her own side; real BIP-340 signing; real Draft
      // via reactivateRestoredConversation() -- every line here is this Arc's own real code).
      const aliceInvitationRuntime = aliceRuntime!.conversationRuntime().conversationInvitation();
      expect(aliceInvitationRuntime, "conversationInvitation() must be real and configured").not.toBeNull();
      const sendOutcome = await aliceInvitationRuntime!.createAndSendInvitation({ authority: "nostr", publicIdentifier: bobPublicIdentifier, identityId: null });
      expect(sendOutcome.outcome).toBe("sent");
      if (sendOutcome.outcome !== "sent") throw new Error("unreachable");
      const conversationId = sendOutcome.conversationId;
      // `relayOutcome` is "route-unavailable" and `activated` is `false` --
      // both are the SAME disclosed, pre-existing wire-adapter/legacy-
      // encryption-authority gap this file's own header documents, NOT a
      // failure of this Arc's own invitation/bootstrap logic (proven
      // below: the Draft and both real Memberships already exist).
      expect(sendOutcome.relayOutcome).toBe("route-unavailable");

      // 2: Alice's own local Draft already exists (real, durable, created during the bootstrap above).
      const aliceDraft = aliceRuntime!.conversationRuntime().findConversation(conversationId);
      expect(aliceDraft, "Alice's own local Draft must be real and durable").not.toBeNull();
      expect(aliceDraft!.mode).toBe("direct");

      // 3: deliver the REAL, signed invitation record to Bob's own REAL inbound
      // coordinator directly -- substituting ONLY for the disclosed, blocked
      // relay-transported Gift Wrap leg (see this file's own header). The
      // record itself, its signature, and every line of processing below are
      // exactly what a live relay delivery would have handed to
      // `receiveNip17Rumor()` -- never fabricated.
      const controlPayload = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation: sendOutcome.invitation });
      const bobInvitationRuntime = bobRuntime!.conversationRuntime().conversationInvitation();
      expect(bobInvitationRuntime, "conversationInvitation() must be real and configured for Bob too").not.toBeNull();
      const importOutcome = await bobInvitationRuntime!.importInvitationPayload(new TextDecoder().decode(controlPayload));
      expect(importOutcome.outcome).toBe("accepted");

      // 4: Bob's own local Draft now exists (real, durable, reached via the REAL signed invitation).
      const bobDraft = bobRuntime!.conversationRuntime().findConversation(conversationId);
      expect(bobDraft, "Bob's own local Draft must be real and durable").not.toBeNull();
      expect(bobDraft!.mode).toBe("direct");
      expect(bobDraft!.creator.publicIdentifier).toBe(alicePublicIdentifier);

      // 5: both peers independently hold identical, active Membership for the SAME conversationId --
      // the mission's own "Membership is persisted" requirement, real and restart-safe on both sides.
      const aliceMemberships = aliceRuntime!.conversationRuntime().listMemberships(conversationId);
      const bobMemberships = bobRuntime!.conversationRuntime().listMemberships(conversationId);
      expect(aliceMemberships.filter((m) => m.state === "active")).toHaveLength(2);
      expect(bobMemberships.filter((m) => m.state === "active")).toHaveLength(2);

      // 6: duplicate delivery of the SAME invitation is idempotent (Phase I-style proof) --
      // no second Membership admission attempt, no error, the SAME real dedup key.
      const duplicateImport = await bobInvitationRuntime!.importInvitationPayload(new TextDecoder().decode(controlPayload));
      expect(duplicateImport.outcome).toBe("duplicate");

      // 7: restart Bob -- a fresh Coordinator over the SAME on-disk profile.
      await bobCoordinator.lock();
      const bobRelaunch = await makeRealProductionCoordinator(bobDir, relay.url, "com.fedos.desktop.test.bob-7081");
      const bobUnlocked = await bobRelaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("bob-passphrase-7081"));
      expect(bobUnlocked.outcome).toBe("ok");
      if (bobUnlocked.outcome !== "ok") throw new Error("unreachable");
      expect(bobUnlocked.value.accountPublicIdentifier).toBe(bobPublicIdentifier);

      const bobFreshRuntime = bobRelaunch.runningRuntime();
      expect(bobFreshRuntime).not.toBeNull();
      expect(bobFreshRuntime).not.toBe(bobRuntime);
      const bobFreshDraft = bobFreshRuntime!.conversationRuntime().findConversation(conversationId);
      expect(bobFreshDraft, "restart must preserve Bob's own Draft").not.toBeNull();
      expect(bobFreshDraft!.creator.publicIdentifier).toBe(alicePublicIdentifier);
      const bobFreshMemberships = bobFreshRuntime!.conversationRuntime().listMemberships(conversationId);
      expect(bobFreshMemberships.filter((m) => m.state === "active")).toHaveLength(2);

      // 8: the received-invitation record itself also survived the restart (its own durable log).
      const bobFreshInvitationRuntime = bobFreshRuntime!.conversationRuntime().conversationInvitation();
      const duplicateAfterRestart = await bobFreshInvitationRuntime!.importInvitationPayload(new TextDecoder().decode(controlPayload));
      expect(duplicateAfterRestart.outcome).toBe("duplicate");

      await aliceCoordinator.lock();
      await bobRelaunch.lock();
    } finally {
      await relay.close();
    }
  }, 30000);
});

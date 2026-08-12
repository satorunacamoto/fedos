/**
 * Secure Runtime Alpha 7161-7240 — the real production vertical slice.
 *
 * Closes what Secure Runtime Alpha 7081-7160's own real vertical slice
 * disclosed as blocked: the real `NostrNip17V1WireAdapter` is now
 * genuinely constructed through the real `FedosProfileInitializationCoordinator`
 * → `startFedosDesktopRuntime()` chain (this Arc's own
 * `conversationCanonicalCryptoAuthority` wiring), and a real, live,
 * standard-kind (`1059`, NIP-59) inbound subscription is now genuinely
 * wired too (this Arc's own `conversationTransportInboundEnabled`
 * wiring — a second, previously-undiscovered gap: no Coordinator caller
 * could ever receive a LIVE relay-delivered Rumor before this Arc,
 * regardless of the wire-adapter gap). **No manual test-side substitution
 * of any kind is used anywhere in this file** — every hop below travels
 * through the real local WebSocket relay server
 * (`test/support/fedos_real_local_websocket_relay_server.ts`, reused
 * unmodified), is really Gift-Wrapped/Sealed/Rumor-encoded, and is really
 * received by a live subscription on the other side.
 *
 * Alice and Bob are two genuinely independent real production profiles
 * (separate temp roots, separate Master Seeds), each driven through the
 * REAL `FedosProfileInitializationCoordinator` → `startFedosDesktopRuntime()`
 * chain, each wrapped in a real `FedosDesktopApplicationShell` (the SAME
 * public surface a packaged Electron renderer would call through IPC).
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent. **`NODE_ENV` is never read or set anywhere in
 * this file.**
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
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
import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function waitUntil(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!predicate()) throw new Error(`waitUntil timed out: ${label}`);
}

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
    // Secure Runtime Alpha 7161-7240 -- the three new toggles this Arc
    // adds: a real canonical crypto graph, the real standard NIP-17
    // route, and a real live inbound subscription. Together they close
    // every gap Alpha 7081-7160 disclosed as blocked.
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    // Real, supported config override (not a manual tick shortcut) --
    // tunes the SAME real setInterval-driven Scheduler to a fast, real
    // cadence for this test's own real time budget; production would
    // choose a longer interval for battery/bandwidth reasons.
    conversationTransportIntervalMs: 100,
  };
  return new FedosProfileInitializationCoordinator(deps);
}

suite("Alpha 7161-7240 -- real production vertical slice: invitation, activation, and encrypted messaging over a REAL relay, no substitution", () => {
  it("Alice invites Bob over the real relay; Bob's real live subscription receives it; the conversation activates for real; a real encrypted message and reply are really delivered; both sides restart and the conversation continues", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer();
    try {
      const root = mkdtempSync(join(tmpdir(), "fedos-7161-"));
      const aliceDir = mkdtempSync(join(root, "alice-"));
      const bobDir = mkdtempSync(join(root, "bob-"));

      const aliceCoordinator = await makeRealProductionCoordinator(aliceDir, relay.url, "com.fedos.desktop.test.alice-7161");
      const aliceCreated = await aliceCoordinator.createProfile({ displayLabel: "Alice" }, fedosProfileUnlockSecretFromUtf8("alice-passphrase-7161"));
      expect(aliceCreated.outcome).toBe("ok");
      if (aliceCreated.outcome !== "ok") throw new Error("unreachable");
      const alicePublicIdentifier = aliceCreated.value.accountPublicIdentifier;
      const aliceRef = { authority: "nostr" as const, publicIdentifier: alicePublicIdentifier, identityId: null };

      const bobCoordinator = await makeRealProductionCoordinator(bobDir, relay.url, "com.fedos.desktop.test.bob-7161");
      const bobCreated = await bobCoordinator.createProfile({ displayLabel: "Bob" }, fedosProfileUnlockSecretFromUtf8("bob-passphrase-7161"));
      expect(bobCreated.outcome).toBe("ok");
      if (bobCreated.outcome !== "ok") throw new Error("unreachable");
      const bobPublicIdentifier = bobCreated.value.accountPublicIdentifier;
      const bobRef = { authority: "nostr" as const, publicIdentifier: bobPublicIdentifier, identityId: null };
      expect(bobPublicIdentifier).not.toBe(alicePublicIdentifier);

      await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
      // Real per-client REQ subscribe is a second, asynchronous round trip
      // after the raw WebSocket connect above (EOSE); a short real wait
      // here is standard NIP-01 client discipline, not a substitution of
      // any kind -- mirrors the established connection-settle wait this
      // Arc's own predecessor already used.
      await new Promise((resolve) => setTimeout(resolve, 200));

      const aliceRuntime = aliceCoordinator.runningRuntime();
      const bobRuntime = bobCoordinator.runningRuntime();
      expect(aliceRuntime).not.toBeNull();
      expect(bobRuntime).not.toBeNull();

      // This Arc's own new production wiring, verifiable BEFORE a single
      // conversation exists: identity resolution and the canonical crypto
      // graph are both real, through the real Coordinator/Runtime chain.
      expect(aliceRuntime!.conversationCanonicalCryptoAvailable()).toBe(true);
      expect(bobRuntime!.conversationCanonicalCryptoAvailable()).toBe(true);
      expect(aliceRuntime!.conversationRuntime().resolveLocalParticipant()).toEqual(aliceRef);
      expect(bobRuntime!.conversationRuntime().resolveLocalParticipant()).toEqual(bobRef);

      const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime!);
      const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime!);

      // 1: Alice creates a brand-new Direct conversation and sends a real,
      // signed invitation -- this time genuinely delivered over the real
      // relay (never "route-unavailable").
      const sendResult = await aliceShell.createConversationInvitation(bobRef);
      expect(sendResult.outcome).toBe("ok");
      if (sendResult.outcome !== "ok") throw new Error("unreachable");
      const sendOutcome = sendResult.value;
      expect(sendOutcome.outcome).toBe("sent");
      if (sendOutcome.outcome !== "sent") throw new Error("unreachable");
      const conversationId = sendOutcome.conversationId;
      expect(sendOutcome.relayOutcome).not.toBe("route-unavailable");
      // Requirement: "Encryption Authority selected automatically" -- the
      // real activation attempted inside the outbound coordinator's own
      // bootstrap now genuinely succeeds (no more disclosed "activation-failed").
      expect(sendOutcome.activated).toBe(true);

      // 2: Bob's real, LIVE inbound subscription receives the real
      // Gift-Wrapped invitation over the real relay -- no manual delivery
      // of any kind. This is the mission's own "Bob accepts" step,
      // happening automatically exactly as a real NIP-17 client would.
      await waitUntil(
        () => bobRuntime!.conversationRuntime().findConversation(conversationId) !== null,
        5000,
        "Bob's real live subscription receiving Alice's real invitation",
      );

      // 3: shared Conversation established -- identical conversationId, real Draft on both sides.
      const aliceDraft = aliceRuntime!.conversationRuntime().findConversation(conversationId);
      const bobDraft = bobRuntime!.conversationRuntime().findConversation(conversationId);
      expect(aliceDraft).not.toBeNull();
      expect(bobDraft).not.toBeNull();
      expect(bobDraft!.mode).toBe("direct");
      expect(bobDraft!.creator.publicIdentifier).toBe(alicePublicIdentifier);

      // 4: Identity resolution succeeds + Membership persisted -- both
      // sides independently hold identical, active Membership.
      const aliceMemberships = aliceRuntime!.conversationRuntime().listMemberships(conversationId);
      const bobMemberships = bobRuntime!.conversationRuntime().listMemberships(conversationId);
      expect(aliceMemberships.filter((m) => m.state === "active")).toHaveLength(2);
      expect(bobMemberships.filter((m) => m.state === "active")).toHaveLength(2);

      // 5: Encryption Authority selected automatically + activation
      // genuinely succeeded on Bob's own side too (the SAME real
      // canonical crypto graph, no manual activation call needed).
      const bobActive = bobRuntime!.conversationRuntime().resolveActiveConversation(conversationId);
      expect(bobActive.outcome).toBe("active");
      const aliceActive = aliceRuntime!.conversationRuntime().resolveActiveConversation(conversationId);
      expect(aliceActive.outcome).toBe("active");

      // 6: NIP-17 transport used + first encrypted message delivered --
      // Alice sends; Bob's real live subscription receives it over the
      // real relay (never a manual test-side call).
      const firstSend = await aliceShell.sendMessage(conversationId, aliceRef, "hello bob, this is really encrypted");
      expect(firstSend.outcome).toBe("ok");
      if (firstSend.outcome !== "ok") throw new Error("unreachable");
      // `fanout` is "not-applicable" for every Direct-mode send by
      // design (only Group pairwise fanout ever reports "complete"/
      // "partial") -- real NIP-17 delivery is proven below by Bob's own
      // real live subscription actually receiving the message, not by
      // this field.
      expect(firstSend.value.fanout).toBe("not-applicable");

      await waitUntil(
        () => bobShell.listMessages(conversationId).outcome === "ok" && (bobShell.listMessages(conversationId) as { outcome: "ok"; value: readonly unknown[] }).value.length >= 1,
        5000,
        "Bob's real live subscription receiving Alice's real first message",
      );
      const bobMessages = bobShell.listMessages(conversationId);
      expect(bobMessages.outcome).toBe("ok");
      if (bobMessages.outcome !== "ok") throw new Error("unreachable");
      expect(bobMessages.value).toHaveLength(1);
      const firstMessageId = bobMessages.value[0]!.messageId;
      const firstRead = await bobShell.readMessage(conversationId, firstMessageId);
      expect(firstRead.outcome).toBe("ok");
      if (firstRead.outcome !== "ok") throw new Error("unreachable");
      expect(firstRead.value.plaintext).toEqual({ state: "available", text: "hello bob, this is really encrypted" });

      // 7: reply delivered -- Bob replies; Alice's real live subscription receives it.
      const replySend = await bobShell.reply(conversationId, bobRef, firstMessageId, "hi alice, reply also really encrypted");
      expect(replySend.outcome).toBe("ok");

      await waitUntil(
        () => {
          const r = aliceShell.listMessages(conversationId);
          // Alice's own first message is already locally visible to her
          // immediately -- wait for a SECOND entry (Bob's real reply,
          // really received over the real relay), never just ">= 1".
          return r.outcome === "ok" && r.value.length >= 2;
        },
        5000,
        "Alice's real live subscription receiving Bob's real reply",
      );
      const aliceMessages = aliceShell.listMessages(conversationId);
      expect(aliceMessages.outcome).toBe("ok");
      if (aliceMessages.outcome !== "ok") throw new Error("unreachable");
      expect(aliceMessages.value).toHaveLength(2);
      // Envelope ids are generated LOCALLY per side (Alice's own id for
      // her sent message and Bob's own id for the same message he
      // received are two distinct local ids, by this codebase's own
      // existing, unmodified design -- not a concern this Arc's own
      // identity/crypto/NIP-17-wire scope touches) -- so the reply is
      // identified by its own real, decrypted plaintext, not by any
      // cross-peer id match.
      const aliceReads = await Promise.all(aliceMessages.value.map((m) => aliceShell.readMessage(conversationId, m.messageId)));
      for (const r of aliceReads) expect(r.outcome).toBe("ok");
      const aliceTexts = aliceReads.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));
      expect(aliceTexts).toContainEqual({ state: "available", text: "hello bob, this is really encrypted" });
      expect(aliceTexts).toContainEqual({ state: "available", text: "hi alice, reply also really encrypted" });

      // 8: restart BOTH runtimes -- fresh Coordinators over the SAME on-disk profiles.
      await aliceCoordinator.lock();
      await bobCoordinator.lock();

      const aliceRelaunch = await makeRealProductionCoordinator(aliceDir, relay.url, "com.fedos.desktop.test.alice-7161");
      const aliceUnlocked = await aliceRelaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("alice-passphrase-7161"));
      expect(aliceUnlocked.outcome).toBe("ok");
      if (aliceUnlocked.outcome !== "ok") throw new Error("unreachable");
      expect(aliceUnlocked.value.accountPublicIdentifier).toBe(alicePublicIdentifier);

      const bobRelaunch = await makeRealProductionCoordinator(bobDir, relay.url, "com.fedos.desktop.test.bob-7161");
      const bobUnlocked = await bobRelaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("bob-passphrase-7161"));
      expect(bobUnlocked.outcome).toBe("ok");
      if (bobUnlocked.outcome !== "ok") throw new Error("unreachable");
      expect(bobUnlocked.value.accountPublicIdentifier).toBe(bobPublicIdentifier);

      const aliceFreshRuntime = aliceRelaunch.runningRuntime();
      const bobFreshRuntime = bobRelaunch.runningRuntime();
      expect(aliceFreshRuntime).not.toBeNull();
      expect(bobFreshRuntime).not.toBeNull();

      // Restart safety: Draft/Membership/message history all survive on both sides.
      expect(aliceFreshRuntime!.conversationRuntime().findConversation(conversationId)).not.toBeNull();
      expect(bobFreshRuntime!.conversationRuntime().findConversation(conversationId)).not.toBeNull();
      const aliceFreshMemberships = aliceFreshRuntime!.conversationRuntime().listMemberships(conversationId);
      const bobFreshMemberships = bobFreshRuntime!.conversationRuntime().listMemberships(conversationId);
      expect(aliceFreshMemberships.filter((m) => m.state === "active")).toHaveLength(2);
      expect(bobFreshMemberships.filter((m) => m.state === "active")).toHaveLength(2);

      // Real activation is real per-Runtime-lifetime state, not a
      // persisted fact -- a freshly-restarted Runtime must re-establish
      // it exactly like `FedosConversationReactivationCoordinator.reactivateRestoredConversation()`
      // (Alpha 2041-2120, real and unmodified by this Arc) already exists
      // to do; the Draft/Membership facts it depends on are the ones
      // restart safety actually persists.
      const aliceReactivate = await aliceFreshRuntime!.conversationRuntime().activateDirectConversation(conversationId);
      expect(aliceReactivate.outcome).toBe("activated");
      const bobReactivate = await bobFreshRuntime!.conversationRuntime().activateDirectConversation(conversationId);
      expect(bobReactivate.outcome).toBe("activated");

      const aliceFreshShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceFreshRuntime!);
      const bobFreshShell = FedosDesktopApplicationShell.fromRunningRuntime(bobFreshRuntime!);
      const aliceFreshMessages = aliceFreshShell.listMessages(conversationId);
      const bobFreshMessages = bobFreshShell.listMessages(conversationId);
      expect(aliceFreshMessages.outcome).toBe("ok");
      expect(bobFreshMessages.outcome).toBe("ok");
      if (aliceFreshMessages.outcome !== "ok" || bobFreshMessages.outcome !== "ok") throw new Error("unreachable");
      expect(aliceFreshMessages.value).toHaveLength(2);
      expect(bobFreshMessages.value).toHaveLength(2);

      // 9: conversation continues -- a real, freshly-encrypted message after restart, really delivered.
      await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections re-established after restart");
      const postRestartSend = await aliceFreshShell.sendMessage(conversationId, aliceRef, "still really working after restart");
      expect(postRestartSend.outcome).toBe("ok");

      await waitUntil(
        () => {
          const r = bobFreshShell.listMessages(conversationId);
          return r.outcome === "ok" && r.value.length >= 3;
        },
        5000,
        "Bob's real live subscription receiving Alice's post-restart message",
      );
      const bobFinalMessages = bobFreshShell.listMessages(conversationId);
      expect(bobFinalMessages.outcome).toBe("ok");
      if (bobFinalMessages.outcome !== "ok") throw new Error("unreachable");
      expect(bobFinalMessages.value).toHaveLength(3);
      const bobFinalReads = await Promise.all(bobFinalMessages.value.map((m) => bobFreshShell.readMessage(conversationId, m.messageId)));
      for (const r of bobFinalReads) expect(r.outcome).toBe("ok");
      const bobFinalTexts = bobFinalReads.map((r) => (r.outcome === "ok" ? r.value.plaintext : null));
      expect(bobFinalTexts).toContainEqual({ state: "available", text: "hello bob, this is really encrypted" });
      expect(bobFinalTexts).toContainEqual({ state: "available", text: "hi alice, reply also really encrypted" });
      expect(bobFinalTexts).toContainEqual({ state: "available", text: "still really working after restart" });

      await aliceRelaunch.lock();
      await bobRelaunch.lock();
    } finally {
      await relay.close();
    }
  }, 30000);
});

/**
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — Phase A / regression: this file
 * ORIGINALLY (Stage 1, before any production edit) froze a fresh,
 * independent, live reproduction of the same-peer inbound misrouting
 * defect disclosed by Secure Runtime Alpha 7241-7320
 * (`test/secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts`,
 * test 2, unmodified) — see
 * `docs/secure_runtime_alpha_7401_7480_defect_reproduction_report.md` for
 * that original finding's own full write-up, preserved as this Arc's own
 * historical record. Once Stage 2 implemented the fix (the route-binding
 * resolver, `src/conversation/delivery/nostr/fedos_direct_conversation_route_binding_resolver.ts`),
 * this SAME test's own assertions were updated (this comment included) to
 * assert the CORRECTED behavior going forward — it is now a permanent
 * regression test, not merely a historical artifact, exercising the exact
 * scenario that used to silently misroute.
 *
 * EXACT SOURCE PATH THE ORIGINAL DEFECT LIVED AT (quoted verbatim,
 * preserved for history):
 *
 *   `src/conversation/delivery/nostr/fedos_private_nostr_inbound_conversation_resolver.ts`,
 *   `resolveFedosPrivateNostrInboundDirectConversation()` — resolved an
 *   inbound Rumor's target Conversation SOLELY from the sender's Nostr
 *   pubkey, the FIRST active `direct` draft matching that pubkey, no
 *   cross-check against anything the message itself carried. This
 *   function is UNCHANGED by this Arc's own fix — it is retained,
 *   unmodified, and reused ONLY for the bounded Legacy Policy fallback
 *   (see the Legacy and Migration Policy doc); it is no longer the
 *   PRIMARY resolution path for any message that carries this Arc's own
 *   route binding.
 *
 * THE FIX proven live below: `FedosNip17InboundImportCoordinator.receiveRumor()`
 * now decodes this Arc's own `FedosDirectConversationPlainMessagePayloadV1`
 * route binding from `rumor.content` and resolves the EXACT target
 * Conversation directly via `resolveFedosDirectConversationByRouteBinding()`
 * — never a peer-only guess. A message sent to conversation B now arrives
 * in conversation B, and conversation A remains untouched.
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

async function makeRealParty(dir: string, relayUrl: string, appId: string, label: string, passphrase: string) {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
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
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationTransportIntervalMs: 80,
  };
  const coordinator = new FedosProfileInitializationCoordinator(deps);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8(passphrase));
  expect(created.outcome).toBe("ok");
  if (created.outcome !== "ok") throw new Error("unreachable");
  return { coordinator, publicIdentifier: created.value.accountPublicIdentifier };
}

suite("Alpha 7401-7480 -- Phase A: fresh, independent reproduction of same-peer inbound NIP-17 misrouting", () => {
  it(
    "a message genuinely sent to the SECOND, later-created Direct conversation with a peer now arrives there, and ONLY there -- REGRESSION test for the same-peer silent-misrouting defect this Arc's own route binding closes",
    async () => {
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const root = mkdtempSync(join(tmpdir(), "fedos-7401-phase-a-"));
        const aliceDir = mkdtempSync(join(root, "alice-"));
        const bobDir = mkdtempSync(join(root, "bob-"));
        const alicePass = "alice-phase-a-repro-passphrase-7401";
        const bobPass = "bob-phase-a-repro-passphrase-7401";

        const alice = await makeRealParty(aliceDir, relay.url, "com.fedos.desktop.test.alice-7401-phase-a", "Alice", alicePass);
        const bob = await makeRealParty(bobDir, relay.url, "com.fedos.desktop.test.bob-7401-phase-a", "Bob", bobPass);
        await waitUntil(() => relay.connectionCount() >= 2, 2000, "both real relay connections established");
        await new Promise((resolve) => setTimeout(resolve, 200));

        const aliceRef = { authority: "nostr" as const, publicIdentifier: alice.publicIdentifier, identityId: null };
        const bobRef = { authority: "nostr" as const, publicIdentifier: bob.publicIdentifier, identityId: null };

        const aliceRuntime = alice.coordinator.runningRuntime()!;
        const bobRuntime = bob.coordinator.runningRuntime()!;
        const aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(aliceRuntime);
        const bobShell = FedosDesktopApplicationShell.fromRunningRuntime(bobRuntime);

        // Two independent, real, concurrently-active Direct conversations
        // with the SAME peer -- the system does not itself prevent this.
        const inviteA = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteA.outcome).toBe("ok");
        if (inviteA.outcome !== "ok") throw new Error("unreachable");
        expect(inviteA.value.outcome).toBe("sent");
        if (inviteA.value.outcome !== "sent") throw new Error("unreachable");
        const conversationA = inviteA.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationA) !== null, 5000, "Bob receiving conversation A's invitation");

        const inviteB = await aliceShell.createConversationInvitation(bobRef);
        expect(inviteB.outcome).toBe("ok");
        if (inviteB.outcome !== "ok") throw new Error("unreachable");
        expect(inviteB.value.outcome).toBe("sent");
        if (inviteB.value.outcome !== "sent") throw new Error("unreachable");
        const conversationB = inviteB.value.conversationId;
        await waitUntil(() => bobRuntime.conversationRuntime().findConversation(conversationB) !== null, 5000, "Bob receiving conversation B's invitation");
        expect(conversationA).not.toBe(conversationB);

        // Alice sends a real message specifically INTO conversation B (the
        // second, later-created one).
        const sent = await aliceShell.sendMessage(conversationB, aliceRef, "route-binding-repro-message-for-B-only");
        expect(sent.outcome).toBe("ok");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const bobListB = bobShell.listMessages(conversationB);
        expect(bobListB.outcome).toBe("ok");
        if (bobListB.outcome !== "ok") throw new Error("unreachable");
        expect(bobListB.value, "FIXED: a message genuinely addressed to conversation B now arrives there via resolveFedosDirectConversationByRouteBinding()").toHaveLength(1);
        const readB = await bobShell.readMessage(conversationB, bobListB.value[0]!.messageId);
        expect(readB.outcome).toBe("ok");
        if (readB.outcome !== "ok") throw new Error("unreachable");
        expect(readB.value.plaintext).toEqual({ state: "available", text: "route-binding-repro-message-for-B-only" });

        const bobListA = bobShell.listMessages(conversationA);
        expect(bobListA.outcome).toBe("ok");
        if (bobListA.outcome !== "ok") throw new Error("unreachable");
        expect(
          bobListA.value,
          "FIXED: conversation A (the FIRST, earlier-created conversation with the same peer) must remain completely untouched by a message actually addressed to B -- no more first-match misrouting",
        ).toHaveLength(0);

        await alice.coordinator.lock();
        await bob.coordinator.lock();
      } finally {
        await relay.close();
      }
    },
    30000,
  );
});

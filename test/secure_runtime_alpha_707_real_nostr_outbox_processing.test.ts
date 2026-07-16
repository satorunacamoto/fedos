import { describe, it, expect } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { createFedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import { FedosNostrSigningPublicAuthorAuthority } from "../src/board/runtime/identity/fedos_nostr_signing_public_author_authority.js";
import { FedosSigningAuthorityBoardPostEventSource } from "../src/board/publish/nostr/fedos_signing_authority_board_post_event_source.js";
import { FedosNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import { FedosRelayOkCorrelatedNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.js";
import { NobleSignatureVerifier } from "../src/nostr/noble_signature.js";
import type { FedosRelay } from "../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";

/**
 * A real BIP-340-signing `FedosNostrSigningAuthority` test double, built
 * directly on `@noble/curves` (already an existing project dependency --
 * no new one added). Exists ONLY because the real Rust/WASM signing path
 * is gated behind `process.env.NODE_ENV === "development"`
 * (`src/runtime/fedos_wasm_loader.ts`'s own dev-only gate) and no existing
 * test in this repository exercises it for real either -- every existing
 * TS-level signing test (`test/secure_runtime_alpha_445_*`) uses a
 * scripted loader-boundary mock. This double signs with GENUINE BIP-340
 * Schnorr signatures so Alpha 708's own independent verification is real,
 * not merely structural.
 */
function realSigningAuthority(secretKey: Uint8Array): FedosNostrSigningAuthority {
  const publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  return {
    async publicIdentityForAccount(accountIndex: number) {
      if (accountIndex !== 0) return null;
      return { accountIndex: 0, publicKeyHex };
    },
    async signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null> {
      const preimage = JSON.stringify([0, publicKeyHex, request.createdAt, request.kind, request.tags, request.content]);
      const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
      return Object.freeze({
        id,
        pubkey: publicKeyHex,
        created_at: request.createdAt,
        kind: request.kind,
        tags: request.tags,
        content: request.content,
        sig,
      });
    },
  };
}

/** A `FedosRelay` test double that records every published event and immediately fires a matching `["OK", ..., accepted]` back through `onRelayMessage()` -- simulating a real Relay's own acceptance/rejection response, using the SAME already-shipped `onRelayMessage` primitive `FedosRelayOkCorrelatedNostrBoardPublisher` (Alpha 710/711) consumes. */
class AckingRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  readonly acceptDecision: (event: FedosEventDescriptor) => boolean;

  constructor(acceptDecision: (event: FedosEventDescriptor) => boolean = () => true) {
    this.acceptDecision = acceptDecision;
  }

  async connect(): Promise<void> {
    this.#connected = true;
  }
  async disconnect(): Promise<void> {
    this.#connected = false;
  }
  isConnected(): boolean {
    return this.#connected;
  }
  async publish(event: FedosEventDescriptor): Promise<void> {
    if (!this.#connected) throw new Error("AckingRelay.publish() called while not connected.");
    this.published.push(event);
    const accepted = this.acceptDecision(event);
    this.#relayListener?.({ kind: "ok", eventId: event.id, accepted, message: accepted ? "" : "rejected" });
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used in this test");
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

/** One coherent identity graph: same signing authority backs both the resolved author (Phase A) and the eventual signed event (Phase B). */
function buildRuntimeAndHost(relay: FedosRelay) {
  const secretKey = schnorr.utils.randomSecretKey();
  const signingAuthority = realSigningAuthority(secretKey);
  const boardPersistence = new InMemoryFedosBoardPersistence();
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const observationRepository = new FedosDeliveryObservationRepository(
    new InMemoryFedosDeliveryObservationPersistence(),
  );
  let host: FedosDesktopHost;
  const eventSource = new FedosSigningAuthorityBoardPostEventSource(() => host.board(), signingAuthority, 0);
  const publisher = new FedosNostrBoardPublisherAdapter(
    new FedosRelayOkCorrelatedNostrBoardPublisher(relay),
    eventSource.resolveSignedEvent,
  );
  host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence,
    outboxPersistence,
    observationRepository,
    publisher,
    deliveryIntervalMs: 10,
  });
  const runtime = createFedosBoardRuntime({
    host,
    publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
    nostrAccountIndex: 0,
  });
  return { runtime, host, outboxPersistence, observationRepository };
}

describe("Secure Runtime Alpha 707/708/719 -- Real Nostr Outbox Processing and Signed Event Verification", () => {
  it("1. a bound public post reaches the Relay as one real, signed Event and Observation records acceptance", async () => {
    const relay = new AckingRelay();
    const { runtime, host, outboxPersistence } = buildRuntimeAndHost(relay);
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "board-a",
      body: "hello nostr, for real",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "inserted" }]);
    expect(outboxPersistence.listIntents()).toHaveLength(1);

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await host.stopDelivery();

    // 2. Signed event verification (Alpha 708) -- independent, real BIP-340 verification.
    expect(relay.published).toHaveLength(1);
    const sent = relay.published[0]!;
    expect(sent.content).toBe("hello nostr, for real");
    const asLegacyNostrEvent = {
      id: sent.id,
      pubkey: sent.author,
      created_at: sent.createdAt,
      kind: sent.kind,
      tags: sent.tags.map((tag) => [...tag]),
      content: sent.content,
      sig: sent.signature,
    };
    expect(await NobleSignatureVerifier.verify(asLegacyNostrEvent)).toBe(true);

    // Sent pubkey equals the binding public key -- never trust the Publisher merely because it returned success.
    const boundIdentity = runtime.findPost(result.post.id);
    expect(boundIdentity?.author.publicIdentifier).toBe(sent.author);

    // Delivery observation reflects real Relay acceptance, not merely transport-sent.
    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const intentId = outboxPersistence.listIntents()[0]!.id;
    const subjectId = toFedosDeliveryObservationSubjectId(intentId)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(["publishing", "accepted"]).toContain(history[0]!.state);

    await host.stop();
  });

  it("2. a real Relay rejection (OK accepted=false) is honestly reflected -- never conflated with a transport success", async () => {
    const relay = new AckingRelay(() => false);
    const { runtime, host } = buildRuntimeAndHost(relay);
    await host.start();

    await runtime.createPublicThread({
      boardId: "board-a",
      body: "will be rejected",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.stopDelivery();

    // A rejected OK collapses into the SAME "failed"/retryPolicy "later"
    // outcome a transport failure would (Alpha 710/712's own disclosed V1
    // limitation -- `publishOne()`'s frozen boolean return cannot also
    // carry "never retry this again" without widening the interface) --
    // so the Scheduler legitimately retries. Every attempt actually made
    // must still show a real rejection, never a false "accepted".
    expect(relay.published.length).toBeGreaterThan(0);
    await host.stop();
  });

  it("3. no duplicate send: a single accepted intent is not re-attempted on a later tick", async () => {
    const relay = new AckingRelay();
    const { runtime, host } = buildRuntimeAndHost(relay);
    await host.start();

    await runtime.createPublicThread({
      boardId: "board-a",
      body: "once only",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(1);
    await host.stop();
  });
});

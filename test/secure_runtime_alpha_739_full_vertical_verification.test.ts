import { describe, it, expect } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/os/messenger/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import { FedosNostrSigningPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/fedos_nostr_signing_public_author_authority.js";
import { FedosSigningAuthorityBoardPostEventSource } from "../src/os/messenger/board/publish/nostr/fedos_signing_authority_board_post_event_source.js";
import { FedosOutcomeAwareNostrBoardPublisherAdapter } from "../src/os/messenger/board/publish/nostr/fedos_outcome_aware_nostr_board_publisher_adapter.js";
import { FedosRelayOkCorrelatedNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";

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

type RelayMode = "accept" | "reject" | "silent";

class ConfigurableRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  readonly mode: RelayMode;

  constructor(mode: RelayMode) {
    this.mode = mode;
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
    if (!this.#connected) throw new Error("not connected");
    this.published.push(event);
    if (this.mode === "silent") return; // never ACKs -- times out
    this.#relayListener?.({ kind: "ok", eventId: event.id, accepted: this.mode === "accept", message: "" });
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used");
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

function buildRuntime(relay: ConfigurableRelay, timeoutMs = 40) {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const observationRepository = new FedosDeliveryObservationRepository(
    new InMemoryFedosDeliveryObservationPersistence(),
  );
  const secretKey = schnorr.utils.randomSecretKey();
  const signingAuthority = realSigningAuthority(secretKey);
  let host: FedosDesktopHost;
  const eventSource = new FedosSigningAuthorityBoardPostEventSource(() => host.board(), signingAuthority, 0);
  const publisher = new FedosOutcomeAwareNostrBoardPublisherAdapter(
    new FedosRelayOkCorrelatedNostrBoardPublisher(relay, timeoutMs),
    eventSource.resolveSignedEvent,
  );
  host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
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
  return { host, runtime, outboxPersistence, observationRepository };
}

/**
 * Secure Runtime Alpha 739 ("Full Vertical Verification") -- Stage 19 of
 * the Alpha 721–740 Arc. Three independent runtimes, three real paths,
 * running concurrently, with no cross-contamination.
 */
describe("Secure Runtime Alpha 739 -- Full Vertical Verification", () => {
  it("A/B/C: accepted, rejected, and transient-failure runtimes run concurrently with no cross-contamination", async () => {
    const relayA = new ConfigurableRelay("accept");
    const relayB = new ConfigurableRelay("reject");
    const relayC = new ConfigurableRelay("silent");

    const a = buildRuntime(relayA);
    const b = buildRuntime(relayB);
    const c = buildRuntime(relayC);

    await a.host.start();
    await b.host.start();
    await c.host.start();

    await a.runtime.createPublicThread({
      boardId: "b",
      body: "path A: accepted",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    await b.runtime.createPublicThread({
      boardId: "b",
      body: "path B: rejected",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    await c.runtime.createPublicThread({
      boardId: "b",
      body: "path C: transient failure",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    a.host.startDelivery();
    b.host.startDelivery();
    c.host.startDelivery();

    await new Promise((resolve) => setTimeout(resolve, 200));

    await a.host.stopDelivery();
    await b.host.stopDelivery();
    await c.host.stopDelivery();

    // Path A: accepted, delivered exactly once.
    expect(relayA.published).toHaveLength(1);
    expect(relayA.published[0]!.content).toBe("path A: accepted");
    const historyA = new FedosDeliveryRetryQuery(a.host.observationQuery()!).historyFor(
      toFedosDeliveryObservationSubjectId(a.outboxPersistence.listIntents()[0]!.id)!,
    );
    expect(historyA[0]!.state).toBe("accepted");

    // Path B: rejected exactly once, never retried despite ~20 ticks.
    expect(relayB.published).toHaveLength(1);
    expect(relayB.published[0]!.content).toBe("path B: rejected");
    const historyB = new FedosDeliveryRetryQuery(b.host.observationQuery()!).historyFor(
      toFedosDeliveryObservationSubjectId(b.outboxPersistence.listIntents()[0]!.id)!,
    );
    expect(historyB).toHaveLength(1);
    expect(historyB[0]!.state).toBe("rejected");

    // Path C: transient failure, retried multiple times (timeout every attempt).
    expect(relayC.published.length).toBeGreaterThan(1);
    const historyC = new FedosDeliveryRetryQuery(c.host.observationQuery()!).historyFor(
      toFedosDeliveryObservationSubjectId(c.outboxPersistence.listIntents()[0]!.id)!,
    );
    for (const attempt of historyC) {
      expect(attempt.state).not.toBe("accepted");
      expect(attempt.state).not.toBe("rejected");
    }

    // No cross-contamination: each Relay only ever saw its OWN runtime's content.
    expect(relayA.published.every((e) => e.content === "path A: accepted")).toBe(true);
    expect(relayB.published.every((e) => e.content === "path B: rejected")).toBe(true);
    expect(relayC.published.every((e) => e.content === "path C: transient failure")).toBe(true);

    await a.host.stop();
    await b.host.stop();
    await c.host.stop();
  });
});

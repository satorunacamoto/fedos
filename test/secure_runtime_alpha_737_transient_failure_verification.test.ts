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
import { FedosOutcomeAwareNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_outcome_aware_nostr_board_publisher_adapter.js";
import { FedosRelayOkCorrelatedNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.js";
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

/** A `FedosRelay` double that never fires an OK, throws on publish, or refuses connections -- per test configuration. */
class SilentOrThrowingRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected: boolean;
  readonly published: FedosEventDescriptor[] = [];
  #throwOnPublish: boolean;

  constructor(options: { connected?: boolean; throwOnPublish?: boolean } = {}) {
    this.#connected = options.connected ?? true;
    this.#throwOnPublish = options.throwOnPublish ?? false;
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
    if (this.#throwOnPublish) throw new Error("simulated socket send failure");
    if (!this.#connected) throw new Error("not connected");
    this.published.push(event);
    // Deliberately never fires onRelayMessage -- simulates a Relay that never ACKs.
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used");
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(_listener: FedosRelayMessageListener): void {
    // Registered but deliberately never invoked by this double.
  }
}

function buildHostAndRuntime(
  relay: FedosRelay,
  signingAuthority: FedosNostrSigningAuthority,
  timeoutMs?: number,
) {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const observationRepository = new FedosDeliveryObservationRepository(
    new InMemoryFedosDeliveryObservationPersistence(),
  );
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
 * Secure Runtime Alpha 737 ("Transient Failure Verification") -- Stage 17
 * of the Alpha 721–740 Arc. Every case here must produce a `"failed"`
 * Observation (never `"rejected"`), remain subject to the existing,
 * unchanged retry/abandonment policy, and leave no listener/timer leak.
 */
describe("Secure Runtime Alpha 737 -- Transient Failure Verification", () => {
  it("1. timeout: no matching OK ever arrives -> failed, retryable, not permanently rejected", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new SilentOrThrowingRelay();
    const { host, runtime, outboxPersistence, observationRepository } = buildHostAndRuntime(relay, signingAuthority, 30);
    await host.start();

    await runtime.createPublicThread({
      boardId: "b",
      body: "will time out",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await host.stopDelivery();

    // Sent at least once (transport succeeded), retried because the
    // timeout each time resolves "failed", never "rejected".
    expect(relay.published.length).toBeGreaterThan(0);

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const intentId = outboxPersistence.listIntents()[0]!.id;
    const subjectId = toFedosDeliveryObservationSubjectId(intentId)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history.length).toBeGreaterThan(0);
    for (const attempt of history) {
      expect(attempt.state).not.toBe("rejected");
    }
    await host.stop();
  });

  it("2. disconnect: the Relay is not connected -> publish throws -> failed, retryable", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new SilentOrThrowingRelay({ connected: false });
    const { host, runtime } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();

    await runtime.createPublicThread({
      boardId: "b",
      body: "disconnected relay",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(0); // never actually sent
    await host.stop();
  });

  it("3. socket send throw: publish() itself throws -> failed, retryable, no crash", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new SilentOrThrowingRelay({ throwOnPublish: true });
    const { host, runtime } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "b",
      body: "socket throws",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("created");

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(0);
    await host.stop();
  });

  it("4. signer unavailable: the author itself cannot resolve -> command fails closed, no Outbox intent, no Relay call", async () => {
    const unavailableSigningAuthority: FedosNostrSigningAuthority = {
      async signEvent() {
        return null;
      },
      async publicIdentityForAccount() {
        return null;
      },
    };
    const relay = new SilentOrThrowingRelay();
    const { host, runtime, outboxPersistence } = buildHostAndRuntime(relay, unavailableSigningAuthority);
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "b",
      body: "no signer",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("unavailable");
    expect(outboxPersistence.listIntents()).toHaveLength(0);
    await host.stop();
  });

  it("5. malformed event mapping: signEvent() itself returns null (e.g. malformed request) -> failed, retryable, no crash", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
    const signerThatFailsToSign: FedosNostrSigningAuthority = {
      async publicIdentityForAccount(accountIndex: number) {
        if (accountIndex !== 0) return null;
        return { accountIndex: 0, publicKeyHex };
      },
      async signEvent() {
        return null; // simulates a malformed request the signer itself rejects
      },
    };
    const relay = new SilentOrThrowingRelay();
    const { host, runtime, outboxPersistence } = buildHostAndRuntime(relay, signerThatFailsToSign);
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "b",
      body: "signer refuses to sign",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(outboxPersistence.listIntents()).toHaveLength(1);

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(0); // never even reached the Relay
    await host.stop();
  });
});

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

/** A `FedosRelay` test double that records every published event and fires a scripted `["OK", ...]` back through `onRelayMessage()`. */
class ScriptedAckRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  readonly accepted: boolean;

  constructor(accepted: boolean) {
    this.accepted = accepted;
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
    this.#relayListener?.({
      kind: "ok",
      eventId: event.id,
      accepted: this.accepted,
      message: this.accepted ? "" : "rejected: untrusted content policy violation",
    });
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

function buildHost(
  relay: FedosRelay,
  signingAuthority: FedosNostrSigningAuthority,
  outboxPersistence: InMemoryFedosBoardOutboxPersistence,
  observationRepository: FedosDeliveryObservationRepository,
): FedosDesktopHost {
  let host: FedosDesktopHost;
  const eventSource = new FedosSigningAuthorityBoardPostEventSource(() => host.board(), signingAuthority, 0);
  const publisher = new FedosOutcomeAwareNostrBoardPublisherAdapter(
    new FedosRelayOkCorrelatedNostrBoardPublisher(relay),
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
  return host;
}

function buildHostAndRuntime(relay: FedosRelay, signingAuthority: FedosNostrSigningAuthority) {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const observationRepository = new FedosDeliveryObservationRepository(
    new InMemoryFedosDeliveryObservationPersistence(),
  );
  const host = buildHost(relay, signingAuthority, outboxPersistence, observationRepository);
  const runtime = createFedosBoardRuntime({
    host,
    publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
    nostrAccountIndex: 0,
  });
  return { host, runtime, outboxPersistence, observationRepository };
}

/**
 * Secure Runtime Alpha 735 ("Acceptance Verification") / Alpha 736
 * ("Permanent Rejection Verification", the Arc's own headline acceptance
 * criterion) -- Stages 15–16 of the Alpha 721–740 Arc, both using
 * `FedosOutcomeAwareNostrBoardPublisherAdapter` (Alpha 723), the fix this
 * Arc adds.
 */
describe("Secure Runtime Alpha 735 -- Acceptance Verification", () => {
  it("1-7. real signed Event, matching OK accepted=true, canonical accepted result, accepted Observation, restart, no resend", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new ScriptedAckRelay(true);
    const { host, runtime, outboxPersistence, observationRepository } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "b",
      body: "accepted for real",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "inserted" }]);

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(1);
    expect(relay.published[0]!.content).toBe("accepted for real");

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const intentId = outboxPersistence.listIntents()[0]!.id;
    const subjectId = toFedosDeliveryObservationSubjectId(intentId)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(history[0]!.state).toBe("accepted");

    await host.stop();

    // restart: the SAME durable Outbox (in-memory here, standing in for
    // the append-only restart already proven for real in
    // test/secure_runtime_alpha_709_restart_delivery_verification.test.ts)
    // must not re-attempt an already-delivered intent.
    const relay2 = new ScriptedAckRelay(true);
    const host2 = buildHost(relay2, signingAuthority, outboxPersistence, observationRepository);
    await host2.start();
    host2.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await host2.stopDelivery();
    expect(relay2.published).toHaveLength(0);
    await host2.stop();
  });
});

describe("Secure Runtime Alpha 736 -- Permanent Rejection Verification (headline)", () => {
  it("1-7. real signed Event, matching OK accepted=false, canonical rejected result, rejected Observation, multiple ticks, restart, Publisher never called again", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new ScriptedAckRelay(false);
    const { host, runtime, outboxPersistence, observationRepository } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "b",
      body: "will be permanently rejected",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("created");

    // 5. run multiple Scheduler ticks -- a 10ms interval over 150ms is
    // roughly a dozen ticks; the Publisher must be called EXACTLY ONCE,
    // never re-attempted, because "rejected" carries retryPolicy "never".
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(1); // exactly one attempt, never retried

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const intentId = outboxPersistence.listIntents()[0]!.id;
    const subjectId = toFedosDeliveryObservationSubjectId(intentId)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(history[0]!.state).toBe("rejected"); // terminal, not "failed"

    await host.stop();

    // 6-7. restart runtime; verify Publisher is NOT called again -- the
    // already-rejected (terminal) intent must never be re-attempted.
    const relay2 = new ScriptedAckRelay(true); // even if it WOULD now accept, it must never be asked
    const host2 = buildHost(relay2, signingAuthority, outboxPersistence, observationRepository);
    await host2.start();
    host2.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await host2.stopDelivery();
    expect(relay2.published).toHaveLength(0); // never resent
    await host2.stop();
  });

  it("2. no arbitrary Relay rejection text is ever persisted -- Observation carries no `reason` for a rejected outcome", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new ScriptedAckRelay(false);
    const { host, runtime, observationRepository } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();

    await runtime.createPublicThread({
      boardId: "b",
      body: "rejected, reason must not leak",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await host.stopDelivery();

    const allObservations = observationRepository.list();
    for (const observation of allObservations) {
      expect(JSON.stringify(observation)).not.toMatch(/untrusted content policy violation/);
    }
    await host.stop();
  });
});

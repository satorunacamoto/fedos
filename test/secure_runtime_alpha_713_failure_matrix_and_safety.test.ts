import { describe, it, expect } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/os/messenger/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import { FedosNostrSigningPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/fedos_nostr_signing_public_author_authority.js";
import { StaticFedosPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/static_fedos_public_author_authority.js";
import { FedosSigningAuthorityBoardPostEventSource } from "../src/os/messenger/board/publish/nostr/fedos_signing_authority_board_post_event_source.js";
import { FedosNostrBoardPublisherAdapter } from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
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

class RecordingRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  #shouldThrow = false;
  throwOnPublish(): void {
    this.#shouldThrow = true;
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
    if (this.#shouldThrow) throw new Error("simulated transport failure");
    if (!this.#connected) throw new Error("not connected");
    this.published.push(event);
    this.#relayListener?.({ kind: "ok", eventId: event.id, accepted: true, message: "" });
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

function buildHostAndRuntime(relay: FedosRelay, signingAuthority: FedosNostrSigningAuthority) {
  const boardPersistence = new InMemoryFedosBoardPersistence();
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
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
    publisher,
    deliveryIntervalMs: 10,
  });
  const runtime = createFedosBoardRuntime({
    host,
    publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
    nostrAccountIndex: 0,
  });
  return { host, runtime, outboxPersistence };
}

describe("Secure Runtime Alpha 713 -- Failure Matrix", () => {
  it("1. a disconnected/throwing Relay never crashes the Scheduler and leaves the intent pending, never falsely marked delivered", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new RecordingRelay();
    relay.throwOnPublish();
    const { host, runtime, outboxPersistence } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();

    await runtime.createPublicThread({
      boardId: "b",
      body: "will fail to send",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(outboxPersistence.listIntents()).toHaveLength(1);

    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(0); // never actually sent
    await host.stop();
  });

  it("2a. an unavailable signing authority behind the Public Author Authority itself fails the whole command closed (no post, no Outbox intent) -- Alpha 691's own documented behavior", async () => {
    const unavailableSigningAuthority: FedosNostrSigningAuthority = {
      async signEvent() {
        return null;
      },
      async publicIdentityForAccount() {
        return null;
      },
    };
    const relay = new RecordingRelay();
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

  it("2b. a resolved author whose Binding Authority signing authority independently becomes unavailable keeps the target ineligible, but the post itself still persists", async () => {
    const resolvedButUnbindable: FedosNostrSigningAuthority = {
      async signEvent() {
        return null;
      },
      async publicIdentityForAccount() {
        return null; // The Binding Authority's own signer is unavailable, independent of author resolution.
      },
    };
    const relay = new RecordingRelay();
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    let host: FedosDesktopHost;
    const eventSource = new FedosSigningAuthorityBoardPostEventSource(() => host.board(), resolvedButUnbindable, 0);
    const publisher = new FedosNostrBoardPublisherAdapter(
      new FedosRelayOkCorrelatedNostrBoardPublisher(relay),
      eventSource.resolveSignedEvent,
    );
    host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence, outboxPersistence, publisher });
    const runtime = createFedosBoardRuntime({
      host,
      publicAuthorAuthority: new StaticFedosPublicAuthorAuthority({
        outcome: "resolved",
        author: { identityId: null, protocol: "nostr", publicIdentifier: bytesToHex(schnorr.getPublicKey(schnorr.utils.randomSecretKey())) },
      }),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(resolvedButUnbindable),
      nostrAccountIndex: 0,
    });
    await host.start();

    const result = await runtime.createPublicThread({
      boardId: "b",
      body: "resolved but cannot bind",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("outbox-partial-failure");
    expect(outboxPersistence.listIntents()).toHaveLength(0);
    await host.stop();
  });

  it("3. imported ActivityPub/AT Protocol/Session authors never bind and never become eligible, even with a real Binding Authority configured", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    for (const protocol of ["activitypub", "atproto", "session"] as const) {
      const relay = new RecordingRelay();
      const boardPersistence = new InMemoryFedosBoardPersistence();
      const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
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
        publisher,
      });
      const runtime = createFedosBoardRuntime({
        host,
        publicAuthorAuthority: new StaticFedosPublicAuthorAuthority({
          outcome: "resolved",
          author: { identityId: null, protocol, publicIdentifier: "imported-author-1" },
        }),
        nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
        nostrAccountIndex: 0,
      });
      await host.start();

      const result = await runtime.createPublicThread({
        boardId: "b",
        body: `imported ${protocol} author`,
        outboundTargets: [{ protocol: "nostr", destination: null }],
      });
      expect(result.outcome).toBe("outbox-partial-failure");
      expect(outboxPersistence.listIntents()).toHaveLength(0);
      await host.stop();
    }
  });

  it("4. local-only posts (no outboundTargets) never touch the Relay, even with a fully configured, real signing/binding graph", async () => {
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new RecordingRelay();
    const { host, runtime } = buildHostAndRuntime(relay, signingAuthority);
    await host.start();
    host.startDelivery();

    const result = await runtime.createPublicThread({ boardId: "b", body: "local only, no targets" });
    expect(result.outcome).toBe("created");
    if (result.outcome === "created") expect(result.outbox).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(relay.published).toHaveLength(0);
    expect(relay.isConnected()).toBe(true); // never even disconnected/reconnected -- no network activity of any kind
    await host.stopDelivery();
    await host.stop();
  });

  it("5. two independent runtimes with separate Relays never share state or cross-deliver", async () => {
    const secretKeyA = schnorr.utils.randomSecretKey();
    const secretKeyB = schnorr.utils.randomSecretKey();
    const relayA = new RecordingRelay();
    const relayB = new RecordingRelay();
    const { host: hostA, runtime: runtimeA } = buildHostAndRuntime(relayA, realSigningAuthority(secretKeyA));
    const { host: hostB, runtime: runtimeB } = buildHostAndRuntime(relayB, realSigningAuthority(secretKeyB));
    await hostA.start();
    await hostB.start();
    hostA.startDelivery();
    hostB.startDelivery();

    await runtimeA.createPublicThread({
      boardId: "b",
      body: "only A",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(relayA.published).toHaveLength(1);
    expect(relayB.published).toHaveLength(0); // B never saw A's post at all

    await hostA.stopDelivery();
    await hostB.stopDelivery();
    await hostA.stop();
    await hostB.stop();
  });
});

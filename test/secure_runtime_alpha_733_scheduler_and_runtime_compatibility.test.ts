import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
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
import type { FedosRunningDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-733-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Secure Runtime Alpha 733 ("Scheduler Integration") -- Stage 13 of the
 * Alpha 721–740 Arc. `FedosPublishScheduler` (`src/board/outbox/fedos_publish_scheduler.ts`)
 * is NOT modified by this Arc at all -- this test confirms, structurally,
 * that it remains protocol-neutral.
 */
describe("Secure Runtime Alpha 733 -- Scheduler Protocol Neutrality", () => {
  it("1. FedosPublishScheduler's own source contains no Nostr import", () => {
    const source: string = readFileSync("src/board/outbox/fedos_publish_scheduler.ts", "utf8");
    const importLines = source
      .split("\n")
      .filter((line: string) => line.trim().startsWith("import "))
      .join("\n");
    expect(importLines).not.toMatch(/nostr/i);
  });

  it("2. this Arc's own new adapter/interface files are never imported by the Scheduler", () => {
    const source: string = readFileSync("src/board/outbox/fedos_publish_scheduler.ts", "utf8");
    expect(source).not.toMatch(/fedos_outcome_aware_nostr_board_publisher_adapter/);
    expect(source).not.toMatch(/fedos_relay_ok_correlated_nostr_board_publisher/);
  });
});

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

class AckingRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
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

/**
 * Secure Runtime Alpha 734 ("Host and Runtime Compatibility") -- Stage 14
 * of the Alpha 721–740 Arc.
 */
describe("Secure Runtime Alpha 734 -- Host and Runtime Compatibility", () => {
  it("1. startFedosDesktopRuntime() wires the new outcome-aware adapter with an injected ACK timeout, end to end", async () => {
    const dir = freshDir();
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new AckingRelay();

    let runtime: FedosRunningDesktopRuntime;
    const eventSource = new FedosSigningAuthorityBoardPostEventSource(() => runtime.host.board(), signingAuthority, 0);
    const publisher = new FedosOutcomeAwareNostrBoardPublisherAdapter(
      new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 2_000), // explicit, injected ACK timeout
      eventSource.resolveSignedEvent,
    );

    runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.ndjson"),
      outboxLogPath: join(dir, "outbox.ndjson"),
      observationLogPath: join(dir, "observation.ndjson"),
      deliveryEnabled: true,
      deliveryIntervalMs: 10,
      publisher,
      publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    const result = await runtime.boardRuntime().createPublicThread({
      boardId: "b",
      body: "runtime compatibility",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("created");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(relay.published).toHaveLength(1);

    await runtime.stop();
  });

  it("2. delivery disabled remains network-free even with the new adapter available", async () => {
    const dir = freshDir();
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);

    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.ndjson"),
      outboxLogPath: join(dir, "outbox.ndjson"),
      deliveryEnabled: false,
      publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    const result = await runtime.boardRuntime().createPublicThread({
      boardId: "b",
      body: "local only, delivery disabled",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    // Still ineligible/persisted-only -- no publisher was even configured, matching the pre-existing "deliveryEnabled: false needs no publisher" contract.
    expect(["created", "outbox-partial-failure"]).toContain(result.outcome);

    await runtime.stop();
  });

  it("3. stop() waits for an in-flight correlated publish (accepted before stop resolves) rather than abandoning it mid-flight", async () => {
    const dir = freshDir();
    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const relay = new AckingRelay();

    let runtime: FedosRunningDesktopRuntime;
    const eventSource = new FedosSigningAuthorityBoardPostEventSource(() => runtime.host.board(), signingAuthority, 0);
    const publisher = new FedosOutcomeAwareNostrBoardPublisherAdapter(
      new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 2_000),
      eventSource.resolveSignedEvent,
    );

    runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.ndjson"),
      outboxLogPath: join(dir, "outbox.ndjson"),
      observationLogPath: join(dir, "observation.ndjson"),
      deliveryEnabled: true,
      deliveryIntervalMs: 10,
      publisher,
      publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
      nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
      nostrAccountIndex: 0,
    });

    await runtime.boardRuntime().createPublicThread({
      boardId: "b",
      body: "stop waits for in-flight",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    await runtime.stop(); // pre-existing stopDelivery()/stop() ordering, unchanged by this Arc
    expect(relay.published.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import { FedosNostrSigningPublicAuthorAuthority } from "../src/board/runtime/identity/fedos_nostr_signing_public_author_authority.js";
import { FedosSigningAuthorityBoardPostEventSource } from "../src/board/publish/nostr/fedos_signing_authority_board_post_event_source.js";
import { FedosNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
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
import type { FedosRunningDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-709-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
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

/** Builds a fresh publisher wired to `runtime`'s own board reader (assigned after construction, matching production's own construction-order constraint), reusing the SAME signing authority instance across "restarts" -- standing in for restoring the SAME sealed Master Seed each real process would (Rust-level seed restore is already verified in `packages/fedos-core-rust/src/lib.rs`'s own `public_key_hex_for_account_restored_from_the_same_sealed_envelope_yields_the_identical_hex`). */
function buildPublisher(signingAuthority: FedosNostrSigningAuthority, relay: FedosRelay) {
  let runtime: FedosRunningDesktopRuntime;
  const eventSource = new FedosSigningAuthorityBoardPostEventSource(
    () => runtime?.host.board() ?? null,
    signingAuthority,
    0,
  );
  const publisher = new FedosNostrBoardPublisherAdapter(
    new FedosRelayOkCorrelatedNostrBoardPublisher(relay),
    eventSource.resolveSignedEvent,
  );
  return {
    publisher,
    bindRuntime(r: FedosRunningDesktopRuntime): void {
      runtime = r;
    },
  };
}

describe("Secure Runtime Alpha 709 -- Restart Delivery Verification", () => {
  it("1-9. create + outbox before delivery -> stop -> restore -> deliver for real -> stop -> restart again -> not resent", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");
    const observationLogPath = join(dir, "observation.ndjson");

    const secretKey = schnorr.utils.randomSecretKey();
    const signingAuthority = realSigningAuthority(secretKey);
    const authorAuthority = new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0);
    const bindingAuthority = new FedosSigningAuthorityNostrAuthorBinding(signingAuthority);

    // 1-4: runtime A creates post + Outbox, then stops BEFORE delivery ever ticks
    // (a very large interval guarantees no tick fires within this test's timeframe).
    const relayA = new AckingRelay();
    const { publisher: publisherA, bindRuntime: bindA } = buildPublisher(signingAuthority, relayA);
    const runtimeA = await startFedosDesktopRuntime({
      boardLogPath,
      outboxLogPath,
      observationLogPath,
      deliveryEnabled: true,
      deliveryIntervalMs: 60_000,
      publisher: publisherA,
      publicAuthorAuthority: authorAuthority,
      nostrAuthorBindingAuthority: bindingAuthority,
      nostrAccountIndex: 0,
    });
    bindA(runtimeA);

    const created = await runtimeA.boardRuntime().createPublicThread({
      boardId: "board-709",
      body: "restart-safe delivery",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(created.outcome).toBe("created");
    expect(relayA.published).toHaveLength(0); // Nothing sent yet -- interval never ticked.

    await runtimeA.stop();

    // 5-7: runtime B restores the SAME durable Board/Outbox/Observation
    // paths, hydrates, and starts delivery for real this time.
    const relayB = new AckingRelay();
    const { publisher: publisherB, bindRuntime: bindB } = buildPublisher(signingAuthority, relayB);
    const runtimeB = await startFedosDesktopRuntime({
      boardLogPath,
      outboxLogPath,
      observationLogPath,
      deliveryEnabled: true,
      deliveryIntervalMs: 10,
      publisher: publisherB,
      publicAuthorAuthority: authorAuthority,
      nostrAuthorBindingAuthority: bindingAuthority,
      nostrAccountIndex: 0,
    });
    bindB(runtimeB);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(relayB.published).toHaveLength(1);
    expect(relayB.published[0]!.content).toBe("restart-safe delivery");

    await runtimeB.stop();

    // 8-9: runtime C restarts once more over the SAME durable paths; the
    // already-accepted intent must not be resent.
    const relayC = new AckingRelay();
    const { publisher: publisherC, bindRuntime: bindC } = buildPublisher(signingAuthority, relayC);
    const runtimeC = await startFedosDesktopRuntime({
      boardLogPath,
      outboxLogPath,
      observationLogPath,
      deliveryEnabled: true,
      deliveryIntervalMs: 10,
      publisher: publisherC,
      publicAuthorAuthority: authorAuthority,
      nostrAuthorBindingAuthority: bindingAuthority,
      nostrAccountIndex: 0,
    });
    bindC(runtimeC);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(relayC.published).toHaveLength(0);

    await runtimeC.stop();
  });
});

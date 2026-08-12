import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";

class ManualRelay implements FedosRelay {
  readonly url = "wss://fake.test";
  #connected = false;
  async connect(): Promise<void> {
    this.#connected = true;
  }
  async disconnect(): Promise<void> {
    this.#connected = false;
  }
  isConnected(): boolean {
    return this.#connected;
  }
  async publish(_event: FedosEventDescriptor): Promise<void> {}
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    return { id: "sub-1" };
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(_listener: FedosRelayMessageListener): void {}
}

function fakeSigningAuthority(): FedosNostrSigningAuthority {
  return {
    async signEvent() {
      return null;
    },
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: "a".repeat(64) };
    },
  };
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-runtime-transport-"));
}

describe("Secure Runtime Alpha 1471-1540 -- Runtime Wiring", () => {
  it("1. privateTransportEnabled omitted -- privateTransport() throws 'not enabled', regression: board/conversation runtimes unaffected", async () => {
    const dir = makeTempDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        boardLogPath: join(dir, "board.ndjson"),
        outboxLogPath: join(dir, "outbox.ndjson"),
        deliveryEnabled: false,
      });
      try {
        expect(() => runtime.privateTransport()).toThrow(/not enabled/);
        expect(runtime.boardRuntime()).toBeDefined();
        expect(runtime.conversationRuntime()).toBeDefined();
      } finally {
        await runtime.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. privateTransportEnabled true without conversationTransportObservationLogPath throws synchronously, before any construction", async () => {
    const dir = makeTempDir();
    try {
      await expect(
        startFedosDesktopRuntime({
          boardLogPath: join(dir, "board.ndjson"),
          outboxLogPath: join(dir, "outbox.ndjson"),
          deliveryEnabled: false,
          privateTransportEnabled: true,
          conversationTransportRelays: [new ManualRelay()],
          conversationTransportSigningAuthority: fakeSigningAuthority(),
        }),
      ).rejects.toThrow(/conversationTransportObservationLogPath/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. privateTransportEnabled true without conversationTransportRelays throws synchronously", async () => {
    const dir = makeTempDir();
    try {
      await expect(
        startFedosDesktopRuntime({
          boardLogPath: join(dir, "board.ndjson"),
          outboxLogPath: join(dir, "outbox.ndjson"),
          deliveryEnabled: false,
          privateTransportEnabled: true,
          conversationTransportObservationLogPath: join(dir, "transport-observation.ndjson"),
          conversationTransportSigningAuthority: fakeSigningAuthority(),
        }),
      ).rejects.toThrow(/conversationTransportRelays/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. privateTransportEnabled true without conversationTransportSigningAuthority throws synchronously", async () => {
    const dir = makeTempDir();
    try {
      await expect(
        startFedosDesktopRuntime({
          boardLogPath: join(dir, "board.ndjson"),
          outboxLogPath: join(dir, "outbox.ndjson"),
          deliveryEnabled: false,
          privateTransportEnabled: true,
          conversationTransportObservationLogPath: join(dir, "transport-observation.ndjson"),
          conversationTransportRelays: [new ManualRelay()],
        }),
      ).rejects.toThrow(/conversationTransportSigningAuthority/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("5. privateTransportEnabled true with every required field constructs and starts a real FedosPrivateTransport, accessible via privateTransport(), inaccessible after stop()", async () => {
    const dir = makeTempDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        boardLogPath: join(dir, "board.ndjson"),
        outboxLogPath: join(dir, "outbox.ndjson"),
        deliveryEnabled: false,
        privateTransportEnabled: true,
        conversationTransportObservationLogPath: join(dir, "transport-observation.ndjson"),
        conversationTransportRelays: [new ManualRelay()],
        conversationTransportSigningAuthority: fakeSigningAuthority(),
      });
      const transport = runtime.privateTransport();
      expect(transport.isRunning()).toBe(true);

      await runtime.stop();
      expect(() => runtime.privateTransport()).toThrow(/inaccessible after stop/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

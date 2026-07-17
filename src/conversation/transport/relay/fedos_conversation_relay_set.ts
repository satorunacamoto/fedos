/**
 * Secure Runtime Alpha 1471–1540 — Multiple Relay fan-out.
 *
 * `FedosConversationRelaySet` composes N already-constructed `FedosRelay`
 * instances (`../../../desktop/fedos_relay.ts`, Alpha 212–238, UNCHANGED
 * — no Relay Pool, no reconnect policy, no new Relay implementation is
 * added anywhere in this arc). It never constructs a `FedosRelay` itself
 * — every relay is injected, mirroring every other "inject the
 * transport, never construct it inline" boundary already established in
 * this repository (`FedosRelayOkCorrelatedNostrBoardPublisher`, Alpha
 * 711, takes one `FedosRelay`; this class takes N of the identical
 * shape).
 *
 * No Onion, no Tor, no reconnect/backoff policy of any kind — a relay
 * that fails to connect simply reports `false` for that one relay;
 * `connectAll()` never throws for a single relay's own connection
 * failure.
 */

import type { FedosRelay } from "../../../desktop/fedos_relay.js";

export interface FedosConversationRelaySetConnectionOutcome {
  readonly url: string;
  readonly connected: boolean;
}

export class FedosConversationRelaySet {
  readonly #relays: readonly FedosRelay[];

  constructor(relays: readonly FedosRelay[]) {
    if (relays.length === 0) {
      throw new Error("FedosConversationRelaySet requires at least one relay.");
    }
    this.#relays = [...relays];
  }

  get relays(): readonly FedosRelay[] {
    return this.#relays;
  }

  /** Connects every relay independently — one relay's rejection never prevents another from connecting. */
  async connectAll(): Promise<readonly FedosConversationRelaySetConnectionOutcome[]> {
    return Promise.all(
      this.#relays.map(async (relay) => {
        try {
          await relay.connect();
          return { url: relay.url, connected: relay.isConnected() };
        } catch {
          return { url: relay.url, connected: false };
        }
      }),
    );
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      this.#relays.map(async (relay) => {
        try {
          await relay.disconnect();
        } catch {
          // Best-effort — a relay that fails to close cleanly never blocks the others.
        }
      }),
    );
  }

  connectedCount(): number {
    return this.#relays.filter((relay) => relay.isConnected()).length;
  }
}

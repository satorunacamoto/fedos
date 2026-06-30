/**
 * Stage 5 — read-only WebSocket relay adapter (NIP-01 subscription).
 *
 * Implements `RelayAdapter.query` over a single short-lived subscription:
 *   send ["REQ", subId, ...filters] -> collect ["EVENT", subId, event] ->
 *   resolve on ["EOSE", subId] (or on timeout, with whatever arrived) ->
 *   send ["CLOSE", subId] and close the socket.
 *
 * This adapter NEVER publishes events. It is read-only.
 *
 * The socket is obtained from an injected `WebSocketFactory`, so it works both
 * in Cloudflare Workers (where outbound sockets come from `fetch(..., { Upgrade
 * })` + `accept()`) and under a mock in tests — no `new WebSocket()` assumption.
 * The factory must return a socket that is already open and safe to `send` on.
 */

import type { NostrEvent } from "./types.js";
import type { NostrFilter, RelayAdapter } from "./relay.js";
import {
  isEoseMessage,
  isEventMessage,
  isNoticeMessage,
  parseRelayMessage,
} from "./messages.js";

/** The socket event types this adapter listens for. */
export type RelaySocketEventType = "message" | "open" | "close" | "error";

/** Minimal event shape; only `message` carries `data`. */
export interface RelaySocketEvent {
  readonly data?: unknown;
}

/** The minimal socket surface the adapter needs (a subset of WebSocket). */
export interface RelaySocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: RelaySocketEventType,
    listener: (event: RelaySocketEvent) => void,
  ): void;
}

/** Produces a ready-to-use socket for a relay URL (may be async). */
export type WebSocketFactory = (
  url: string,
) => RelaySocketLike | Promise<RelaySocketLike>;

export interface WebSocketRelayOptions {
  readonly factory: WebSocketFactory;
  /** Max time to wait for EOSE before resolving with partial results. */
  readonly timeoutMs?: number;
  /** Called for each NOTICE message received. */
  readonly onNotice?: (message: string) => void;
  /** Prefix for generated subscription ids. */
  readonly subIdPrefix?: string;
}

const DEFAULT_TIMEOUT_MS = 4000;

export class WebSocketRelayAdapter implements RelayAdapter {
  readonly url: string;
  readonly #factory: WebSocketFactory;
  readonly #timeoutMs: number;
  readonly #onNotice: ((message: string) => void) | undefined;
  readonly #subIdPrefix: string;
  #counter = 0;
  #lastNotices: string[] = [];

  constructor(url: string, options: WebSocketRelayOptions) {
    this.url = url;
    this.#factory = options.factory;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#onNotice = options.onNotice;
    this.#subIdPrefix = options.subIdPrefix ?? "fedos-";
  }

  /** NOTICE messages from the most recent `query` call. */
  get lastNotices(): readonly string[] {
    return this.#lastNotices;
  }

  async query(filters: NostrFilter[]): Promise<NostrEvent[]> {
    const subscriptionId = `${this.#subIdPrefix}${++this.#counter}`;
    const socket = await this.#factory(this.url);
    const events: NostrEvent[] = [];
    this.#lastNotices = [];

    return await new Promise<NostrEvent[]>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        try {
          socket.send(JSON.stringify(["CLOSE", subscriptionId]));
        } catch {
          /* socket already gone — nothing to clean up */
        }
        try {
          socket.close();
        } catch {
          /* ignore close errors */
        }
        resolve(events);
      };

      socket.addEventListener("message", (event) => {
        if (settled) return;
        const data = event.data;
        const raw = typeof data === "string" ? data : String(data ?? "");
        const message = parseRelayMessage(raw);

        if (isEventMessage(message)) {
          if (message.subscriptionId === subscriptionId) events.push(message.event);
        } else if (isEoseMessage(message)) {
          if (message.subscriptionId === subscriptionId) finish();
        } else if (isNoticeMessage(message)) {
          this.#lastNotices.push(message.message);
          this.#onNotice?.(message.message);
        }
        // unknown / invalid messages are ignored.
      });
      socket.addEventListener("error", () => finish());
      socket.addEventListener("close", () => finish());

      timer = setTimeout(finish, this.#timeoutMs);

      try {
        socket.send(JSON.stringify(["REQ", subscriptionId, ...filters]));
      } catch (err) {
        this.#onNotice?.(`REQ send failed: ${String(err)}`);
        finish();
      }
    });
  }
}

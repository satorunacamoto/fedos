/**
 * MeshKV signaling channel.
 *
 * In a full mesh, peers exchange connection offers/answers over an out-of-band
 * signaling channel before any WebRTC link is formed. THIS PACKAGE SHIPS A
 * BOUNDARY ONLY: constructing a channel opens NOTHING — no WebSocket, no HTTP,
 * no network. A connection is established only by the explicit `open()` call.
 */

export interface SignalingChannelOptions {
  /** Where a real signaling server would live. Unused until `open()`. */
  readonly url?: string;
}

export class SignalingChannel {
  readonly #url: string | undefined;
  #open = false;

  constructor(options: SignalingChannelOptions = {}) {
    this.#url = options.url;
    // Deliberately establishes no connection here — see open().
  }

  get isOpen(): boolean {
    return this.#open;
  }

  get url(): string | undefined {
    return this.#url;
  }

  /** Explicitly opens the channel. A real impl would connect here — not before. */
  async open(): Promise<void> {
    this.#open = true;
  }

  async close(): Promise<void> {
    this.#open = false;
  }
}

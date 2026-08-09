/**
 * Stage 12 — relay PUBLISH boundary (NIP-01 EVENT + NIP-20 OK).
 *
 * This is the write-path counterpart to the read-only `WebSocketRelayAdapter`.
 * It is deliberately a SEPARATE interface and class: the read-only adapter is
 * never taught to publish. A `RelayPublisher` takes an already-signed event and
 * sends ["EVENT", event] to a relay, then waits for the relay's NIP-20
 * ["OK", id, accepted, message] acknowledgement.
 *
 * Scope guardrails (Stage 12): nothing here signs, generates, or stores a key,
 * and nothing here is wired into the UI or Worker. Publishing is a boundary that
 * exists to be tested and composed, not an auto-executed action. Callers are
 * expected to run `validateBeforePublish` (and any policy check) first.
 */

import type { SignedNostrEvent } from "../os/_legacy_prototype/sign/types.js";
import { isSignedEventLike } from "../os/_legacy_prototype/sign/validate.js";
import type { SignatureVerifier } from "./signature.js";
import type { RelaySocketLike, WebSocketFactory } from "./ws_relay.js";

/** The outcome of attempting to publish one event to one relay. */
export interface PublishResult {
  /** The event id the relay acknowledged (or that we tried to publish). */
  readonly eventId: string;
  /** Relay's verdict: did it accept the event? */
  readonly accepted: boolean;
  /** Human-readable reason/message from the relay (may be empty). */
  readonly message: string;
  /** Which relay produced this result, when known. */
  readonly relayUrl?: string;
}

/**
 * Abstract write-path. Implemented by `WebSocketRelayPublisher` (real relays)
 * and `MockRelayPublisher` (tests). Never throws for relay-side problems — it
 * resolves a `PublishResult` with `accepted: false` instead.
 */
export interface RelayPublisher {
  publish(event: SignedNostrEvent): Promise<PublishResult>;
}

/**
 * Parses a relay->client NIP-20 message ["OK", eventId, accepted, message].
 * Pure and total: malformed JSON, wrong label, or wrong field types all yield
 * `null` rather than throwing. A missing message defaults to "".
 */
export function parseOkMessage(raw: string): PublishResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed[0] !== "OK") return null;

  const eventId = parsed[1];
  const accepted = parsed[2];
  if (typeof eventId !== "string") return null;
  if (typeof accepted !== "boolean") return null;

  const message = typeof parsed[3] === "string" ? parsed[3] : "";
  return { eventId, accepted, message };
}

/**
 * Decision returned by `validateBeforePublish`: either an `ok` signed event that
 * passed both structural and signature checks, or a denial with a reason. This
 * never publishes — it only gates what is safe to hand to a `RelayPublisher`.
 */
export type PublishDecision =
  | { readonly ok: true; readonly event: SignedNostrEvent }
  | { readonly ok: false; readonly reason: string };

/**
 * Pre-publish safety gate. Confirms `event` is structurally a signed NIP-01
 * event (well-formed id/pubkey/sig) AND that the signature actually verifies via
 * the injected `SignatureVerifier` (e.g. `NobleSignatureVerifier`). Returns a
 * denial instead of throwing. It does NOT publish.
 */
export async function validateBeforePublish(
  event: unknown,
  verifier: SignatureVerifier,
): Promise<PublishDecision> {
  if (!isSignedEventLike(event)) {
    return { ok: false, reason: "event is not a structurally valid signed event" };
  }
  const verified = await verifier.verify(event);
  if (!verified) {
    return { ok: false, reason: "signature verification failed" };
  }
  return { ok: true, event };
}

export interface MockRelayPublisherOptions {
  /** Verdict every publish should report. Defaults to `true`. */
  readonly accepted?: boolean;
  /** Message every publish should report. Defaults to "". */
  readonly message?: string;
  /** Relay url echoed back on the result, if any. */
  readonly relayUrl?: string;
}

/**
 * In-memory `RelayPublisher` for tests and local prototypes. It performs NO
 * network I/O: it records every event in `published` and returns a configurable
 * verdict. Useful for a publish UI prototype that must never reach a real relay.
 */
export class MockRelayPublisher implements RelayPublisher {
  /** Every event handed to `publish`, in order. */
  readonly published: SignedNostrEvent[] = [];
  readonly #accepted: boolean;
  readonly #message: string;
  readonly #relayUrl: string | undefined;

  constructor(options: MockRelayPublisherOptions = {}) {
    this.#accepted = options.accepted ?? true;
    this.#message = options.message ?? "";
    this.#relayUrl = options.relayUrl;
  }

  publish(event: SignedNostrEvent): Promise<PublishResult> {
    this.published.push(event);
    const result: PublishResult = {
      eventId: event.id,
      accepted: this.#accepted,
      message: this.#message,
      ...(this.#relayUrl !== undefined ? { relayUrl: this.#relayUrl } : {}),
    };
    return Promise.resolve(result);
  }
}

export interface WebSocketRelayPublisherOptions {
  readonly factory: WebSocketFactory;
  /** Max time to wait for an OK before resolving as not-accepted. */
  readonly timeoutMs?: number;
  /** Called for NOTICE-style diagnostics (e.g. a failed send). */
  readonly onNotice?: (message: string) => void;
}

const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Real write-path over a single short-lived WebSocket. Distinct from the
 * read-only `WebSocketRelayAdapter`: it sends ["EVENT", signedEvent], waits for
 * the matching ["OK", id, accepted, message], then closes the socket.
 *
 * The socket comes from an injected `WebSocketFactory` (same contract as the
 * read adapter), so it is testable and Worker-compatible with no `new
 * WebSocket()` assumption. Relay errors never crash the caller: socket error,
 * early close, send failure, and timeout all resolve a `accepted: false`
 * `PublishResult`.
 */
export class WebSocketRelayPublisher implements RelayPublisher {
  readonly url: string;
  readonly #factory: WebSocketFactory;
  readonly #timeoutMs: number;
  readonly #onNotice: ((message: string) => void) | undefined;

  constructor(url: string, options: WebSocketRelayPublisherOptions) {
    this.url = url;
    this.#factory = options.factory;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#onNotice = options.onNotice;
  }

  async publish(event: SignedNostrEvent): Promise<PublishResult> {
    const socket: RelaySocketLike = await this.#factory(this.url);

    return await new Promise<PublishResult>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (result: PublishResult): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        try {
          socket.close();
        } catch {
          /* socket already gone — nothing to clean up */
        }
        resolve(result);
      };

      const fail = (message: string): void =>
        finish({ eventId: event.id, accepted: false, message, relayUrl: this.url });

      socket.addEventListener("message", (ev) => {
        if (settled) return;
        const data = ev.data;
        const raw = typeof data === "string" ? data : String(data ?? "");
        const ok = parseOkMessage(raw);
        // Only the OK for *our* event ends the publish; ignore everything else.
        if (ok !== null && ok.eventId === event.id) {
          finish({ ...ok, relayUrl: this.url });
        }
      });
      socket.addEventListener("error", () => fail("relay socket error"));
      socket.addEventListener("close", () => fail("relay closed before OK"));

      timer = setTimeout(() => fail("timed out waiting for OK"), this.#timeoutMs);

      try {
        socket.send(JSON.stringify(["EVENT", event]));
      } catch (err) {
        this.#onNotice?.(`EVENT send failed: ${String(err)}`);
        fail(`EVENT send failed: ${String(err)}`);
      }
    });
  }
}

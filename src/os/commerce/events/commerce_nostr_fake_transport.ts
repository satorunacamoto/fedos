/**
 * FedOS Commerce End-to-End Completion, Wave B (Agent N) — deterministic,
 * fully in-memory `CommerceNostrEventTransport` for tests. Zero network
 * code, zero relay contact of any kind, real or mocked-at-the-socket-level
 * — this is a plain object implementing the transport interface.
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as the rest of `src/os/commerce`
 * (see `../README.md`).
 *
 * Every test file in this wave (`test/commerce_nostr_event_drafts.test.ts`,
 * `test/commerce_nostr_event_port.test.ts`,
 * `test/commerce_nostr_fake_transport.test.ts`) uses this transport instead
 * of any real Nostr adapter — see `../catalog/adapters/nostr/`'s own header
 * comments for why real event construction/signing is confined to that one
 * reserved directory and not exercised by this wave's own test files.
 */

import type {
  CommerceNostrEventTransport,
  CommerceNostrTransportSendResult,
} from "./commerce_nostr_event_port.js";
import { canonicalizeCommerceNostrEventDraft } from "./commerce_nostr_event_port.js";
import type { CommerceNostrEventDraft } from "./commerce_nostr_event_drafts.js";

/**
 * Deterministic, dependency-free, non-cryptographic 32-bit FNV-1a hash of a
 * string, rendered as 8 lowercase hex characters. Used ONLY to synthesize a
 * stable, content-derived fake event id for this test double — never used
 * anywhere as a real Nostr event id (real event ids are a sha256 of the
 * NIP-01 canonical serialization, computed by `../../messenger/adapters/nostr/protocol/event.ts`,
 * which this file never touches).
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit, then hex-pad to 8 chars.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface InMemoryFakeCommerceNostrTransportOptions {
  /** Verdict every `send()` should report, unless overridden per-call via
   * `rejectNextSend()`. Defaults to `true`. */
  readonly accepted?: boolean;
  /** Message every `send()` should report. Defaults to `""`. */
  readonly message?: string;
}

/**
 * In-memory `CommerceNostrEventTransport` for tests and local prototypes.
 * Performs NO I/O of any kind. Records every draft handed to `send()` (in
 * order, INCLUDING drafts a `CommerceNostrEventPort` would have already
 * deduplicated away before ever reaching this transport) in `sent`, and
 * derives a stable fake event id from the draft's own canonical content —
 * so calling `send()` twice with structurally identical drafts (bypassing
 * the Port's own dedup guard, e.g. by constructing two transports, or by
 * calling the transport directly as these tests do) yields the SAME fake
 * id both times, mirroring how a real relay would assign the same id to
 * the same canonical NIP-01 serialization.
 */
export class InMemoryFakeCommerceNostrTransport implements CommerceNostrEventTransport {
  /** Every draft handed to `send()`, in call order — unlike
   * `CommerceNostrEventPortImpl.publishedCount`, this is NOT deduplicated;
   * it is a raw call log for tests to assert against. */
  readonly sent: CommerceNostrEventDraft[] = [];

  #accepted: boolean;
  #message: string;
  #forcedRejectionForNextSend: string | undefined;

  constructor(options: InMemoryFakeCommerceNostrTransportOptions = {}) {
    this.#accepted = options.accepted ?? true;
    this.#message = options.message ?? "";
  }

  /** Makes the NEXT `send()` call only report `accepted: false` with the
   * given message, then reverts to the constructor-configured default.
   * Useful for testing a Port's `"transport-error"` path without changing
   * the transport's steady-state behavior. */
  rejectNextSend(message: string): void {
    this.#forcedRejectionForNextSend = message;
  }

  send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult> {
    this.sent.push(draft);
    const contentKey = canonicalizeCommerceNostrEventDraft(draft);
    const eventId = `fake-${fnv1aHex(contentKey)}`;

    if (this.#forcedRejectionForNextSend !== undefined) {
      const message = this.#forcedRejectionForNextSend;
      this.#forcedRejectionForNextSend = undefined;
      return Promise.resolve({ accepted: false, eventId: "", message });
    }

    return Promise.resolve({
      accepted: this.#accepted,
      eventId: this.#accepted ? eventId : "",
      message: this.#message,
    });
  }
}

/**
 * Secure Runtime Alpha 1471–1540 — Relay Deduplication.
 *
 * The SAME logical event can legitimately arrive once per relay in a
 * `FedosConversationRelaySet` (Multiple Relay fan-out means an Inbound
 * Subscription is open on every relay simultaneously) — this class is the
 * ONE gate that ensures a caller's own envelope callback fires exactly
 * once per genuinely-new NIP-01 event id, no matter how many relays
 * deliver it.
 *
 * Bounded, FIFO-evicted `Set<string>` — never grows unboundedly across a
 * long-lived subscription. Keyed by the Nostr event's own deterministic
 * `id` (never a Relay-issued token, never a subscription id) — the SAME
 * "keyed by the event's own deterministic id" idiom
 * `FedosRelayOkCorrelatedNostrBoardPublisher`
 * (`../../../board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts`,
 * Alpha 711) already uses for outbound OK correlation, applied here to
 * inbound receipt.
 *
 * HARD GUARDRAILS:
 *   - `shouldProcess(eventId)` is the ONLY mutating method — a single
 *     atomic "seen it? mark it." check; no separate `mark()` step exists
 *     for a caller to forget to call.
 *   - No persistence, no network, no cross-process state — dedup is
 *     entirely in-memory, scoped to one running `FedosPrivateTransport`.
 */

const DEFAULT_MAX_SEEN_EVENT_IDS = 4096;

export class FedosRelayEventDeduplicator {
  readonly #maxSize: number;
  readonly #seen = new Set<string>();

  constructor(maxSize: number = DEFAULT_MAX_SEEN_EVENT_IDS) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error("FedosRelayEventDeduplicator requires a positive integer maxSize.");
    }
    this.#maxSize = maxSize;
  }

  /** Returns `true` the FIRST time a given event id is seen (caller should process it); `false` on every subsequent call for the same id. */
  shouldProcess(eventId: string): boolean {
    if (this.#seen.has(eventId)) return false;
    if (this.#seen.size >= this.#maxSize) {
      const oldest = this.#seen.values().next().value;
      if (oldest !== undefined) this.#seen.delete(oldest);
    }
    this.#seen.add(eventId);
    return true;
  }

  size(): number {
    return this.#seen.size;
  }
}

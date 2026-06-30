/**
 * Relay client abstraction.
 *
 * The real transport (WebSocket REQ/EVENT/EOSE per NIP-01, or an HTTP gateway)
 * is deliberately NOT implemented in Stage 1. Everything downstream depends on
 * this interface only, so the network layer can be swapped without touching
 * ingest / thread-building logic. An in-memory adapter is provided for tests
 * and local development.
 */

import type { NostrEvent } from "./types.js";

/** Subset of NIP-01 REQ filters relevant to read-only ingest. */
export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  /** Referenced event ids (#e tag). */
  "#e"?: string[];
  /** Referenced pubkeys (#p tag). */
  "#p"?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

/** A read-only source of Nostr events. */
export interface RelayAdapter {
  readonly url: string;
  /** Returns events matching ALL given filters (OR across the filter list). */
  query(filters: NostrFilter[]): Promise<NostrEvent[]>;
}

/** True if an event satisfies a single filter (AND across the filter's fields). */
export function eventMatchesFilter(
  event: NostrEvent,
  filter: NostrFilter,
): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;

  const eRefs = filter["#e"];
  if (eRefs && !hasTagValue(event, "e", eRefs)) return false;

  const pRefs = filter["#p"];
  if (pRefs && !hasTagValue(event, "p", pRefs)) return false;

  return true;
}

function hasTagValue(
  event: NostrEvent,
  tagName: string,
  wanted: string[],
): boolean {
  return event.tags.some(
    (tag) => tag[0] === tagName && tag[1] !== undefined && wanted.includes(tag[1]),
  );
}

/** True if an event matches at least one filter in the list (NIP-01 OR semantics). */
export function eventMatchesAnyFilter(
  event: NostrEvent,
  filters: NostrFilter[],
): boolean {
  return filters.length === 0 || filters.some((f) => eventMatchesFilter(event, f));
}

/**
 * In-memory relay adapter. Useful for tests and offline development.
 * Applies `limit` per filter-list after filtering (newest first).
 */
export class InMemoryRelayAdapter implements RelayAdapter {
  readonly url: string;
  #events: NostrEvent[];

  constructor(url: string, events: NostrEvent[] = []) {
    this.url = url;
    this.#events = [...events];
  }

  add(...events: NostrEvent[]): void {
    this.#events.push(...events);
  }

  async query(filters: NostrFilter[]): Promise<NostrEvent[]> {
    const matched = this.#events
      .filter((e) => eventMatchesAnyFilter(e, filters))
      .sort((a, b) => b.created_at - a.created_at);

    const limit = filters.reduce<number | undefined>((min, f) => {
      if (f.limit === undefined) return min;
      return min === undefined ? f.limit : Math.min(min, f.limit);
    }, undefined);

    return limit === undefined ? matched : matched.slice(0, limit);
  }
}

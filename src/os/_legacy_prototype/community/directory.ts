/**
 * Stage 11 — space directory (read-only).
 *
 * A `SpaceDirectory` is just a source of `Space` definitions. `InMemorySpaceDirectory`
 * is the only implementation for now; a persistent (D1) directory can drop in
 * behind the same interface later. The lookup/filter helpers are pure functions
 * over a space array so callers can use them without a directory instance.
 */

import { canRead } from "./policy.js";
import { eventMatchesSpace } from "./classify.js";
import type { Space } from "./types.js";
import type { NostrEvent } from "../../../nostr/types.js";

/** A source of space definitions (synchronous, process-local). */
export interface SpaceDirectory {
  list(): readonly Space[];
  get(id: string): Space | undefined;
}

/**
 * The async/persisted counterpart of `SpaceDirectory`. A backing store like D1
 * cannot satisfy the synchronous interface, so persistent adapters implement
 * this one (reads return promises; `put`/`delete` mutate the store). It is the
 * same conceptual role — a source of `Space` definitions — not an access-control
 * system: `canRead`/`canPost` decisions still live in the pure policy layer.
 */
export interface AsyncSpaceDirectory {
  list(): Promise<readonly Space[]>;
  get(id: string): Promise<Space | undefined>;
  put(space: Space): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Process-local directory backed by a fixed array. */
export class InMemorySpaceDirectory implements SpaceDirectory {
  readonly #spaces: readonly Space[];

  constructor(spaces: readonly Space[]) {
    this.#spaces = [...spaces];
  }

  list(): readonly Space[] {
    return this.#spaces;
  }

  get(id: string): Space | undefined {
    return findSpaceById(this.#spaces, id);
  }
}

/** Finds a space by exact id, or undefined. */
export function findSpaceById(
  spaces: readonly Space[],
  id: string,
): Space | undefined {
  return spaces.find((space) => space.id === id);
}

/**
 * Spaces the actor is allowed to read (per `canRead`). A guest is represented
 * by an empty/omitted pubkey. Does not mutate the input.
 */
export function listReadableSpaces(
  spaces: readonly Space[],
  actorPubkey = "",
): Space[] {
  return spaces.filter((space) => canRead(actorPubkey, space).allowed);
}

/**
 * Keeps only the events that reference the given space (by tag). Works on any
 * item exposing a NostrEvent (e.g. `IngestedEvent`). Does not mutate the input.
 */
export function filterEventsForSpace<T extends { readonly event: NostrEvent }>(
  events: readonly T[],
  space: Space,
): T[] {
  return events.filter((item) => eventMatchesSpace(item.event, space));
}

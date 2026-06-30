/**
 * Stage 9 — pure event → space classification.
 *
 * Reads space references out of a Nostr event's tags and maps the event onto
 * known spaces. The tag conventions are kept behind this adapter so it can be
 * pointed at NIP-72 (`a` / kind 34550) or other schemes later without touching
 * callers.
 *
 * Recognized space tags (value -> space id):
 *   ["space", "<spaceId>"]        -> "<spaceId>"
 *   ["a", "<spaceId>"]            -> "<spaceId>"
 *   ["t", "space:<spaceId>"]      -> "<spaceId>"
 * Anything else (including a plain ["t", "topic"]) is ignored.
 */

import type { NostrEvent } from "../nostr/types.js";
import type { Space } from "./types.js";

const T_SPACE_PREFIX = "space:";

/** Extracts referenced space ids from an event (deduped, first-seen order). */
export function getSpaceTags(event: NostrEvent): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  const push = (id: unknown): void => {
    if (typeof id === "string" && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };

  for (const tag of event.tags) {
    const name = tag[0];
    const value = tag[1];
    if (name === "space" || name === "a") {
      push(value);
    } else if (name === "t" && typeof value === "string" && value.startsWith(T_SPACE_PREFIX)) {
      push(value.slice(T_SPACE_PREFIX.length));
    }
  }

  return ids;
}

/** True if the event references the given space by id. */
export function eventMatchesSpace(event: NostrEvent, space: Space): boolean {
  return getSpaceTags(event).includes(space.id);
}

/**
 * Returns the subset of `spaces` the event belongs to (by id). Unknown space
 * references are ignored; an event with no space tags returns []. Does not
 * mutate inputs.
 */
export function classifyEventToSpaces(
  event: NostrEvent,
  spaces: readonly Space[],
): Space[] {
  const referenced = new Set(getSpaceTags(event));
  if (referenced.size === 0) return [];
  return spaces.filter((space) => referenced.has(space.id));
}

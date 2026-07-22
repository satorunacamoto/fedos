/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase C: Navigation State Persistence.
 *
 * Mirrors this codebase's own established append-only-NDJSON persistence
 * pattern exactly (e.g.
 * `../../conversation/invitation/append_only_fedos_conversation_invitation_revocation_registry.ts`,
 * Alpha 998) — an INDEPENDENT log file, one
 * `FedosPersistedDesktopNavigationEventV1` per line, insert-only, replayed
 * on every read, no side index held between calls, no delete/compaction/
 * rewrite method of any kind. This is the SAME persistence approach every
 * other domain in this repository already uses for a new, narrow need —
 * never a new kind of persistence engine.
 *
 * Unlike the id-keyed registries this pattern usually backs (revocations,
 * drafts, capabilities), navigation events are a small ORDERED journal —
 * `pin`/`unpin`/`recent-touch`/`last-opened` — folded left-to-right into one
 * `FedosDesktopNavigationSnapshot` on every read. No event is ever
 * rejected as a "conflict": the same conversation id can legitimately be
 * pinned, unpinned, and pinned again over a session's lifetime, each a
 * real, ordered fact.
 *
 * CRASH REVIEW: identical policy to every sibling backend — a missing/
 * empty file is NOT corruption (`snapshot()` returns the all-empty
 * snapshot); a non-blank line that fails `JSON.parse`, or one missing a
 * required field, THROWS — this file never repairs a truncated trailing
 * write automatically.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosDesktopNavigationPersistence` is the ONLY export
 *     besides its own record/snapshot types.
 *   - The constructor performs NO filesystem I/O — only stores the path
 *     (Alpha 316/353/752's own "no constructor side effects" guardrail).
 *   - `node:fs` only, reached the SAME untyped way every sibling backend
 *     already does — no external dependency.
 *   - No conversation CONTENT (title, plaintext, membership) is ever
 *     recorded here — a bare conversation id string plus event
 *     type/timestamp only.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";

export type FedosDesktopNavigationEventType = "last-opened" | "pin" | "unpin" | "recent-touch";

export interface FedosPersistedDesktopNavigationEventV1 {
  readonly type: FedosDesktopNavigationEventType;
  readonly conversationId: string;
  /** Unix seconds, caller-supplied clock — matches every other persisted record's own convention in this codebase (e.g. `FedosConversationMembership.joinedAt`). */
  readonly at: number;
}

export interface FedosDesktopNavigationSnapshot {
  readonly lastOpenedConversationId: string | null;
  /** Insertion order among currently-pinned ids (a later `unpin` removes; a later re-`pin` of the same id moves it to the end, mirroring "pin again = pinned again just now"). */
  readonly pinnedConversationIds: readonly string[];
  /** Most-recently-touched first, deduplicated, bounded to `maxRecent` (see `snapshot()`). */
  readonly recentConversationIds: readonly string[];
}

const DEFAULT_MAX_RECENT = 20;

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

function isValidEvent(candidate: unknown): candidate is FedosPersistedDesktopNavigationEventV1 {
  if (candidate === null || typeof candidate !== "object") return false;
  const c = candidate as Record<string, unknown>;
  return (
    (c.type === "last-opened" || c.type === "pin" || c.type === "unpin" || c.type === "recent-touch") &&
    typeof c.conversationId === "string" &&
    c.conversationId.length > 0 &&
    typeof c.at === "number"
  );
}

function touchRecent(recent: readonly string[], conversationId: string, maxRecent: number): readonly string[] {
  return Object.freeze([conversationId, ...recent.filter((id) => id !== conversationId)].slice(0, maxRecent));
}

function replayLog(filePath: string, maxRecent: number): FedosDesktopNavigationSnapshot {
  const contents = readLogFile(filePath);
  let lastOpenedConversationId: string | null = null;
  let pinned: string[] = [];
  let recent: readonly string[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed: unknown = JSON.parse(line);
    if (!isValidEvent(parsed)) {
      throw new Error(`AppendOnlyFedosDesktopNavigationPersistence: malformed navigation event record found in log file: ${line}`);
    }
    switch (parsed.type) {
      case "last-opened":
        lastOpenedConversationId = parsed.conversationId;
        recent = touchRecent(recent, parsed.conversationId, maxRecent);
        break;
      case "recent-touch":
        recent = touchRecent(recent, parsed.conversationId, maxRecent);
        break;
      case "pin":
        pinned = [...pinned.filter((id) => id !== parsed.conversationId), parsed.conversationId];
        break;
      case "unpin":
        pinned = pinned.filter((id) => id !== parsed.conversationId);
        break;
    }
  }
  return Object.freeze({ lastOpenedConversationId, pinnedConversationIds: Object.freeze(pinned), recentConversationIds: recent });
}

export class AppendOnlyFedosDesktopNavigationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  /** Appends one event, unconditionally — never rejected as a conflict (see this file's own header). */
  recordEvent(event: FedosPersistedDesktopNavigationEventV1): void {
    appendFileSync(this.#filePath, JSON.stringify(event) + "\n", "utf8");
  }

  /** Replays the full log into the current, folded snapshot. `maxRecent` bounds `recentConversationIds` only (default 20); it does not affect `pinnedConversationIds`, which has no bound. */
  snapshot(maxRecent: number = DEFAULT_MAX_RECENT): FedosDesktopNavigationSnapshot {
    return replayLog(this.#filePath, maxRecent);
  }
}

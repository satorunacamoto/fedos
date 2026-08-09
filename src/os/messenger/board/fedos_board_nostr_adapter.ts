/**
 * Secure Runtime Alpha 266 ("Adapter Implementation") — Stage 6 of the
 * Alpha 261–270 Nostr Canonical Board Adapter Arc.
 *
 * The FIRST Protocol Adapter: a pure, one-way, fail-closed translation
 * from an already-verified `FedosValidatedNostrEvent`
 * (`src/desktop/fedos_validated_nostr_event.ts`, Alpha 242) into a
 * `FedosBoardPost` (`./fedos_board_post.ts`, Alpha 255). Uses ONLY the
 * decisions this Arc's own Alpha 261–265 fixed — see those docs for the
 * full field-mapping table and rationale. Never the reverse: nothing in
 * this file constructs or mutates a Nostr event of any kind.
 *
 * Architecture rule, confirmed by this file's own imports: a Protocol
 * Adapter reads a verified native protocol object and maps it into the
 * Canonical Board Model — it owns ALL protocol-specific interpretation
 * (the NIP-10 e-tag resolution below) so `src/board/`'s other files stay
 * entirely protocol-neutral. The ONLY cross-module reference is a
 * `import type` of `FedosValidatedNostrEvent` — erased entirely at
 * compile time (`verbatimModuleSyntax`/`isolatedModules`), so the
 * compiled/executed adapter carries zero runtime dependency on
 * `src/desktop/` (see Alpha 268's own boundary review).
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`. Nothing here throws.
 *   - No mutation of `event` of any kind.
 *   - No network, no storage, no Relay/Runtime/Worker/Desktop/GUI access
 *     of any kind — a pure, synchronous, in-memory translation.
 *   - Only NIP-01 kind `1` (text note) events are accepted — the ONLY
 *     kind this repository has established real reply/thread semantics
 *     for (`src/thread/thread.ts`, Stage 2). Any other kind is rejected
 *     (`null`), not guessed at — mapping it would invent semantics this
 *     Arc's own instruction forbids ("Never invent semantics").
 */

import type { FedosValidatedNostrEvent } from "../../../desktop/fedos_validated_nostr_event.js";
import type { FedosBoardPost } from "./fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "./fedos_board_post_validator.js";

/** The only Nostr `kind` this adapter accepts. See Alpha 264's own doc for why. */
export const FEDOS_BOARD_NOSTR_SUPPORTED_KIND = 1;

const HEX_64 = /^[0-9a-f]{64}$/;
const KNOWN_E_TAG_MARKERS: ReadonlySet<string> = new Set(["root", "reply", "mention"]);

type NostrETagMarker = "root" | "reply" | "mention";

interface ParsedNostrETag {
  readonly id: string;
  readonly marker: NostrETagMarker | undefined;
}

/**
 * Extracts well-formed `e` tags (64-lowercase-hex id) from a Nostr tag
 * list. Malformed `e` tags (wrong id shape, missing id) are silently
 * dropped — the SAME tolerance `src/thread/thread.ts`'s own
 * `parseETags` already applies (Stage 2), mirrored here rather than
 * imported, keeping this per-event adapter decoupled from that
 * multi-event graph module (see Alpha 268).
 */
function parseNostrETags(tags: readonly (readonly string[])[]): ParsedNostrETag[] {
  const valid: ParsedNostrETag[] = [];
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag[0] !== "e") continue;
    const id = tag[1];
    if (typeof id !== "string" || !HEX_64.test(id)) continue;
    const rawMarker = tag[3];
    const marker =
      typeof rawMarker === "string" && KNOWN_E_TAG_MARKERS.has(rawMarker)
        ? (rawMarker as NostrETagMarker)
        : undefined;
    valid.push({ id, marker });
  }
  return valid;
}

interface ResolvedNostrThreadRefs {
  readonly root: string | null;
  readonly reply: string | null;
}

/**
 * Resolves NIP-10 root/reply targets from a Nostr tag list, using the
 * SAME resolution rule already established and tested in this
 * repository (`getRootTarget`/`getReplyTarget`,
 * `src/thread/thread.ts`, Stage 2, unmodified by this Arc):
 *   - A marked `["e", id, relay, "reply"]` tag names the direct parent.
 *   - A marked `["e", id, relay, "root"]` tag names the thread root.
 *   - When NO `e` tag carries a marker (the deprecated positional
 *     form): exactly one `e` tag -> that id is both root and reply;
 *     multiple `e` tags -> the first is root, the last is reply.
 *   - When markers ARE present but no tag carries the `"reply"`
 *     marker, `reply` resolves to `null` — matching this repository's
 *     own established precedent (`src/thread/thread.ts`'s
 *     `getReplyTarget`), even when a `"root"`-marked tag is present.
 */
function resolveNostrThreadRefs(tags: readonly (readonly string[])[]): ResolvedNostrThreadRefs {
  const valid = parseNostrETags(tags);
  if (valid.length === 0) return { root: null, reply: null };

  if (valid.some((ref) => ref.marker !== undefined)) {
    const root = valid.find((ref) => ref.marker === "root");
    const reply = valid.find((ref) => ref.marker === "reply");
    return { root: root ? root.id : null, reply: reply ? reply.id : null };
  }

  // Deprecated positional form (no `e` tag carries a marker).
  if (valid.length === 1) return { root: valid[0]!.id, reply: valid[0]!.id };
  return { root: valid[0]!.id, reply: valid[valid.length - 1]!.id };
}

/**
 * Maps a `FedosValidatedNostrEvent` into a typed `FedosBoardPostInput`
 * (`./fedos_board_post_validator.ts`, Alpha 257), WITHOUT running Board
 * validation itself — exposed separately so Alpha 267 (determinism) and
 * Alpha 268 (boundary review) can exercise the pure mapping step in
 * isolation. `boardId` is supplied by the caller, never derived from the
 * event: Nostr carries no native "which local board" concept — deciding
 * that is Board Application Logic's own job (see Alpha 261's own field
 * mapping table, "fields requiring explicit policy"), out of scope for
 * a per-event adapter.
 *
 * Returns `null` (never throws) when `event.kind` is not
 * `FEDOS_BOARD_NOSTR_SUPPORTED_KIND`, when any required field is the
 * wrong type, or when `boardId` is empty.
 */
export function mapValidatedNostrEventToBoardPostInput(
  event: FedosValidatedNostrEvent,
  boardId: string,
): FedosBoardPostInput | null {
  if (event === null || typeof event !== "object") return null;
  if (typeof event.id !== "string" || event.id.length === 0) return null;
  if (typeof event.pubkey !== "string" || event.pubkey.length === 0) return null;
  if (typeof event.created_at !== "number") return null;
  if (typeof event.kind !== "number" || event.kind !== FEDOS_BOARD_NOSTR_SUPPORTED_KIND) return null;
  if (!Array.isArray(event.tags)) return null;
  if (typeof event.content !== "string") return null;
  if (typeof boardId !== "string" || boardId.length === 0) return null;

  const { root, reply } = resolveNostrThreadRefs(event.tags);

  let threadId: string;
  let replyTo: string | null;

  if (reply === null) {
    // No resolvable direct parent -> this post is its own thread root
    // (Alpha 256 §1 convention: a root's threadId equals its own id),
    // regardless of any dangling/unmatched root tag.
    threadId = event.id;
    replyTo = null;
  } else {
    replyTo = reply;
    // Prefer the event's own explicit root reference; when it names
    // none (malformed/unusual input carrying a reply marker but no
    // root marker), fall back to the nearest known anchor -- the
    // direct parent itself. Walking further to find a TRUE root
    // requires the rest of the board's post set, which this per-event
    // adapter does not have -- that reconciliation is explicitly
    // deferred to Board Application Logic (Alpha 264 §"deferred
    // boundary", Alpha 256 §4-5).
    threadId = root ?? reply;
  }

  return {
    id: event.id,
    boardId,
    threadId,
    replyTo,
    author: {
      identityId: null,
      protocol: "nostr",
      publicIdentifier: event.pubkey,
    },
    body: event.content,
    createdAt: event.created_at,
    source: {
      protocol: "nostr",
      reference: event.id,
    },
  };
}

/**
 * The Nostr Board Adapter's single public entry point: converts an
 * already-verified `FedosValidatedNostrEvent` into a `FedosBoardPost`,
 * or `null` if it cannot be honestly represented. Combines
 * `mapValidatedNostrEventToBoardPostInput` (this file, protocol-specific
 * mapping) with `validateFedosBoardPost` (`./fedos_board_post_validator.ts`,
 * Alpha 257, protocol-neutral validation) — the SAME two-step boundary
 * every future Protocol Adapter (ActivityPub, AT Protocol, Session) will
 * also compose. Performs NO cryptographic verification of its own: the
 * caller must have already produced `event` via
 * `validateInboundNostrEvent` (`src/desktop/combined_inbound_event_validator.ts`,
 * Alpha 245) or equivalent.
 */
export function validateNostrBoardPost(
  event: FedosValidatedNostrEvent,
  boardId: string,
): FedosBoardPost | null {
  const input = mapValidatedNostrEventToBoardPostInput(event, boardId);
  if (input === null) return null;
  return validateFedosBoardPost(input);
}

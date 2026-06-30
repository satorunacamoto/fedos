/**
 * Stage 10 — pure builders for UNSIGNED events.
 *
 * These assemble the event body the user would sign. They never sign, never
 * publish, and never touch a key. `prepareSpacePost` additionally consults the
 * Stage 9 community policy so callers can avoid building a post the actor isn't
 * allowed to make — the actual signing still happens elsewhere via an
 * `EventSigner`.
 */

import type { NostrTag } from "../nostr/types.js";
import { canPost } from "../community/policy.js";
import type { Space, SpaceDecision } from "../community/types.js";
import type {
  BuildTextNoteOptions,
  SignRequest,
  UnsignedNostrEvent,
} from "./types.js";

const KIND_TEXT_NOTE = 1;

/** Deep-copies a tag list so the result never aliases caller-owned arrays. */
function copyTags(tags: readonly NostrTag[]): NostrTag[] {
  return tags.map((tag) => [...tag]);
}

/** Builds an unsigned kind:1 text note. Does not mutate `options.tags`. */
export function buildUnsignedTextNote(
  options: BuildTextNoteOptions,
): UnsignedNostrEvent {
  return {
    pubkey: options.pubkey,
    created_at: options.now ?? Math.floor(Date.now() / 1000),
    kind: KIND_TEXT_NOTE,
    tags: copyTags(options.tags ?? []),
    // Content is stored verbatim; HTML escaping is the render layer's job.
    content: options.content,
  };
}

/**
 * NIP-10 reply tags. A root id yields a "root" marker; a reply id yields a
 * "reply" marker. With only a root id you get just the root tag.
 */
export function buildReplyTags(
  rootId: string,
  replyId?: string,
  relayUrl?: string,
): NostrTag[] {
  const relay = relayUrl ?? "";
  const tags: NostrTag[] = [];
  if (rootId) tags.push(["e", rootId, relay, "root"]);
  if (replyId) tags.push(["e", replyId, relay, "reply"]);
  return tags;
}

/** Space tags in both forms the Stage 9 classifier recognizes. */
export function buildSpaceTags(spaceId: string): NostrTag[] {
  return [
    ["space", spaceId],
    ["t", `space:${spaceId}`],
  ];
}

export interface PrepareSpacePostOptions {
  readonly actorPubkey: string;
  readonly space: Space;
  readonly content: string;
  readonly rootId?: string;
  readonly replyId?: string;
  readonly relayUrl?: string;
  readonly extraTags?: NostrTag[];
  readonly now?: number;
}

/**
 * Result of preparing a space post. `ok: false` means the actor may not post
 * here (per `canPost`); `ok: true` carries a `SignRequest` ready for a signer.
 * Either way the `SpaceDecision` explains why.
 */
export type PrepareSpacePostResult =
  | { readonly ok: true; readonly decision: SpaceDecision; readonly request: SignRequest }
  | { readonly ok: false; readonly decision: SpaceDecision };

/**
 * Builds an unsigned post for a space IF policy allows it. Pure: never signs,
 * never publishes, never mutates inputs.
 */
export function prepareSpacePost(
  options: PrepareSpacePostOptions,
): PrepareSpacePostResult {
  const decision = canPost(options.actorPubkey, options.space);
  if (!decision.allowed) return { ok: false, decision };

  const tags: NostrTag[] = [
    ...buildSpaceTags(options.space.id),
    ...(options.rootId
      ? buildReplyTags(options.rootId, options.replyId, options.relayUrl)
      : []),
    ...copyTags(options.extraTags ?? []),
  ];

  const unsigned = buildUnsignedTextNote({
    pubkey: options.actorPubkey,
    content: options.content,
    tags,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  return {
    ok: true,
    decision,
    request: { unsigned, purpose: `post to space ${options.space.id}` },
  };
}

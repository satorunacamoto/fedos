/**
 * Stage 113 — Nostr event mapping boundary (pure mapping candidates only).
 *
 * Four PURE functions that turn FedOS's protocol-neutral descriptors
 * (`SocialEventDescriptor`, `BoardDescriptor`, `MarketplaceListingDescriptor`,
 * `ModerationSignalInput`) into a `NostrEventCandidate` (see `./types.js`) —
 * an UNSIGNED, non-published SHAPE a future real Nostr adapter's mapping
 * step would produce. Every function reads its input, never mutates it, and
 * never throws.
 *
 * HARD GUARDRAILS (see `docs/nostr_adapter_planning.md`):
 *   - NO relay connection, NO WebSocket, NO `fetch`, NO signing, NO private
 *     key of any kind, NO NIP-44/NIP-17, NO DM, NO publish, NO subscribe,
 *     and NO JSON serialization for a relay. A `NostrEventCandidate` never
 *     carries an actual event id, signature, or real pubkey.
 *   - `contentPreview` is NEVER real content — a fixed placeholder, or (for
 *     a `BoardDescriptor`'s already-display-only `title`) a sanitized
 *     display label that itself passed the sensitive-value check below.
 *   - Only PUBLIC-equivalent visibility is ever candidate-ized: `public`
 *     only for a `SocialEventDescriptor` (`SocialVisibility` has no
 *     "unlisted" value), `public`/`unlisted` for a
 *     `MarketplaceListingDescriptor`. `followers`/`community`/
 *     `private_placeholder`/`private` are REJECTED outright — no
 *     placeholder-without-content variant is produced for them in this
 *     stage.
 *   - `SocialEventKind: "chat"` is ALWAYS rejected, regardless of
 *     visibility: chat/DM activity must never become a public event
 *     candidate (see `docs/chat_boundary.md`).
 *   - Metadata/reason strings containing a
 *     secret/key/seed/token/payment/entitlement/buyer/checkout/invoice/
 *     download/signed/url/dm/message/body/content marker are dropped
 *     (from `metadata`) or cause outright rejection (for a single
 *     non-metadata field like `reason`/`title`).
 *   - NOT connected to `PaymentProvider`, `EntitlementProvider`,
 *     `StorageBackend`, any `CryptoProvider`, any `FederationProvider`
 *     implementation, the Runtime, or the Worker. Nothing here is
 *     auto-called by constructing a runtime.
 */

import type { BoardDescriptor } from "../social/board.js";
import type { SocialEventDescriptor, SocialEventKind } from "../social/event.js";
import type {
  MarketplaceListingDescriptor,
  MarketplaceVisibility,
} from "../marketplace/types.js";
import type {
  ModerationSignalInput,
  NostrEventCandidate,
  NostrEventCandidateKind,
  NostrEventMappingDecision,
} from "./types.js";

/**
 * Substrings that mark a value as sensitive (case-insensitive). Matched
 * against metadata keys (stripped of non-alphanumerics) and against
 * metadata/reason/title VALUES as a lowercase substring. Deliberately
 * conservative, matching this boundary's own hard guardrail list above.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "buyer",
  "checkout",
  "invoice",
  "download",
  "signed",
  "url",
  "dm",
  "message",
  "body",
  "content",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries a sensitive marker. */
export function isSensitiveNostrMappingValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveNostrMappingValue(value)) return true;
  }
  return false;
}

/** Return a NEW metadata object with sensitive entries removed, or `undefined` if none remain. */
function sanitizeMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveNostrMappingValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

function deny(reason: string): NostrEventMappingDecision {
  return { allowed: false, state: "rejected", reason };
}

function accept(candidate: NostrEventCandidate, reason: string): NostrEventMappingDecision {
  return { allowed: true, state: "accepted_placeholder", reason, candidate };
}

/** One Nostr TAG-shaped pair, or `null` when the opaque ref is absent. */
function refTag(name: string, ref: string | undefined): readonly string[] | null {
  return ref !== undefined && ref.length > 0 ? [name, ref] : null;
}

/** Drops absent tags and returns the fixed tag-shape array `NostrEventCandidate.tags` expects. */
function buildTags(...maybeTags: readonly (readonly string[] | null)[]): readonly (readonly string[])[] {
  return maybeTags.filter((tag): tag is readonly string[] => tag !== null);
}

/** A fixed, non-sensitive placeholder string — never real content. */
function fixedPreview(label: string): string {
  return `${label} (placeholder preview — no real content)`;
}

const SOCIAL_EVENT_KIND_TO_CANDIDATE: Readonly<
  Record<Exclude<SocialEventKind, "chat">, NostrEventCandidateKind>
> = {
  post: "text_note_placeholder",
  reply: "reply_placeholder",
  repost: "text_note_placeholder",
  reaction: "reaction_placeholder",
  profile: "profile_placeholder",
  article: "long_form_placeholder",
  marketplace: "marketplace_announcement_placeholder",
  moderation: "moderation_signal_placeholder",
  test: "test_placeholder",
};

/**
 * Map a `SocialEventDescriptor` to a `NostrEventCandidate`. Rejects
 * `kind: "chat"` unconditionally (chat/DM activity never becomes a public
 * candidate) and any non-`public` visibility (`SocialVisibility` has no
 * "unlisted" value — only `public`/`followers`/`community`/
 * `private_placeholder`, and only `public` is eligible here). Never
 * mutates `event`, never throws, never touches a relay.
 */
export function socialEventToNostrCandidate(
  event: SocialEventDescriptor,
): NostrEventMappingDecision {
  if (event.kind === "chat") {
    return deny("chat activity is never mapped to a public Nostr event candidate");
  }
  if (event.visibility !== "public") {
    return deny(`visibility "${event.visibility}" is not eligible for a public event candidate`);
  }
  if (hasSensitiveMetadata(event.metadata)) {
    return deny("event metadata contains a sensitive key or value");
  }

  const kindLabel = SOCIAL_EVENT_KIND_TO_CANDIDATE[event.kind];
  const metadata = sanitizeMetadata(event.metadata);
  const candidate: NostrEventCandidate = {
    kindLabel,
    tags: buildTags(refTag("p", event.authorRef)),
    contentPreview: fixedPreview(event.kind),
    ...(event.authorRef !== undefined ? { pubkeyRef: event.authorRef } : {}),
    ...(event.createdAt !== undefined ? { createdAt: event.createdAt } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
  return accept(candidate, "social event is policy-clean (placeholder mapping only)");
}

/**
 * Map a `BoardDescriptor` to a `NostrEventCandidate` (a root/text-note-shaped
 * candidate representing the board/thread). `title`/topic/category names are
 * already display-only labels (see `src/social/board.ts`); they are still
 * reviewed for a sensitive marker before use. Never mutates `board`, never
 * throws, never touches a relay.
 */
export function boardToNostrCandidate(board: BoardDescriptor): NostrEventMappingDecision {
  if (isSensitiveNostrMappingValue(board.title)) {
    return deny("board title contains a sensitive value");
  }
  for (const topic of board.topics ?? []) {
    if (isSensitiveNostrMappingValue(topic.name)) {
      return deny("board topic label contains a sensitive value");
    }
  }
  for (const category of board.categories ?? []) {
    if (isSensitiveNostrMappingValue(category.name)) {
      return deny("board category label contains a sensitive value");
    }
  }

  const kindLabel: NostrEventCandidateKind =
    board.kind === "test" ? "test_placeholder" : "text_note_placeholder";
  const topicTags = (board.topics ?? []).map((topic) => ["t", topic.name] as const);
  const categoryTags = (board.categories ?? []).map((category) => ["t", category.name] as const);
  const candidate: NostrEventCandidate = {
    kindLabel,
    tags: buildTags(refTag("d", board.id), ...topicTags, ...categoryTags),
    contentPreview: board.title,
  };
  return accept(candidate, "board is policy-clean (placeholder mapping only)");
}

function isPublicMarketplaceVisibility(visibility: MarketplaceVisibility): boolean {
  return visibility === "public" || visibility === "unlisted";
}

/**
 * Map a `MarketplaceListingDescriptor` to a `NostrEventCandidate`. Rejects
 * `visibility: "private"` and any sensitive metadata. NEVER carries a
 * price, payment, checkout, download, or signed-URL value — the type
 * itself has no such field (see `docs/marketplace_boundary.md`). Never
 * mutates `listing`, never throws, never touches a relay/payment rail.
 */
export function marketplaceListingToNostrCandidate(
  listing: MarketplaceListingDescriptor,
): NostrEventMappingDecision {
  if (!isPublicMarketplaceVisibility(listing.visibility)) {
    return deny(`visibility "${listing.visibility}" is not eligible for a public event candidate`);
  }
  if (hasSensitiveMetadata(listing.metadata)) {
    return deny("listing metadata contains a sensitive key or value");
  }

  const metadata = sanitizeMetadata(listing.metadata);
  const candidate: NostrEventCandidate = {
    kindLabel: "marketplace_announcement_placeholder",
    tags: buildTags(refTag("d", listing.idRef), refTag("p", listing.creatorRef), [
      "t",
      listing.kind,
    ]),
    contentPreview: fixedPreview(listing.kind),
    ...(listing.creatorRef !== undefined ? { pubkeyRef: listing.creatorRef } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
  return accept(candidate, "listing is policy-clean (placeholder mapping only)");
}

/**
 * Map a `ModerationSignalInput` to a `NostrEventCandidate` — a FedOS-local
 * hide/mute/filter decision, never a claim that anything was deleted (see
 * `docs/nostr_adapter_planning.md` §7). Rejects a sensitive `reason` or
 * metadata. Never mutates `input`, never throws, never touches a relay.
 */
export function moderationSignalToNostrCandidate(
  input: ModerationSignalInput,
): NostrEventMappingDecision {
  if (input.reason !== undefined && isSensitiveNostrMappingValue(input.reason)) {
    return deny("moderation reason contains a sensitive value");
  }
  if (hasSensitiveMetadata(input.metadata)) {
    return deny("moderation signal metadata contains a sensitive key or value");
  }

  const metadata = sanitizeMetadata(input.metadata);
  const candidate: NostrEventCandidate = {
    kindLabel: "moderation_signal_placeholder",
    tags: buildTags(refTag("fedos-target", input.targetRef)),
    contentPreview: fixedPreview(`moderation:${input.action}`),
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
  return accept(candidate, "moderation signal is policy-clean (placeholder mapping only)");
}

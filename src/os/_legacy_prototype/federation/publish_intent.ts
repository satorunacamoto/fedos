/**
 * Stage 116 — Nostr publish intent boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a user WOULD like to publish something" —
 * an INTENT, not a publish. This is a DIFFERENT, earlier layer than
 * `./nostr_mapping.js`'s `NostrEventCandidate`: a publish intent names WHAT
 * a caller wants to eventually publish and WHY (a kind label), before any
 * mapping, signing, or relay send exists for it. Nothing here builds an
 * event, signs anything, or opens a relay connection.
 *
 * HARD GUARDRAILS (see `docs/nostr_adapter_planning.md`):
 *   - NO `content`/`body`/bytes field of any kind. A `PublishIntentDescriptor`
 *     carries OPAQUE labels/metadata strings only — never the actual
 *     post/reply/profile text a user typed.
 *   - NO signing of any kind. No private key, no `nsec`, no signature field,
 *     no event id is ever produced or referenced by this file.
 *   - NO relay connection, NO `fetch`, NO `WebSocket`, NO publish, NO
 *     subscribe. `reviewPublishIntent` evaluates a decision ONLY.
 *   - `idRef`/`actorRef`/`targetRef` are OPAQUE labels a real route would
 *     resolve on its own side — never a protocol-specific id, DID, or
 *     handle used for a real lookup.
 *   - This boundary makes NO delivery guarantee. Do not describe an
 *     `accepted_placeholder` decision as "published", "sent", or
 *     "broadcast".
 */

/** What the user WOULD like to (eventually) publish — a label of intent only. */
export type PublishIntentKind =
  | "post_placeholder"
  | "reply_placeholder"
  | "reaction_placeholder"
  | "marketplace_announcement_placeholder"
  | "creator_profile_placeholder"
  | "moderation_signal_placeholder"
  | "test_placeholder";

/**
 * A non-sensitive description of one publish intent. Carries NO
 * `content`/`body`/bytes field of any kind — only opaque labels, a kind,
 * and metadata strings.
 */
export interface PublishIntentDescriptor {
  /** OPAQUE label a real route would resolve to its own intent/record id. */
  readonly idRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for signing. */
  readonly actorRef?: string;
  /** OPAQUE label to what is being published about/in reply to. */
  readonly targetRef?: string;
  readonly kind: PublishIntentKind;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewPublishIntent`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of an intent review. No signed/relay data is exposed at any state. */
export type PublishIntentState = "accepted_placeholder" | "rejected";

/**
 * The result of reviewing an intent. `accepted_placeholder` means the
 * intent is policy-clean — NOT that anything was published, signed, or
 * sent to a relay.
 */
export interface PublishIntentDecision {
  readonly allowed: boolean;
  readonly state: PublishIntentState;
  readonly reason: string;
}

/** Every publish-intent-kind label (for mapping/documentation helpers). */
export const PUBLISH_INTENT_KINDS: readonly PublishIntentKind[] = [
  "post_placeholder",
  "reply_placeholder",
  "reaction_placeholder",
  "marketplace_announcement_placeholder",
  "creator_profile_placeholder",
  "moderation_signal_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Includes the signing/relay-specific family (a real private key/signature/
 * relay reference must never ride on an intent) alongside the conservative
 * marker family used across this codebase's other boundaries (see
 * `../social/intent.js`).
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "dm",
  "body",
  "content",
  "message",
  "sig",
  "signature",
  "privkey",
  "nsec",
  "relay",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/signing content. */
export function isSensitivePublishIntentValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitivePublishIntentValue(value)) return true;
  }
  return false;
}

/** Return a NEW metadata object with sensitive entries removed, or `undefined` if none remain. */
export function sanitizePublishIntentMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitivePublishIntentValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Decide whether an intent may be handed to a (future) route. Denies (never
 * throws) when metadata contains a sensitive key/value. A clean intent is
 * `accepted_placeholder` — a PLACEHOLDER acceptance that still signs/
 * publishes/sends nothing. Never mutates `intent`, never opens a relay
 * connection.
 */
export function reviewPublishIntent(intent: PublishIntentDescriptor): PublishIntentDecision {
  if (hasSensitiveMetadata(intent.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "intent metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "intent carries only non-sensitive, opaque labels (nothing signed/published/sent)",
  };
}

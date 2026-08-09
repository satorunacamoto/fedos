/**
 * Stage 114 — Board interaction intent boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a user WOULD like to do something on a
 * board" (post, reply, react, hide, mute, report) — an INTENT, not an
 * action. This file defines the intent shape and a pure review function
 * only; nothing here posts, replies, reacts, hides, mutes, or reports
 * anything for real. It exists so a future UI/route can express "the user
 * clicked reply" as data, before any send/moderation logic is wired up.
 *
 * HARD GUARDRAILS:
 *   - NO raw bytes field. NO `content`/`body`/`text` field of any kind. A
 *     `BoardInteractionIntentDescriptor` carries OPAQUE labels/metadata
 *     strings only — never the actual post/reply text a user typed.
 *   - `idRef`/`boardRef`/`actorRef`/`targetRef` are OPAQUE labels a real
 *     route would resolve on its own side — never a protocol-specific id,
 *     DID, or handle used for a real lookup.
 *   - `reviewBoardInteractionIntent` evaluates a decision ONLY — it never
 *     posts, sends, or moderates anything; nothing here calls
 *     `ChatProvider`, `FederationProvider`, `StorageBackend`, or any
 *     `CryptoProvider`.
 *   - This boundary makes NO delivery, moderation-effect, or storage
 *     guarantee. Do not describe an `accepted_placeholder` decision as
 *     "posted", "sent", or "applied".
 */

/** What the user WOULD like to do — a label of intent only. */
export type BoardInteractionIntentKind =
  | "create_post_placeholder"
  | "reply_placeholder"
  | "react_placeholder"
  | "hide_placeholder"
  | "mute_placeholder"
  | "report_placeholder"
  | "test_placeholder";

/**
 * A non-sensitive description of one interaction intent. Carries NO
 * `content`/`body`/bytes field of any kind — only opaque labels and
 * metadata strings.
 */
export interface BoardInteractionIntentDescriptor {
  /** OPAQUE label a real route would resolve to its own intent/record id. */
  readonly idRef?: string;
  /** OPAQUE label a real route would resolve to its own board/thread id. */
  readonly boardRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly actorRef?: string;
  /** OPAQUE label to what is being replied to/reacted to/moderated. */
  readonly targetRef?: string;
  readonly kind: BoardInteractionIntentKind;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewBoardInteractionIntent`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of an intent review. No content is exposed at any state. */
export type BoardIntentState = "accepted_placeholder" | "rejected";

/**
 * The result of reviewing an intent. `accepted_placeholder` means the
 * intent is policy-clean — NOT that anything was posted, sent, or applied.
 */
export interface BoardIntentDecision {
  readonly allowed: boolean;
  readonly state: BoardIntentState;
  readonly reason: string;
}

/** Every board-interaction-intent-kind label (for mapping/documentation helpers). */
export const BOARD_INTERACTION_INTENT_KINDS: readonly BoardInteractionIntentKind[] = [
  "create_post_placeholder",
  "reply_placeholder",
  "react_placeholder",
  "hide_placeholder",
  "mute_placeholder",
  "report_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Matches the same conservative marker family used across this codebase's
 * other boundaries (see `src/storage/policy.ts`, `src/federation/nostr_mapping.ts`).
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
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive content. */
export function isSensitiveIntentValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveIntentValue(value)) return true;
  }
  return false;
}

/** Return a NEW metadata object with sensitive entries removed, or `undefined` if none remain. */
export function sanitizeBoardInteractionIntentMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveIntentValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Decide whether an intent may be handed to a (future) route. Denies (never
 * throws) when metadata contains a sensitive key/value. A clean intent is
 * `accepted_placeholder` — a PLACEHOLDER acceptance that still posts/sends/
 * moderates nothing. Never mutates `intent`.
 */
export function reviewBoardInteractionIntent(
  intent: BoardInteractionIntentDescriptor,
): BoardIntentDecision {
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
    reason: "intent carries only non-sensitive, opaque labels (nothing posted/sent/moderated)",
  };
}

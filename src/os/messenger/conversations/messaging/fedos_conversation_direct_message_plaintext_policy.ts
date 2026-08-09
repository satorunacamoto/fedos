/**
 * Secure Runtime Alpha 1128 ("Plaintext Policy") — Phase C of the Alpha
 * 1111–1180 Private Conversation Activation and Direct Messaging Runtime
 * Arc.
 *
 * Reuses `validateFedosBoardPost`'s own reviewed body constraint
 * (`../../board/fedos_board_post_validator.ts`, Alpha 258) VERBATIM where
 * semantically correct — the exact numeric bound
 * (`FEDOS_BOARD_POST_MAX_BODY_LENGTH = 10_000`, measured in UTF-16 code
 * units) and the exact "non-empty, plain text only, no HTML/Markdown
 * interpretation, Unicode preserved as-is" discipline that file's own
 * header already establishes. This file does not import that Board-domain
 * file directly (a direct message and a Board post are different domains
 * that happen to share a size discipline — importing across domains for a
 * single constant would create an accidental coupling neither Arc asked
 * for); it restates the identical bound as its own named constant, the
 * same "literal restatement of an already-adopted decision" precedent
 * `fedos_conversation_counterparty_public_key_resolver.ts` (Alpha 934)
 * already uses for the Nostr public-key hex pattern.
 *
 * `validateFedosConversationDirectMessageBody` operates on the caller's
 * own `string` BEFORE UTF-8 encoding — a direct-message plaintext body
 * exists only ephemerally in memory for the duration of one `encrypt()`
 * call (Alpha 1128's own "no logs or persisted plaintext" requirement);
 * this validator itself performs no logging and returns nothing that
 * outlives the caller's own stack frame.
 */

/** Restates `FEDOS_BOARD_POST_MAX_BODY_LENGTH` verbatim (Alpha 258) — see this file's own header for why the value is restated rather than imported. */
export const FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH = 10_000;

/**
 * Fails closed (`null`) for anything not a genuinely sendable plaintext
 * body: not a `string`, empty, or longer than the fixed bound. Never
 * throws. Unicode is preserved exactly as given — no normalization, no
 * stripping, no HTML/Markdown interpretation of any kind.
 */
export function validateFedosConversationDirectMessageBody(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  if (candidate.length < 1 || candidate.length > FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH) return null;
  return candidate;
}

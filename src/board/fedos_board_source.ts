/**
 * Secure Runtime Alpha 253 ("Source Provenance Model") — Stage 3 of the
 * Alpha 251–260 Canonical Board Model Foundation Arc.
 *
 * Explicit protocol provenance for a Canonical Board Post
 * (`./fedos_board_post.ts`, Alpha 255): WHICH protocol a post arrived
 * from, and an opaque reference into that protocol's own namespace.
 * Protocol identity is carried on `protocol` as DATA, never inferred by
 * pattern-matching `reference`'s own shape.
 *
 * HARD GUARDRAILS:
 *   - No secret token, access token, session credential, HTTP signature,
 *     or private relay metadata field of any kind.
 *   - No generic metadata bag — exactly two fields, `protocol` and
 *     `reference`.
 *   - `reference` is an OPAQUE string; nothing in this file parses it.
 */

export type FedosBoardSourceProtocol =
  | "fedos"
  | "nostr"
  | "activitypub"
  | "atproto"
  | "session";

/**
 * `reference` may hold, depending on `protocol`:
 *   - `nostr`: the Nostr event id (hex).
 *   - `activitypub`: the ActivityPub object URI.
 *   - `atproto`: the AT URI (see Alpha 259 §3 for the AT-URI/CID policy).
 *   - `session`: a gateway-assigned reference to a published board message.
 *   - `fedos`: reserved for content authored directly through FedOS,
 *     equal to the post's own `FedosBoardPostId`.
 */
export interface FedosBoardSourceReference {
  readonly protocol: FedosBoardSourceProtocol;
  readonly reference: string;
}

/** Every source-protocol label (for mapping/documentation helpers). */
export const FEDOS_BOARD_SOURCE_PROTOCOLS: readonly FedosBoardSourceProtocol[] = [
  "fedos",
  "nostr",
  "activitypub",
  "atproto",
  "session",
];

export function isFedosBoardSourceProtocol(value: string): value is FedosBoardSourceProtocol {
  return (FEDOS_BOARD_SOURCE_PROTOCOLS as readonly string[]).includes(value);
}

/**
 * Two source references identify the SAME source object iff both
 * `protocol` and `reference` match exactly. A future deduplication layer
 * would use this key; this function performs no deduplication itself —
 * it only names the identity rule (Alpha 253 §"Decide duplicate-import
 * identity").
 */
export function fedosBoardSourceKey(source: FedosBoardSourceReference): string {
  return `${source.protocol}:${source.reference}`;
}

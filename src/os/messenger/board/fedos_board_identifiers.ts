/**
 * Secure Runtime Alpha 252 ("Canonical Board Identifiers") — Stage 2 of
 * the Alpha 251–260 Canonical Board Model Foundation Arc.
 *
 * Protocol-independent identifier types for the Canonical Board Model
 * (`src/board/`). These identifiers are FedOS's OWN application-level
 * names for a board/thread/post — never a Nostr event id, a DID, an
 * ActivityPub URI, or a Session ID reused directly. A protocol-native
 * reference to the same object is carried separately, on
 * `FedosBoardSourceReference` (`./fedos_board_source.ts`, Alpha 253) —
 * see Alpha 252's own design doc for the adopted "Option C" rationale.
 *
 * HARD GUARDRAILS:
 *   - Each branded type is structurally distinct from the others and from
 *     a plain `string` — one cannot be assigned to another without an
 *     explicit cast, by construction of the branding technique itself.
 *   - No random ID generator exists anywhere in this file. Nothing here
 *     mints a new id; every function only BRANDS an already-chosen,
 *     already-non-empty string.
 *   - No protocol parsing: none of these functions inspects the string's
 *     content beyond a non-empty check — an id here is OPAQUE.
 */

export type FedosBoardId = string & { readonly __brand: "FedosBoardId" };
export type FedosThreadId = string & { readonly __brand: "FedosThreadId" };
export type FedosBoardPostId = string & { readonly __brand: "FedosBoardPostId" };
export type FedosExternalReference = string & { readonly __brand: "FedosExternalReference" };

function isNonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Brands an already-chosen, non-empty string as a `FedosBoardId`. Returns `null` for anything else. */
export function toFedosBoardId(value: string): FedosBoardId | null {
  return isNonEmpty(value) ? (value as FedosBoardId) : null;
}

/** Brands an already-chosen, non-empty string as a `FedosThreadId`. Returns `null` for anything else. */
export function toFedosThreadId(value: string): FedosThreadId | null {
  return isNonEmpty(value) ? (value as FedosThreadId) : null;
}

/** Brands an already-chosen, non-empty string as a `FedosBoardPostId`. Returns `null` for anything else. */
export function toFedosBoardPostId(value: string): FedosBoardPostId | null {
  return isNonEmpty(value) ? (value as FedosBoardPostId) : null;
}

/** Brands an already-chosen, non-empty string as a `FedosExternalReference`. Returns `null` for anything else. */
export function toFedosExternalReference(value: string): FedosExternalReference | null {
  return isNonEmpty(value) ? (value as FedosExternalReference) : null;
}

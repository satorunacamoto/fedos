/**
 * Secure Runtime Alpha 5401-5480 (FedOS Direct Ratchet State and Sealed
 * Persistence Foundation Arc) — Phase B: the versioned Direct Ratchet
 * session identity.
 *
 * The normative review (`review/fedos-forward-secrecy-double-ratchet-v1`
 * @ `b34d608`, `10_double_ratchet_state_model.md` §2/§14) names the
 * binding tuple as (local account, peer identity, peer Device) — three
 * components, deliberately without naming a canonical delimiter/encoding
 * scheme. This Arc DELIBERATELY EXTENDS that tuple with a fourth
 * component, `localDeviceRef`: the base branch's own accepted Device
 * Trust/Sync foundations (`FedosDeviceBindingV1`,
 * `../../sync/fedos_sync_device_registry.ts`) establish genuine
 * multi-device-per-account reality already (one account may own more
 * than one trusted device) — collapsing "local device" into "local
 * account" would be unsound here even though the review's own
 * single-device-vantage-point prose never had to consider it. This is a
 * documented elaboration of the review's model, never a contradiction of
 * it (see `docs/secure_runtime_alpha_5401_5480_reconciliation_report.md`
 * §4).
 *
 * `FedosConversationId` (`../fedos_conversation_id.ts`, Alpha 743,
 * unmodified) already identifies WHICH Direct Conversation; this file
 * adds the missing Device-pair dimension the review's own V1 decision
 * ("one independent session per Device pair") requires but no existing
 * type carries.
 *
 * DELIMITER CHOICE: a real `FedosConversationId` ALWAYS itself contains
 * `::` (both `toFedosConversationId`'s `boardId::threadId` shape, Alpha
 * 743, and `toFedosPrivateConversationId`'s `private-draft::mode::requestId`
 * shape, Alpha 908) — rejecting `::` inside every component, as an
 * earlier draft of this file did, would make this function reject EVERY
 * real Conversation id. This file therefore joins on `"##"` instead — a
 * two-character sequence that appears in none of this codebase's own id
 * schemes — and validates every component (INCLUDING `conversationId`)
 * free of `"##"` only; `conversationId`'s own internal `::` structure is
 * left untouched and un-inspected.
 *
 * HARD GUARDRAILS:
 *   - No secret material of any kind — every field here is a public,
 *     non-derived reference or closed literal.
 *   - Deterministic construction only — `toFedosDirectRatchetSessionId`
 *     never mints randomness; the identical component tuple always
 *     produces the identical id.
 *   - No filesystem path — the encoded id is a plain, bounded-length
 *     string with a closed `"##"`-based delimiter; every component is
 *     validated `"##"`-free, `/`-free, `\`-free, and NUL-free before
 *     joining, so no ambiguous-boundary collision is possible and the
 *     id can never itself smuggle a path-traversal segment.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";

/** Closed, versioned suite/version literal (review §10 §2's own example, `"fedos-direct-ratchet-v1"`). Reserved for future additive suite values only via an explicit, separate review — never widened silently. */
export type FedosDirectRatchetSuite = "fedos-direct-ratchet-v1";

export const FEDOS_DIRECT_RATCHET_SUITES: readonly FedosDirectRatchetSuite[] = ["fedos-direct-ratchet-v1"];

export type FedosDirectRatchetSessionId = string & { readonly __brand: "FedosDirectRatchetSessionId" };

export interface FedosDirectRatchetSessionIdComponents {
  readonly localAccountRef: string;
  readonly localDeviceRef: string;
  readonly remoteAccountRef: string;
  readonly remoteDeviceRef: string;
  readonly conversationId: FedosConversationId;
  readonly suite: FedosDirectRatchetSuite;
  /** Non-negative 32-bit integer — the session generation (review §14 §3's own "a new session for the same tuple took over" case increments this). */
  readonly generation: number;
}

const SESSION_ID_NAMESPACE = "direct-ratchet-v1";
const DELIMITER = "##";
const MAX_COMPONENT_LENGTH = 256;
const MAX_TOTAL_LENGTH = 1024;
const MAX_GENERATION = 0xffffffff;

function isSafeComponent(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_COMPONENT_LENGTH &&
    !value.includes(DELIMITER) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

/**
 * Deterministic, collision-safe construction: every component is
 * validated free of the join delimiter (and of path-meaningful
 * characters) BEFORE joining, so splitting the encoded id on the fixed
 * delimiter always recovers exactly the original components — no two
 * distinct, well-formed component tuples can ever encode to the same
 * string. Returns `null` (never throws) on any malformed component,
 * unrecognized suite, invalid generation, or an encoded length exceeding
 * `MAX_TOTAL_LENGTH`.
 */
export function toFedosDirectRatchetSessionId(
  components: FedosDirectRatchetSessionIdComponents,
): FedosDirectRatchetSessionId | null {
  const { localAccountRef, localDeviceRef, remoteAccountRef, remoteDeviceRef, conversationId, suite, generation } =
    components;
  if (
    !isSafeComponent(localAccountRef) ||
    !isSafeComponent(localDeviceRef) ||
    !isSafeComponent(remoteAccountRef) ||
    !isSafeComponent(remoteDeviceRef) ||
    !isSafeComponent(conversationId as unknown as string)
  ) {
    return null;
  }
  if (!FEDOS_DIRECT_RATCHET_SUITES.includes(suite)) return null;
  if (!Number.isInteger(generation) || generation < 0 || generation > MAX_GENERATION) return null;

  const encoded = [
    SESSION_ID_NAMESPACE,
    localAccountRef,
    localDeviceRef,
    remoteAccountRef,
    remoteDeviceRef,
    conversationId as unknown as string,
    suite,
    String(generation),
  ].join(DELIMITER);
  if (encoded.length > MAX_TOTAL_LENGTH) return null;
  return encoded as FedosDirectRatchetSessionId;
}

/** Structural, non-authoritative pre-check only — confirms `candidate` has this format's fixed namespace prefix and eight `"##"`-joined segments. Never throws. */
export function isWellFormedFedosDirectRatchetSessionId(candidate: unknown): candidate is FedosDirectRatchetSessionId {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > MAX_TOTAL_LENGTH) return false;
  const segments = candidate.split(DELIMITER);
  return segments.length === 8 && segments[0] === SESSION_ID_NAMESPACE && segments.every((segment) => segment.length > 0);
}

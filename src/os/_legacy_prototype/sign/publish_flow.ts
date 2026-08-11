/**
 * Stage 12 — pure glue between the Stage 9 space policy and the publish gate.
 *
 * These helpers decide whether a signed event MAY be published; they never
 * publish, sign, or touch a key. Sending is the `RelayPublisher`'s job. The
 * actor identity is taken from the signed event's own `pubkey` — you cannot ask
 * to publish "as" someone other than whoever signed the event.
 */

import { canPost } from "../community/policy.js";
import type { Space, SpaceDecision } from "../community/types.js";
import {
  validateBeforePublish,
  type PublishDecision,
} from "../../messenger/adapters/nostr/protocol/publish.js";
import type { SignatureVerifier } from "../../messenger/adapters/nostr/protocol/signature.js";
import type { SignedNostrEvent } from "./types.js";

/**
 * Whether the event's author may post into `space`, per `canPost`. The actor is
 * the event's signer: if `actorPubkey` is passed it MUST equal `event.pubkey`,
 * otherwise the post is denied (no posting on someone else's behalf). Returns a
 * `SpaceDecision` only — it does not publish.
 */
export function canPublishToSpace(
  actorPubkey: string,
  space: Space,
  event: SignedNostrEvent,
): SpaceDecision {
  if (actorPubkey !== event.pubkey) {
    return {
      allowed: false,
      role: "guest",
      reason: "actor pubkey does not match the signed event's pubkey",
    };
  }
  return canPost(event.pubkey, space);
}

export interface PreparePublishOptions {
  /** The (untrusted) event to publish; structurally checked here. */
  readonly event: unknown;
  /** Signature verifier run before anything is considered publishable. */
  readonly verifier: SignatureVerifier;
  /** Optional space the post targets; when set, `canPost` is also required. */
  readonly space?: Space;
}

/**
 * Combined gate: a denial if either the signature gate or (when a space is
 * given) the space policy fails; otherwise an `ok` decision carrying the
 * verified event. The `space` decision is included whenever a space was
 * supplied, so callers can surface the reason. Pure — never publishes.
 */
export type PreparePublishDecision =
  | {
      readonly ok: true;
      readonly event: SignedNostrEvent;
      readonly space?: SpaceDecision;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly space?: SpaceDecision;
    };

export async function preparePublishDecision(
  options: PreparePublishOptions,
): Promise<PreparePublishDecision> {
  const gate: PublishDecision = await validateBeforePublish(
    options.event,
    options.verifier,
  );
  if (!gate.ok) return { ok: false, reason: gate.reason };

  if (options.space !== undefined) {
    const space = canPublishToSpace(gate.event.pubkey, options.space, gate.event);
    if (!space.allowed) return { ok: false, reason: space.reason, space };
    return { ok: true, event: gate.event, space };
  }

  return { ok: true, event: gate.event };
}

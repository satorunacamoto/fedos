/**
 * FedOS Commerce End-to-End Completion, Wave B (Agent N) —
 * `CommerceNostrEventPort`: the ONE seam Commerce domain code would ever
 * call to get a `CommerceNostrEventDraft` (`commerce_nostr_event_drafts.ts`)
 * published. No Commerce domain file may call a Nostr protocol function
 * directly — see `../../../../test/architecture_boundary_commerce.test.ts`
 * and `../catalog/adapters/nostr/`'s own header comments.
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as the rest of `src/os/commerce`
 * (see `../README.md`) — nothing here is wired into `createCommerce()` or the
 * shipped Electron app.
 *
 * SAFETY GATE (the load-bearing property of this file)
 * ----------------------------------------------------------------------
 * `CommerceNostrEventPortImpl.publish()` calls
 * `isWellFormedCommerceNostrEventDraft()` FIRST, before touching the
 * duplicate guard or the injected `CommerceNostrEventTransport` in any way.
 * An invalid draft is rejected with `outcome: "rejected"` and the
 * transport's `send()` is NEVER called — see
 * `test/commerce_nostr_event_drafts.test.ts` and
 * `test/commerce_nostr_event_port.test.ts` for the tests proving this.
 *
 * DUPLICATE / REPLAY GUARD (original brief §31/§16 — "Nostr duplicate
 * event", "Nostr replay")
 * ----------------------------------------------------------------------
 * This Port keeps an in-memory map from a draft's CANONICAL content key
 * (`canonicalizeCommerceNostrEventDraft()` below — a deterministic,
 * recursively-key-sorted JSON string of the validated draft) to the
 * transport-assigned event id of the FIRST successful publish of that exact
 * content. Publishing the same logical draft twice:
 *   1. First call: not seen before -> forwarded to
 *      `transport.send()`; on `accepted: true` the mapping is recorded.
 *   2. Second (or Nth) call with an IDENTICAL draft: short-circuits to
 *      `outcome: "duplicate"` and returns the ORIGINAL event id WITHOUT
 *      calling `transport.send()` again — a true no-op, not a re-send.
 * A draft that differs in even one field (e.g. a later `product-update`
 * with a new `priceCents`, or a genuinely new `order-commitment` a moment
 * later) produces a different canonical key and is treated as a new event,
 * exactly as intended — this is content-addressed de-duplication, not
 * rate-limiting.
 *
 * WHAT THIS FILE DOES NOT DO — EXPLICIT GAP FOR THE COORDINATOR
 * ----------------------------------------------------------------------
 * This is PUBLISH-SIDE de-duplication only. There is no SUBSCRIBE/inbound
 * path anywhere in `src/os/commerce` today (confirmed: no Commerce file
 * reads from a relay) and this wave does not build one — building inbound
 * processing would require a real relay subscription adapter, which needs
 * its own design (what Commerce state, if any, an inbound Nostr event is
 * even allowed to mutate) that this wave's brief explicitly scoped out
 * ("you're not required to build the SUBSCRIBE/inbound-processing side this
 * wave unless trivial"). Concretely NOT covered by this Port:
 *   - Detecting that an event Commerce is ABOUT TO RECEIVE (from a relay)
 *     is a replay of one it already processed.
 *   - Any mutation of Commerce domain state (Order/Payment/etc.) in
 *     response to ANY Nostr event, inbound or outbound — this Port never
 *     touches Commerce domain state at all, by design (it only records its
 *     own local dedup-guard bookkeeping and forwards to `transport`).
 * A future Wave B+1 (or later) item should design a
 * `CommerceNostrEventSubscriptionPort` (or similar) with its own explicit
 * inbound duplicate/replay guard before any Commerce code ever consumes an
 * inbound Nostr event.
 */

import {
  isWellFormedCommerceNostrEventDraft,
  type CommerceNostrEventDraft,
} from "./commerce_nostr_event_drafts.js";

// ---------------------------------------------------------------------------
// Transport seam (implemented by a fake for every test in this wave, and by
// a real adapter living in ../catalog/adapters/nostr/ for a future wave that
// wires this Port into `createCommerce()`).
// ---------------------------------------------------------------------------

/** What a transport reports back after attempting to send one draft. */
export interface CommerceNostrTransportSendResult {
  /** Did the transport accept/publish the event? */
  readonly accepted: boolean;
  /** The transport-assigned event id — must be non-empty when `accepted`
   * is `true`; MAY be empty when `accepted` is `false`. */
  readonly eventId: string;
  /** Human-readable outcome detail (e.g. a relay's own message, or an
   * error). May be empty. */
  readonly message: string;
}

/**
 * The narrow seam a `CommerceNostrEventPort` implementation delegates the
 * actual send to. A transport receives an ALREADY-VALIDATED draft (the Port
 * guarantees this — see this file's header) and is responsible for turning
 * it into whatever wire representation it uses. Nothing in this interface
 * mentions a Nostr type — only `../catalog/adapters/nostr/`'s own real
 * implementation (a future file, not added by this wave to keep review
 * surface minimal) needs to know that shape; every test in this wave uses
 * `InMemoryFakeCommerceNostrTransport` (`commerce_nostr_fake_transport.ts`)
 * instead.
 */
export interface CommerceNostrEventTransport {
  send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult>;
}

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export type CommerceNostrPublishOutcome = "published" | "duplicate" | "rejected" | "transport-error";

export interface CommerceNostrPublishResult {
  readonly outcome: CommerceNostrPublishOutcome;
  readonly reason: string;
  /** Present when `outcome` is `"published"` or `"duplicate"`. For
   * `"duplicate"` this is the ORIGINAL event id from the first successful
   * publish of this exact content, never a new one. */
  readonly eventId?: string;
}

/** The Port Commerce domain code would depend on. */
export interface CommerceNostrEventPort {
  publish(draft: CommerceNostrEventDraft): Promise<CommerceNostrPublishResult>;
}

/**
 * Deterministic, recursively-key-sorted JSON serialization used as the
 * duplicate-guard's content key. Two drafts produce the same key if and
 * only if they are deeply structurally equal (same keys, same values,
 * key order ignored). Not a cryptographic digest — it is an in-process
 * dedup key only, never published or transmitted anywhere.
 */
export function canonicalizeCommerceNostrEventDraft(draft: CommerceNostrEventDraft): string {
  return JSON.stringify(canonicalizeValue(draft));
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      out[key] = canonicalizeValue(record[key]);
    }
    return out;
  }
  return value;
}

/**
 * The one real (non-transport-specific) implementation of
 * `CommerceNostrEventPort` this wave ships. Owns nothing except the
 * in-memory duplicate guard described in this file's header; delegates
 * everything else to the injected `transport`.
 */
export class CommerceNostrEventPortImpl implements CommerceNostrEventPort {
  readonly #transport: CommerceNostrEventTransport;
  /** content key -> event id of the first successful publish. */
  readonly #publishedByContentKey = new Map<string, string>();

  constructor(transport: CommerceNostrEventTransport) {
    this.#transport = transport;
  }

  async publish(draft: CommerceNostrEventDraft): Promise<CommerceNostrPublishResult> {
    if (!isWellFormedCommerceNostrEventDraft(draft)) {
      return { outcome: "rejected", reason: "draft failed field-safety validation" };
    }

    const contentKey = canonicalizeCommerceNostrEventDraft(draft);
    const existingEventId = this.#publishedByContentKey.get(contentKey);
    if (existingEventId !== undefined) {
      return {
        outcome: "duplicate",
        reason: "identical draft already published — no-op, transport was not called again",
        eventId: existingEventId,
      };
    }

    const sendResult = await this.#transport.send(draft);
    if (!sendResult.accepted) {
      return {
        outcome: "transport-error",
        reason: sendResult.message.length > 0 ? sendResult.message : "transport rejected the event",
      };
    }

    this.#publishedByContentKey.set(contentKey, sendResult.eventId);
    return {
      outcome: "published",
      reason: sendResult.message,
      eventId: sendResult.eventId,
    };
  }

  /** Test/introspection helper — the number of distinct logical events this
   * Port instance has successfully published (post-dedup). Not part of the
   * `CommerceNostrEventPort` interface. */
  get publishedCount(): number {
    return this.#publishedByContentKey.size;
  }
}

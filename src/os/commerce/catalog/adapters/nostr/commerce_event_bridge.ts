/**
 * FedOS Commerce End-to-End Completion, Wave B (Agent N) — bridges an
 * ALREADY-VALIDATED `CommerceNostrEventDraft` (`../../../events/
 * commerce_nostr_event_drafts.ts`) into this repo's real, canonical Nostr
 * event shape and real signing/publish path.
 *
 * This is the ONE new file this wave adds to the reserved adapter directory
 * `NOSTR_ADAPTER_DIR` (`test/architecture_boundary_commerce.test.ts`) —
 * `bridge.ts` and `classify.ts` in this same directory are UNMODIFIED by
 * this wave; this file sits alongside them as a sibling, not a replacement.
 *
 * NO NEW CRYPTO. Signing is delegated to `FedosNostrSigningAuthority`
 * (`../../../../messenger/adapters/nostr/protocol/sign/
 * fedos_nostr_signing_authority.ts`) — this repo's own ONE reviewed
 * Nostr-signing seam (Secure Runtime Alpha 442/445), exactly as this
 * wave's brief requires ("do not implement real signing yourself if a
 * reviewed helper already exists — call it"). Relaying is delegated to
 * `RelayPublisher` (`../../../../messenger/adapters/nostr/protocol/
 * publish.ts`), this repo's own existing write-path abstraction. Nothing in
 * this file computes a signature, derives a key, or opens a socket itself.
 *
 * WHY EVERY COMMERCE NOSTR EVENT USES `kind: 1`
 * ----------------------------------------------------------------------
 * `FedosNostrUnsignedEventRequest`'s own validator
 * (`isWellFormedFedosNostrUnsignedEventRequest`,
 * `.../protocol/sign/fedos_nostr_signing_authority.ts`) enforces a CLOSED,
 * fixed `kind` allowlist — `1` (public text note), the FedOS private
 * delivery kind, and the NIP-59 Seal kind — and nothing else is accepted by
 * the one real signing authority this repo has. Widening that allowlist to
 * add a dedicated Commerce kind is a change to shared Messenger signing
 * infrastructure, out of this wave's scope (`fedos_nostr_signing_authority.ts`
 * is not in Agent N's territory and touching it would need its own
 * separately-reviewed decision). So every Commerce Nostr event this file
 * builds is a `kind: 1` public text note whose `content` is the validated
 * draft's own canonical JSON and whose `tags` carry a `["t",
 * "fedos-commerce:<category>:v1"]` namespacing tag — the SAME "kind-agnostic
 * event + `t`/`product` tag" convention this directory's own `classify.ts`
 * already reads (`T_PRODUCT_PREFIX`), not a new convention invented here.
 *
 * WHAT THIS FILE DOES NOT DO
 * ----------------------------------------------------------------------
 * It never constructs a request for the private-delivery or Seal kinds
 * (Commerce events published this way are, by definition, meant to be
 * public — a private Commerce event is out of this design's scope
 * entirely). It never signs with, stores, or logs any key material — the
 * `FedosNostrSigningAuthority` it depends on already enforces that. It
 * never retries a failed publish or selects which relay to use — both are
 * the injected `RelayPublisher`'s job.
 *
 * STATUS UPDATE (FedOS "Real Two-Party Commerce + UX P0/P1 Closure"
 * mega-arc, Agent N, re-verified live rather than trusted from this
 * comment's own prior claim) — `RealCommerceNostrEventTransport` IS
 * reachable from the shipped Electron app: `fedos_electron_beta_main.cts`'s
 * `commerceNostrOutboundPortFor()` constructs a real instance of it (real
 * signing authority + real `WebSocketRelayPublisher`) whenever a signer is
 * unlocked and a Relay is configured, and `handleCommerceProductPublish()`/
 * `handleCommerceProductUpdate()` both call through it on a real
 * publish/unpublish/field-edit. Still gated by `commerceNetworkProfile`
 * (`"local-only"` by default — see that file's own doc comments) and still
 * not part of `createCommerce()`'s own barrel. This wave's own automated
 * tests still cannot exercise THIS file directly (it needs a real,
 * compiled `FedosNostrSigningAuthority` WASM artifact this worktree does
 * not have) — `test/commerce_nostr_real_relay_two_party_discovery.test.ts`
 * proves the same publish->relay->discover pipeline for real over a real
 * local socket using real `@noble/curves` Schnorr signing instead (no
 * WASM dependency), which is what `test/commerce_nostr_event_*.test.ts`'s
 * own `InMemoryFakeCommerceNostrTransport`-based tests already established
 * as this codebase's precedent for testing this seam without WASM.
 */

import type { NostrEvent } from "../../../../messenger/adapters/nostr/protocol/types.js";
import type { RelayPublisher } from "../../../../messenger/adapters/nostr/protocol/publish.js";
import {
  freezeFedosNostrUnsignedEventRequest,
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "../../../../messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import {
  isWellFormedCommerceNostrEventDraft,
  type CommerceNostrEventDraft,
} from "../../../events/commerce_nostr_event_drafts.js";
import type {
  CommerceNostrEventTransport,
  CommerceNostrTransportSendResult,
} from "../../../events/commerce_nostr_event_port.js";

/** Fixed `kind` every Commerce Nostr event uses — see this file's header
 * for exactly why this is the only option the real signing authority
 * accepts. */
export const COMMERCE_NOSTR_EVENT_KIND = 1;

/** Builds the `["t", ...]` namespacing tag for a draft's category — the
 * SAME lookup a future inbound classifier could use to recognize a
 * Commerce event among ordinary kind-1 notes, mirroring `classify.ts`'s own
 * `T_PRODUCT_PREFIX` convention in this same directory. */
export function commerceNostrEventTopicTag(draft: CommerceNostrEventDraft): readonly [string, string] {
  return ["t", `fedos-commerce:${draft.category}:v1`];
}

/**
 * Builds the unsigned request `FedosNostrSigningAuthority.signEvent()`
 * expects, from an ALREADY-VALIDATED draft. Returns `null` (fails closed,
 * never throws) if the draft does not pass
 * `isWellFormedCommerceNostrEventDraft()` — this is a second, independent
 * check on top of whatever the caller already did, matching this file's
 * own "no crypto call reachable from an unvalidated draft" discipline.
 */
export function buildCommerceNostrUnsignedEventRequest(
  draft: CommerceNostrEventDraft,
  accountIndex: number,
  createdAt: number,
): FedosNostrUnsignedEventRequest | null {
  if (!isWellFormedCommerceNostrEventDraft(draft)) return null;

  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_NOSTR_EVENT_KIND,
    tags: [commerceNostrEventTopicTag(draft)],
    content: JSON.stringify(draft),
  };

  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

export interface RealCommerceNostrEventTransportOptions {
  readonly signingAuthority: FedosNostrSigningAuthority;
  readonly relayPublisher: RelayPublisher;
  readonly accountIndex: number;
  /** Returns the current Unix-seconds timestamp. Injectable for
   * determinism; defaults to the real system clock. */
  readonly now?: () => number;
}

/**
 * The ONE real `CommerceNostrEventTransport` implementation — signs an
 * already-validated draft via the injected `FedosNostrSigningAuthority`
 * (this repo's own reviewed Nostr signing seam) and hands the resulting
 * signed `NostrEvent` to the injected `RelayPublisher` (this repo's own
 * existing write-path). Never used by this wave's own tests (see this
 * file's header) — provided so a future wave can wire
 * `CommerceNostrEventPortImpl` to a real relay without inventing a new
 * signing or publish path.
 */
export class RealCommerceNostrEventTransport implements CommerceNostrEventTransport {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #relayPublisher: RelayPublisher;
  readonly #accountIndex: number;
  readonly #now: () => number;

  constructor(options: RealCommerceNostrEventTransportOptions) {
    this.#signingAuthority = options.signingAuthority;
    this.#relayPublisher = options.relayPublisher;
    this.#accountIndex = options.accountIndex;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult> {
    const request = buildCommerceNostrUnsignedEventRequest(draft, this.#accountIndex, this.#now());
    if (request === null) {
      return { accepted: false, eventId: "", message: "draft failed unsigned-request construction/validation" };
    }

    const signed: NostrEvent | null = await this.#signingAuthority.signEvent(request);
    if (signed === null) {
      return { accepted: false, eventId: "", message: "signing authority returned no signed event" };
    }

    const published = await this.#relayPublisher.publish(signed);
    return {
      accepted: published.accepted,
      eventId: published.eventId,
      message: published.message,
    };
  }
}

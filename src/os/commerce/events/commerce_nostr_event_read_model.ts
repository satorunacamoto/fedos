/**
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N) — the SUBSCRIBE/inbound
 * half `commerce_nostr_event_port.ts`'s own header explicitly left as a
 * gap for "a future Wave B+1 (or later) item": a transport-agnostic
 * `CommerceNostrProductReadModel` that consumes ALREADY-SIGNATURE-CHECKED
 * inbound Commerce Nostr envelopes and derives local Product state from
 * them — the "a second FedOS instance/read model consumes it" half of
 * this wave's own proof requirement.
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as the rest of
 * `src/os/commerce` (see `../README.md`): nothing here is wired into
 * `createCommerce()` or the shipped Electron app. Not reachable from the
 * shipped app.
 *
 * WHY THIS FILE STAYS TRANSPORT/PROTOCOL-AGNOSTIC
 * ----------------------------------------------------------------------
 * `src/os/commerce/events/` (this directory) may not import the real
 * Nostr protocol layer directly — only `../catalog/adapters/nostr/` may
 * (`test/architecture_boundary_commerce.test.ts`'s `NOSTR_ADAPTER_DIR`).
 * So this file never sees a `NostrEvent`. Instead it accepts
 * `InboundCommerceNostrEnvelope` below — a small, already-verified shape
 * ANY transport could produce. The real bridge from a signed `NostrEvent`
 * to this shape lives in
 * `../catalog/adapters/nostr/commerce_inbound_event_bridge.ts` (real
 * Schnorr signature verification via this repo's own
 * `NobleSignatureVerifier`); tests use a hand-built envelope or that real
 * bridge fed with real `@noble/curves`-signed events — never a public
 * relay.
 *
 * THE SAFETY GATE THIS FILE ENFORCES (load-bearing — read before editing
 * `ingest()`)
 * ----------------------------------------------------------------------
 * `ingest()` NEVER mutates `#products`/`#otherRecords` before ALL of the
 * following pass, in this exact order:
 *   1. Not a replay of an already-applied event id (`"duplicate"` —
 *      idempotent no-op, never re-applied, never an error).
 *   2. `envelope.signatureVerified === true` (`"rejected-unverified-
 *      signature"` otherwise — covers both a tampered event, whose id/sig
 *      no longer match its body, and any transport-level forgery; the
 *      bridge that sets this flag is the ONLY thing this file trusts for
 *      authorship, per this repo's own `SignatureVerifier` seam).
 *   3. `envelope.rawContent` passes `isWellFormedCommerceNostrEventDraft()`
 *      (`"rejected-unknown-shape"` otherwise — an unparseable/malformed/
 *      unrecognized-category content is never applied, never guessed at).
 *   4. Category-specific checks (below) — signer-identity consistency and
 *      monotonic-version ordering. A `product-update` for a productId this
 *      read model has never seen a `product-publication` for is rejected
 *      (`"rejected-unknown-product"` — the out-of-order case "update
 *      arrived before its publication"). A `product-update`/re-publication
 *      whose own timestamp does not strictly advance the currently-applied
 *      watermark is rejected (`"rejected-stale-version"` — the out-of-
 *      order/old-version case) WITHOUT mutating the current state — a late
 *      arriving stale event can never regress already-applied state. An
 *      event whose claimed authorship (`envelope.authorPubkeyHex`, the
 *      REAL verified signer) does not match the product's own established
 *      creator is rejected (`"rejected-signer-mismatch"` — catches a
 *      technically-validly-signed event from an attacker's OWN key that
 *      merely CLAIMS, inside its content, to be publishing/updating
 *      someone else's product; real signature verification alone does not
 *      catch this, since the attacker's signature is genuinely valid for
 *      the attacker's own key — this is a second, independent check).
 *
 * RESILIENCE (original brief's own explicit requirement)
 * ----------------------------------------------------------------------
 * `ingest()` is synchronous, total, and NEVER throws — a malformed
 * envelope, an absent/unreachable relay (this read model is never even
 * called in that case — there is nothing to catch), a merchant or customer
 * being offline (events simply arrive later, in whatever order; see
 * `test/commerce_nostr_event_read_model.test.ts`'s own "offline catch-up"
 * cases) — none of these can corrupt `#products`, crash the process, or
 * block any other Commerce domain code, because NOTHING in
 * `src/os/commerce`'s real domain logic (`catalog/`, `order/`, `payment/`,
 * `delivery/`, `receipt/`) reads from or depends on this read model at
 * all today (verified: no import of this file exists outside
 * `src/os/commerce/events/` and its own tests). Commerce's real product
 * data lives in `LocalProductRepository`
 * (`../catalog/local_product_repository.ts`) and is entirely
 * Nostr-independent; this read model is an OPTIONAL, additive mirror of
 * PUBLIC listing data a Nostr-enabled instance MAY also maintain.
 *
 * FIELD-BY-FIELD PRIVACY CLASSIFICATION OF THIS FILE'S OWN NEW SHAPES
 * ----------------------------------------------------------------------
 * (PUBLIC NOSTR / ENCRYPTED NOSTR / LOCAL ONLY / AUTHORIZED DISCLOSURE —
 * see `commerce_nostr_event_drafts.ts`'s own header for the outbound
 * draft fields; this section covers only the NEW fields this file adds.)
 *
 * `InboundCommerceNostrEnvelope`:
 *   - `eventId`            — PUBLIC NOSTR (it's the relay-assigned id of an
 *     already-public event; also used here purely as a LOCAL dedup key).
 *   - `authorPubkeyHex`    — PUBLIC NOSTR (the event's real signer, already
 *     public by definition of a signed public Nostr event).
 *   - `signatureVerified`  — LOCAL ONLY (this instance's own local
 *     verification bookkeeping; never transmitted anywhere, never read
 *     from the wire).
 *   - `receivedAt`         — LOCAL ONLY (this instance's own local-clock
 *     observation time; NOT trusted as an authorship timestamp and never
 *     published).
 *   - `rawContent`         — mirrors whatever the wrapped draft's own
 *     fields are classified as (see `commerce_nostr_event_drafts.ts`) —
 *     this file does not add a new field here, only carries it.
 *
 * `CommerceReadModelProductView` (derived, LOCAL read-model state — never
 * itself published; every field mirrors an already-PUBLIC-NOSTR field of
 * `ProductPublicationEventDraft`/`ProductUpdateEventDraft`, so this
 * derived copy carries the SAME classification as its source field, not a
 * new one):
 *   - `productId`/`creatorPubkeyHex`/`productKind`/`title`/`description`/
 *     `priceCents`/`currency`/`status` — PUBLIC NOSTR (copied verbatim
 *     from an already-validated, already-public draft).
 *   - `lastEventId`/`lastAppliedAtUnixSeconds` — LOCAL ONLY (this read
 *     model's own bookkeeping of which event produced the current view and
 *     the version watermark used for out-of-order rejection).
 */

import {
  isWellFormedCommerceNostrEventDraft,
  type CommerceNostrProductKindMirror,
  type CommercePublicProductStatus,
} from "./commerce_nostr_event_drafts.js";

// ---------------------------------------------------------------------------
// Inbound envelope — the ONE shape this file accepts from any transport.
// ---------------------------------------------------------------------------

/**
 * What ANY transport (a real relay bridge, a test fake) must produce
 * before handing an inbound event to `CommerceNostrProductReadModel`.
 * `signatureVerified` MUST have been computed by a real (or, in tests,
 * deliberately fake) `SignatureVerifier`-shaped check BEFORE this object
 * is constructed — this file performs no cryptography itself and trusts
 * this flag as its sole authorship signal.
 */
export interface InboundCommerceNostrEnvelope {
  /** Transport-assigned event id (a real relay's NIP-01 event id, or a
   * test double's own stable id). Used as the idempotent replay-dedup
   * key. */
  readonly eventId: string;
  /** The event's REAL verified signer (hex pubkey) — never a claim read
   * out of the event's own content. */
  readonly authorPubkeyHex: string;
  /** True only if a real signature+id check already passed for this exact
   * event body. `false` (or an event never verified at all) is always
   * treated as "reject", never "trust anyway". */
  readonly signatureVerified: boolean;
  /** This read model instance's own local-clock observation time (unix
   * seconds). LOCAL ONLY — see this file's header. */
  readonly receivedAt: number;
  /** The event's content, ALREADY JSON-parsed by the caller (or
   * `undefined` if parsing failed — this file treats that identically to
   * any other malformed shape, never throws on it). */
  readonly rawContent: unknown;
}

// ---------------------------------------------------------------------------
// Derived read-model state
// ---------------------------------------------------------------------------

/** The read model's own derived view of one PUBLIC product. Every field
 * mirrors an already-public draft field — see this file's header. */
export interface CommerceReadModelProductView {
  readonly productId: string;
  readonly creatorPubkeyHex: string;
  readonly productKind: CommerceNostrProductKindMirror;
  readonly title: string;
  readonly description?: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly status: CommercePublicProductStatus;
  /** Event id that produced this exact view — local bookkeeping only. */
  readonly lastEventId: string;
  /** Monotonic watermark (the applied event's own `publishedAt`/
   * `updatedAt`) used to reject stale/out-of-order updates. Local
   * bookkeeping only, never published. */
  readonly lastAppliedAtUnixSeconds: number;
}

export type CommerceNostrIngestOutcome =
  | "applied"
  | "duplicate"
  | "rejected-unverified-signature"
  | "rejected-unknown-shape"
  | "rejected-signer-mismatch"
  | "rejected-stale-version"
  | "rejected-unknown-product";

export interface CommerceNostrIngestResult {
  readonly outcome: CommerceNostrIngestOutcome;
  readonly reason: string;
  /** Present when the ingested event was a `product-publication` or
   * `product-update` (applied, duplicate, or rejected for a product-scoped
   * reason) — the productId it concerned, for caller convenience. */
  readonly productId?: string;
}

/**
 * The one real read-model implementation this wave ships. Purely
 * in-memory, synchronous, total (never throws). See this file's header
 * for the full safety-gate ordering and resilience guarantees.
 */
export class CommerceNostrProductReadModel {
  readonly #appliedEventIds = new Set<string>();
  readonly #products = new Map<string, CommerceReadModelProductView>();
  /** Non-product categories (order-commitment / trade-completion-
   * attestation / reputation-attestation / media-manifest-reference) —
   * this wave gives them dedup-only bookkeeping (no versioning/signer
   * semantics defined yet for those categories; see this file's header). */
  readonly #otherRecords = new Map<string, { readonly category: string; readonly eventId: string }>();

  ingest(envelope: InboundCommerceNostrEnvelope): CommerceNostrIngestResult {
    if (this.#appliedEventIds.has(envelope.eventId)) {
      return {
        outcome: "duplicate",
        reason: "event id already applied — idempotent no-op, state unchanged",
      };
    }

    if (!envelope.signatureVerified) {
      return {
        outcome: "rejected-unverified-signature",
        reason: "signature/id verification did not pass — event is untrusted, possibly tampered",
      };
    }

    const draft = envelope.rawContent;
    if (!isWellFormedCommerceNostrEventDraft(draft)) {
      return {
        outcome: "rejected-unknown-shape",
        reason: "event content is not a recognized, well-formed Commerce Nostr event draft",
      };
    }

    switch (draft.category) {
      case "product-publication": {
        const existing = this.#products.get(draft.productId);
        if (existing !== undefined) {
          if (existing.creatorPubkeyHex !== envelope.authorPubkeyHex) {
            return {
              outcome: "rejected-signer-mismatch",
              reason: "product-publication signer does not match the product's already-established creator",
              productId: draft.productId,
            };
          }
          if (draft.publishedAt <= existing.lastAppliedAtUnixSeconds) {
            return {
              outcome: "rejected-stale-version",
              reason: "publication timestamp does not advance the currently-applied watermark",
              productId: draft.productId,
            };
          }
        }
        if (draft.creatorPubkey !== envelope.authorPubkeyHex) {
          return {
            outcome: "rejected-signer-mismatch",
            reason: "draft's own claimed creatorPubkey does not match the event's real verified signer",
            productId: draft.productId,
          };
        }
        this.#products.set(draft.productId, {
          productId: draft.productId,
          creatorPubkeyHex: envelope.authorPubkeyHex,
          productKind: draft.productKind,
          title: draft.title,
          description: draft.description,
          priceCents: draft.priceCents,
          currency: draft.currency,
          status: draft.status,
          lastEventId: envelope.eventId,
          lastAppliedAtUnixSeconds: draft.publishedAt,
        });
        this.#appliedEventIds.add(envelope.eventId);
        return { outcome: "applied", reason: "product-publication applied", productId: draft.productId };
      }

      case "product-update": {
        const existing = this.#products.get(draft.productId);
        if (existing === undefined) {
          return {
            outcome: "rejected-unknown-product",
            reason: "product-update arrived before any product-publication for this productId — out of order",
            productId: draft.productId,
          };
        }
        if (existing.creatorPubkeyHex !== envelope.authorPubkeyHex) {
          return {
            outcome: "rejected-signer-mismatch",
            reason: "product-update signer does not match the product's established creator",
            productId: draft.productId,
          };
        }
        if (draft.updatedAt <= existing.lastAppliedAtUnixSeconds) {
          return {
            outcome: "rejected-stale-version",
            reason: "update timestamp does not advance the currently-applied watermark — stale/out-of-order, ignored",
            productId: draft.productId,
          };
        }
        this.#products.set(draft.productId, {
          ...existing,
          title: draft.title ?? existing.title,
          description: draft.description ?? existing.description,
          priceCents: draft.priceCents ?? existing.priceCents,
          currency: draft.currency ?? existing.currency,
          status: draft.status ?? existing.status,
          lastEventId: envelope.eventId,
          lastAppliedAtUnixSeconds: draft.updatedAt,
        });
        this.#appliedEventIds.add(envelope.eventId);
        return { outcome: "applied", reason: "product-update applied", productId: draft.productId };
      }

      default: {
        // order-commitment / trade-completion-attestation /
        // reputation-attestation / media-manifest-reference: dedup-only
        // bookkeeping this wave — see this file's header.
        this.#otherRecords.set(envelope.eventId, { category: draft.category, eventId: envelope.eventId });
        this.#appliedEventIds.add(envelope.eventId);
        return { outcome: "applied", reason: `${draft.category} recorded (dedup-only)` };
      }
    }
  }

  getProduct(productId: string): CommerceReadModelProductView | undefined {
    return this.#products.get(productId);
  }

  /** Test/introspection helper — total count of distinct event ids ever
   * successfully applied (products + other categories combined). */
  get appliedEventCount(): number {
    return this.#appliedEventIds.size;
  }

  /** Test/introspection helper — total count of distinct non-product
   * records recorded (dedup-only categories). */
  get otherRecordCount(): number {
    return this.#otherRecords.size;
  }
}

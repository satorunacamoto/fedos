/**
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N) — bridges a real,
 * received `NostrEvent` into the transport-agnostic
 * `InboundCommerceNostrEnvelope` shape
 * (`../../../events/commerce_nostr_event_read_model.ts`'s own input),
 * performing REAL signature verification on the way in. This is the
 * inbound counterpart of `commerce_event_bridge.ts` (same directory,
 * outbound/publish-side, unmodified by this wave) — together the two
 * files are the ONLY places under `src/os/commerce` allowed to know about
 * a real `NostrEvent` shape or a real `SignatureVerifier`
 * (`test/architecture_boundary_commerce.test.ts`'s `NOSTR_ADAPTER_DIR`).
 *
 * NO NEW CRYPTO. Verification is delegated to `NobleSignatureVerifier`
 * (`../../../../messenger/adapters/nostr/protocol/noble_signature.ts`) —
 * this repo's own real, reviewed Schnorr/secp256k1 verifier — by default,
 * injectable for tests. Nothing in this file computes a hash, checks a
 * signature, or opens a socket itself.
 *
 * WHAT "VERIFIED" MEANS HERE, PRECISELY
 * ----------------------------------------------------------------------
 * `NobleSignatureVerifier.verify(event)` (see that file's own header)
 * recomputes `event.id` from `event`'s own body and rejects if it does
 * not match, THEN checks the Schnorr signature over that id under
 * `event.pubkey`. So `signatureVerified: true` here proves BOTH "this
 * event's id is a self-consistent hash of its own body" (catches
 * tampering — any post-signature content mutation changes the id, which
 * no longer matches) AND "the party holding `event.pubkey`'s private key
 * really signed it" (catches signature forgery). It does NOT prove that
 * `event.pubkey` is who a draft's own `creatorPubkey` field CLAIMS to be —
 * that is a separate, independent check
 * `CommerceNostrProductReadModel.ingest()` performs itself (see that
 * file's header on `"rejected-signer-mismatch"`), deliberately not done
 * here, so an attacker who signs genuinely with THEIR OWN key while
 * claiming someone else's `creatorPubkey` inside the content is still
 * caught downstream, defense in depth.
 *
 * STATUS UPDATE (FedOS "Real Two-Party Commerce + UX P0/P1 Closure"
 * mega-arc, Agent N) — this function IS now reachable from the shipped
 * Electron app: `fedos_electron_beta_main.cts`'s own
 * `commerceNostrDiscoverAndIngestProductsNonFatal()` calls it, real
 * production code, for every candidate event a real bounded Relay query
 * returns on Catalog load. Still not wired into `createCommerce()`'s own
 * barrel — reached through the main-process composition root instead,
 * same pattern `commerce_event_bridge.ts`'s own `RealCommerceNostrEventTransport`
 * already used for the outbound/publish side.
 */

import { isNostrEvent } from "../../../../messenger/adapters/nostr/protocol/event.js";
import { NobleSignatureVerifier } from "../../../../messenger/adapters/nostr/protocol/noble_signature.js";
import type { SignatureVerifier } from "../../../../messenger/adapters/nostr/protocol/signature.js";
import type { InboundCommerceNostrEnvelope } from "../../../events/commerce_nostr_event_read_model.js";

export interface CommerceInboundNostrBridgeOptions {
  /** Defaults to `NobleSignatureVerifier` — this repo's own real verifier.
   * Tests inject `RejectAllSignatureVerifier`/a custom fake instead of
   * ever reaching a real relay. */
  readonly verifier?: SignatureVerifier;
  /** Returns the current Unix-seconds timestamp for `receivedAt`.
   * Injectable for determinism; defaults to the real system clock. */
  readonly now?: () => number;
}

/**
 * Builds an `InboundCommerceNostrEnvelope` from an unknown wire value,
 * running REAL signature verification along the way. Never throws — an
 * unparseable/malformed `event` (not structurally a NIP-01 event at all —
 * the original brief's "unknown event shape" failure case) or a JSON
 * parse failure of `content` both resolve to a safely-rejectable envelope
 * (`signatureVerified: false` and/or `rawContent: undefined`) rather than
 * an exception — `CommerceNostrProductReadModel.ingest()` (the only
 * consumer of this envelope) already fails closed on both.
 */
export async function verifyAndBuildInboundCommerceNostrEnvelope(
  event: unknown,
  options: CommerceInboundNostrBridgeOptions = {},
): Promise<InboundCommerceNostrEnvelope> {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  if (!isNostrEvent(event)) {
    return {
      eventId: typeof (event as { id?: unknown } | null)?.id === "string" ? (event as { id: string }).id : "",
      authorPubkeyHex: "",
      signatureVerified: false,
      receivedAt: now(),
      rawContent: undefined,
    };
  }

  const verifier = options.verifier ?? NobleSignatureVerifier;
  let signatureVerified: boolean;
  try {
    signatureVerified = await verifier.verify(event);
  } catch {
    signatureVerified = false;
  }

  let rawContent: unknown;
  try {
    rawContent = JSON.parse(event.content);
  } catch {
    rawContent = undefined;
  }

  return {
    eventId: event.id,
    authorPubkeyHex: event.pubkey,
    signatureVerified,
    receivedAt: now(),
    rawContent,
  };
}

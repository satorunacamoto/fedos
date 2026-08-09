/**
 * Secure Runtime Alpha 222 ("Subscription Interface") — the FIRST file
 * of the Alpha 221–230 Nostr Subscription Foundation Arc to add real
 * code, following Alpha 221's own Decision to build a new,
 * Desktop-owned Subscription boundary rather than reuse
 * `src/nostr/relay.ts`/`ws_relay.ts`/`messages.ts` (all three
 * REQ/EOSE/CLOSE/Filter-oriented, all explicitly excluded by this
 * Arc's own instruction list). `FedosSubscription` is a NEW,
 * protocol-independent type — deliberately named and shaped like
 * `FedosRelay` (`fedos_relay.ts`, Alpha 212) itself: this Stage's own
 * entire deliverable is the "opaque identifier only" shape this Arc's
 * own Alpha 222 instruction names — a single `readonly id: string`
 * field, and nothing else. No filters, no relay reference, no callback,
 * no lifecycle state of any kind is attached to this type — a
 * `FedosSubscription` value is a plain, inert token a caller holds and
 * later hands back to `unsubscribe()` (Alpha 226).
 *
 * HARD GUARDRAILS:
 *   - `FedosSubscription` is the ONLY export.
 *   - `readonly id: string` is the ONLY field — no filter, relay
 *     reference, callback, or timestamp of any kind.
 *   - NO REQ, CLOSE, or wire-message vocabulary of any kind — this file
 *     defines a TYPE ONLY, no function, no class, no runtime behavior.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 */

export interface FedosSubscription {
  readonly id: string;
}

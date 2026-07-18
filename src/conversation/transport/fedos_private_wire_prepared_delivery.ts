/**
 * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") — Phase B, Alpha 1846/1847.
 *
 * CLOSES the Arc's own named blocker (see `fedos_private_transport.ts`'s
 * own header, and this file's sibling `fedos_conversation_transport_event.ts`):
 * the standard `nostr-nip17-v1` route structurally requires the ORIGINAL
 * plaintext to build its Rumor -> Seal -> Gift Wrap, but plaintext must
 * never be retained by Transport/Outbox/Observation (Alpha 1842's own
 * frozen "Plaintext Ownership Decision"). This file names the ONE opaque
 * result a caller (`FedosConversationDirectMessagingCoordinator`,
 * `FedosGroupSendCoordinator` transitively) hands to
 * `FedosPrivateTransport` in place of plaintext, once preparation is done:
 *
 *   plaintext (application send operation, ephemeral)
 *     -> NostrNip17V1WireAdapter.build()  (already-signed native event)
 *     -> FedosPreparedPrivateDelivery      (THIS file — opaque, durable-safe)
 *     -> FedosPrivateTransport.sendMailboxNip17() persists it
 *
 * Alpha 1848 (Retry Stability) — OPTION A is adopted, not Option B: the
 * EXACT signed Gift Wrap event is persisted verbatim and replayed on every
 * retry. This is the only sound choice given Alpha 1842's own "plaintext
 * is never retained" rule — Option B ("regenerate safe outer wraps")
 * would require plaintext at retry time, which by design no longer
 * exists. It is also cheap and correct: `NostrNip17V1WireAdapter.build()`
 * (Phase G of the prior Arc, Alpha 1788) already produces a FULLY SIGNED
 * `FedosNostrWireEvent` — signed once, by a single-use ephemeral Gift-Wrap
 * key (Alpha 1779/1780 of that Arc) — so replaying the SAME bytes on
 * retry never reuses a consumed ephemeral PRIVATE key (only the ALREADY-
 * PUBLIC signed event is replayed) and never mints a second, competing
 * Gift Wrap for the same logical delivery.
 *
 * HARD GUARDRAILS:
 *   - NO plaintext field anywhere in this file.
 *   - NO raw key (ephemeral or otherwise) anywhere in this file.
 *   - `FedosPreparedPrivateDelivery` carries ONLY: route, the LOCAL
 *     canonical envelope/conversation identity, the recipient's public
 *     key, and the already-signed native event — exactly what Alpha 1846
 *     names, nothing more.
 */

import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";

/** Alpha 1846 — immutable, opaque, NO plaintext, NO raw key. */
export interface FedosPreparedPrivateDelivery {
  readonly route: "nostr-nip17-v1";
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly recipientPublicKeyHex: string;
  readonly nativeEvent: FedosNostrWireEvent;
  readonly createdAt: number;
}

/**
 * Alpha 1847 — the ONE closed preparation-failure vocabulary every
 * preparation call site returns. No raw `Error` ever crosses this
 * boundary publicly.
 */
export type FedosPrivateWirePreparationOutcome =
  | { readonly outcome: "prepared"; readonly delivery: FedosPreparedPrivateDelivery }
  | { readonly outcome: "route-unavailable" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "crypto-unavailable" }
  | { readonly outcome: "unsupported-recipient" }
  | { readonly outcome: "failed" };

/**
 * Alpha 1850/1852 — the end-to-end outcome `FedosPrivateTransport.sendMailboxNip17()`
 * returns to its caller: preparation outcomes above, widened with the
 * ADDITIVE durable-enqueue outcomes this method alone can produce.
 * `"queued"` NEVER means "a Relay accepted it" (Alpha 1851's own "never
 * label Relay ACK as recipient delivery" instruction) — it means only
 * that the already-signed Gift Wrap is now durably queued for the
 * existing Mailbox Delivery Scheduler to publish on its own next tick.
 */
export type FedosPrivateWireDeliveryQueueOutcome =
  | { readonly outcome: "queued"; readonly envelopeId: string }
  | { readonly outcome: "route-unavailable" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "crypto-unavailable" }
  | { readonly outcome: "unsupported-recipient" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "failed" };

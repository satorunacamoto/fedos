/**
 * Secure Runtime Alpha 1614 ("Proprietary Route Status") — part of the
 * Alpha 1611–1690 Nostr Private Wire Standardization and Transport
 * Reconciliation Arc.
 *
 * `FedosPrivateV1WireAdapter` implements `FedosPrivateWireAdapter`
 * (`fedos_private_wire_adapter.ts`) as a thin, real, behavior-preserving
 * wrapper around the EXISTING `buildFedosPrivateTransportUnsignedEventRequest()`/
 * `parseFedosPrivateTransportEventDescriptor()` functions
 * (`fedos_conversation_transport_event.ts`, Alpha 1471–1540, kind-1
 * closed by this Arc's own Alpha 1615). No new crypto, no new wire
 * shape, no new tag — this file adds a NAME and a STATUS to behavior
 * that already existed.
 *
 * EXACT STATUS OF `kind: FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` (24700),
 * recorded here per this Arc's own Alpha 1614 instruction:
 *   - FedOS proprietary — invented by this repository (Alpha 1399/1402),
 *     not a registered NIP number.
 *   - Recipient-specific encrypted delivery — one wire event per
 *     recipient, ciphertext from the existing pairwise ECDH+AEAD scheme
 *     (Alpha 861–890/1261–1320), never a shared group key.
 *   - NOT interoperable with standard Nostr clients — a generic Nostr
 *     client has no reason to know this kind, and will not render or
 *     decrypt it.
 *   - Explicit opt-in only — a caller must construct a
 *     `FedosPrivateTransport` (`privateTransportEnabled: true`) or use
 *     `conversationRuntime().privateNostrDelivery()` explicitly; neither
 *     is ever activated implicitly.
 *   - Versioned — this adapter's own `route` is the literal string
 *     `"fedos-private-v1"`; a future incompatible proprietary wire
 *     change would be `"fedos-private-v2"`, a NEW adapter, never a
 *     silent reinterpretation of this one.
 *   - NEVER presented as NIP-17 — no doc comment, log message, or type
 *     name anywhere this Arc touches claims NIP-17/NIP-44/NIP-59
 *     compliance for this adapter (verified: `docs/secure_runtime_alpha_1611_1690_phase_a_reconciliation.md`
 *     §2 and this Arc's own structural guard test).
 */

import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import {
  buildFedosPrivateTransportUnsignedEventRequest,
  parseFedosPrivateTransportEventDescriptor,
} from "./fedos_conversation_transport_event.js";
import type {
  FedosPrivateWireAdapter,
  FedosPrivateWireBuildInput,
  FedosPrivateWireBuildResult,
  FedosPrivateWireParseResult,
} from "./fedos_private_wire_adapter.js";

export class FedosPrivateV1WireAdapter implements FedosPrivateWireAdapter {
  readonly route = "fedos-private-v1" as const;

  /** Always available — this is the existing, real, already-proven proprietary wire shape. */
  isAvailable(): boolean {
    return true;
  }

  build(input: FedosPrivateWireBuildInput): FedosPrivateWireBuildResult {
    return { outcome: "built", request: buildFedosPrivateTransportUnsignedEventRequest(input) };
  }

  parse(descriptor: FedosEventDescriptor): FedosPrivateWireParseResult {
    const parsed = parseFedosPrivateTransportEventDescriptor(descriptor);
    return parsed === null ? { outcome: "not-mine" } : { outcome: "parsed", event: parsed };
  }
}

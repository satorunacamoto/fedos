/**
 * Secure Runtime Alpha 1616/1617 — part of the Alpha 1611–1690 Nostr
 * Private Wire Standardization and Transport Reconciliation Arc.
 *
 * `NostrNip17V1WireAdapter` implements the SAME `FedosPrivateWireAdapter`
 * interface (`../../transport/fedos_private_wire_adapter.ts`)
 * `FedosPrivateV1WireAdapter` does, as the standard-route half of the
 * Alpha 1616 freeze diagram. It is permanently `isAvailable() === false`
 * today, and every `build()`/`parse()` call resolves to `"unsupported"`
 * — never a thrown error, never a partial/best-effort event, never a
 * silent fallback to the proprietary route (Alpha 1648's own
 * No-Downgrade Rule is this class's caller's responsibility to respect;
 * THIS class simply never offers anything to downgrade FROM).
 *
 * WHY unavailable, precisely (see
 * `docs/secure_runtime_alpha_1611_1690_phase_b_normative_source_gate.md`
 * §4 for the full reasoning) — NOT because normative material is
 * missing:
 *
 *   - This Arc fetched and checked in verbatim NIP-17/NIP-44/NIP-59
 *     text at a pinned upstream revision
 *     (`docs/normative/nostr-protocol-nips/{17,44,59}.md`,
 *     `nostr-protocol/nips@bdfa7e62ef87fcfcb992b1a27aee49d36b0b4f91`).
 *     The Alpha 1617 Normative Source Gate's own "material cannot be
 *     accessed" blocker is RESOLVED.
 *   - What is genuinely missing is the real IMPLEMENTATION: the exact
 *     `kind:14` Rumor model (Alpha 1622), `kind:13` Seal model (Alpha
 *     1623), a narrow ephemeral Gift-Wrap signing authority with no
 *     deterministic Master-Seed derivation (Alpha 1624), and the
 *     `kind:1059` Gift Wrap model itself (Alpha 1625) — real,
 *     security-sensitive protocol code this Arc's own scope decision
 *     (§4 of the gate document) deliberately defers to the recommended
 *     next Arc, rather than rushing it inside this Arc's own
 *     already-completed reconciliation/kind-1-closure work.
 *
 * This file will gain a real implementation in a future Arc WITHOUT
 * this interface changing — `FedosPrivateWireAdapter` is exactly the
 * seam Alpha 1616 exists to make that possible without touching
 * `FedosPrivateTransport` again.
 */

import type { FedosEventDescriptor } from "../../../../desktop/fedos_event_descriptor.js";
import type {
  FedosPrivateWireAdapter,
  FedosPrivateWireBuildInput,
  FedosPrivateWireBuildResult,
  FedosPrivateWireParseResult,
} from "../../../transport/fedos_private_wire_adapter.js";

export class NostrNip17V1WireAdapter implements FedosPrivateWireAdapter {
  readonly route = "nostr-nip17-v1" as const;

  /** Always `false` today -- see this file's own header for the exact, honest reason (not a missing-spec blocker). */
  isAvailable(): boolean {
    return false;
  }

  /** `input` is intentionally unused -- every call resolves to `"unsupported"`, never a partial event built from it. */
  build(_input: FedosPrivateWireBuildInput): FedosPrivateWireBuildResult {
    return { outcome: "unsupported" };
  }

  /** `descriptor` is intentionally unused -- every call resolves to `"unsupported"`, never a best-effort partial parse. */
  parse(_descriptor: FedosEventDescriptor): FedosPrivateWireParseResult {
    return { outcome: "unsupported" };
  }
}

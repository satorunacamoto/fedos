# FedOS Commerce — Decentralized/Serverless Data Plane (Architecture Validation)

Status: **DESIGN ONLY — no source changed by this document.**
Arc: FedOS Commerce Decentralized Media / Nostr Trade Reputation / Serverless Mode Architecture Validation Arc.
Grounded against commit `db53a64282484c8884417ee5d060030646efb730` (the merged FedOS Commerce E2E audit lineage).

This document is the top-level map. Detail docs:

- [COMMERCE-MEDIA-STORAGE.md](./COMMERCE-MEDIA-STORAGE.md) — `MediaStorePort`, encrypt-before-IPFS, media manifest
- [PSEUDONYMOUS-REPUTATION.md](./PSEUDONYMOUS-REPUTATION.md) — reputation/attestation model
- [PERSONA-EPOCH-ROTATION.md](./PERSONA-EPOCH-ROTATION.md) — epoch rotation, carry-over proof
- [COMMERCE-PRIVACY-DATA-CLASSIFICATION.md](./COMMERCE-PRIVACY-DATA-CLASSIFICATION.md) — field-by-field disclosure classification
- [SERVERLESS-COMMERCE-THREAT-MODEL.md](./SERVERLESS-COMMERCE-THREAT-MODEL.md) — Tor threat model + tabletop
- [../commerce/COMMERCE-IMPLEMENTATION-ROADMAP.md](../commerce/COMMERCE-IMPLEMENTATION-ROADMAP.md) — reconciliation with the E2E audit phases + recommended build order

## 0. Non-negotiable constraints carried into this design

These are existing, already-enforced architecture facts this design must not violate:

1. **`src/os/commerce` may never import `src/os/messenger`, `os/trust`, `os/nostr`, `os/board`, `os/device`, or `os/desktop`.** Enforced today by `test/architecture_boundary_commerce.test.ts`. Any Nostr/IPFS/Tor access from Commerce domain code must go through an injected Port, never a direct import.
2. **`src/os/trust` may never import `src/os/commerce`.** Enforced by `test/architecture_boundary_trust.test.ts:35`. Trust stays a narrow, reusable primitive; Commerce composes Trust primitives from the outside (composition root), Trust never knows Commerce exists.
3. **`createCommerce(deps: CommerceDependencies = {})` is pure aggregation, zero I/O, always safe with no arguments** (`src/os/commerce/create_commerce.ts:36-82`). Every new capability in this design must be an *optional* dependency injected the same way (`catalog?`, `payments?`, `marketplace?`, and — new — `media?`, `network?`), never a hard-wired import inside `create_commerce.ts`.
4. **No `Order` type exists anywhere in the repo today.** `PaymentStatus` has no `"paid"` state (`src/os/commerce/payment/types.ts`). This design does not introduce them either — order/payment modeling is explicitly out of scope for this arc (see §13/roadmap).
5. **IPFS is unused** (only a deliberately-inert `_legacy_prototype/asset/ipfs_asset_cache.ts` and a retired `"ipfs_placeholder"` label on the retired `StorageBackend` seam — do not resurrect `StorageBackend` for this).
6. **Tor has zero implementation** (`src/os/messenger/onion/` is a README only). Any Tor reference in this design is a *transport profile flag*, not new onion-routing code.
7. **The real Nostr signing authority allow-lists exactly 3 event kinds today** (`kind 1`, a proprietary private-delivery kind, `kind 13` NIP-59 seal — `fedos_nostr_signing_authority.ts:42-48`). New Commerce event kinds are a real, tracked *future* extension point, not something this design silently assumes already works.
8. **Reputation scaffolding already rejects numeric scores.** `src/os/commerce/creator/reputation.ts` explicitly has "NO aggregation, NO scoring algorithm" and its `reviewReputationSignal()` rejects signals whose `reason`/`metadata` contain `score`/`weight`/`rank`. This design's reputation model (§7 in the arc goal, detailed in `PSEUDONYMOUS-REPUTATION.md`) must stay consistent with that existing philosophy: coarse labels/buckets, not scores.

## 1. Layered architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Commerce domain (src/os/commerce/**)                                │
│  Product, ProductMedia reference, PurchaseGrant, (future) Order      │
│  — depends ONLY on Ports below, never on Nostr/IPFS/Tor packages     │
└───────────────┬───────────────────────┬───────────────┬─────────────┘
                │ MediaStorePort         │ CommerceEventPort │ NetworkProfilePort (read-only)
                ▼                         ▼                   ▼
┌───────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────┐
│ LocalMediaStore        │  │ NostrCommerceEventPort   │  │ FedosNetworkProfile    │
│ IpfsMediaStore         │  │  → existing              │  │ resolver               │
│ (adapters, optional)   │  │  FedosNostrSigningAuthority│ │ (capability-manifest  │
│                        │  │  + RelayPublisher (existing)│ │  style, read-only)   │
└───────────────────────┘  └─────────────────────────┘  └───────────────────────┘
```

Composition root (Electron main / `loadRootModules()`) decides *which* adapters to inject at startup, based on the active `FedosNetworkProfile`. Commerce domain code never branches on "am I on Tor" or "is IPFS available" — it only calls the Port interface it was given.

## 2. `FedosNetworkProfile`

Modeled on the existing capability-manifest discipline in `fedos_desktop_beta_capability_manifest.ts` (closed status vocabulary + closed id vocabulary + versioned, frozen manifest + a single boundary-safe accessor function) — not invented from scratch.

```ts
type FedosNetworkProfileId =
  | "local"           // no serverless data plane at all — today's default
  | "nostr"           // Nostr relays only (existing NIP-01/17/44/59 stack), no IPFS, no Tor
  | "tor_nostr_ipfs";  // Nostr + IPFS + Tor transport profile — fully optional, off by default

interface FedosNetworkProfileEntry {
  readonly id: FedosNetworkProfileId;
  readonly mediaStore: "local-only" | "local-and-ipfs";
  readonly eventPlane: "none" | "nostr";
  readonly transport: "direct" | "tor-only" | "tor-preferred";
  readonly requiresNetwork: boolean;
  readonly userVisibleLabel: string;
  readonly coarseLimitation: string; // non-secret, renderable in Settings
}
```

- `local`: `MediaStorePort` → `LocalMediaStore` only; no Nostr Commerce events published; matches "0 network dependency" required by Phase 1 of the reachable-catalog roadmap.
- `nostr`: adds `NostrCommerceEventPort` (small signed events/attestations only — never media bytes, per §4).
- `tor_nostr_ipfs`: adds `IpfsMediaStore` for ciphertext blobs and marks relay/gateway connections as Tor-routed at the transport layer. This is the only profile where large media ever leaves the device.

**Every profile is optional and defaults to `local`.** `createCommerce()` with no `network` dependency must remain exactly as safe as it is today (zero I/O). This satisfies the arc's own hard requirement ("It must remain optional").

## 3. Why Ports, not direct SDK calls

Nostr publishing already lives behind its own internal abstractions (`RelayPublisher`, `FedosNostrSigningAuthority`) inside `src/os/messenger/adapters/nostr/`. Commerce must **not** import those modules directly — that would violate the existing `os/commerce → os/messenger` boundary ban (constraint 1 above). Instead:

- A new `NostrCommerceEventPort` interface is defined under `src/os/core/ports/` (same location as `messaging_port.ts`, `conversation_port.ts`, `transport_port.ts` today), with a signature narrow enough to only *publish a pre-built signed event* and *does not* let Commerce construct raw Nostr wire structures itself.
- The composition root wires a real adapter (`FedosCommerceNostrEventPortAdapter`, in `src/os/messenger/adapters/` next to the existing `FedosMessengerMessagingPortAdapter`) that internally reuses the existing signing authority / relay publisher — Commerce never sees them.
- This mirrors the existing `MessagingPort` → `FedosMessengerMessagingPortAdapter` pattern exactly, so it costs the codebase zero new architectural concepts.

## 4. Non-goals of this arc

- No `MediaStorePort` implementation is written. No IPFS client dependency is added to `package.json`. No Tor code is written.
- No Nostr event kind allocation is finalized/registered in the signing authority's allow-list — that is a tracked follow-up decision (see roadmap), not a fact of this document.
- No reputation storage, scoring, or aggregation is implemented.
- No change to `Order`/`Payment` types.

## 5. Open decisions (must be resolved before Phase 2+ implementation)

1. Exact Nostr event `kind` numbers for `ProductPublication`/`ProductUpdate`/`OrderCommitment`/`TradeCompletionAttestation`/`ReputationAttestation`/`MediaManifestReference` — needs either a real NIP-99-style classified-listing kind (mentioned only as a future idea in `docs/nostr_adapter_planning.md:93`, never implemented) or a proprietary kind range, and needs `FedosNostrUnsignedEventRequest`'s allow-list extended.
2. Which team/arc owns extending `src/os/core/ports/` vs. keeping the new ports colocated under `src/os/commerce/ports/` (either is architecturally legal; existing precedent favors the shared `core/ports` location for anything a non-Messenger adapter might also need).
3. IPFS pinning/availability strategy (who pins ciphertext blobs, for how long) is unresolved — flagged as a threat-model gap in `SERVERLESS-COMMERCE-THREAT-MODEL.md` (§ "ciphertext unavailable").

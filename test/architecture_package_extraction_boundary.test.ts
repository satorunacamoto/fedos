import { describe, it, expect } from "vitest";
// @ts-expect-error `.mjs` has no type declarations in this project's tsconfig -- mirrors architecture_cycle_detector.test.ts's own pattern for this sibling script.
import { runScan, ROOTS } from "../scripts/package_extraction_boundary_scan.mjs";

/**
 * Package Extraction Readiness (Compatibility Facade Reduction + Package
 * Extraction Readiness + Remaining Architecture Debt Closure arc, Agent P,
 * Half B) — the automated proof `docs/architecture/PACKAGE-EXTRACTION-PLAN.md`
 * points to. Runs `scripts/package_extraction_boundary_scan.mjs`'s real
 * import-graph scan (reusing `architecture_cycle_detector.mjs`'s own
 * resolution logic) and asserts on its output directly, rather than
 * re-implementing the scan in yet a third place.
 *
 * BASELINE, NOT ZERO: unlike the existing `architecture_boundary_*.test.ts`
 * suite (which enforces zero cross-domain imports for rules already fully
 * satisfied today), this file's own baseline is the CURRENTLY MEASURED
 * blocker count — package extraction is honestly NOT fully ready yet (see
 * the plan doc's own READY/PARTIAL/BLOCKED verdict). This test exists so a
 * FUTURE regression (a new `os/core`/`os/messenger`/`os/commerce` file
 * importing outside its declared roots) is caught immediately, and so a
 * future FIX (reducing the count) requires deliberately updating this
 * test's own number — never a silent widening.
 *
 * UPDATED by the Runtime Ownership Extraction Arc: baseline was 48 (this
 * test's original number) / 46 (re-measured, authoritative, at this arc's
 * start — 2 of the original 48 had already been fixed by an earlier
 * commit). This arc closed Root Cause A (`src/runtime/`'s 19-file live
 * closure moved to `os/core`, 36 blockers) and Root Causes C (2 stray
 * old-path imports) and D's dead-`_legacy_prototype` edges (5 blockers),
 * leaving exactly **3**: Root Cause B (`os/core/crypto/fedos_core_adapter.ts`
 * → `packages/fedos-core-rust`, blocked on real npm workspaces not existing
 * yet) and Root Cause D's 2 SANCTIONED `os/commerce` → `os/messenger`
 * `NostrEvent` edges (an open design decision the plan doc explicitly
 * defers to a future extraction arc, not a mechanical gap). See
 * `docs/architecture/RUNTIME-OWNERSHIP-EXTRACTION-FINAL-VALIDATION.md`.
 */

describe("package extraction boundary scan (scripts/package_extraction_boundary_scan.mjs)", () => {
  it("declares exactly the four roots this arc's plan covers", () => {
    expect(Object.keys(ROOTS).sort()).toEqual(
      ["apps/desktop-electron-spike", "os/commerce", "os/core", "os/messenger"].sort(),
    );
  });

  it("finds at least one file under every declared root (sanity -- catches an accidentally-empty root, e.g. a path-separator bug)", () => {
    const { closures } = runScan();
    for (const [rootKey, result] of Object.entries(closures) as [string, { fileCount: number }][]) {
      expect(result.fileCount, `expected ${rootKey} to have at least one file`).toBeGreaterThan(0);
    }
  });

  it("the Electron app root (os/core + os/messenger + os/commerce allowed) has ZERO blockers today -- the one root already ready", () => {
    const { blockers } = runScan();
    const appBlockers = blockers.filter((b: { root: string }) => b.root === "apps/desktop-electron-spike");
    expect(appBlockers).toEqual([]);
  });

  it("does not regress past the currently-measured blocker baseline (40, up from 35 -- FedOS 'Real Digital Delivery + Security UX + Release Closure' mega-arc, Agent G, Coordinator-directed merge -- a new violation must update this number deliberately, never silently)", () => {
    // Commerce E2E Completion arc, Wave B: 4 new, DELIBERATE, reviewed blockers on
    // top of the pre-existing 3 (os/core -> packages/fedos-core-rust; the two
    // pre-existing catalog/adapters/nostr/{bridge,classify}.ts -> os/messenger
    // imports) -- every one of the 4 new ones is the SAME kind of already-reviewed,
    // narrowly-scoped adapter-directory exception the pre-existing 2 already
    // established, not a new category of leak:
    //   - catalog/adapters/nostr/commerce_event_bridge.ts (Agent N) -> os/messenger's
    //     Nostr protocol layer, 3 import sites -- lives in the SAME
    //     NOSTR_ADAPTER_DIR (`test/architecture_boundary_commerce.test.ts`) the two
    //     pre-existing files already use; extends, does not widen, that allowlist.
    //   - receipt/commerce_trust_receipt_adapter.ts (Agent T) -> src/os/trust/index.js,
    //     1 import site -- the ONE reviewed Commerce->Trust seam Agent R's own Wave A
    //     design explicitly named as the future integration point (Gap #8,
    //     docs/commerce/COMMERCE-GAP-CLASSIFICATION.md); `test/architecture_boundary_commerce.test.ts`
    //     does not forbid this direction today (confirmed, re-verified independently
    //     by both Agent R and Agent T), and `test/architecture_boundary_trust.test.ts`
    //     only forbids the opposite direction.
    //
    // Commerce FINAL Closure Mega-Arc (Agent N): 3 more new, DELIBERATE,
    // reviewed blockers on top of the prior 7 -- the SUBSCRIBE/inbound
    // counterpart of the existing outbound bridge:
    //   - catalog/adapters/nostr/commerce_inbound_event_bridge.ts (Agent N) ->
    //     os/messenger's Nostr protocol layer, 3 import sites (`event.js`'s
    //     `isNostrEvent`, `noble_signature.js`'s `NobleSignatureVerifier`,
    //     `signature.js`'s `SignatureVerifier` type) -- lives in the SAME
    //     NOSTR_ADAPTER_DIR the outbound `commerce_event_bridge.ts` already
    //     uses; same narrowly-scoped exception, not a new category of leak.
    //     This file performs real signature verification on inbound Commerce
    //     Nostr events (`../../../events/commerce_nostr_event_read_model.ts`'s
    //     own input) -- it is the read-side of the SAME adapter boundary the
    //     write-side blockers above already crossed.
    // FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
    // Coordinator-directed pass): 6 more new, DELIBERATE, reviewed blockers
    // on top of the prior 10 -- all 6 from ONE new file,
    // catalog/adapters/nostr/commerce_private_order_bridge.ts, the PRIVATE
    // Order/status transport (arc items #4/#5). Lives in the SAME
    // NOSTR_ADAPTER_DIR the outbound/inbound public-event bridges already
    // use (`test/architecture_boundary_commerce.test.ts`'s own
    // `NOSTR_ADAPTER_DIR` allowlist, unchanged by this pass) -- same
    // narrowly-scoped exception, not a new category of leak:
    //   - event.js's `isNostrEvent` (structural NostrEvent check, same
    //     import the inbound public bridge already has)
    //   - noble_signature.js's `NobleSignatureVerifier` (real Schnorr
    //     verification, same as the inbound public bridge)
    //   - signature.js's `SignatureVerifier` type (same as the inbound
    //     public bridge)
    //   - types.js's `NostrEvent` type (same as every bridge file here)
    //   - publish.js's `RelayPublisher` type (same as the outbound public
    //     bridge)
    //   - sign/fedos_nostr_signing_authority.js's `FedosNostrSigningAuthority`/
    //     `FedosNostrUnsignedEventRequest`/`freezeFedosNostrUnsignedEventRequest`/
    //     `isWellFormedFedosNostrUnsignedEventRequest` (same real signing
    //     seam the outbound public bridge already uses -- see this arc's
    //     own Coordinator decision: reuse `FedosMasterSeedAuthority.encryptNip44Wire`/
    //     `decryptNip44Wire`, the SAME real NIP-44 primitive the Gift-Wrap
    //     adapter already uses, directly -- rather than the full NIP-17
    //     stack, which would have pulled in a Conversation-domain
    //     dependency instead of this already-sanctioned Nostr-protocol one)
    //
    // FedOS "Real Two-Party Purchase Completion + UX Closure" mega-arc
    // (Agents P and D, Coordinator-directed pass): 12 more new, DELIBERATE,
    // reviewed blockers on top of the prior 16 -- 6 each from TWO new files,
    // both living in the SAME NOSTR_ADAPTER_DIR the pre-existing bridges
    // already use, and both importing the IDENTICAL 6 os/messenger Nostr
    // protocol symbols `commerce_private_order_bridge.ts` already
    // established above (byte-for-byte the same import list: `event.js`'s
    // `isNostrEvent`, `noble_signature.js`'s `NobleSignatureVerifier`,
    // `signature.js`'s `SignatureVerifier` type, `types.js`'s `NostrEvent`
    // type, `publish.js`'s `RelayPublisher` type, and
    // `sign/fedos_nostr_signing_authority.js`'s signing-authority exports)
    // -- not a new category of leak, the SAME already-reviewed pattern
    // replicated for two more private-sync channels, per this arc's own
    // explicit instruction to reuse the existing FedOS Nostr/NIP-44 stack
    // rather than build a second crypto/messaging stack per channel:
    //   - catalog/adapters/nostr/commerce_private_delivery_bridge.ts
    //     (Agent D) -- the private Delivery-sync transport (fulfilling /
    //     recipient_acknowledged / completed).
    //   - catalog/adapters/nostr/commerce_private_payment_evidence_bridge.ts
    //     (Agent P) -- the private PaymentEvidence transport, this arc's
    //     primary blocker closure (receiver-side-verified PAID crossing
    //     process for the first time).
    // Verified mechanically, not just by inspection: 28 - 16 = 12, and 12
    // is exactly 2 x 6 -- confirmed by running
    // `node scripts/package_extraction_boundary_scan.mjs` directly and
    // diffing its output against the pre-existing 16-line blocker list.
    //
    // FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agents
    // D/M/A, Coordinator-directed integration pass): 7 more new,
    // DELIBERATE, reviewed blockers on top of the prior 28 -- 6 from one
    // new file plus 1 from another, both the SAME already-reviewed pattern
    // this file's own history above already established, not a new
    // category of leak:
    //   - catalog/adapters/nostr/commerce_private_media_release_bridge.ts
    //     (Agent A) -- the private MediaAccessGrant-release transport
    //     (private-media-release-request / private-media-release), the
    //     FOURTH private-sync channel following the exact same convention
    //     as the order/delivery/payment-evidence bridges above. Imports
    //     the IDENTICAL 6 os/messenger Nostr protocol symbols those three
    //     already established (byte-for-byte the same import list:
    //     `event.js`'s `isNostrEvent`, `noble_signature.js`'s
    //     `NobleSignatureVerifier`, `signature.js`'s `SignatureVerifier`
    //     type, `types.js`'s `NostrEvent` type, `publish.js`'s
    //     `RelayPublisher` type, and `sign/fedos_nostr_signing_authority.js`'s
    //     signing-authority exports) -- lives in the SAME NOSTR_ADAPTER_DIR
    //     allowlist, unchanged by this pass.
    //   - share/commerce_trust_share_adapter.ts (Agent D) ->
    //     src/os/trust/index.js, 1 import site -- the SAME reviewed
    //     Commerce->Trust seam receipt/commerce_trust_receipt_adapter.ts
    //     already established above (Commerce E2E Completion arc, Wave B),
    //     applied to a second Trust `contracts/` artifact kind
    //     (`fedos.contract-artifact.v1`-backed Share Proof instead of a
    //     receipt). `test/architecture_boundary_commerce.test.ts` still
    //     does not forbid this direction; `test/architecture_boundary_trust.test.ts`
    //     still only forbids the opposite one.
    // Verified mechanically: 35 - 28 = 7 = 6 + 1, confirmed by running
    // `node scripts/package_extraction_boundary_scan.mjs` directly and
    // diffing its output against the pre-existing 28-line blocker list --
    // every added line is one of the two files named above, nothing else
    // changed.
    //
    // FedOS "Real Digital Delivery + Security UX + Release Closure"
    // mega-arc (Agent G, Coordinator-directed merge): 5 more new,
    // DELIBERATE, reviewed blockers on top of the prior 35 -- all 5 from
    // ONE new file, catalog/adapters/nostr/commerce_media_grant_signing_key_delegation_bridge.ts,
    // which closes Blocker 5 (real seller-identity MediaAccessGrant
    // custody) by having the seller's real Nostr identity sign a small
    // delegation certificate authorizing the pre-existing durable
    // media-grant-signing key. Same already-reviewed pattern this file's
    // own history above already established, not a new category of leak
    // -- 5 of the SAME 6 os/messenger Nostr protocol symbols
    // `commerce_private_order_bridge.ts` established (this file has no
    // `publish.js` import -- it only signs/verifies a certificate, it
    // never itself publishes to a relay, so it needs one fewer of the six):
    // `event.js`'s `isNostrEvent`, `noble_signature.js`'s
    // `NobleSignatureVerifier`, `signature.js`'s `SignatureVerifier` type,
    // `types.js`'s `NostrEvent` type, and
    // `sign/fedos_nostr_signing_authority.js`'s `FedosNostrSigningAuthority`
    // -- lives in the SAME NOSTR_ADAPTER_DIR allowlist, unchanged by this
    // pass.
    // Verified mechanically: 40 - 35 = 5, confirmed by running
    // `node scripts/package_extraction_boundary_scan.mjs` directly and
    // diffing its output against the pre-existing 35-line blocker list --
    // every added line is from the one file named above, nothing else
    // changed.
    const { blockers } = runScan();
    expect(blockers.length).toBeLessThanOrEqual(40);
  });

  it("every blocker belongs to one of the three os/* roots (never the already-clean Electron app)", () => {
    const { blockers } = runScan();
    for (const b of blockers as { root: string }[]) {
      expect(["os/core", "os/messenger", "os/commerce"]).toContain(b.root);
    }
  });

  it("src/runtime/ never reappears as a package-extraction blocker (Root Cause A regression guard -- the Runtime Ownership Extraction Arc's 19-file live closure must stay moved)", () => {
    const { blockers } = runScan();
    for (const b of blockers as { resolvedTo: string }[]) {
      expect(b.resolvedTo.startsWith("src/runtime/"), `src/runtime/ regressed as a blocker source: ${b.resolvedTo}`).toBe(false);
    }
  });

  it("os/core's own remaining blocker is exactly Root Cause B (packages/fedos-core-rust, pending real npm workspaces)", () => {
    const { blockers } = runScan();
    const coreBlockers = blockers.filter((b: { root: string }) => b.root === "os/core");
    expect(coreBlockers.length).toBeGreaterThan(0);
    for (const b of coreBlockers as { resolvedTo: string }[]) {
      expect(b.resolvedTo.startsWith("packages/fedos-core-rust/"), `unexpected new os/core external dependency: ${b.resolvedTo}`).toBe(true);
    }
  });

  it("os/messenger's virtual package now PASSES (Root Cause A closed this arc)", () => {
    const { closures } = runScan();
    expect(closures["os/messenger"].pass).toBe(true);
    expect(closures["os/messenger"].disallowedTouched).toEqual([]);
  });
});

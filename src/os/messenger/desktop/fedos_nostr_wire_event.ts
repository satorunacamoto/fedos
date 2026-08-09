/**
 * Secure Runtime Alpha 234 ("Inbound Event Representation") originally
 * introduced `FedosNostrWireEvent` as a SEPARATE, independent type from
 * `NostrEvent` (`src/os/messenger/adapters/nostr/protocol/types.ts`,
 * formerly `src/nostr/types.ts`) — see this Arc's own git history for the
 * original four-option comparison (`FedosEventDescriptor` vs. a dedicated
 * type vs. the legacy `SignedNostrEvent` vs. a raw `unknown`).
 *
 * Nostr Consolidation Plan, Step 1
 * (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`) — re-verified against
 * the CURRENT source (not just the plan's own frozen analysis) that
 * `FedosNostrWireEvent` and `NostrEvent` had already converged on
 * identical field names (both use NIP-01's own verbatim wire names: `id`,
 * `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`); the only
 * remaining difference was `tags` mutability, resolved by making
 * `NostrEvent.tags` deep-readonly (see `protocol/types.ts`'s own header
 * comment). The two types are therefore now ONE type. This file is a
 * re-export alias, not a duplicate definition — `FedosNostrWireEvent` is
 * kept as a NAME (not a distinct type) so this file's ~30 existing
 * consumers (relay/subscription/board-publish/device-sync/conversation-
 * delivery code) needed zero call-site changes.
 *
 * The canonical DEFINITION deliberately lives under
 * `adapters/nostr/protocol/` rather than here: `protocol/sign/{fedos_nostr_signing_authority,fedos_wasm_nostr_signing_authority}.ts`
 * are "protocol primitive" layer code that used to reach INTO this
 * `desktop/`-adjacent file for this type — a logical backward dependency
 * this Plan's Step 3/4 fixes by having `protocol/sign/` import the type
 * from its own `protocol/types.ts` instead. Defining the canonical type
 * here would have left that backward reach in place (or made it worse, by
 * making protocol/'s OWN internal files reach into `desktop/` too);
 * defining it in `protocol/types.ts` and re-exporting the name here
 * avoids that while changing nothing for this file's own consumers.
 *
 * The prior guardrail here ("NO reference to `src/nostr/*`... anywhere in
 * this file") predates this Plan's own Step 1 decision to unify the two
 * types; it is superseded by that decision, not violated by it — the
 * WHOLE POINT of Step 1 is that this file now aliases the canonical
 * `adapters/nostr/protocol/types.ts` definition instead of duplicating it.
 */
export type { NostrEvent as FedosNostrWireEvent } from "../adapters/nostr/protocol/types.js";

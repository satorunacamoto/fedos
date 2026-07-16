# Secure Runtime Alpha 775 — Capability Inventory

## 1. Existing reusable Capability boundary

None. Direct source search (re-confirming the prior reviews' own §08/§09 findings, still true against real, current source): no invite token, link, generation, redemption, or join-request/approval flow exists anywhere in `src/`. `MembershipPolicy: "invite_only"` (`src/community/types.ts`) remains an unenforced label only.

## 2. Public identifier vs. secret bearer material precedent

`FedosConversationId`/`FedosBoardPostId` etc. are all opaque, PUBLIC branded strings (Alpha 743/252) — no existing precedent anywhere in `src/` for a SEPARATE, non-loggable secret-bearer type. `FedosConversationCapabilityId` (public) and `FedosConversationCapabilityBearerSecret` (secret) are two newly, structurally distinct branded types specifically because no existing pair could be reused for this split (Alpha 777/778).

## 3. Expiry authority

No existing expiry convention beyond `FedosBoardOutboxTarget`-adjacent nullable-timestamp fields (matched by `expiresAt: number | null`, Alpha 777).

## 4. Current atomic write primitives

None beyond a single `Map`'s own synchronous, single-threaded JavaScript semantics (`InMemoryFedosConversationPersistence`, Alpha 751) — no compare-and-swap primitive, no transaction, no lock. This IS the atomicity this Arc's own in-memory Capability Authority relies on (Alpha 784).

## 5. Whether exactly-once can be guaranteed in-memory only

Yes, WITHIN one instance's own single-threaded state — no claim beyond that boundary (Alpha 784).

## 6. Exact expected RIPPLE scope

New files only, under `src/conversation/capability/`. No existing `src/conversation/*` file requires a change.

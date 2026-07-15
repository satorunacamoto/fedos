# Secure Runtime Alpha 554 — Unnecessary Adapter Investigation (不要なAdapter)

Stage 14 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only.

## Method

For every one-line-forwarding or type-narrowing wrapper class in the
reviewed stack, ask: does removing it (replacing every call site with
the wrapped object directly) change any real, exercised guarantee?

## `FedosBoardServiceReader` — NECESSARY, not removable

Wraps ANY `FedosBoardReader`, forwards exactly three calls. Looks
structurally like a candidate for removal (a caller COULD hold the
underlying `FedosBoardReader` directly). But its own design doc
(Alpha 403) documents a real, load-bearing reason it exists: a
`FedosBoardService` instance re-typed AS `FedosBoardReader` would still
have a live, callable `registerPost` method at the OBJECT level (TypeScript
structural typing erases nothing at runtime) — `FedosBoardServiceReader`
closes that bypass at the object surface itself, confirmed by direct
inspection: `Object.keys(new FedosBoardServiceReader(service))` never
includes `registerPost`. Removing this adapter would reopen a real,
previously-closed write-bypass. **Keep.**

## `nostrWireEventToFedosEventDescriptor` — NECESSARY, currently unreachable only because its own caller chain is unwired

A pure, single-purpose field-mapping function
(`src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts`).
Its ONE caller, `FedosRelayNostrBoardPublisher.publishOne()`, is itself
correctly built but has no production caller of its own (Alpha 541/543).
This is NOT an "unnecessary adapter" — it bridges two GENUINELY
different wire shapes (`FedosNostrWireEvent`'s snake_case NIP-01 fields
vs. `FedosEventDescriptor`'s camelCase protocol-neutral fields) that
would otherwise require every future caller to hand-map the six fields
itself, repeatedly. Its uselessness today is entirely a consequence of
Alpha 541's ownership gap, not of the adapter's own design. **Keep.**

## `PersistedFedosBoardRepository` — the ONE genuine candidate this Stage finds, reviewed fully in Alpha 555

Not reviewed again here in full — see Alpha 555, since it is better
classified as an unnecessary REPOSITORY (an alternate architecture
never adopted) than an unnecessary ADAPTER (a thin bridge with no
independent logic) — `PersistedFedosBoardRepository` DOES carry
independent logic (its own conflict-mapping rule, §3a of its own design
doc), which is precisely why it does not merely "adapt" but constitutes
a second, real implementation choice.

## `FedosDeliveryObservationRepository`/`FedosDeliveryObservationQuery` — NECESSARY once wired, currently idle for the same reason as above

Both carry real logic beyond forwarding (`record()`'s
construct-serialize-write sequence; `historyFor()`/`currentStateFor()`'s
own sort/derivation logic) — not adapters in the "thin wrapper" sense
this investigation is looking for. Not flagged.

## Conclusion: no unnecessary adapter found

Every wrapper-shaped class/function in this stack either closes a real
security/type-erasure gap (`FedosBoardServiceReader`) or performs
real, non-trivial field translation (`nostrWireEventToFedosEventDescriptor`)
or non-trivial coordination logic (Observation Repository/Query). This
Arc's own "not currently exercised" finding (Alpha 541) explains every
candidate's apparent uselessness without any of them actually being
structurally redundant.

## See also

- `docs/secure_runtime_alpha_403_read_only_board_access_model.md`
- `docs/secure_runtime_alpha_555_publish_runtime_unnecessary_repository_review.md`

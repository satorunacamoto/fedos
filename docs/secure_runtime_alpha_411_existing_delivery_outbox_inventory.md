# Secure Runtime Alpha 411 — Existing Delivery / Queue / Outbox Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change.** Stage 1
of the Alpha 411–420 Canonical Board Durable Outbox Foundation Arc.

## 1. Method

Direct inspection of `src/desktop/host/*`, `src/board/repository/*`,
`src/board/persistence/*`, `src/board/query/*`, `src/nostr/*`,
`src/desktop/*` (Relay/websocket/event-descriptor files), and every
`docs/secure_runtime_alpha_39[1-9]_*`/`secure_runtime_alpha_40*` design
doc — no assumption carried over from the Arc instruction without a
direct grep/read confirming it.

## 2. Findings, numbered per the Arc instruction

1. **No Outbox exists.** No file anywhere under `src/` contains
   `Outbox`, `outbox`, or a delivery-intent record of any kind.
   `docs/secure_runtime_alpha_409_outbound_publish_readiness_review.md`
   (Alpha 409, Arc 401–410) confirms this directly: "No Outbox code,
   schema, or API is introduced by this Stage."
2. **No delivery queue exists.** No job/task/queue abstraction of any
   kind exists in `src/board/`, `src/desktop/`, or `src/nostr/`. (A
   same-named but unrelated `test/outbound_queue_creator_analytics.test.ts`
   exists for the Creator Dashboard's analytics domain — confirmed by
   reading it — and shares no code, type, or vocabulary with Board/Nostr
   delivery.)
3. **Legacy Nostr publish code is transport-only, and reusable AS
   TRANSPORT ONLY.** `src/desktop/fedos_relay.ts` defines the
   `FedosRelay` interface (`publish(event): void|Promise<void>`, plus
   listener registration); `src/desktop/websocket_relay.ts` is its one
   real `WebSocket` implementation. Neither constructs, signs, or knows
   anything about a `FedosBoardPost` — both accept an already-built wire
   event. `src/nostr/publish.ts` is a pure, protocol-level `EVENT`
   message formatter (`["EVENT", event]`), also unaware of the Board
   model.
4. **No existing type wrongly combines intent and transport.** Every
   Nostr-facing type inspected (`FedosNostrWireEvent`,
   `FedosEventDescriptor`, `NostrEvent`) is either a pure wire shape or a
   pure application-facing read model — none carries a delivery-status
   field, a retry count, or a "targets" list of any kind.
5. **No Outbox identifier convention exists** — there is no precedent to
   reuse; Alpha 413 introduces the first one, deliberately mirroring the
   existing `FedosBoardId`/`FedosBoardPostId` branded-string pattern
   (`src/board/fedos_board_identifiers.ts`, Alpha 252).
6. **Outbox persistence CANNOT honestly reuse the Board persistence
   port.** `FedosBoardPersistence` (`src/board/persistence/fedos_board_persistence.ts`,
   Alpha 315) is typed exactly to `FedosPersistedBoardPostRecordV1` —
   widening `putPost`/`getPost` to also accept an Outbox record would
   either require an unsafe cast at every call site or a discriminated
   union no existing caller expects; neither is a "same port, honestly."
7. **A separate persistence port IS required** — confirmed by finding
   6. `FedosBoardOutboxPersistence` (Alpha 417) is a new, sibling port,
   not a widened `FedosBoardPersistence`.
8. **Protocol targets CAN be represented without embedding native wire
   objects.** `FedosBoardOutboxTarget` (Alpha 413) needs only a
   `protocol` label and an opaque `destination: string | null` — no
   existing type in this repository (Nostr, ActivityPub, AT Protocol, or
   Session adapter code) needs to be referenced to express that shape.
9. **`submitPost()` can be EXTENDED, not modified, to add Board+Outbox
   coordination without partial-write dishonesty**, by delegating the
   entire canonical write to the EXISTING, byte-for-byte unchanged
   `submitPost()` first, and only then attempting Outbox writes — see
   Alpha 419's own design doc for the full ordering argument and why
   this is NOT described as one atomic transaction.
10. **Exact ripple scope**: five new files under a new `src/board/outbox/`
    directory; one additive interface field + one additive method on
    `src/desktop/host/fedos_desktop_host.ts`; one additive
    pass-through line in `src/desktop/host/create_fedos_desktop_host.ts`.
    Zero of the 29 pre-existing test files that directly construct
    `new FedosDesktopHost(...)` require any change — `outboxPersistence`
    is OPTIONAL on `FedosDesktopHostDependencies`, defaulted inside the
    constructor. `submitPost()`'s own existing body, `FedosBoardService`,
    `FedosBoardPersistence`, every inbound Protocol Adapter, and every
    Board Query file are all confirmed, by direct re-read after this
    Arc's own changes, byte-for-byte unchanged except for the two Host
    files named above.

## 3. Conclusion

No existing Outbox, queue, or reusable delivery-intent abstraction
exists anywhere in this repository. A new, sibling persistence port and
a new, additive Host method are the correct shape — confirmed, not
assumed.

## 4. See also

- `docs/secure_runtime_alpha_409_outbound_publish_readiness_review.md`
- `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`

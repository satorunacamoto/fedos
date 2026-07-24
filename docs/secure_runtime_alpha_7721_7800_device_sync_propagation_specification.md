# Secure Runtime Alpha 7721–7800 — Device Sync Propagation Specification (Phase F/G)

## Route: a new, dedicated `kind:1` route, never a new NIP

Mirrors `fedos_device_relay_sync_event.ts`'s own exact route decision
(Alpha 3641–3720 Phase B/C): a new, distinct marker tag
(`["fedos-archive-suppression-sync", "1"]`) under the SAME existing
`kind:1`, so it can never collide with Device Transfer's own
`["fedos-device-sync", "1"]` traffic, the Private Transport's own
`["fedos-private", "1"]` traffic, a public Board post, or a NIP-17 Gift
Wrap. Self-addressed (`["p", accountPublicIdentifier]` +
`["d-target", targetDeviceId]`) for the identical reason Device Relay
Sync is self-addressed: suppression facts propagate between two Devices
of the SAME account, never a Conversation (Phase A reconciliation report
§11's own finding that the Conversation-scoped NIP-17 private-transport
channel is structurally the wrong shape for this).

## Wire payload — `FedosArchiveSuppressionWirePayloadV1`

```ts
{
  schemaVersion: 1,
  sourceDeviceId: string,
  targetDeviceId: string,
  fact: FedosArchiveSuppressionFact,
  deviceEvidence: FedosArchiveSuppressionFactDeviceEvidenceV1 | null,
  createdAt: number,   // unix seconds
  expiresAt: number,   // createdAt + ttlSeconds (default 24h)
  deliveryId: string,  // 128-bit hex, this Arc's own dedup identity layer
}
```

Eight fields, carried directly (not as one opaque encrypted blob) — a
suppression fact is, by Phase C's own design, already small and free of
secret/plaintext content, so there is nothing here for a Relay to be
denied visibility into beyond what the fact type already excludes.
`FEDOS_ARCHIVE_SUPPRESSION_SYNC_MAX_CONTENT_BYTES = 64 KiB` is checked on
the raw `content` string BEFORE `JSON.parse()` is ever attempted (Phase
M, test 5) — a resource-exhaustion guard, mirroring Device Relay Sync's
own discipline.

## Outbound: `FedosArchiveSuppressionOutboundCoordinator.fanOut()`

Per currently-trusted, same-account, non-self target Device:

1. Verify the source (local) Device remains trusted — a revoked/unknown
   source cannot fan out anything (`"source-not-trusted"`).
2. Resolve the LIVE, currently-trusted target Device set from the
   Device Registry (`listBindingsForAccount()`) — **never** a
   caller-supplied list, so a target revoked between enqueue and send is
   naturally excluded. Zero other trusted Devices →
   `"no-other-trusted-devices"`, never a fabricated success.
3. Build the wire payload (fact + optional Device evidence).
4. Sign through the EXISTING, UNWIDENED
   `FedosNostrSigningAuthority.signEvent()` (kind 1) — no new signing
   surface.
5. Publish via the EXISTING, REUSED `FedosDeviceRelaySyncPublisher`
   (Alpha 3641–3720, unmodified) — "do not create a new Relay transport
   if Device Sync already has a suitable seam," honored literally: the
   Publisher class is already fully generic over any
   `FedosNostrWireEvent`.
6. Record a durable, per-`(fact, targetDevice)` attempt via the SAME
   generic, protocol-agnostic `FedosDeliveryObservationRepository`
   Board/Conversation/Device-Relay-Sync already share — reusing the
   existing Observation vocabulary rather than inventing a new status
   log, keyed by `` `archive-suppression::${factId}::${targetDeviceId}` ``
   so repeated fanout attempts accumulate a real attempt history rather
   than colliding.

Bounded fanout: target count is the Device Registry's own already-bounded
trusted-Device count for one account — no unbounded loop. One target's
own publish failure never affects another's (`Promise.all`, per-target
try/catch boundary implicit in the Publisher's own per-Relay-outcome
design). **Local deletion never waits for this Coordinator** — it is
called strictly AFTER a local suppression fact is already durably
recorded, fire-and-forget from the caller's own point of view.

A zero-configured-Relay or a Relay that never sends an OK both resolve
to a real, honest `published: false` per-target result rather than
throwing or hanging (Phase M, tests 15/16/20).

## Inbound: `FedosArchiveSuppressionInboundHandler.handleIncomingEvent()`

Sequence, mirroring `fedos_device_relay_sync_inbound_handler.ts`'s own
proven order exactly:

1. **Dedup** by the outer Relay event id, BEFORE any parsing —
   `"duplicate"` short-circuits everything else (Phase M, test 14).
2. **Parse/validate wire shape** — `"malformed"` on anything
   structurally wrong, including an unrecognized marker tag or an
   oversized `content`.
3. **Verify the outer Nostr signature** — real BIP-340 Schnorr via the
   existing, unmodified `NobleSignatureVerifier`; also confirms
   `descriptor.author === payload.fact.accountRef.publicIdentifier`. A
   tampered `content` (including the embedded fact) fails closed here as
   `"invalid-signature"`, BEFORE any of its claims are acted on.
4. **Verify intended recipient and account** — `targetDeviceId !==
   localDeviceId` → `"wrong-recipient"`; account mismatch →
   `"wrong-account"`.
5. **Check expiry** — `now > expiresAt` → `"expired"`.
6. **Check LIVE Device Registry trust** for the CLAIMED
   `sourceDeviceId` — revoked/unknown fails closed as
   `"source-not-trusted"`. The outer envelope's own routing
   `sourceDeviceId` and the embedded fact's own `sourceDeviceId` must
   also agree, or `"invalid-signature"` (a mismatch means the envelope
   is claiming a different origin than the signed fact itself asserts).
7. **Verify OPTIONAL Device-level evidence** (Phase D, best-effort,
   never a hard requirement).
8. **Hand off** to
   `FedosArchiveSuppressionObservationAuthority.recordImportedSuppression()`
   for the final replay/revision-ordered write (Phase E's own
   conflict/rollback rule) — mapped back to one of `"recorded"` /
   `"already-present"` / `"rollback-rejected"` / `"conflict"` /
   `"failed"`.

The Handler's only effect is a new, additive row in the Suppression
Observation log — it never calls `payloadStorage`/`envelopePersistence`/
`searchIndex` directly (Phase N, structural guard 7), matching Phase G's
own explicit "do not let a peer-controlled fact delete unrelated local
data" requirement.

## Honest reachability disclosure

This Arc reuses the generic `FedosDeviceRelaySyncPublisher` class
directly. It does **not** fix general production reachability — Phase A
reconciliation report §10 already found the real relay transport
(`FedosDeviceRelaySyncOutboundCoordinator`/`Publisher`/`InboundHandler`)
has zero production construction sites in
`fedos_desktop_runtime.ts` today. This Arc's own real vertical slice
(Phase K) proves the propagation logic works correctly over a real local
relay when wired by a caller; it does not claim the production Desktop
Runtime already wires it end to end.

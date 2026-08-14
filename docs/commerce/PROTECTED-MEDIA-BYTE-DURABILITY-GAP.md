# Protected-Media Byte Durability Gap — Coordinator Decision Record

**Status: DOCUMENTED, DEFERRED (not fixed in this arc). Blocker 5 (grant
custody) is separately RESOLVED — this is a distinct, downstream gap
discovered while building the positive digital-delivery E2E that proves it.**

## Summary

The shipped Electron app's real composition root (`commerceMediaStoreFor()`
in `fedos_electron_beta_main.cts`) constructs its protected-content transport
as:

```ts
const transport = new m.Media.InMemoryIpfsTransport();
```

`InMemoryIpfsTransport` (`src/os/commerce/catalog/ipfs_media_store.ts`) is,
by its own name and construction, an in-memory-only store — it holds
protected ciphertext bytes and their metadata (including the checksum
`getStoredCiphertextChecksum()` needs) in process memory only, with zero
disk persistence.

**Live, reproducible impact** (confirmed via a real two-independent-Electron-
process positive-delivery run,
`packages/fedos-desktop-electron-spike/test/commerce_digital_delivery_positive_real_electron.test.ts`):
a seller who attaches real protected purchased content in one process
launch, then closes the app (an ordinary real-world action — this suite
spawns a brand-new process per step, exactly modeling that), loses the
actual encrypted bytes. When a later process later tries to serve that
content, `getStoredCiphertextChecksum(storageRef)` returns `null` (no
in-memory record survived), which `commerce_private_media_release_apply.ts`'s
own fail-closed CONTENT-IDENTITY gate correctly treats as a mismatch,
denying the response with `"content-checksum-mismatch"` — never a false
success, but also never real delivery.

## Relationship to the sibling `DurableProductMediaRepository` fix

This arc separately found and fixed an adjacent gap: `LocalProductMediaRepository`
(a `Product`'s *metadata catalog* — role/classification/checksum/`storageRef`
pointer) was ALSO in-memory-only, and has now been replaced with
`DurableProductMediaRepository`, an append-only-NDJSON-backed sibling
matching every other Commerce entity's durability pattern. That fix is
real, tested (9/9 new unit tests, full regression suite green), and
confirmed live: it resolved the earlier, upstream failure where grant
issuance itself silently produced no grant at all (`media_access_grants.ndjson`
never created).

**This document covers what remains AFTER that fix**: even with the
`ProductMedia` *catalog record* (including its declared `checksum` and
`storageRef` pointer) now durable, the actual *ciphertext bytes* the
`storageRef` points at are still only in memory. Fixing the catalog was
necessary but not sufficient — the transport holding the bytes themselves
has the same architectural gap, one layer deeper.

## Why this was not fixed in this pass

Unlike the `ProductMedia` catalog fix (a narrow, precedented, single-file
addition mirroring an existing `Durable*` sibling), making
`InMemoryIpfsTransport` durable is a materially larger change:

- It is the ACTUAL bytes (up to `COMMERCE_MEDIA_MAX_PAYLOAD_BYTES` = 8 MiB
  per object today), not a small metadata record — real disk I/O, real
  storage-growth/retention questions that don't apply to a small NDJSON
  catalog line.
- `IpfsMediaStore`/`InMemoryIpfsTransport`'s own naming signals an intended
  eventual real-IPFS integration path; a hasty durable-local shim risks
  either conflicting with that future design or needing to be thrown away.
- The mega-arc's own instructions (§28) explicitly say local/fake MediaStore
  is sufficient for THIS arc and public IPFS integration is NOT required —
  but do not resolve whether "sufficient" means "in-memory is acceptable" or
  "must survive a restart." That is a real product/architecture decision,
  not a mechanical fix.

Per the Coordinator's own stop conditions, a genuinely ambiguous
architectural decision correctly pauses THIS thread of work — it does not
block the rest of the arc (packaging/NSIS/installed-E2E/tabletop can and do
proceed against current state).

## Options for a future pass

1. **Durable local transport** (recommended shape, not yet built): a
   `DurableIpfsTransport` sibling of `InMemoryIpfsTransport`, same `IpfsTransport`
   port, backed by per-object files on disk under the profile directory
   (mirroring `DurableProductMediaRepository`'s own append-only-NDJSON
   precedent for metadata, plus one binary file per stored object) — no new
   dependency, no public network, no public IPFS. This directly closes the
   live gap this document describes.
2. **Explicit product decision to leave in-memory for now**, with the
   corresponding truthful UX consequence documented (a seller MUST keep
   their process running between "attach content" and "buyer redeems it" —
   this needs to be surfaced in-product, not silently assumed).
3. **Real IPFS/durable network transport** — larger scope, deferred per the
   mega-arc's own explicit instruction against requiring public IPFS in this
   arc.

## Current test-suite state (informational, not a fix)

`commerce_digital_delivery_positive_real_electron.test.ts`: 6/9 passing
after the `DurableProductMediaRepository` fix (up from 5/9 before it).
STEP 5 (grant issuance) now genuinely passes. STEPs 7/8/9 fail exactly
and only because of this documented gap — content-checksum-mismatch,
never a false success; the order correctly, honestly stays "delivered"
rather than falsely advancing to "completed." No false-green anywhere.

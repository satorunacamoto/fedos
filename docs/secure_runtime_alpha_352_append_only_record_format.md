# Secure Runtime Alpha 352 — Append-only Record Format

**Status: this Stage is DESIGN — it fixes the on-disk format Alpha
353 implements. No code in this Stage.** Stage 2 of the Alpha
351–360 Append-only Durable Board Backend Arc.

## 1. Format

**One JSON-serialized `FedosPersistedBoardPostRecordV1` per line,
`\n`-terminated — JSON Lines (NDJSON).** Concretely:

```
{"schemaVersion":1,"id":"post-1","boardId":"board-1", ...}\n
{"schemaVersion":1,"id":"post-2","boardId":"board-1", ...}\n
```

- **No binary format** — every byte on disk is UTF-8 text, directly
  inspectable/diffable with any text tool, matching Alpha 344 §8's own
  "plain, inspectable, diffable" testability finding.
- **No compression** — no `gzip`/`deflate`/custom encoding of any
  kind; every line is exactly the same JSON text `JSON.stringify`
  would produce from a `FedosPersistedBoardPostRecordV1` value.
- **No batching** — every `putPost()` call that actually writes (a
  genuinely new `id`, per Alpha 354) performs exactly ONE
  `appendFileSync` call for exactly ONE line; no buffering, no
  write-coalescing, no delayed flush of multiple pending records into
  a single write.
- **The line terminator (`\n`) is chosen and written by this Stage's
  own implementation, never inherited from the OS or an editor** — so
  reading and splitting on `\n` is portable and deterministic
  regardless of platform, sidestepping any Windows `\r\n`
  auto-translation concern (Node's `fs` functions perform no
  line-ending translation of their own; `\r`, if it ever appears
  immediately before a line's own `\n` — e.g. from an external tool —
  is valid insignificant JSON whitespace per RFC 8259 and does not
  break parsing).

## 2. Crash assumptions, stated explicitly

- **A local filesystem's own append semantics are assumed.** A `write()`
  to a file opened in append mode (`O_APPEND`, what `appendFileSync`
  uses) is assumed to either land entirely at the current end of file,
  or not at all in a way that corrupts BYTES ALREADY WRITTEN before
  it. This is a standard, well-established property of local
  filesystems (ext4, NTFS, APFS) for a SINGLE writer process — it is
  NOT asserted for networked or distributed filesystems, which this
  Arc does not target.
- **No explicit `fsync`/`fdatasync` is called anywhere in this Arc's
  own implementation.** `appendFileSync` hands the written bytes to
  the OS's own page cache and returns once the kernel has accepted
  them — this is durable against a PROCESS crash (the OS retains the
  data independent of the crashed process) but is **NOT** durable
  against a true POWER-LOSS event before the OS itself flushes those
  dirty pages to physical storage (typically within seconds, by the
  OS's own background writeback, not controlled by this
  implementation). **This is a genuine, disclosed limitation, not an
  oversight** — see §3.
- **A trailing malformed line is the ONLY corruption shape a crash
  mid-write can plausibly produce**, and only for the SINGLE record
  being written at the moment of the crash — every record appended
  BEFORE it remains byte-for-byte intact, because each `putPost()`
  call is one independent, already-completed append before the next
  one ever begins (Alpha 354's own "never rewrite" guarantee makes
  this true by construction: nothing after the initial write ever
  touches an already-written byte).
- **Duplicate replay is safe by the port's own existing semantics**
  (`fedosPersistedBoardPostRecordsAreEqual`, Alpha 315) — a caller that
  is unsure whether a prior `putPost()` call durably completed may
  safely call it again with the identical record; see Alpha 356.

## 3. Named limitation: no `fsync`

This Stage deliberately does NOT add an `fsync` call. Reasoning:

- Node's `fs` module DOES expose a synchronous `fsync`-equivalent (via
  a file descriptor opened with `openSync`, then `fsyncSync`) —
  technically reachable with zero new dependency, satisfying this
  Arc's own "Node standard library only" requirement.
- Adding it would mean EVERY `putPost()` call blocks on a physical
  disk flush, a real latency/throughput cost this Arc's own
  instruction ("Only implement the append-only backend and supporting
  logic") does not ask for, and Alpha 349's own selection criteria
  (`simplicity`) argue against front-loading before a real requirement
  demonstrates the need.
- The exact tolerance for "last few seconds of writes lost on a true
  power-loss event, but never corrupted" is ALREADY the honestly
  disclosed gap Alpha 345 §6 named for append-only generally — this
  Stage does not pretend to close that gap; it documents precisely
  where it lives (the missing `fsync`) so a future Arc can close it
  deliberately, with its own review, if a real requirement ever
  demands it.

## 4. What this Stage does NOT do

No code, no file, no test exists anywhere in this Stage's own
deliverables — this is a design document only, exactly as Alpha
352's own instruction states ("No code in this Stage").

## 5. Conclusion

The record format is JSON Lines, one record per line, no binary
format, no compression, no batching — directly implementable with
`node:fs`'s synchronous API alone. Crash tolerance is strong for a
process crash or ordinary unclean shutdown (every already-written
record survives intact); a true power-loss event may lose the last
few seconds of un-flushed writes, never corrupt earlier ones — a
disclosed, deliberate, not-yet-closed gap, not an oversight.

## 6. See also

- `docs/secure_runtime_alpha_351_existing_persistence_layer_inventory.md`
- `docs/secure_runtime_alpha_345_crash_recovery_review.md`
- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`

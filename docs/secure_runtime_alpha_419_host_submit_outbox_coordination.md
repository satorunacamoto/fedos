# Secure Runtime Alpha 419 — Host Submit + Outbox Coordination

Stage 9 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc. Implements `submitPostWithOutbox()` on
`src/desktop/host/fedos_desktop_host.ts`.

## 1. Candidates compared

- **A.** `submitPost(post)` always creates Outbox intents automatically.
- **B.** `submitPost(post, targets)` accepts explicit outbound targets.
- **C.** `submitPost()`, then a separate `host.enqueueOutbound(postId, targets)`.
- **D.** One Host method, `submitAndQueue(post, targets)`
  (`submitPostWithOutbox` in this implementation).

**A is rejected outright** — required by this Arc's own safety rule:
"Existing `submitPost(post)` behavior must remain valid and must not
silently publish or queue anything. A local-only post is a legitimate
product action." Automatic queueing on every call would violate this
directly.

**C is rejected**: a second, separate call re-opens the exact
non-atomicity question this Stage already has to answer for D/B anyway
(what happens if the post write and the enqueue call are separated by
an unrelated `submitPost()` in between, or the caller never calls
`enqueueOutbound()` at all) while adding a second public entry point
with weaker guarantees than a single call — no real benefit over B/D.

**B vs D — adopted D, named `submitPostWithOutbox`, keeping `submitPost(post)`
completely unchanged as a SEPARATE method** rather than widening
`submitPost`'s own signature with an optional second parameter. Reason:
`submitPost()`'s own existing single-argument signature is exercised by
dozens of pre-existing tests and documented, load-bearing behavior
(Alpha 395–410); adding an optional `targets`/`options` parameter to it
— even one that defaults to "no Outbox" — still changes ONE function's
own contract that this repository's own established discipline (Alpha
401 §3: "zero production caller anywhere in `src/` ever called
`host.board()`" was the bar for a CLEAN rewire) treats as something to
avoid touching unless zero ripple is provable. A second, purely
additive method provably cannot regress `submitPost()` — it calls
`submitPost()` internally and adds nothing to its own signature.

## 2. Required honest ordering

1. Host ready-state check (`state !== "ready"` throws, mirroring
   `submitPost()`'s own identical guard).
2. Empty-`targets` short-circuit (§4 below).
3. Delegate the ENTIRE canonical write to the EXISTING, unmodified
   `submitPost(post)` — validation, durable Persistence, Repository,
   and Query visibility all happen exactly as they already do, with NO
   new code path.
4. Only if step 3 returns `"inserted"` or `"already-present"`: dedupe
   `targets` by deterministic `FedosBoardOutboxId` (Alpha 413), then
   `putIntent()` one Outbox record per surviving target.
5. Return a result distinguishing the post's own outcome from each
   target's own Outbox outcome.

**No publisher execution happens inside this method** — confirmed by
direct inspection: nothing in `submitPostWithOutbox()` imports a Relay,
a signer, or any network-capable type.

## 3. Two-file atomicity — NOT claimed

`AppendOnlyFedosBoardPersistence` and (a future)
`AppendOnlyFedosBoardOutboxPersistence` instance are two SEPARATE files.
Node's `node:fs` (this repository's only filesystem dependency, per
every prior Persistence Arc's own guardrail) provides no cross-file
transaction primitive. **This implementation does NOT call the
Board-write-then-Outbox-write sequence atomic, anywhere, in code
comments or documentation.** The honest, disclosed direction (matching
this Arc's own required "Preferred honest direction"):

> The canonical post is authoritative and MAY succeed even if Outbox
> queueing subsequently fails. `submitPostWithOutbox()`'s own returned
> result explicitly distinguishes the two outcomes; no rollback of an
> already-durable canonical post is ever attempted because Outbox
> persistence failed.

Concretely, four distinguishable outcome shapes are returned (not
hidden behind one boolean):

- post inserted, all requested intents queued;
- post already present, all requested intents queued;
- post stored (either outcome above), but one or more Outbox writes
  returned `"conflict"`/`"failed"`;
- post rejected (a domain rejection or `"persistence-failed"`) BEFORE
  any Outbox write is even attempted — `outbox` is always `[]` in this
  case.

A fifth case, Host unavailable, is NOT a returned result shape — it
THROWS, mirroring `submitPost()`'s own established "ready"-state-guard
convention exactly (see that method's own header for why a throw here
is not a normal-rejection exception).

## 4. Empty targets — explicit decision

**Decided: delegate to local-only `submitPost()`.**
`submitPostWithOutbox(post, [])` is behaviorally identical to
`submitPost(post)` (wrapped in the richer result shape, `outbox: []`)
rather than being rejected as an error. Reason: rejecting an empty
array would force every caller who is not yet sure of a post's outbound
targets to call two DIFFERENT methods depending on whether `targets` is
empty at the call site — a worse API than one method that degrades
gracefully to "local-only" when given nothing to queue.

## 5. Duplicate targets — explicit decision

**Decided: normalize (dedupe), not reject.** Two targets producing the
SAME deterministic `FedosBoardOutboxId` (Alpha 413) collapse to exactly
one Outbox write attempt and one result entry, first-occurrence order
preserved. Reason: `FedosBoardOutboxId`'s own deterministic derivation
already makes a duplicate submission idempotent at the persistence
layer (`"already-present"`); deduping before the write additionally
keeps the RETURNED result array free of misleadingly-repeated entries
for what is, logically, one request.

## 6. Intent timestamp

Each Outbox intent's own `createdAt` reuses `post.createdAt` rather
than reading a new `Date.now()`. `FedosDesktopHost` holds no injected
Clock anywhere today; introducing one for this single field would be
new surface area this Arc's own scope does not require. This keeps
`submitPostWithOutbox()` fully deterministic given its inputs — a
property every persistence-layer test in this Arc depends on.

## 7. Ripple: `outboxPersistence` is OPTIONAL

`FedosDesktopHostDependencies.outboxPersistence` is `?:` (optional),
defaulted inside `FedosDesktopHost`'s own constructor to a fresh
`InMemoryFedosBoardOutboxPersistence()` when omitted — NOT a required
field alongside `boardPersistence`. Confirmed by direct grep (Alpha 411
§2.10): 29 pre-existing test files construct `new FedosDesktopHost({desktopApplication, boardPersistence})`
directly; making `outboxPersistence` required would force every one of
them to change for a field none of them exercises. Zero of those 29
files needed any change for this Arc.

## 8. See also

- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
- `docs/secure_runtime_alpha_409_outbound_publish_readiness_review.md`
- `docs/secure_runtime_alpha_413_outbox_identifier_target_model.md`

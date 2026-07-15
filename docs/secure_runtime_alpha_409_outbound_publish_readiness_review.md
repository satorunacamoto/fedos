# Secure Runtime Alpha 409 — Outbound Publish Readiness Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind. No Outbox code is added.** Stage 9 of the Alpha 401–410 Desktop
Host Canonical Write Boundary Closure Arc.

## 1. Why now

With Persistence-bypassing Host writes closed (Alpha 404) and
`submitPost()` formally reverified as the sole canonical write boundary
(Alpha 405–408), the Host is now ready to receive an OUTBOUND
publishing layer on top of it. This Stage reviews the future order
WITHOUT implementing it, per this Arc's own explicit instruction.

## 2. Candidates compared

- **Option A — Persist → register → publish.** A single synchronous
  (or single logical) sequence: `submitPost()` runs exactly as today,
  then a publish step runs immediately afterward, in the same logical
  operation.
- **Option B — Publish → persist → register.** Publish FIRST, persist
  second.
- **Option C — Persist/register locally, then create an Outbox
  delivery record.** `submitPost()` remains exactly as it is today;
  publishing becomes a SEPARATE, durable, asynchronous concern tracked
  by its own delivery-intent record.
- **Option D — One synchronous transaction across local storage and
  remote protocols.** A single atomic operation spanning BOTH the
  local append-only log AND one or more remote protocol calls.

## 3. Evaluation

**Option D** is rejected outright, for a structural reason, not a
preference: remote protocols (a Nostr relay, an ActivityPub inbox, an
AT Protocol PDS, a Session node) are NOT participants in this
repository's own local, synchronous, single-process append-only
transaction (Alpha 393's own established model) — there is no
mechanism, and none is proposed anywhere in this repository, for a
network call to a remote server to participate in an atomic commit
with a local file append. Any design that assumes otherwise is
proposing a distributed transaction this repository has no
infrastructure for and this Arc's own Absolute Prohibitions
(`Relay Pool`, `retry queue`, `outbound protocol publishing`) already
exclude building.

**Option B** is rejected: publishing before the post is even durably
registered locally means a successful remote publish could correspond
to a LOCAL write that then fails validation or persistence — the
remote world would show a post the local canonical Board never
actually accepted. This inverts the entire fail-closed philosophy this
repository has maintained since Alpha 307 (`FedosBoardService`'s own
"no partial writes" guardrail) and Alpha 393 (Persistence-before-
Repository, for the identical reason: never let an unrecoverable
external effect precede local validation).

**Option A** is closer, but conflates two operations with fundamentally
different failure/retry semantics into one step: a local write
(synchronous, source-of-truth, already correctly ordered by Alpha 393)
and a remote delivery (asynchronous by nature, may fail, may need
retry, may take an arbitrary amount of time, may partially succeed
across MULTIPLE target protocols for a single post). Treating "publish"
as a single follow-on step to `submitPost()` would need to answer
questions this Arc's own instruction explicitly defers (retry/backoff,
delivery receipts) BEFORE the local write boundary itself is even
finished settling from this Arc's own work — premature coupling.

**Option C — Preferred, adopted exactly as this Arc's own instruction
names.** Reason, restated precisely: remote protocols cannot
participate in the local append-only transaction (the SAME structural
fact that rejects Option D), so the local write and the publish INTENT
must be two separate durable facts. `submitPost()` remains completely
unchanged — no coupling of any kind. A future, NOT-YET-DESIGNED Outbox
concept records the DURABLE INTENT to publish, separately, as its own
canonical fact — decoupling "the post exists, canonically, locally"
(already solved, this Arc and Arc 391–400) from "the post has been (or
needs to be, or failed to be) delivered to protocol X" (entirely
future work).

## 4. Required future conceptual flow

```
submitPost()
    ↓
durable canonical Board write        (SOLVED -- Arc 391-400, Arc 401-410)
    ↓
durable Outbox intent                (FUTURE -- Arc 411-420, not designed here)
    ↓
protocol publisher                   (FUTURE, per-protocol -- not this Arc, not the next Arc)
    ↓
delivery observation                 (FUTURE -- retry/backoff, receipts, not this Arc)
```

This Stage names the flow's own SHAPE only — no field, no schema, no
API, no file for any of the three FUTURE boxes is proposed here.

## 5. Review of future per-protocol targets, deliberately NOT unified

This Arc's own instruction is explicit: "Do not pretend they share one
transport or one success model." Reviewed, at the SHAPE level only,
without designing any of them:

- **Nostr Relay publish**: a `WebSocket` `EVENT` message to one or more
  relays; "success" is inherently PER-RELAY and best-effort — no
  single relay is authoritative, and a relay accepting an event is not
  a guarantee of propagation to any reader.
- **ActivityPub delivery**: an authenticated HTTP `POST` to one or more
  remote inbox URLs (potentially many, for a post with multiple
  followers/instances); "success" is a 2xx HTTP response per inbox,
  with NO delivery confirmation beyond that — federation itself may
  still fail asynchronously, invisibly, on the remote server's own
  side.
- **AT Protocol repository write**: a signed write to the user's OWN
  PDS-hosted repository (fundamentally different from the other three:
  the "publish" IS a local-to-the-user's-own-PDS write, which the AT
  Protocol network then indexes/crawls asynchronously) — "success" here
  means the PDS accepted the record, not that any other party has seen
  it yet.
- **Session outbound Gateway**: delivery through Session's own onion
  routing / gateway model — an entirely different transport and trust
  model from the other three, with its own distinct notion of
  "delivered."

Four genuinely different transports, four genuinely different success
definitions — confirming Option C's own Outbox-intent model (§3) is
the right shape precisely because it does NOT need to unify these, only
to durably record that a delivery ATTEMPT is owed, once, per protocol,
per post — leaving the attempt's own mechanics to each future
protocol-specific publisher.

## 6. Conclusion

Option C is adopted, exactly as this Arc's own instruction names,
because remote protocols cannot participate in this repository's own
local, synchronous append-only transaction — the same structural fact
that rules out Option D and disqualifies Option B's own
publish-before-durable-local-write ordering. No Outbox code, schema,
or API is introduced by this Stage — this is a shape-level review,
strictly deferring implementation to a correctly-scoped future Arc.

## 7. See also

- `docs/secure_runtime_alpha_408_host_write_failure_boundary_verification.md`
- `docs/secure_runtime_alpha_393_write_transaction_order.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`

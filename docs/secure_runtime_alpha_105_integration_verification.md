# Secure Runtime Alpha 105 — Integration Verification

**Status: this Stage is VERIFICATION ONLY. It adds NO code — no
change to any `src/desktop/*` or `src/identity/*` file. This document
and its own guard test are the entire deliverable. This is Stage 5,
the closing Stage, of the Alpha 101–105 Public Identity Source
Foundation Arc.**

## 1. Why now

Alpha 101 defined the `FedosPublicIdentityReader` interface. Alpha
102 decided Desktop owns it. Alpha 103 built the first real
implementation and wired it into `DesktopApplication` and
`createDesktopApplication()`. Alpha 104 added a second, unwired
alternative. This Stage verifies, against the actual resulting
source, that the connection this whole Arc set out to build — Desktop
→ Reader → Source → Provider → Identity Runtime — actually exists as
ONE connected graph, not two accidentally-parallel mechanisms that
merely happen to look similar.

## 2. The connection, confirmed end to end

```
DesktopApplication
  ├─ #identity: FedosRuntimeIdentity
  │    └─ #service: FedosIdentityService
  │         └─ provider: FedosIdentityProvider (NostrIdentityProvider,
  │              via resolveFedosIdentityProvider())
  │              └─ #source: FedosNostrPublicIdentitySource
  │                   (a `new NullNostrPublicIdentitySource()`
  │                   constructed directly inside
  │                   `fedos_identity_provider_resolver.ts`, Alpha 039)
  └─ #reader: FedosPublicIdentityReader (NostrPublicIdentityReader,
       via createDesktopApplication())
       └─ #source: FedosNostrPublicIdentitySource
            (the shared singleton `resolveNostrPublicIdentitySource()`
            returns, Alpha 048)
```

Desktop holds TWO independent objects — `#identity` (Bootstrap) and
`#reader` (public identity reading) — each reaching its own
`FedosNostrPublicIdentitySource` instance through a SEPARATE path.
Confirmed precisely, by direct inspection of the actual source rather
than assumption: these are `NullNostrPublicIdentitySource`, the SAME
CLASS in both cases, but NOT the same object reference —
`fedos_identity_provider_resolver.ts` (Alpha 039) constructs its own
`new NullNostrPublicIdentitySource()` directly, entirely independent
of the shared singleton `resolveNostrPublicIdentitySource()`
(Alpha 048) returns and `NostrPublicIdentityReader` uses. Both
instances are, however, behaviorally indistinguishable — `NullNostrPublicIdentitySource`
holds no per-instance state of any kind (Alpha 039) — so this
structural detail has zero observable effect: both paths resolve
`null` identically. This is pre-existing behavior, unchanged since
Alpha 039/048, and explicitly OUT OF SCOPE to alter in this Arc — this
Stage documents it precisely rather than assuming a shared reference
that does not, in fact, exist.

## 3. What remains deliberately unconnected

- **`#reader` is held but never read.** No method on `DesktopApplication`
  calls `this.#reader.readPublicIdentity()` — confirmed directly
  against the actual, unchanged class body across Alpha 103/104.
- **The Identity remains `null`.** `resolveNostrPublicIdentitySource()`
  is still fixed to `NullNostrPublicIdentitySource` (Alpha 048,
  unchanged) — every real read, through either path, resolves `null`
  today. This Arc builds the WIRING, not a real identity source.
- **Observation, Nostr Relay connections, GUI.** Unaffected and
  untouched by this entire Arc — confirmed unchanged since Alpha 100.

## 4. What remains permanently untouched

- `src/runtime/create_runtime.ts`, `types.ts`, `AppRuntime` — no
  `reader` or `identity` field of any kind, confirmed unchanged since
  Alpha 100.
- `src/worker.ts` — no reference to anything under `src/desktop/*`.
- `src/runtime/fedos_runtime_identity.ts` — byte-for-byte unchanged.
- `src/identity/fedos_nostr_identity_provider.ts`
  (`NostrIdentityProvider`) — byte-for-byte unchanged; this Arc adds a
  SECOND, independent consumer of `resolveNostrPublicIdentitySource()`
  without modifying the first.

## 5. Completion Declaration

- **The Public Identity Source Foundation is hereby declared
  functionally COMPLETE for its own stated scope: Desktop → Reader →
  Source is a real, working, verified connection, confirmed to reach
  a `NullNostrPublicIdentitySource` instance of the SAME CLASS the
  pre-existing Desktop → Identity Runtime → Provider → Source path
  already reaches — a separate object reference, by design of the
  pre-existing Alpha 039 Provider Resolver, but behaviorally identical
  since that class holds no per-instance state.**
- No real Nostr communication, no Relay connection, and no secret-key
  handling exist anywhere in this Arc's own deliverables — building
  those remains explicitly OUT OF SCOPE, deferred to future,
  separately-scoped Stages.

## 6. What this Stage does NOT do

- Does **not** modify any file under `src/desktop/*` or
  `src/identity/*`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement Observation, Relay connections, or GUI of
  any kind.
- Does **not** add a sixth Public Identity Source Foundation Stage,
  and forbids any future Stage from adding one under this Arc's own
  name.

## 7. See also

- `docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md`
- `docs/secure_runtime_alpha_100_integration_verification.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_104_null_reader.md`

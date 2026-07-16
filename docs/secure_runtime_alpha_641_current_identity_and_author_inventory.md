# Secure Runtime Alpha 641 — Current Identity and Author Inventory

Stage 1 of the Alpha 641–680 Public Identity, Conversation Policy &
Application Runtime Integration Arc. Read-only inventory, no source
modified.

## 1. Every current identity source

- `FedosRuntimeIdentity` (`src/runtime/fedos_runtime_identity.ts`) — the
  sole Identity Authority `DesktopApplication` holds privately
  (`#identity`); exposed only via `currentIdentity()`/`isBootstrapped()`.
- `DesktopApplication` (`src/desktop/desktop_application.ts`) — owns a
  SECOND, independent path: `#reader: FedosPublicIdentityReader` +
  `#currentPublicIdentity` cache, populated by `readPublicIdentity()`/
  `refreshPublicIdentity()`, read by `currentPublicIdentity()`.
- `NostrPublicIdentityReader` (`src/desktop/nostr_public_identity_reader.ts`)
  — the one Reader `createDesktopApplication()` wires by default; wraps
  a `FedosNostrPublicIdentitySource` and maps its Snapshot to
  `FedosIdentityDescriptor` with `provider` fixed to `"nostr"`.
- `NullPublicIdentityReader` (`src/desktop/null_public_identity_reader.ts`)
  — a standalone, always-`null` alternative Reader implementation, not
  wired into `createDesktopApplication()`.
- `resolveNostrPublicIdentitySource()` (`src/identity/fedos_nostr_public_identity_source_resolver.ts`)
  — a fixed module-level singleton, ALWAYS `NullNostrPublicIdentitySource`.
- `StaticNostrPublicIdentitySource` (`src/desktop/static_nostr_public_identity_source.ts`)
  — the one non-null `FedosNostrPublicIdentitySource`; used only when a
  caller explicitly supplies `createDesktopApplication(publicIdentity)`.
- `resolvePublicAuthorReference()` (`src/board/runtime/fedos_board_runtime_author_authority.ts`,
  Alpha 627) — the Board Runtime's own existing author-resolution
  function, reading `DesktopApplication.currentPublicIdentity()` and
  falling back to a fixed anonymous-local `FedosBoardAuthorReference`.
- Community role/membership code — searched; none exists anywhere in
  `src/` today (no `role`, `membership`, or `Community` module found).

## 2. Which identity is authoritative

`FedosRuntimeIdentity` is authoritative for LOCAL identity bootstrap
(`currentIdentity()`/`isBootstrapped()`). `DesktopApplication.currentPublicIdentity()`
is authoritative for PUBLIC, board-authorship-eligible identity — the
only one `resolvePublicAuthorReference()` (and, after this Arc,
`FedosPublicAuthorAuthority`) ever reads. The two are deliberately
independent (see §3).

## 3. Which identity paths are intentionally independent

Per `desktop_application.ts`'s own header (Alpha 121): `readPublicIdentity()`
"NEVER touches Identity Runtime" and `currentIdentity()`/`isBootstrapped()`
never touch `#reader` — the two paths never cross, by explicit design,
not by omission.

## 4. Why the default public identity resolves to null

`createDesktopApplication()` (no argument) constructs
`resolveNostrPublicIdentitySource()`, which is a FIXED singleton
`NullNostrPublicIdentitySource`, wrapped in `NostrPublicIdentityReader`.
`startFedosDesktopRuntime()` (Alpha 606, `src/desktop/runtime/fedos_desktop_runtime.ts:114`)
calls `createDesktopApplication()` with NO argument — even though
`createDesktopApplication(publicIdentity)` already supports a real,
static identity, the Local Runtime entry point never plumbs one
through. This is the exact runtime ownership gap (§9).

## 5. Current anonymous-author semantics

`resolvePublicAuthorReference()` (Alpha 627) returns a FIXED sentinel —
`{ identityId: null, protocol: "fedos", publicIdentifier: "local-anonymous" }`
— whenever `currentPublicIdentity()` is `null` OR the resolved identity's
`provider` is not a recognized `FedosBoardSourceProtocol` OR its
`publicIdentifier` is empty. These three distinct cases (nothing
configured vs. something malformed) are collapsed into ONE outcome
today — Alpha 643/644 (this Arc) separate them into `"anonymous-local"`
vs. `"conflict"`.

## 6. Whether identityId and publicIdentifier may be derived honestly

Yes. `publicIdentifier` is already public, non-secret data
(`FedosIdentityDescriptor`'s own contract, Alpha 028) and is preserved
verbatim. `identityId` (`descriptor.id`) is a bare, caller-supplied
opaque id with no narrower validity constraint than "the whole
Descriptor was accepted" — see Alpha 644's own mapping policy doc.

## 7. Whether a local FedOS author needs a new protocol value

No. `"fedos"` already exists on `FedosBoardSourceProtocol`
(`src/board/fedos_board_source.ts`, Alpha 253), documented as "reserved
for content authored directly through FedOS" — exactly the anonymous-
local case. No new protocol vocabulary is introduced by this Arc.

## 8. Whether signing authority proves authorship or only delivery eligibility

Only delivery eligibility, and only partially. `FedosNostrSigningAuthority.signEvent()`
(`src/nostr/sign/fedos_nostr_signing_authority.ts`, Alpha 442/445) takes
an `accountIndex: number` — there is no method anywhere in this
codebase that maps an `accountIndex` to a `publicIdentifier`/pubkey, or
that lets a caller ask "does this signing authority control the key
behind identity X?" Confirmed by direct inspection of
`FedosWasmNostrSigningAuthority` (`fedos_wasm_nostr_signing_authority.ts`):
it exposes `signEvent()` only. There is no safe key-control match today
— see Alpha 649.

## 9. Exact runtime ownership gap

`FedosBoardRuntime` (Alpha 622) exists, is fully tested, and is never
constructed by `startFedosDesktopRuntime()` (Alpha 606) — confirmed by
direct inspection of `fedos_desktop_runtime.ts`: it imports
`createFedosDesktopHost`/`createDesktopApplication` only, never
`createFedosBoardRuntime`. `FedosRunningDesktopRuntime` exposes `host`
and `stop()` only — no `boardRuntime()` accessor exists. This is the
Phase D gap.

## 10. Exact expected ripple scope

- New modules: `src/board/runtime/identity/`, `src/board/runtime/policy/`,
  `src/board/runtime/eligibility/` (all new files, no existing file
  deleted).
- Modified: `src/board/runtime/fedos_board_runtime.ts` (constructor
  gains three optional dependencies; `createPublicThread`/
  `replyToPublicThread` become `async`, routing through the new
  Authorities/Evaluator instead of Alpha 627/633's direct calls).
- Modified: `src/desktop/runtime/fedos_desktop_runtime.ts` +
  `fedos_desktop_runtime_config.ts` (Phase D — construct and expose
  `boardRuntime()`).
- Ripple: 7 existing test files under `test/` that call
  `createPublicThread()`/`replyToPublicThread()` synchronously needed
  `await` + `async` test callbacks added, since both methods now return
  `Promise<FedosBoardRuntimeCommandResult>` (an unavoidable consequence
  of the new Authorities' own `Promise`-returning contract, Alpha 646).
  No test's own assertions changed — only call-site syntax.
- `fedos_board_runtime_author_authority.ts` / `fedos_board_runtime_outbound_eligibility.ts`
  (Alpha 627/633) are left byte-for-byte UNCHANGED and still fully
  tested — `FedosBoardRuntime` simply stops calling them directly,
  reusing their exported `anonymousLocalAuthorReference()`/
  `FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER` from the
  new Authority layer instead of duplicating the sentinel.

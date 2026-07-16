# Secure Runtime Alpha 647 — Desktop Identity Adapter

Stage 7. `FedosDesktopPublicAuthorAuthority`
(`src/board/runtime/identity/fedos_desktop_public_author_authority.ts`)
implements `FedosPublicAuthorAuthority` over the SAME `FedosDesktopHost`
a `FedosBoardRuntime` already holds.

Requirements confirmed:

- **Public methods only**: calls only `host.desktop()` (already-public,
  Alpha 336) and, on a non-null result, `.currentPublicIdentity()`
  (already-public, Alpha 128).
- **Does not expose `DesktopApplication` itself**: `resolvePublicAuthor()`'s
  own return type is `FedosPublicAuthorResolution`, which carries only a
  `FedosBoardAuthorReference` or a bare outcome tag — never the
  `DesktopApplication` instance.
- **No access to Reader/Provider/Registry/Source**: this class imports
  only `FedosDesktopHost`'s type, `isFedosBoardSourceProtocol`, and the
  Authority's own vocabulary — no `FedosPublicIdentityReader`,
  `FedosNostrPublicIdentitySource`, `FedosIdentityRegistry`, or
  `FedosIdentityProvider` import anywhere in this file.
- **No caching of its own**: this class holds no field beyond `#host`
  — it reads `currentPublicIdentity()`'s own already-cached value fresh
  on every call, adding no second cache layer.
- **No refresh side effect per post command**: `resolvePublicAuthor()`
  never calls `refreshPublicIdentity()` — only `currentPublicIdentity()`,
  a synchronous read of whatever `DesktopApplication.start()` (Alpha
  136) already populated once.
- **Unavailable identity fails per Alpha 645 policy**: when
  `host.desktop()` is `null` (Host not `"ready"`), this method returns
  `{ outcome: "unavailable" }` — distinct from `"anonymous-local"`
  (Host ready, but no identity configured).
- **No mutation of Runtime Identity**: no write of any kind occurs in
  this file.

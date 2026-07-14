# Secure Runtime Alpha 336 — Desktop Host Access Boundary

**Status: this Stage implements code.** Stage 6 of the Alpha 331–340
Desktop Host Runtime Foundation Arc. Adds `desktop()`/`board()` to
`FedosDesktopHost` (`src/desktop/host/fedos_desktop_host.ts`).

## 1. Why now

Alpha 335 wired hydration and Desktop startup into `start()`, but held
the resulting `FedosBoardService` privately. This Stage fixes the
minimum public surface a caller uses to actually reach the owned
`DesktopApplication`/`FedosBoardService` once the Host is ready.

## 2. Is returning `DesktopApplication` itself too broad?

Reviewed directly against the ACTUAL public surface of both owned
classes, not a hypothetical one:

- `DesktopApplication` (Alpha 096–136) exposes exactly: `bootstrap()`,
  `start()`, `currentIdentity()`, `isBootstrapped()`,
  `readPublicIdentity()`, `currentPublicIdentity()`,
  `refreshPublicIdentity()`. None of these returns a Secret Handle, a
  Protocol Provider, or the Identity Registry itself —
  `currentIdentity()`/`currentPublicIdentity()` return a
  `FedosIdentityDescriptor | null` (public fields only, per Alpha
  028/045), never the underlying `FedosRuntimeIdentity` instance or
  its own private `#registry`.
- `FedosBoardService` (Alpha 307) exposes exactly: `registerPost()`,
  `findPost()`, `listBoardPosts()`, `listThreadPosts()`. None of these
  returns the underlying `FedosBoardRepository`, `FedosBoardSourceIndex`,
  or `FedosBoardIndex` — only `FedosBoardPost` values (already
  `readonly`) or write-result tokens.

**Conclusion: returning the owned instances directly is NOT too
broad**, because neither class's OWN public surface exposes Persistence,
a mutable index, the Identity Registry, a Protocol Provider, or a
Secret Handle — the objects themselves are already as narrow as this
Arc's own guardrails require.

## 3. Candidates compared

- **Option A — expose owned application/service instances after
  ready.** `desktop(): DesktopApplication | null`,
  `board(): FedosBoardService | null`. Zero new wrapper methods; every
  capability a caller needs is already public on the owned objects
  themselves (§2).
- **Option B — expose only Host-level delegated operations.** Would
  require duplicating `DesktopApplication`'s seven public methods and
  `FedosBoardService`'s four as pass-through wrappers on
  `FedosDesktopHost` itself — pure boilerplate with no additional
  safety, since §2 already confirms neither owned object exposes
  anything forbidden.
- **Option C — expose an immutable context object.** Would introduce a
  THIRD type (`{ readonly desktop: DesktopApplication; readonly board:
  FedosBoardService }`) carrying no capability Option A's two
  accessors don't already provide, and complicates the
  before-ready/after-stopped fail-closed check (§4) by requiring the
  context object itself to be nullable instead of each field
  independently.

**Decision: Option A**, matching Alpha 332's own class-based
responsibility model — the Host owns two things, so it exposes exactly
two accessors, each independently gated.

## 4. Fail closed before ready and after stopped

```ts
desktop(): DesktopApplication | null {
  return this.#state === "ready" ? this.#desktopApplication : null;
}
board(): FedosBoardService | null {
  return this.#state === "ready" ? this.#boardService : null;
}
```

Both accessors return `null` for `"constructed"`, `"starting"`,
`"stopping"`, `"stopped"`, and `"failed"` — every state except
`"ready"` — never throwing, matching `DesktopApplication.currentIdentity()`'s
own never-throws-a-plain-read convention (Alpha 116).

## 5. Permanent prohibitions confirmed

No method on `FedosDesktopHost` exposes: the `FedosBoardPersistence`
implementation, a mutable index (`FedosBoardIndex`/
`FedosBoardSourceIndex`/`FedosBoardRepository`), an Identity Registry,
a Protocol Provider, a Secret Handle, an internal lifecycle `Promise`
(`start()`/`stop()` themselves return `Promise<void>`, carrying no
internal state), or any `p2p`/Ontology internal — none of these types
is imported anywhere in `src/desktop/host/`.

## 6. Conclusion

`desktop()`/`board()` return the exact owned instances, gated
identically on `state() === "ready"`, with no wrapper layer — the
owned objects' own already-narrow public surfaces make a delegation
layer (Option B) or a context wrapper (Option C) pure ceremony, not
additional safety.

## 7. See also

- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_116_desktop_identity_access.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`

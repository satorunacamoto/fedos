# 07. IPC Response Boundary

## Specification

Reuse `FedosDesktopHostResponse<T>`
(`src/desktop/host_boundary/fedos_desktop_host_response.ts`) VERBATIM as
the IPC response shape — no new type is needed. It is already:

- `{outcome:"ok", value, requestId?}` or
  `{outcome:"error", code, message, requestId?}` — a closed, two-branch
  shape.
- `Object.freeze`d and built exclusively from plain data (strings,
  numbers, booleans, plain objects/arrays, `null`) — already confirmed
  structured-clone/JSON-safe by Alpha 3561-3640's own dedicated
  serialization test, which this review's own `security_boundary_invariants.test.ts`
  re-confirms still holds in this exact worktree.
- Never a raw `Error`, a class instance, a `Buffer`/file handle, or a
  crypto handle — confirmed by the SAME existing test (`.not.toBeInstanceOf(Error)`
  across every command type exercised in one real session).

## Explicit exclusions (already satisfied, restated for the IPC context)

- **Raw Errors** — every `dispatch()`/`start()`/`stop()` path in
  `FedosDesktopHostBridge` is wrapped in `try`/`catch`, converting any
  unexpected lower-layer exception into a closed `{outcome:"error",code:"failed",message}`
  BEFORE it would ever reach an IPC reply.
- **Class instances** — `FedosDesktopRenderModel<T>`/ViewModel state/Shell
  result objects are already plain, frozen object literals, never class
  instances with methods (confirmed by inspection of every renderer/
  ViewModel file, Alpha 3241-3320/3401-3480).
- **File handles** — `archive-inspect`'s own result is a manifest (plain
  data), never an open handle or stream.
- **Crypto handles** — no `AeadKeyHandle`/`AeadCiphertextHandle` (or any
  Master Seed reference) is reachable from anything `dispatch()` can
  return; confirmed transitively by Alpha 3081-3160's own Content
  Accessor guarantee (unchanged, still the deepest layer the Host
  reaches).
- **Secrets** — no bearer secret, passphrase, or private key field exists
  on any type in the command/response vocabulary (structurally impossible
  — none of the closed union members declares such a field).
- **Stack traces by default** — `message`/`reason` fields are short,
  closed, human-readable diagnostics sourced from the Shell/ViewModel's
  own existing `reason` strings, never `error.stack`.

## Conclusion

No new response-boundary work is required for Electron specifically — the
existing Host response vocabulary was already designed (Alpha 3561-3640)
to be safe for an eventual process boundary crossing, and this review's
own tests confirm that guarantee still holds unmodified.

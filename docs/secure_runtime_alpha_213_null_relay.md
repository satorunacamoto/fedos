# Secure Runtime Alpha 213 — Null Relay

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/null_relay.ts`, and nothing else. This is Stage 3 of the
Alpha 211–220 Nostr Relay Foundation Arc, following Alpha 212's own
Relay Interface.**

## 1. Why now

Alpha 212 shipped `FedosRelay` with no implementation. This Stage adds
the first one, `NullRelay` — a dependency-free implementation needing
no socket, no factory, no network capability of any kind, mirroring
`NullEventReader`'s (Alpha 203) own identical relationship to
`FedosEventReader`. Since `FedosRelay` (as of this Stage) names only
`url`, `NullRelay`'s own entire body is that one field, held and
returned — there is nothing else on the interface yet for any
implementation to satisfy.

## 2. What was implemented

```ts
export class NullRelay implements FedosRelay {
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }
}
```

- One constructor parameter, `url`, stored verbatim.
- No other field, no method, no async work of any kind — this class
  performs literally nothing beyond holding the string it was given.

## 3. Existing behavior maintained 100%

This Stage adds ONE new, standalone file and wires it into NOTHING —
no existing file references `NullRelay`, and `FedosRelay` itself is
unmodified. Since nothing else in this repository yet references
`FedosRelay` at all (Alpha 212 shipped it unwired), there is no
existing behavior for this Stage to disturb.

## 4. What this Stage does NOT do

- Does **not** add `connect()`, `disconnect()`, `isConnected()`, or
  `publish()` to `NullRelay` or to `FedosRelay` — each is a separate,
  later Stage's own deliverable (Alpha 214/215/216).
- Does **not** modify `src/desktop/fedos_relay.ts`,
  `desktop_application.ts`, or `create_desktop_application.ts`.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.
- Does **not** open any network connection of any kind — no
  `WebSocket`, no `fetch`.

## 5. See also

- `docs/secure_runtime_alpha_212_relay_interface.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
- `docs/secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision.md`
- `docs/secure_runtime_alpha_104_null_reader.md`

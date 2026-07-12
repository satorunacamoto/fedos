# Secure Runtime Alpha 137 — Bootstrap Ordering

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 2 of the
Alpha 136–140 Desktop Startup Identity Sequence Arc, following Alpha
136's own Startup Sequence wiring.**

## 1. Why now

Alpha 136 inserted `await this.refreshPublicIdentity();` between
`await this.bootstrap();` and `this.#started = true;` in `start()`'s
own body. Before building further on the new sequence, this Stage
formally confirms — grounded in the actual, current source and in real
execution — that the ORDER is genuinely enforced: `refreshPublicIdentity()`
is called only after `bootstrap()` has resolved successfully, and is
never reached if `bootstrap()` rejects.

## 2. What was reviewed

The full, current body of `start()` was inspected:

```ts
async start(): Promise<void> {
  if (this.#started) {
    throw new Error("DesktopApplication.start() was already called.");
  }
  await this.bootstrap();
  await this.refreshPublicIdentity();
  this.#started = true;
}
```

- `await this.bootstrap();` and `await this.refreshPublicIdentity();`
  are two SEPARATE, SEQUENTIAL `await` statements — not
  `Promise.all([...])`, not two independent fire-and-forget calls.
- Plain JavaScript `async`/`await` control flow: if the `Promise`
  `this.bootstrap()` returns REJECTS, the `await` on that line throws
  immediately, and `start()`'s own function body exits via that
  exception — the following line,
  `await this.refreshPublicIdentity();`, is NEVER reached, and
  therefore `this.#reader.readPublicIdentity()` (the only place a
  Reader call could originate from within this sequence) is NEVER
  invoked.
- This was confirmed not merely by reading the code, but by executing
  it: a real `DesktopApplication` instance, constructed with a Reader
  whose own call is spied on, and a `FedosIdentityService` mock forced
  to reject once — the Reader spy recorded ZERO calls after the
  rejected `start()` attempt.

## 3. Decision

**`refreshPublicIdentity()` is called if and only if `bootstrap()` has
already resolved successfully within the SAME `start()` invocation.
Bootstrap failure — a rejected `Promise` from `bootstrap()` — GUARANTEES
the Reader is never called by `start()`'s own sequence. This ordering
guarantee follows directly from `async`/`await` semantics, not from any
additional guard code — there is no `try`/`catch`, no boolean flag, no
conditional; the sequential `await` chain itself is the enforcement
mechanism.**

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** add a `try`/`catch` or any explicit ordering guard — the
  guarantee is, and remains, a consequence of plain sequential `await`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_132_refresh_delegation.md`
- `docs/secure_runtime_alpha_136_startup_sequence.md`

# Secure Runtime Alpha 7001–7080 — Secret-Surface Audit Report

**FedOS Desktop Beta Final Runtime Validation and End-to-End Messaging
Acceptance Arc.** Phase N.

## Scope actually covered this session

Packaging was not run (no `dist-package-beta/`/`release/` output exists
for this Arc's own changes), and no real end-to-end message flow with
real canary plaintexts was established (see the End-to-End Messaging
Acceptance Report), so there is no packaged asar / release-manifest /
durable-message-store output to scan for canary leakage this session.
This report instead covers what IS real and inspectable: the new source
this Arc actually added.

## Findings (real source inspection, not narrative claim)

1. **Acceptance script step logging never includes the raw payload.**
   `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`'s
   `AUTOTEST_MODE === "acceptance"` branch logs only
   `` `FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:${i}:${step.command}:${JSON.stringify(result)}` ``
   — the command NAME and its RESULT, never `step.payload`. A
   `profile-create`/`profile-unlock` script step's own passphrase (inside
   `payload`) is never written to stdout/console by this new code path.
2. **No new console logging of secrets anywhere in the acceptance
   handlers.** `grep -n "console\.(log|error)"` across the new
   `handleAcceptance*` functions returns zero matches — every one of
   them only returns a value to its caller (the script runner, which
   itself only logs the RESULT, per finding 1).
3. **The relay server fixture never inspects event content.** Confirmed
   by direct source read of `test/support/fedos_real_local_websocket_relay_server.ts`:
   every `EVENT` payload is forwarded as opaque `unknown`/`Record<string,
   unknown>` — no field is read, decoded, or logged beyond the top-level
   NIP-01 envelope shape (`id`, used only to echo back in the `OK` ack).
4. **No raw Master Seed handle, SecretHandle id, Ratchet key, or raw WASM
   module reference appears anywhere in the new `fedos-acceptance:*`
   code path** — confirmed by structural guard test 6 (direct source
   scan of the acceptance-handler section for `masterSeedAuthority`/
   `SecretHandle`/`root_key`/`chain_key`/`private_key`/`moduleRef`/
   `FedosWasmLoaderSkeleton`, zero matches).
5. **No absolute worktree path appears in any new source file's own
   runtime-visible output.** The only path-shaped strings in the new
   code are `distUrl(...)` import specifiers (build-relative, never
   logged) and the relay server's own `ws://127.0.0.1:<port>` URL
   (a real bound local address, not a filesystem path).

## Not proven by this report

- Physical RAM erasure of any secret — restated, unchanged: no claim of
  this kind is made anywhere in this codebase's history, and this Arc
  makes none either.
- Packaged asar/release-manifest secret scanning — not run, since
  packaging was not run this session (disclosed, not silently skipped).
- Durable local-message-store plaintext-boundary verification — not run,
  since no real message was ever sent/persisted this session (see the
  End-to-End Messaging Acceptance Report).

## Recommended next step

Once a real end-to-end message flow exists (per the End-to-End Messaging
Acceptance Report's own recommended next step), re-run this audit against
the real durable profile/message/Outbox/Identity-Transition/Signed-
Deletion persistence files it produces, using unique per-run canary
values throughout, exactly as this Phase's own mission specifies.

# Secure Runtime Alpha 616–618 — No Worker Coupling / No Implicit Startup / Operational Verification

Stages 16–18 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Alpha 616 — No Worker Coupling Guard

`test/secure_runtime_alpha_616_no_worker_coupling_guard.test.ts` — 3
cases: `src/worker.ts`'s own source never mentions `desktop/host` or
`desktop/runtime`; none of the three new runtime files import from
`../../worker.js`, mention `Cloudflare`/`D1`, or access a Worker-style
`env.*` binding; none constructs a `Request`/`Response` or calls
`handleRequest`. All checked against real source text (`?raw` imports),
not design intent alone.

## Alpha 617 — No Implicit Startup Guard

`test/secure_runtime_alpha_617_no_implicit_startup_guard.test.ts` — 3
cases: every non-indented (module-top-level) line in
`fedos_desktop_runtime.ts` is only an import, an interface/function
declaration opener, or a brace — confirmed there is no top-level
statement that CALLS anything (no eager `mkdirSync`, no eager Host
construction). `main()` is invoked exactly once in
`run_fedos_desktop_runtime.ts`, at that file's own top level — the ONE
intentional, documented exception (Alpha 613's own "executable owns
process" boundary), safe specifically because Alpha 616 already
confirms nothing else in this repository imports that file. No
`process.on`/timer/Relay/WebSocket/Signing reference exists anywhere
in the testable assembly module.

An initial draft of case 1 used `vi.spyOn(nodeFs, "mkdirSync")` to
observe import-time side effects directly — abandoned after a real
`TypeError: Cannot redefine property: mkdirSync` (Node's own `node:fs`
export is not configurable in this environment); the structural,
regex-based check above verifies the identical property (no top-level
call) without depending on a mockable module boundary that does not
exist here.

## Alpha 618 — Operational Verification

`test/secure_runtime_alpha_618_operational_verification.test.ts` — 8
cases, every one one this Stage's own instruction named: clean
startup -> graceful stop -> restart (3 cycles, same paths); a corrupt
board log's own failure does not affect a SUBSEQUENT, correctly-pathed
runtime; `deliveryStatus()` stays `{running: false}` for delivery
disabled's entire lifetime; two runtimes over DIFFERENT paths share no
state; two runtimes over the SAME paths are still independent `Host`
object identities (`not.toBe`); no Publisher call occurs after `stop()`
resolves even after a further real wait (confirms the interval was
genuinely cleared, not merely ignored); `p2p/` is never imported by
any of the three new runtime files (code-only regex, a doc comment
naming the prohibition is not itself flagged).

## See also

- `docs/secure_runtime_alpha_606_runtime_assembly.md`
- `docs/secure_runtime_alpha_612_runtime_stop_ordering.md`

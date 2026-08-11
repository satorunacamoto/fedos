# Commerce Packaged-Binary E2E — pre-run host telemetry snapshot (Agent X, investigation-only phase)

**Purpose:** this is NOT evidence from a real packaged-binary E2E run. Agent X's
mandate for this phase was investigation/harness-hardening only — no
`npm run package`, no NSIS install, no packaged-binary launch, no full
happy-path run was executed. This file exists purely to give the arc
coordinator a fresh host-contention baseline, captured live on this machine
immediately before the coordinator's own later, sequential heavy
install+E2E run, so that run's timing can be compared against this and
against the "severe pressure" numbers recorded in
`docs/commerce/COMMERCE-PACKAGED-BINARY-E2E-CLOSURE.md` (free memory falling
1.36 GB -> 0.79 GB -> 0.70 GB out of 15.18 GB, 280+ system-wide processes,
while packaged-binary launch attempts were in flight and never completed).

Machine/worktree: `OS-worktrees/commerce-final-agent-x`
(`arc/commerce-durability-agent-x`), captured 2026-08-11, via
`Get-CimInstance Win32_OperatingSystem` / `Win32_Processor` / `Win32_Process`
and cross-checked with `Get-Process`.

## Three live samples, ~35 seconds apart

| Sample (UTC) | Total processes (Win32_Process) | node.exe | electron*/FedOS* | cargo.exe/rustc.exe | Free physical mem (MB) | Total physical mem (MB) | Free mem % | Avg CPU load % |
|---|---|---|---|---|---|---|---|---|
| 2026-08-11T10:32:47.54Z | 194 | 0 | 0 | 0 | 1770.10 | 15546.87 | 11.39% | 3% |
| 2026-08-11T10:33:09.79Z | 194 | 0 | 0 | 0 | 2167.11 | 15546.87 | 13.94% | 43% |
| 2026-08-11T10:33:46.33Z | 193 | 0 | 0 | 0 | 2119.38 | 15546.87 | 13.63% | 12% |

Cross-check via `Get-Process` (distinct API, same instant as sample 3):
process names `node`/`electron`/`FedOS Desktop Beta`/`cargo`/`rustc`/
`esbuild`/`bash`/`vitest` — **zero matches**, 195 total processes reported
(within 1-2 of the `Win32_Process` count above; the small discrepancy is
expected — the two APIs enumerate at slightly different instants and one
short-lived helper process can exit between snapshots).

One transient artifact worth disclosing honestly: a `Group-Object`-based
process-name tally taken between sample 1 and sample 2 momentarily showed
`node.exe Count=2` and `bash.exe Count=4` — most likely short-lived
child processes (this Bash tool's own invocations, or another agent's quick
npm/node script) that started and exited within the ~20-second window
between that call and sample 2's explicit `node.exe`/`bash.exe` filter,
which both then read 0. Not treated as a stable "N node processes running"
finding — the two immediately-following explicit samples (0 each) are more
representative of the steady state at capture time.

## Comparison against the arc doc's "severe pressure" numbers

| Metric | Arc doc's "severe pressure" run | This snapshot (now) |
|---|---|---|
| System-wide process count | 280+ | ~193-195 |
| Free physical memory | 1.36 GB -> 0.79 GB -> 0.70 GB (falling, out of 15.18 GB total) | 1.73-2.17 GB (fluctuating, out of ~15.19 GB total) |
| Free memory % | ~4.6% -> ~5.2% at the low point | ~11.4-13.9% |
| Concurrent node/electron/cargo build processes | many (unspecified exact count, but part of "dozens of concurrent sibling Arc worktrees' builds/tests") | 0 in each of 3 explicit samples (one transient 2-node/4-bash blip noted above, not sustained) |

## Assessment (numbers-based, not a guess)

This machine's current state has roughly **1.5x the free-memory headroom**
(11-14% free vs ~4.6-9% at the "severe pressure" run's measured low points)
and **fewer than 70% of the total system process count** (~194 vs 280+) that
the arc doc's Part 2 finding correlated with the packaged binary's
non-completing/extremely-slow startup. Zero build-tool (node/electron/cargo)
processes were observed running concurrently in any of the three explicit
samples taken here, versus "dozens of concurrent sibling Arc worktrees'
builds/tests" during the severe-pressure run.

Based strictly on these numbers, this machine right now looks **meaningfully
less contended** than the conditions under which Part 2's slowness was
observed, and therefore **less likely** (not "unlikely" — no lower bound was
established, and this is a live shared machine that can change in seconds)
to reproduce Part 2's non-completing-startup symptom if the coordinator's
real heavy run were started at this exact moment. This is not a guarantee:
these are point-in-time samples on a machine other agents/worktrees actively
use, and load can rise sharply again before the coordinator's own run
starts. The coordinator should take its own fresh snapshot (or use the new
periodic-sampling harness diagnostic — see this arc's own commit — during
the actual run) immediately before/during the real attempt rather than
relying solely on this file's numbers.

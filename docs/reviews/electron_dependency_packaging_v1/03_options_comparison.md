# 03. Options Comparison

Evaluated against the ACTUAL repository (`01`): pure TypeScript/ESM
application code, one Rust crate that is WASM-crypto-only (no native GUI
surface of any kind), zero bundler, zero CI, two production npm
dependencies, "no HTTP API"/"no remote web hosting"/"no cloud sync" as
standing Absolute Prohibitions repeated in every Arc this stack was built
under.

## A. Electron

**Fit:** Renderer process is plain HTML/JS/CSS — the EXISTING
`FedosDesktopRenderer`'s output (plain JSON render models) is already
exactly what a web-technology UI consumes natively; zero adapter work
needed on the render-model side. Main process is plain Node — the
EXISTING `FedosDesktopHostBridge` already runs unmodified in a Node
context (confirmed: Alpha 3561-3640's own 17 tests run it under plain
Node/vitest). WASM (the crypto crate) loads identically in Electron's
Chromium/Node as in plain Node — no known incompatibility.
**Cost:** Very large dependency (`04`), no bundler currently exists and
one becomes mandatory, largest artifact/install size of every option
here, largest supply-chain surface (`17`).

## B. Tauri

**Fit:** Smaller runtime footprint (uses the OS's own WebView, not a
bundled Chromium), smaller artifacts. **Cost:** Requires a NEW Rust
binary crate hosting a native window + WebView — a materially different
Rust surface than the existing `packages/fedos-core-rust` crate (WASM
library only, no binary target, no windowing dependency of any kind, and
under EXTREMELY strict, repeatedly-tested "exactly N production
dependencies" guardrails — `test/fedos_core_rust_dependency.test.ts`/
`test/fedos_core_rust_skeleton.test.ts` assert the crate's own dependency
COUNT and feature flags line-by-line). Standing up a second, GUI-hosting
Rust crate (or adding a native-windowing dependency to the existing one)
is a substantially bigger, more novel change to this repository's Rust
side than adding one TypeScript devDependency is to its Node side. Tauri
also still needs a bundler for its own web-view frontend, so this cost is
NOT avoided either.

## C. Node process + native WebView host (custom, e.g. raw WebView2 bindings)

**Fit:** Smallest possible runtime if it worked. **Cost:** No accepted
native-binding dependency exists for this today; would require adopting
an UNPROVEN, low-adoption native N-API module (a real new supply-chain
and Windows-native-build risk, likely LARGER integration risk than either
A or B for a solo/small team, and explicitly the kind of "custom native
host" this review's own Phase 03 lists as option F, one this review does
not treat as more mature than A/B).

## D. Browser/PWA shell

**Fit:** Zero new desktop dependency. **Cost:** Requires a web server to
host the page — directly conflicts with this repository's own standing
Absolute Prohibition ("no HTTP API," "no remote web hosting") repeated in
every prior Arc. A PWA also runs inside the browser's own storage/file
sandbox — the Archive/log-path model (explicit, caller-supplied
filesystem paths, Alpha 604's own unchanged rule) has no honest
browser-sandbox equivalent without inventing a new, weaker permission
model. Rejected on this repository's own existing rules, not on
technical-adequacy grounds.

## E. Keep framework-neutral Host only (no concrete window at all)

**Fit:** Zero new dependency, zero new risk, exactly what exists today.
**Cost:** Not a shippable end-user product — there is no window, so no
non-technical user can ever interact with this stack (`02`'s own "local
desktop window" gap remains open indefinitely).

## F. Custom native host later (unspecified technology)

**Fit:** N/A — no concrete technology is named, so there is nothing to
evaluate. This is a valid way to defer the decision, not a technology
choice.

## Comparison table

| | New dependency size | Rust-side change | Bundler needed | Violates a standing prohibition | Shippable window today |
|---|---|---|---|---|---|
| A. Electron | Very large | None | Yes (new) | No | No (not yet built) |
| B. Tauri | Small (JS side); large (new Rust surface) | Yes, substantial | Yes (new) | No | No (not yet built) |
| C. Custom WebView | Unknown/unproven | Possibly | Yes (new) | No | No |
| D. PWA | None | None | Maybe | **Yes** (no HTTP API/remote hosting) | No |
| E. Neutral Host only | None | None | None | No | No (never will be) |
| F. Custom native, later | Undecided | Undecided | Undecided | Undecided | No |

No option here is shippable TODAY without further implementation work —
this review's own job (`20`) is choosing which one to spend that work on
first, not declaring one already done.

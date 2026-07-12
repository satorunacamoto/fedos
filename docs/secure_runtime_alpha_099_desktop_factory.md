# Secure Runtime Alpha 099 — Desktop Factory

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/create_desktop_application.ts`, and modifies nothing
else — `desktop_application.ts` is byte-for-byte unchanged. This is
Stage 4 of the Desktop Shell Foundation Arc (Alpha 096–100).**

## 1. Why now

Alpha 096–098 built `DesktopApplication` itself. Nothing yet
designated a single, canonical place to CONSTRUCT one — any future
caller could write `new DesktopApplication()` directly, scattered
across however many call sites eventually exist. This Stage adds that
single place, mirroring the exact discipline `createRuntime()` itself
already established for `AppRuntime`.

## 2. What was implemented

A new file, `src/desktop/create_desktop_application.ts`, exporting one
new function:

```ts
export function createDesktopApplication(): DesktopApplication {
  return new DesktopApplication();
}
```

- Performs NO async work — construction alone, exactly as
  `DesktopApplication`'s own constructor already guarantees is safe
  (Alpha 091/096).
- Does NOT call `bootstrap()` or `start()` on the instance it returns
  — Bootstrap remains a separate, explicit step a caller performs
  after construction, exactly as the Alpha 092 Bootstrap Sequence
  Decision requires.

## 3. Consistency with the Desktop Design (Alpha 086–095)

- **Alpha 091 (Entry Point):** this factory is a CONSTRUCTION site,
  not a Bootstrap site — it does not itself constitute the
  `Application bootstrap()` entry point Alpha 091 designated; a future
  caller still performs `bootstrap()`/`start()` separately, after
  calling this factory.
- **Alpha 093 (Ownership):** `createDesktopApplication()` does not
  retain a reference to the instance it returns — it constructs and
  immediately hands ownership to its own caller, exactly mirroring
  `createRuntime()`'s own return-and-forget pattern.
- **Alpha 099's own naming** deliberately mirrors `createRuntime()`
  (`create_runtime.ts` → `createRuntime()`,
  `create_desktop_application.ts` → `createDesktopApplication()`) —
  the SAME "one clearly-named function, one clearly-scoped
  responsibility" discipline Alpha 091 already cited as the reason
  `Application bootstrap()` itself was adopted as a dedicated function
  rather than folded into `main()`.

## 4. What this Stage does NOT do

- Does **not** call `bootstrap()` or `start()` from inside
  `createDesktopApplication()` — Bootstrap remains entirely the
  caller's own responsibility.
- Does **not** modify `desktop_application.ts` in any way.
- Does **not** implement any GUI, Nostr, Relay, or Observation
  construct of any kind.
- Does **not** modify `src/runtime/create_runtime.ts`, `types.ts`,
  `src/worker.ts`, any `src/identity/*` file, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** accept any argument, option, or override of any kind —
  `createDesktopApplication()` takes no parameters, mirroring
  `DesktopApplication`'s own argument-free constructor.

## 5. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_091_desktop_entry_point_review.md`
- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_093_ownership_review.md`
- `docs/secure_runtime_alpha_096_desktop_shell_skeleton.md`
- `docs/secure_runtime_alpha_098_ready_state.md`

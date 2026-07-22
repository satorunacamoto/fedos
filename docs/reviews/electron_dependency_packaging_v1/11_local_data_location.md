# 11. Local Data Location

| Data | Current model | User-selected or internal? |
|---|---|---|
| Application data path | **None exists.** Every `FedosDesktopRuntimeConfig` log path is an explicit, caller-supplied string — no default, no `cwd`-relative path (Alpha 604's own rule, confirmed unchanged across every Arc since). Electron would compute explicit paths under `app.getPath("userData")` and pass them into the SAME config contract — no change to the Runtime's own config shape needed. | Internal (once computed) |
| Archive path | `sourcePath`/`destinationPath` on Archive commands — always caller/user-supplied. | **User-selected** (`09`) |
| Search index path | **None — does not exist.** `FedosConversationSearchIndex` is confirmed in-memory-only, never persisted (Alpha 2501-2580's own accepted, unchanged design) — there is no location to choose, by design. | N/A |
| Device registry path | `src/sync/fedos_sync_device_registry.ts` exists but is wired into nothing reachable from the Desktop Host (`01`) — no real path decision applies today. | N/A (unwired) |
| Sync journal path | `src/sync/fedos_sync_journal.ts` — same as above, unwired, N/A. | N/A (unwired) |
| Logs | **None exist.** No file-based logging is implemented anywhere in this stack today — only `console.log`/`console.error` in the bare CLI entry point (`run_fedos_desktop_runtime.ts`). A real Electron app would want structured local log files; this is genuinely NEW work, not an adapter of something that already exists. | Internal (future) |
| Temporary files | Only test-scoped (`mkdtempSync` under the OS temp dir, used by every test in this lineage) — not a production concern today. | Internal |

## Conclusion

The overwhelming majority of this stack's durable state already follows
the "explicit, caller-supplied path, no default" discipline an Electron
adapter can simply compute paths for (via `app.getPath`) without changing
a single existing config contract. The two genuinely NEW pieces an
Electron adoption would surface — a real application-data-path default
and real structured logging — are both new work regardless of which host
technology is chosen, not Electron-specific costs.

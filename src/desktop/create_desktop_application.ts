/**
 * Secure Runtime Alpha 099 ("Desktop Factory") — the FIRST file
 * anywhere in `src/desktop/` besides `desktop_application.ts` itself.
 * `createDesktopApplication()` mirrors `createRuntime()`'s own naming
 * and scoping discipline (`src/runtime/create_runtime.ts`) — ONE
 * clearly-named function, ONE clearly-scoped responsibility: it
 * constructs and returns exactly one `DesktopApplication`, and
 * nothing else. It does NOT call `bootstrap()`/`start()` on the
 * instance it returns; per the Alpha 092 Bootstrap Sequence Decision,
 * a future caller performs that separately, after construction.
 *
 * HARD GUARDRAILS:
 *   - `createDesktopApplication` is the ONLY export.
 *   - This function performs NO async work of any kind — it only
 *     constructs and returns one `DesktopApplication` instance.
 *   - It does NOT call `bootstrap()` or `start()` on the instance it
 *     returns.
 *   - NO reference to `create_runtime.ts`, `types.ts`, `worker.ts`, or
 *     any `AppRuntime` field.
 */

import { DesktopApplication } from "./desktop_application.js";

export function createDesktopApplication(): DesktopApplication {
  return new DesktopApplication();
}

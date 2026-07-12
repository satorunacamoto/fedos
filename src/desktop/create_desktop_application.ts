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
 * Secure Runtime Alpha 103 ("Source Injection") updates this
 * function's own body to explicitly construct the Source and Reader
 * `DesktopApplication` will hold — `resolveNostrPublicIdentitySource()`
 * (Alpha 048), then `new NostrPublicIdentityReader(source)` (Alpha
 * 103), then `new DesktopApplication(reader)` — matching this Stage's
 * own Source Injection diagram precisely. This is functionally
 * EQUIVALENT to the no-argument `new DesktopApplication()` this
 * function called before this Stage, since `DesktopApplication`'s own
 * constructor defaults to the exact same construction when no Reader
 * is supplied — this Stage makes the construction explicit here
 * rather than relying on that default silently.
 *
 * HARD GUARDRAILS:
 *   - `createDesktopApplication` is the ONLY export.
 *   - This function performs NO async work of any kind — it only
 *     constructs the Source, the Reader, and one `DesktopApplication`
 *     instance, and returns the latter.
 *   - It does NOT call `bootstrap()` or `start()` on the instance it
 *     returns.
 *   - It does NOT call `readPublicIdentity()` on the Reader or Source
 *     it constructs.
 *   - NO reference to `create_runtime.ts`, `types.ts`, `worker.ts`, or
 *     any `AppRuntime` field.
 */

import { DesktopApplication } from "./desktop_application.js";
import { NostrPublicIdentityReader } from "./nostr_public_identity_reader.js";
import { resolveNostrPublicIdentitySource } from "../identity/fedos_nostr_public_identity_source_resolver.js";

export function createDesktopApplication(): DesktopApplication {
  const source = resolveNostrPublicIdentitySource();
  const reader = new NostrPublicIdentityReader(source);
  return new DesktopApplication(reader);
}

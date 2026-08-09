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
 * Secure Runtime Alpha 109 ("Desktop Wiring") adds an optional
 * parameter, `publicIdentity?: FedosNostrPublicIdentitySnapshot`, and
 * rewrites this function's own body to branch on it: when supplied,
 * construct a `StaticNostrPublicIdentitySource` (Alpha 108) from it
 * instead of calling `resolveNostrPublicIdentitySource()` (Alpha
 * 048); either way, wrap the resulting Source in a
 * `NostrPublicIdentityReader` (Alpha 103) exactly as before, and pass
 * BOTH the Reader and the original `publicIdentity` value into
 * `new DesktopApplication(reader, publicIdentity)` — matching this
 * Stage's own `createDesktopApplication() → StaticNostrPublicIdentitySource
 * → NostrPublicIdentityReader → DesktopApplication` diagram precisely.
 * Calling `createDesktopApplication()` with NO argument — every
 * existing call site across Alpha 096–108's own test suites —
 * continues to resolve through `resolveNostrPublicIdentitySource()`
 * exactly as before, keeping the default configuration's own
 * behavior (always `null`) completely unchanged.
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
 *   - `publicIdentity` (Alpha 109), when omitted, resolves through
 *     `resolveNostrPublicIdentitySource()` exactly as Alpha 103 left
 *     it — the default configuration's own behavior is unchanged.
 *   - `publicIdentity`, when supplied, is passed to
 *     `StaticNostrPublicIdentitySource`'s own constructor verbatim,
 *     with no validation or transformation of any kind performed
 *     here.
 *   - NO reference to `create_runtime.ts`, `types.ts`, `worker.ts`, or
 *     any `AppRuntime` field.
 */

import { DesktopApplication } from "./desktop_application.js";
import { NostrPublicIdentityReader } from "./nostr_public_identity_reader.js";
import { StaticNostrPublicIdentitySource } from "./static_nostr_public_identity_source.js";
import { resolveNostrPublicIdentitySource } from "../../../identity/fedos_nostr_public_identity_source_resolver.js";
import type { FedosNostrPublicIdentitySnapshot } from "../../../identity/fedos_nostr_public_identity_source.js";

export function createDesktopApplication(
  publicIdentity?: FedosNostrPublicIdentitySnapshot,
): DesktopApplication {
  const source = publicIdentity
    ? new StaticNostrPublicIdentitySource(publicIdentity)
    : resolveNostrPublicIdentitySource();
  const reader = new NostrPublicIdentityReader(source);
  return new DesktopApplication(reader, publicIdentity);
}

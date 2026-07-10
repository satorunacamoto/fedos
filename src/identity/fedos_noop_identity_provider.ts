/**
 * Secure Runtime Alpha 033 — "FedOS No-op Identity Provider".
 *
 * The first (and, as of this Stage, only) concrete implementation of
 * `FedosIdentityProvider` (Alpha 029) anywhere in this repository. See
 * `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md` for
 * the full design rationale, why it is deliberately NOT wired into
 * `resolveFedosIdentityProvider()` (Alpha 032) yet, how its `null`
 * differs in meaning from the Resolver's own `null`, the future
 * position where a real Nostr Provider would replace it, and the
 * comparison against `MemoryStorageBackend`.
 *
 * This file defines a SINGLE CLASS and nothing else — no constructor,
 * no configuration, no internal state, no thrown exceptions, no
 * Resolver reference, no Runtime reference, and no wiring into
 * `FedosIdentityService` (Alpha 031) or any other module in this
 * repository. `describeIdentity()` always resolves to `null`.
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "./fedos_identity_provider.js";

export class NoopFedosIdentityProvider implements FedosIdentityProvider {
  readonly provider = "noop";

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return null;
  }
}

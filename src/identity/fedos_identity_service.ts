/**
 * Secure Runtime Alpha 031 — "FedOS Identity Service Skeleton". Secure
 * Runtime Alpha 042 — "FedOS Identity Service Registry Integration"
 * (this revision).
 *
 * Alpha 031 shipped this Service wrapping exactly ONE
 * `FedosIdentityProvider` (Alpha 029) behind two pure pass-through
 * methods, with no Registry, no Record, no internal state beyond the
 * injected Provider. Alpha 041 then built `FedosIdentityRegistry`
 * (Alpha 041) — a Memory-only holder for `FedosIdentityRecord` (Alpha
 * 040) values — with "zero constructors, zero producers, zero
 * consumers" (Alpha 040 §11) still true of the Record itself even
 * after the Registry existed to hold one. THIS Stage is the first real
 * PRODUCER: `describeIdentity()` now also maps a successful Descriptor
 * onto a `FedosIdentityRecord` and registers it, via a second, required
 * constructor dependency — the injected `FedosIdentityRegistry`. See
 * `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
 * for the full design rationale: the Service/Provider, Service/Registry,
 * Service/Descriptor, Service/Record, Service/Runtime, and
 * Service/Storage boundaries, why this Service does not perform Registry
 * LOOKUP (only registration), and the future Identity Resolver direction
 * for lookup.
 *
 * This file defines a SINGLE CLASS, `FedosIdentityService`, and nothing
 * else — no Resolver, no Provider implementation, no Registry
 * implementation, no Record-shape change, no wiring into any other
 * module in this repository. It holds exactly two things — the
 * `FedosIdentityProvider` and the `FedosIdentityRegistry` its own
 * constructor was given — and still performs the SAME pure delegation
 * this Service has always performed, plus exactly one new, minimal step:
 *
 *   - `describeIdentity()` calls `provider.describeIdentity()` directly;
 *     on `null`, returns `null` UNCHANGED, registering nothing. On a
 *     real Descriptor, maps it onto a `FedosIdentityRecord` (copying its
 *     three fields verbatim — no reformatting, no derivation), calls
 *     `registry.register(record)`, and returns the ORIGINAL Descriptor
 *     unchanged — the Registry's own `register()` return value (`void`)
 *     is never surfaced to this method's own caller.
 *   - `describeCapability()` is BYTE-FOR-BYTE UNCHANGED from Alpha 031 —
 *     still reads ONLY `provider.provider` plus a fixed `true` literal,
 *     never touching the Registry, never calling `describeIdentity()`.
 *
 * HARD GUARDRAILS:
 *   - This Service NEVER calls `registry.find()`, `registry.list()`, or
 *     `registry.remove()` — only `registry.register()`, exactly once,
 *     only when `describeIdentity()` obtains a real Descriptor. Registry
 *     LOOKUP is explicitly out of this Stage's own scope (see the design
 *     doc's own "why this Service does not perform Registry lookup"
 *     section) — a future Identity Resolver is the named future owner.
 *   - `describeIdentity()`'s own RETURN VALUE is always the Provider's
 *     own Descriptor, unchanged — this method never returns a Record, a
 *     Registry-derived value, or anything the Registry's own API
 *     produced.
 *   - NO Runtime, Worker, Storage, Crypto, Authentication, or Nostr
 *     reference of any kind.
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import type { FedosIdentityCapability } from "./fedos_identity_capability.js";
import type { FedosIdentityRecord } from "./fedos_identity_record.js";
import type { FedosIdentityRegistry } from "./fedos_identity_registry.js";

export class FedosIdentityService {
  readonly #provider: FedosIdentityProvider;
  readonly #registry: FedosIdentityRegistry;

  constructor(provider: FedosIdentityProvider, registry: FedosIdentityRegistry) {
    this.#provider = provider;
    this.#registry = registry;
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    const descriptor = await this.#provider.describeIdentity();
    if (descriptor === null) {
      return null;
    }

    const record: FedosIdentityRecord = {
      id: descriptor.id,
      provider: descriptor.provider,
      publicIdentifier: descriptor.publicIdentifier,
    };
    this.#registry.register(record);

    return descriptor;
  }

  async describeCapability(): Promise<FedosIdentityCapability> {
    return { provider: this.#provider.provider, available: true };
  }
}

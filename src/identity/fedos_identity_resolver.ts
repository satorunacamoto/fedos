/**
 * Secure Runtime Alpha 043 — "FedOS Identity Resolver (Registry
 * Lookup)".
 *
 * The MINIMAL, dedicated Registry-lookup component Alpha 042 §10 named
 * but did not build — a thin, read-only wrapper around exactly TWO of
 * `FedosIdentityRegistry`'s (Alpha 041) own four methods, `find()` and
 * `list()`. See
 * `docs/secure_runtime_alpha_043_fedos_identity_resolver.md` for the
 * full design rationale: the Resolver/Registry, Resolver/Service,
 * Resolver/Provider, Resolver/Descriptor, Resolver/Record,
 * Resolver/Runtime, and Resolver/Storage boundaries, why this Resolver
 * never calls `register()`, why it never calls a Provider directly, and
 * the future `create_runtime.ts` wiring direction.
 *
 * This file defines a SINGLE CLASS and nothing else — no Provider
 * reference, no Service reference, no Runtime reference, no Storage
 * reference, and no wiring into any other module in this repository.
 * `FedosIdentityResolver` holds exactly one thing — the injected
 * `FedosIdentityRegistry` — and exposes exactly two methods, each a
 * single, direct pass-through to one (and only one) of that Registry's
 * own existing methods.
 *
 * NAMING NOTE: this class is unrelated to
 * `fedos_identity_provider_resolver.ts`'s own `resolveFedosIdentityProvider()`
 * (Alpha 032) — that function SELECTS which `FedosIdentityProvider`
 * implementation to construct; this class READS `FedosIdentityRecord`
 * values already registered into a `FedosIdentityRegistry`. The two
 * share the English word "resolver" but solve unrelated problems, and
 * neither references the other.
 *
 * HARD GUARDRAILS:
 *   - `#registry` is the ONLY field — a private, injected
 *     `FedosIdentityRegistry` reference, never constructed here.
 *   - `findIdentity()`/`listIdentities()` are the ONLY methods — each
 *     calls EXACTLY ONE `FedosIdentityRegistry` method
 *     (`find()`/`list()` respectively) and returns its result
 *     unchanged.
 *   - NEVER calls `registry.register()` or `registry.remove()` — this
 *     Resolver is READ-ONLY with respect to the Registry.
 *   - NO `FedosIdentityProvider` reference of any kind — this Resolver
 *     never calls `describeIdentity()` on anything.
 *   - NO `FedosIdentityService` reference of any kind.
 *   - NO Runtime, Worker, Storage, Crypto, Authentication, or Nostr
 *     reference of any kind.
 */

import type { FedosIdentityRecord } from "./fedos_identity_record.js";
import type { FedosIdentityRegistry } from "./fedos_identity_registry.js";

export class FedosIdentityResolver {
  readonly #registry: FedosIdentityRegistry;

  constructor(registry: FedosIdentityRegistry) {
    this.#registry = registry;
  }

  findIdentity(id: string): FedosIdentityRecord | null {
    return this.#registry.find(id);
  }

  listIdentities(): readonly FedosIdentityRecord[] {
    return this.#registry.list();
  }
}

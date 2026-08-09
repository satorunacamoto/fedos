/**
 * Secure Runtime Alpha 041 — "FedOS Identity Registry (Canonical
 * Record Registry)".
 *
 * The MINIMAL in-memory holder for `FedosIdentityRecord` (Alpha 040)
 * values — a single `Map<string, FedosIdentityRecord>`, keyed by each
 * Record's own `id`, plus four trivial operations. See
 * `docs/secure_runtime_alpha_041_fedos_identity_registry.md` for the
 * full design rationale: the Registry/Descriptor, Registry/Record,
 * Registry/Provider, Registry/Runtime, Registry/Storage, and
 * Registry/Protocol Adapter boundaries, why a Memory Registry is
 * chosen now, and the future Persistent Registry migration direction.
 *
 * This file defines a SINGLE CLASS and nothing else — no constructor
 * argument, no configuration, no persistence, no Runtime reference, no
 * Storage reference, no Provider reference, no Resolver reference, and
 * no wiring into any other module in this repository. Every method is
 * a synchronous, direct `Map` operation — no validation beyond what
 * `Map` itself already provides, no derived state, no side effect
 * beyond the one `Map` this class owns.
 *
 * HARD GUARDRAILS:
 *   - `#records` is the ONLY field — a private `Map<string,
 *     FedosIdentityRecord>`, never exposed directly.
 *   - `register()`/`find()`/`list()`/`remove()` are the ONLY methods —
 *     each a single, direct `Map` operation.
 *   - NO Runtime, Worker, Storage, Provider, Resolver, Crypto,
 *     Authentication, or Nostr reference of any kind.
 *   - NO persistence of any kind — this Registry's own state exists
 *     only in process memory, for the lifetime of the instance.
 */

import type { FedosIdentityRecord } from "./fedos_identity_record.js";

export class FedosIdentityRegistry {
  readonly #records = new Map<string, FedosIdentityRecord>();

  register(record: FedosIdentityRecord): void {
    this.#records.set(record.id, record);
  }

  find(id: string): FedosIdentityRecord | null {
    return this.#records.get(id) ?? null;
  }

  list(): readonly FedosIdentityRecord[] {
    return [...this.#records.values()];
  }

  remove(id: string): boolean {
    return this.#records.delete(id);
  }
}

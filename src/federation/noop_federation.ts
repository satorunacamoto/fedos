/**
 * Stage 110 — `NoopFederationProvider`: a federation provider that does nothing.
 *
 * The only implementation this stage ships, and the only one `createRuntime`
 * ever selects (see `../runtime/create_runtime.js`). It is permanently
 * `disconnected`: it never opens a relay/WebSocket/HTTP/OAuth/AT-Protocol
 * session, advertises no capability, publishes nothing, and fetches nothing.
 * Every method is total and never throws, and `connect()` NEVER reaches
 * `connected_placeholder` — unlike other boundaries' placeholder providers,
 * this stage ships no "accepts a clean request" variant at all, since a
 * federation adapter has nothing safe to accept yet (see
 * `docs/federation_boundary.md`).
 *
 * This exists so callers can depend on the `FederationProvider` seam without
 * a real protocol adapter, exactly as the app depends on mock/no-op defaults
 * elsewhere. It is NOT wired into the Worker, `StorageBackend`, or any
 * `CryptoProvider`.
 */

import type {
  FederationCapability,
  FederationDescriptor,
  FederationFetchDecision,
  FederationFetchRequest,
  FederationProvider,
  FederationProviderKind,
  FederationPublishDecision,
  FederationPublishRequest,
  FederationStatus,
} from "./types.js";

const NOOP_KIND: FederationProviderKind = "local_placeholder";
const NOOP_CAPABILITIES: readonly FederationCapability[] = [];

export class NoopFederationProvider implements FederationProvider {
  constructor() {
    // Does nothing: no relay/WebSocket/HTTP/OAuth session is opened.
  }

  #descriptor(): FederationDescriptor {
    return {
      kind: NOOP_KIND,
      capabilities: NOOP_CAPABILITIES,
      label: "No federation provider configured",
    };
  }

  status(): FederationStatus {
    return {
      descriptor: this.#descriptor(),
      state: "disconnected",
      reason: "no federation provider is configured",
    };
  }

  async connect(): Promise<FederationStatus> {
    // Opens no real session; the reported state never leaves "disconnected".
    return {
      descriptor: this.#descriptor(),
      state: "disconnected",
      reason: "no federation provider is configured (nothing connected)",
    };
  }

  async disconnect(): Promise<FederationStatus> {
    return this.status();
  }

  async publishPlaceholder(_request: FederationPublishRequest): Promise<FederationPublishDecision> {
    // Reads nothing from the request; publishes nothing; contacts no relay/API.
    return {
      allowed: false,
      state: "disconnected",
      reason: "no federation provider is configured (nothing published)",
    };
  }

  async fetchPlaceholder(_request: FederationFetchRequest): Promise<FederationFetchDecision> {
    return {
      allowed: false,
      state: "disconnected",
      reason: "no federation provider is configured (nothing fetched)",
      items: [],
    };
  }
}

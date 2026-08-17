/**
 * Tor Strict-Transport Local Closure arc — the strict, SOCKS5-routed
 * `FedosRelaySocketFactory`. This is the ONE thing this arc swaps in at
 * the composition root (see
 * `docs/reviews/fedos-tor-strict-transport-current/03_STRICT_TRANSPORT_ARCHITECTURE.md`
 * §4) — every one of the ~13 existing relay-construction call sites in
 * `fedos_electron_beta_main.cts` is untouched; they all keep calling
 * `createNodeWebSocketRelaySocketFactory()` from `RootModules`, which this
 * arc's composition-root wiring points at THIS factory instead of the
 * direct one whenever strict mode is enabled.
 *
 * Fail-closed invariant (§7 of that same doc): this factory rejects
 * IMMEDIATELY, before opening any TCP socket, if the policy is not
 * genuinely `"ready"` right now. There is no code path here that falls
 * through to a direct (non-SOCKS) connection under any circumstance.
 */

import * as tls from "node:tls";
import type * as net from "node:net";
import { socks5Connect } from "./fedos_electron_socks5_client.js";
import { connectStrictWebSocket, type FedosRelaySocket } from "./fedos_electron_strict_websocket_client.js";
import { StrictTransportError } from "./fedos_electron_strict_transport_errors.js";
import type { FedosStrictTransportPolicy } from "./fedos_electron_strict_transport_policy.js";

const SOCKS_CONNECT_TIMEOUT_MS = 15_000;

function parseRelayUrl(url: string): { readonly host: string; readonly port: number; readonly path: string; readonly tls: boolean } {
  const parsed = new URL(url);
  const isTls = parsed.protocol === "wss:";
  const defaultPort = isTls ? 443 : 80;
  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : defaultPort,
    path: `${parsed.pathname}${parsed.search}`,
    tls: isTls,
  };
}

/** Type-erased `FedosRelaySocketFactory` shape -- matches `RootModules["createNodeWebSocketRelaySocketFactory"]`'s own return type in `fedos_electron_beta_main.cts` exactly. */
export type StrictFedosRelaySocketFactory = (url: string) => Promise<FedosRelaySocket>;

export function createStrictFedosRelaySocketFactory(policy: FedosStrictTransportPolicy): StrictFedosRelaySocketFactory {
  return async (url: string): Promise<FedosRelaySocket> => {
    const ready = await policy.ensureReady();
    if (!ready) {
      throw new StrictTransportError("not-ready", `strict Tor routing is enabled but not ready (state: ${policy.state()}); refused to connect to ${url}`);
    }
    const config = policy.config();
    if (config === null) {
      throw new StrictTransportError("not-ready", "strict Tor routing policy has no configuration");
    }
    const { host, port, path, tls: useTls } = parseRelayUrl(url);

    let socket: net.Socket;
    try {
      socket = await socks5Connect({
        socksHost: config.socksHost,
        socksPort: config.socksPort,
        targetHost: host,
        targetPort: port,
        isolation: policy.isolationCredential(),
        connectTimeoutMs: SOCKS_CONNECT_TIMEOUT_MS,
      });
    } catch (err) {
      policy.reportConnectionFailure();
      throw err;
    }

    if (useTls) {
      const tlsSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const wrapped = tls.connect({ socket, servername: host }, () => resolve(wrapped));
        wrapped.once("error", (err) => reject(new StrictTransportError("handshake-failed", String(err))));
      }).catch((err) => {
        policy.reportConnectionFailure();
        throw err;
      });
      return connectStrictWebSocket(tlsSocket as unknown as net.Socket, host, path);
    }

    return connectStrictWebSocket(socket, host, path);
  };
}

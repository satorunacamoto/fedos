/**
 * Tor Strict-Transport Local Closure arc — a narrow SOCKS5 client for
 * connecting through a local Tor (or any SOCKS5) process.
 *
 * Ported near-verbatim from the historical, unmerged
 * `feature/commerce-tor-live-final-v1` branch's own
 * `fedos_electron_tor_socks_client.ts` (logic unchanged; only the error
 * type and isolation-credential type import paths are retargeted to this
 * arc's own, simpler modules — see
 * `docs/reviews/fedos-tor-strict-transport-current/02_HISTORICAL_TOR_ASSETS.md`).
 * Implements exactly what this arc needs against RFC 1928 (SOCKS
 * protocol) + RFC 1929 (username/password sub-negotiation).
 *
 * Structural guarantee, not just a convention: `socks5Connect` takes a
 * `targetHost` string and always sends it as a SOCKS5 ATYP=0x03 (domain
 * name) address. There is no code path anywhere in this file that calls
 * DNS resolution on `targetHost` before constructing the CONNECT request
 * — see `docs/reviews/fedos-tor-strict-transport-current/04_DNS_POLICY.md`.
 */

import * as net from "node:net";
import { StrictTransportError } from "./fedos_electron_strict_transport_errors.js";
import type { StrictSocksIsolationCredential } from "./fedos_electron_strict_isolation.js";

const SOCKS_VERSION = 0x05;
const METHOD_NO_AUTH = 0x00;
const METHOD_USER_PASS = 0x02;
const METHOD_NO_ACCEPTABLE = 0xff;
const CMD_CONNECT = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV4 = 0x01;
const ATYP_IPV6 = 0x04;

export interface Socks5ConnectOptions {
  readonly socksHost: string;
  readonly socksPort: number;
  /** Sent verbatim as a SOCKS5 domain-name address. Never resolved locally. */
  readonly targetHost: string;
  readonly targetPort: number;
  readonly isolation: StrictSocksIsolationCredential;
  readonly connectTimeoutMs: number;
}

class ByteStreamReader {
  #buffer: Buffer = Buffer.alloc(0);
  #waiters: { readonly n: number; readonly resolve: (b: Buffer) => void; readonly reject: (e: Error) => void }[] = [];

  constructor(socket: net.Socket) {
    socket.on("data", (chunk: Buffer) => {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      this.#drain();
    });
    socket.on("close", () => this.#failAll(new Error("socket closed")));
    socket.on("error", (err) => this.#failAll(err));
  }

  read(n: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.#waiters.push({ n, resolve, reject });
      this.#drain();
    });
  }

  #drain(): void {
    while (this.#waiters.length > 0) {
      const next = this.#waiters[0];
      if (!next || this.#buffer.length < next.n) return;
      this.#waiters.shift();
      next.resolve(this.#buffer.subarray(0, next.n));
      this.#buffer = this.#buffer.subarray(next.n);
    }
  }

  #failAll(err: Error): void {
    while (this.#waiters.length > 0) {
      this.#waiters.shift()?.reject(err);
    }
  }
}

function connectTcp(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new StrictTransportError("timeout", `SOCKS TCP connect to ${host}:${port} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(new StrictTransportError("socks-unreachable", String(err)));
    });
    socket.connect(port, host);
  });
}

function replyCodeToError(rep: number): StrictTransportError {
  switch (rep) {
    case 0x02:
      return new StrictTransportError("socks-failure", `SOCKS5 CONNECT reply 0x02 (not allowed by ruleset)`);
    default:
      return new StrictTransportError("socks-failure", `SOCKS5 CONNECT reply 0x${rep.toString(16)}`);
  }
}

/**
 * Opens one TCP connection to `targetHost:targetPort` through the SOCKS5
 * proxy at `socksHost:socksPort`, using `isolation` as the SOCKS5
 * username/password sub-negotiation credential. Resolves with the raw,
 * already-negotiated `net.Socket`, positioned exactly after the CONNECT
 * reply — ready for the caller's own application-level framing (this
 * arc: `fedos_electron_strict_websocket_client.ts`).
 */
export async function socks5Connect(options: Socks5ConnectOptions): Promise<net.Socket> {
  const socket = await connectTcp(options.socksHost, options.socksPort, options.connectTimeoutMs);
  const reader = new ByteStreamReader(socket);

  try {
    // Greeting: offer no-auth and username/password methods.
    socket.write(Buffer.from([SOCKS_VERSION, 0x02, METHOD_NO_AUTH, METHOD_USER_PASS]));
    const methodReply = await reader.read(2);
    if (methodReply[0] !== SOCKS_VERSION) {
      throw new StrictTransportError("socks-failure", `unexpected SOCKS version in method reply: ${methodReply[0]}`);
    }
    const chosenMethod = methodReply[1];
    if (chosenMethod === METHOD_NO_ACCEPTABLE) {
      throw new StrictTransportError("socks-failure", "SOCKS5 server rejected all offered auth methods");
    }
    if (chosenMethod === METHOD_USER_PASS) {
      const usernameBytes = Buffer.from(options.isolation.username, "utf8");
      const passwordBytes = Buffer.from(options.isolation.password, "utf8");
      socket.write(Buffer.concat([Buffer.from([0x01, usernameBytes.length]), usernameBytes, Buffer.from([passwordBytes.length]), passwordBytes]));
      const authReply = await reader.read(2);
      if (authReply[1] !== 0x00) {
        throw new StrictTransportError("authentication-failure", `SOCKS5 username/password rejected: status 0x${authReply[1]?.toString(16)}`);
      }
    }

    const hostBytes = Buffer.from(options.targetHost, "utf8");
    if (hostBytes.length > 255) {
      throw new StrictTransportError("socks-failure", `target host too long for SOCKS5 domain address: ${hostBytes.length} bytes`);
    }
    const portBytes = Buffer.alloc(2);
    portBytes.writeUInt16BE(options.targetPort, 0);
    socket.write(
      Buffer.concat([
        Buffer.from([SOCKS_VERSION, CMD_CONNECT, 0x00, ATYP_DOMAIN, hostBytes.length]),
        hostBytes,
        portBytes,
      ]),
    );

    const replyHeader = await reader.read(4);
    const rep = replyHeader[1];
    if (rep !== 0x00) {
      throw replyCodeToError(rep ?? 0xff);
    }
    const atyp = replyHeader[3];
    const addrLen = atyp === ATYP_DOMAIN ? (await reader.read(1))[0]! : atyp === ATYP_IPV4 ? 4 : atyp === ATYP_IPV6 ? 16 : undefined;
    if (addrLen === undefined) {
      throw new StrictTransportError("socks-failure", `unexpected ATYP in CONNECT reply: 0x${atyp?.toString(16)}`);
    }
    await reader.read(addrLen + 2); // BND.ADDR + BND.PORT, unused by this client

    return socket;
  } catch (err) {
    socket.destroy();
    throw err;
  }
}

/**
 * A pure readiness probe: connects and completes the SOCKS5 method
 * negotiation only (never sends a CONNECT, so it never opens an
 * application-level circuit). Used by `FedosStrictTransportPolicy` to
 * decide READY vs FAILED_CLOSED without side effects.
 */
export async function socks5ProbeReadiness(socksHost: string, socksPort: number, timeoutMs: number): Promise<void> {
  const socket = await connectTcp(socksHost, socksPort, timeoutMs);
  const reader = new ByteStreamReader(socket);
  try {
    // Offers the SAME method set `socks5Connect()` itself offers -- a
    // probe that only offered no-auth could wrongly report FAILED_CLOSED
    // against a real Tor SOCKS listener configured with `IsolateSOCKSAuth`
    // (username/password-only), even though a real connect would succeed.
    socket.write(Buffer.from([SOCKS_VERSION, 0x02, METHOD_NO_AUTH, METHOD_USER_PASS]));
    const methodReply = await reader.read(2);
    if (methodReply[0] !== SOCKS_VERSION) {
      throw new StrictTransportError("socks-failure", `readiness probe: unexpected SOCKS version ${methodReply[0]}`);
    }
    if (methodReply[1] === METHOD_NO_ACCEPTABLE) {
      throw new StrictTransportError("socks-failure", "readiness probe: SOCKS5 server rejected all offered auth methods");
    }
  } finally {
    socket.destroy();
  }
}

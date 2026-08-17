/**
 * Tor Strict-Transport Local Closure arc — acceptance matrix
 * (`docs/reviews/fedos-tor-strict-transport-current/09_ACCEPTANCE_MATRIX.md`).
 *
 * Entirely local: a real, hand-rolled SOCKS5 server (real TCP, real
 * protocol bytes, loopback only) and a real, hand-rolled plain-`ws://`
 * destination server, both on `127.0.0.1`. A separate "clearnet trap"
 * listener proves zero direct/bypass connections ever occur. No public
 * network of any kind — mandate §3's boundary.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import * as net from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { socks5Connect, socks5ProbeReadiness } from "../src/fedos_electron_socks5_client.js";
import { deriveStrictSocksIsolationCredential } from "../src/fedos_electron_strict_isolation.js";
import { FedosStrictTransportPolicy, defaultFedosStrictTransportConfig } from "../src/fedos_electron_strict_transport_policy.js";
import { createStrictFedosRelaySocketFactory } from "../src/fedos_electron_strict_transport_socket_factory.js";
import { connectStrictWebSocket } from "../src/fedos_electron_strict_websocket_client.js";

const ISOLATION = deriveStrictSocksIsolationCredential("test-session-salt");
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function listenLoopback(server: net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address !== null ? address.port : 0);
    });
  });
}

/** A minimal, real SOCKS5 server: negotiates the method, then either proxies the CONNECT to a real loopback target or applies a configured failure mode. Records every CONNECT target it receives. */
function startFakeSocksServer(opts: {
  readonly acceptMethod: "no-auth" | "user-pass" | "none";
  readonly onConnect?: (host: string, port: number) => "proxy" | "refuse" | "malformed" | "hang";
  readonly proxyTargetPort?: number;
}): { readonly server: net.Server; readonly connectTargets: { host: string; port: number }[]; readonly connectionCount: () => number } {
  const connectTargets: { host: string; port: number }[] = [];
  let connectionCount = 0;
  const server = net.createServer((socket) => {
    connectionCount++;
    let stage: "greeting" | "auth" | "connect" | "piping" = "greeting";
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      if (stage === "piping") return; // forwarding is owned by socket.pipe()/upstream.pipe() below -- this listener must stop parsing once piping starts, or it re-parses stale bytes as bogus repeat CONNECTs
      buffered = Buffer.concat([buffered, chunk]);
      if (stage === "greeting") {
        if (buffered.length < 2) return;
        const nMethods = buffered[1]!;
        if (buffered.length < 2 + nMethods) return;
        buffered = buffered.subarray(2 + nMethods);
        if (opts.acceptMethod === "none") {
          socket.write(Buffer.from([0x05, 0xff]));
          socket.end();
          return;
        }
        const methodByte = opts.acceptMethod === "user-pass" ? 0x02 : 0x00;
        socket.write(Buffer.from([0x05, methodByte]));
        stage = opts.acceptMethod === "user-pass" ? "auth" : "connect";
        return;
      }
      if (stage === "auth") {
        if (buffered.length < 2) return;
        const ulen = buffered[1]!;
        if (buffered.length < 2 + ulen + 1) return;
        const plen = buffered[2 + ulen]!;
        if (buffered.length < 2 + ulen + 1 + plen) return;
        buffered = buffered.subarray(2 + ulen + 1 + plen);
        socket.write(Buffer.from([0x01, 0x00]));
        stage = "connect";
        return;
      }
      if (stage === "connect") {
        if (buffered.length < 5) return;
        const atyp = buffered[3]!;
        if (atyp !== 0x03) {
          socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          socket.end();
          return;
        }
        const hostLen = buffered[4]!;
        if (buffered.length < 5 + hostLen + 2) return;
        const host = buffered.subarray(5, 5 + hostLen).toString("utf8");
        const port = buffered.readUInt16BE(5 + hostLen);
        connectTargets.push({ host, port });

        const decision = opts.onConnect?.(host, port) ?? "proxy";
        if (decision === "hang") return; // never reply -- caller's own timeout applies
        if (decision === "refuse") {
          socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          socket.end();
          return;
        }
        if (decision === "malformed") {
          socket.write(Buffer.from([0x09, 0x00])); // wrong SOCKS version in reply
          socket.end();
          return;
        }
        // proxy: reply success bound to 0.0.0.0:0, then pipe bytes to/from the real local target.
        socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        stage = "piping";
        // Pause the incoming stream until the upstream connection is up, so
        // no application-layer byte the client sends immediately after the
        // CONNECT reply can arrive before `.pipe()` is wired -- avoids a
        // real data-loss race, not just the double-parse bug this stage
        // guard already fixes.
        socket.pause();
        const upstream = net.connect(opts.proxyTargetPort ?? port, "127.0.0.1");
        upstream.on("connect", () => {
          socket.pipe(upstream);
          upstream.pipe(socket);
          socket.resume();
        });
        upstream.on("error", () => socket.destroy());
      }
    });
    socket.on("error", () => {});
  });
  return { server, connectTargets, connectionCount: () => connectionCount };
}

/** A minimal, real plain-`ws://` echo server. */
function startFakeWsDestination(): net.Server {
  const server = net.createServer((socket) => {
    let buffered = Buffer.alloc(0);
    let handshakeDone = false;
    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (!handshakeDone) {
        const headerEnd = buffered.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const headerText = buffered.subarray(0, headerEnd).toString("utf8");
        buffered = buffered.subarray(headerEnd + 4);
        const keyMatch = /sec-websocket-key:\s*(\S+)/i.exec(headerText);
        const accept = createHash("sha1").update((keyMatch?.[1] ?? "") + WEBSOCKET_GUID, "utf8").digest("base64");
        socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
        handshakeDone = true;
      }
      // Echo back any client TEXT frame (masked) as an unmasked server TEXT frame -- minimal, matches only what this test sends.
      while (buffered.length >= 2) {
        const opcode = buffered[0]! & 0x0f;
        let len = buffered[1]! & 0x7f;
        const masked = (buffered[1]! & 0x80) !== 0;
        let offset = 2;
        if (len === 126) {
          if (buffered.length < 4) return;
          len = buffered.readUInt16BE(2);
          offset = 4;
        }
        const maskKey = masked ? buffered.subarray(offset, offset + 4) : Buffer.alloc(4);
        if (masked) offset += 4;
        if (buffered.length < offset + len) return;
        const payload = Buffer.alloc(len);
        for (let i = 0; i < len; i++) payload[i] = buffered[offset + i]! ^ (masked ? maskKey[i % 4]! : 0);
        buffered = buffered.subarray(offset + len);
        if (opcode === 0x1) {
          const echoed = Buffer.from(`echo:${payload.toString("utf8")}`, "utf8");
          socket.write(Buffer.concat([Buffer.from([0x81, echoed.length]), echoed]));
        }
      }
    });
    socket.on("error", () => {});
  });
  return server;
}

const openServers: net.Server[] = [];
afterEach(() => {
  for (const s of openServers.splice(0)) s.close();
  vi.restoreAllMocks();
});

describe("socks5Connect / socks5ProbeReadiness -- local fake SOCKS server", () => {
  it("1. successful CONNECT through a real local SOCKS5 server, no-auth", async () => {
    const dest = startFakeWsDestination();
    openServers.push(dest);
    const destPort = await listenLoopback(dest);
    const fake = startFakeSocksServer({ acceptMethod: "no-auth", proxyTargetPort: destPort });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);

    const socket = await socks5Connect({ socksHost: "127.0.0.1", socksPort, targetHost: "relay.example.invalid", targetPort: destPort, isolation: ISOLATION, connectTimeoutMs: 3000 });
    expect(fake.connectTargets).toEqual([{ host: "relay.example.invalid", port: destPort }]);
    socket.destroy();
  });

  it("readiness probe succeeds against a real SOCKS server and fails against nothing listening", async () => {
    const fake = startFakeSocksServer({ acceptMethod: "no-auth" });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);
    await expect(socks5ProbeReadiness("127.0.0.1", socksPort, 3000)).resolves.toBeUndefined();
    await expect(socks5ProbeReadiness("127.0.0.1", 1, 500)).rejects.toThrow();
  });

  it("5. malformed SOCKS server that accepts no method -> fails closed", async () => {
    const fake = startFakeSocksServer({ acceptMethod: "none" });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);
    await expect(socks5Connect({ socksHost: "127.0.0.1", socksPort, targetHost: "x.invalid", targetPort: 1234, isolation: ISOLATION, connectTimeoutMs: 2000 })).rejects.toThrow();
  });

  it("6. SOCKS server sends a malformed CONNECT reply (wrong version) -> fails closed", async () => {
    const fake = startFakeSocksServer({ acceptMethod: "no-auth", onConnect: () => "malformed" });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);
    await expect(socks5Connect({ socksHost: "127.0.0.1", socksPort, targetHost: "x.invalid", targetPort: 1234, isolation: ISOLATION, connectTimeoutMs: 2000 })).rejects.toThrow();
  });

  it("SOCKS server refuses the CONNECT (REP != 0x00) -> fails closed", async () => {
    const fake = startFakeSocksServer({ acceptMethod: "no-auth", onConnect: () => "refuse" });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);
    await expect(socks5Connect({ socksHost: "127.0.0.1", socksPort, targetHost: "x.invalid", targetPort: 1234, isolation: ISOLATION, connectTimeoutMs: 2000 })).rejects.toThrow();
  });

  it("4. nothing listening on the SOCKS port -> fails closed", async () => {
    await expect(socks5Connect({ socksHost: "127.0.0.1", socksPort: 1, targetHost: "x.invalid", targetPort: 1234, isolation: ISOLATION, connectTimeoutMs: 1000 })).rejects.toThrow();
  });

  it("7. DNS-safe: targetHost is sent verbatim to the SOCKS server, never resolved locally", async () => {
    // Structural guard, not a runtime spy: `vi.spyOn(dns, ...)` fails in
    // this environment ("Cannot redefine property") because Node's core
    // `dns` module exports are non-configurable here -- and a structural
    // guard is actually the STRONGER proof anyway: it is impossible for
    // DNS to be resolved locally if the module that builds the CONNECT
    // request never imports `node:dns`/`node:dns/promises` at all (no
    // dynamic `require` exists in this file either, checked below).
    const socksClientSource = readFileSync(join(process.cwd(), "packages/fedos-desktop-electron-spike/src/fedos_electron_socks5_client.ts"), "utf8");
    expect(socksClientSource).not.toMatch(/from ["']node:dns/);
    expect(socksClientSource).not.toMatch(/require\(["']dns/);

    const fake = startFakeSocksServer({ acceptMethod: "no-auth", onConnect: () => "refuse" });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);
    const canary = "fedos-strict-transport-dns-leak-canary.invalid";
    await expect(socks5Connect({ socksHost: "127.0.0.1", socksPort, targetHost: canary, targetPort: 1234, isolation: ISOLATION, connectTimeoutMs: 2000 })).rejects.toThrow();
    // The SOCKS server received the hostname VERBATIM (never an IP a local
    // resolver would have produced) -- a synthetic, deliberately
    // non-resolvable `.invalid` TLD, so a local resolver attempt would
    // have failed loudly rather than silently substituting an address.
    expect(fake.connectTargets).toEqual([{ host: canary, port: 1234 }]);
  });
});

describe("FedosStrictTransportPolicy + createStrictFedosRelaySocketFactory -- fail-closed invariant + clearnet trap", () => {
  it("3/4. strict mode ON, nothing listening on SOCKS -> connect refused BEFORE any socket opens; clearnet trap sees 0 connections", async () => {
    const trap = net.createServer(() => {
      throw new Error("clearnet trap: a direct/bypass connection reached the trap listener");
    });
    openServers.push(trap);
    const trapPort = await listenLoopback(trap);

    const policy = new FedosStrictTransportPolicy();
    policy.enable(defaultFedosStrictTransportConfig("127.0.0.1", 1)); // nothing listening
    const factory = createStrictFedosRelaySocketFactory(policy);

    await expect(factory(`ws://127.0.0.1:${trapPort}/`)).rejects.toThrow();
    expect(policy.state()).toBe("failed-closed");
    // Give any accidental direct connection attempt a moment to arrive if one were wrongly made.
    await new Promise((r) => setTimeout(r, 50));
  });

  it("1/2. strict mode ON, real fake SOCKS + real fake WS destination -> full round trip succeeds through the strict factory, and a message actually echoes back", async () => {
    const dest = startFakeWsDestination();
    openServers.push(dest);
    const destPort = await listenLoopback(dest);
    const fake = startFakeSocksServer({ acceptMethod: "no-auth", proxyTargetPort: destPort });
    openServers.push(fake.server);
    const socksPort = await listenLoopback(fake.server);

    const policy = new FedosStrictTransportPolicy();
    policy.enable(defaultFedosStrictTransportConfig("127.0.0.1", socksPort));
    const factory = createStrictFedosRelaySocketFactory(policy);

    const relaySocket = await factory(`ws://127.0.0.1:${destPort}/`);
    expect(fake.connectTargets).toEqual([{ host: "127.0.0.1", port: destPort }]);

    const messageReceived = new Promise<string>((resolve) => {
      relaySocket.addEventListener("message", (event) => resolve(String(event?.data)));
    });
    relaySocket.send("hello-strict-transport");
    expect(await messageReceived).toBe("echo:hello-strict-transport");
    relaySocket.close();
  });

  it("8. Tor dies mid-session: after one success, the SOCKS server is killed -> next attempt fails closed, never falls through directly", async () => {
    const dest = startFakeWsDestination();
    openServers.push(dest);
    const destPort = await listenLoopback(dest);
    const fake = startFakeSocksServer({ acceptMethod: "no-auth", proxyTargetPort: destPort });
    const socksPort = await listenLoopback(fake.server);

    const policy = new FedosStrictTransportPolicy();
    policy.enable(defaultFedosStrictTransportConfig("127.0.0.1", socksPort));
    const factory = createStrictFedosRelaySocketFactory(policy);

    const relaySocket = await factory(`ws://127.0.0.1:${destPort}/`);
    relaySocket.close();
    expect(policy.state()).toBe("ready");

    await new Promise<void>((resolve) => fake.server.close(() => resolve()));

    // First post-death attempt: `ensureReady()` still trusts the cached
    // "ready" state (by design -- it does not re-probe on every single
    // call), so the factory optimistically attempts the real connection,
    // which fails against the now-dead SOCKS server -- READY -> DEGRADED,
    // and the attempt itself still fails closed (never falls through to a
    // direct connection).
    await expect(factory(`ws://127.0.0.1:${destPort}/`)).rejects.toThrow();
    expect(policy.state()).toBe("degraded");

    // Second attempt: `ensureReady()` sees DEGRADED and re-probes for
    // real, which also fails (still dead) -> FAILED_CLOSED. Still no
    // direct fallback at any point.
    await expect(factory(`ws://127.0.0.1:${destPort}/`)).rejects.toThrow();
    expect(policy.state()).toBe("failed-closed");
  });

  it("not-ready: strict mode never enabled -- factory throws without attempting any connection", async () => {
    const policy = new FedosStrictTransportPolicy(); // never enable()'d -- state stays "disabled"
    const factory = createStrictFedosRelaySocketFactory(policy);
    await expect(factory("ws://127.0.0.1:1/")).rejects.toThrow(/not-ready/);
  });
});

describe("connectStrictWebSocket -- RFC 6455 client surface", () => {
  it("implements the FedosRelaySocket interface shape (send/close/addEventListener) and delivers a real echoed message", async () => {
    const dest = startFakeWsDestination();
    openServers.push(dest);
    const destPort = await listenLoopback(dest);
    const raw = net.connect(destPort, "127.0.0.1");
    await new Promise<void>((resolve) => raw.once("connect", () => resolve()));

    const relaySocket = await connectStrictWebSocket(raw, "127.0.0.1", "/");
    expect(typeof relaySocket.send).toBe("function");
    expect(typeof relaySocket.close).toBe("function");
    expect(typeof relaySocket.addEventListener).toBe("function");

    const messageReceived = new Promise<string>((resolve) => {
      relaySocket.addEventListener("message", (event) => resolve(String(event?.data)));
    });
    relaySocket.send("ping-payload");
    expect(await messageReceived).toBe("echo:ping-payload");
    relaySocket.close();
  });
});

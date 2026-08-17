/**
 * Tor Strict-Transport Local Closure arc — a minimal RFC 6455 WebSocket
 * client that speaks directly over an already-connected raw/TLS socket
 * (the SOCKS5-negotiated socket from `fedos_electron_socks5_client.ts`),
 * rather than via Node/Electron's own spec-global `WebSocket` constructor
 * (which takes only a URL string and has no way to route through a
 * pre-negotiated socket — see
 * `docs/reviews/fedos-tor-strict-transport-current/03_STRICT_TRANSPORT_ARCHITECTURE.md`
 * §6 for why this file exists instead of reusing that constructor).
 *
 * Scope is deliberately narrow, matching exactly what
 * `websocket_relay.ts`'s own `FedosRelaySocket` interface needs
 * (`send(data: string)`, `close()`,
 * `addEventListener("close"|"error"|"message", ...)`) and what the Nostr
 * wire protocol actually sends (JSON text frames only — confirmed by the
 * existing direct-path factory's own `send(data: string)` signature):
 * text frames in both directions, automatic ping/pong reply, close-frame
 * handling. No binary-frame support, no per-message compression
 * extension — nothing here needs either.
 */

import type * as net from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { StrictTransportError } from "./fedos_electron_strict_transport_errors.js";

/**
 * Structural duplicate of root `src/os/messenger/desktop/websocket_relay.ts`'s
 * own `FedosRelaySocket`/`FedosRelaySocketEvent`/`FedosRelaySocketEventType`
 * — this package never statically imports root `src/` types (it consumes
 * root src only via dynamic `import()` of compiled `dist/` output, typed
 * with local `as {...}` projections, matching every other cross-package
 * reference in `fedos_electron_beta_main.cts`); TypeScript's structural
 * typing makes this object assignment-compatible wherever the real
 * `FedosRelaySocket` type is expected at the one composition-root binding
 * site that consumes it.
 */
export type FedosRelaySocketEventType = "close" | "error" | "message";
export interface FedosRelaySocketEvent {
  readonly data?: unknown;
}
export interface FedosRelaySocket {
  send(data: string): void;
  close(): void;
  addEventListener(type: FedosRelaySocketEventType, listener: (event?: FedosRelaySocketEvent) => void): void;
}

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

class FrameByteReader {
  #buffer: Buffer = Buffer.alloc(0);
  #waiters: { readonly n: number; readonly resolve: (b: Buffer) => void; readonly reject: (e: Error) => void }[] = [];
  #failed: Error | null = null;

  feed(chunk: Buffer): void {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    this.#drain();
  }

  fail(err: Error): void {
    this.#failed = err;
    while (this.#waiters.length > 0) this.#waiters.shift()?.reject(err);
  }

  read(n: number): Promise<Buffer> {
    if (this.#failed !== null) return Promise.reject(this.#failed);
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
}

async function performHandshake(socket: net.Socket, host: string, path: string): Promise<Buffer> {
  const key = randomBytes(16).toString("base64");
  const request = [
    `GET ${path.length > 0 ? path : "/"} HTTP/1.1`,
    `Host: ${host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "",
    "",
  ].join("\r\n");
  socket.write(request);

  const expectedAccept = createHash("sha1").update(key + WEBSOCKET_GUID, "utf8").digest("base64");

  return new Promise<Buffer>((resolve, reject) => {
    let buffered = Buffer.alloc(0);
    const onData = (chunk: Buffer): void => {
      buffered = Buffer.concat([buffered, chunk]);
      const headerEnd = buffered.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      socket.off("data", onData);
      const headerText = buffered.subarray(0, headerEnd).toString("utf8");
      const remainder = buffered.subarray(headerEnd + 4);
      const statusLine = headerText.split("\r\n")[0] ?? "";
      if (!statusLine.includes(" 101 ")) {
        reject(new StrictTransportError("handshake-failed", `unexpected HTTP status in WebSocket handshake: ${statusLine}`));
        return;
      }
      const acceptMatch = /sec-websocket-accept:\s*(\S+)/i.exec(headerText);
      if (acceptMatch === null || acceptMatch[1] !== expectedAccept) {
        reject(new StrictTransportError("handshake-failed", "Sec-WebSocket-Accept did not match the expected value"));
        return;
      }
      resolve(remainder);
    };
    socket.on("data", onData);
    socket.once("error", (err) => reject(new StrictTransportError("handshake-failed", String(err))));
  });
}

function encodeTextFrame(payload: string): Buffer {
  const payloadBytes = Buffer.from(payload, "utf8");
  const maskKey = randomBytes(4);
  const masked = Buffer.alloc(payloadBytes.length);
  for (let i = 0; i < payloadBytes.length; i++) masked[i] = payloadBytes[i]! ^ maskKey[i % 4]!;

  let header: Buffer;
  if (payloadBytes.length < 126) {
    header = Buffer.from([0x80 | OPCODE_TEXT, 0x80 | payloadBytes.length]);
  } else if (payloadBytes.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | OPCODE_TEXT;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payloadBytes.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | OPCODE_TEXT;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payloadBytes.length), 2);
  }
  return Buffer.concat([header, maskKey, masked]);
}

function encodeControlFrame(opcode: number, payload: Buffer): Buffer {
  const maskKey = randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i]! ^ maskKey[i % 4]!;
  const header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
  return Buffer.concat([header, maskKey, masked]);
}

/**
 * Builds a `FedosRelaySocket` (the same minimal interface
 * `createNodeWebSocketRelaySocketFactory()`'s direct-path implementation
 * returns) backed by an already-connected raw/TLS socket. Resolves only
 * once the RFC 6455 opening handshake completes successfully — mirrors
 * the direct-path factory's own "never resolve before the real 'open'
 * equivalent" discipline.
 */
export async function connectStrictWebSocket(socket: net.Socket, host: string, path: string): Promise<FedosRelaySocket> {
  const leftover = await performHandshake(socket, host, path);
  const reader = new FrameByteReader();
  if (leftover.length > 0) reader.feed(leftover);
  socket.on("data", (chunk: Buffer) => reader.feed(chunk));

  const listeners = new Map<FedosRelaySocketEventType, Set<(event?: FedosRelaySocketEvent) => void>>([
    ["close", new Set()],
    ["error", new Set()],
    ["message", new Set()],
  ]);
  const emit = (type: FedosRelaySocketEventType, event?: FedosRelaySocketEvent): void => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };

  socket.on("close", () => emit("close"));
  socket.on("error", (err) => emit("error", { data: err }));

  void (async () => {
    try {
      for (;;) {
        const firstTwo = await reader.read(2);
        const opcode = firstTwo[0]! & 0x0f;
        let payloadLen = firstTwo[1]! & 0x7f;
        if (payloadLen === 126) {
          payloadLen = (await reader.read(2)).readUInt16BE(0);
        } else if (payloadLen === 127) {
          payloadLen = Number((await reader.read(8)).readBigUInt64BE(0));
        }
        // Server-to-client frames are never masked per RFC 6455 -- this
        // client does not send a masked bit and does not unmask incoming
        // payloads (a masked server frame would be a protocol violation
        // this narrow client does not attempt to tolerate).
        const payload = payloadLen > 0 ? await reader.read(payloadLen) : Buffer.alloc(0);

        if (opcode === OPCODE_TEXT) {
          emit("message", { data: payload.toString("utf8") });
        } else if (opcode === OPCODE_PING) {
          socket.write(encodeControlFrame(OPCODE_PONG, payload));
        } else if (opcode === OPCODE_CLOSE) {
          emit("close");
          socket.end();
          return;
        }
        // OPCODE_PONG and any binary/continuation opcode: silently ignored -- no caller needs them.
      }
    } catch {
      // Reader failed (socket closed/errored) -- "close"/"error" already emitted by the socket-level listeners above.
    }
  })();

  return {
    send(data: string): void {
      socket.write(encodeTextFrame(data));
    },
    close(): void {
      socket.write(encodeControlFrame(OPCODE_CLOSE, Buffer.alloc(0)));
      socket.end();
    },
    addEventListener(type: FedosRelaySocketEventType, listener: (event?: FedosRelaySocketEvent) => void): void {
      listeners.get(type)?.add(listener);
    },
  };
}

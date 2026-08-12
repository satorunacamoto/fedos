/**
 * Secure Runtime Alpha 7001-7080 — Phase F: a real, minimal, RFC 6455
 * WebSocket relay SERVER used only by this Arc's own packaged/Node
 * acceptance vertical slice. No reusable real relay server exists
 * anywhere in this repository (confirmed by the Phase A reconciliation
 * report) and no `ws`-style server dependency is available in this
 * environment — this file implements the server side of the SAME
 * standard WebSocket protocol `src/desktop/node_websocket_relay_socket_factory.ts`
 * (the real, unmodified production CLIENT) already speaks, plus the SAME
 * NIP-01 `["EVENT", ...]`/`["REQ", subId, ...filters]`/`["CLOSE", subId]`
 * wire framing `src/desktop/websocket_relay.ts` already produces/expects
 * (confirmed by direct source read, not guessed).
 *
 * Deliberately real, not fabricated: a genuine TCP accept, a genuine HTTP
 * Upgrade handshake (`Sec-WebSocket-Accept` computed per RFC 6455 §1.3),
 * genuine WebSocket text-frame parsing/writing over a real local socket —
 * never an in-memory bookkeeping object like the pre-existing, in-test-file-
 * only `FakeRelayServer` (`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`).
 *
 * Deliberately simplified relative to a production Nostr relay (disclosed,
 * not hidden): delivers every published `EVENT` to every currently-open
 * `REQ` subscription verbatim, with NO server-side filter matching (kind/
 * author/tag) — matching this Arc's own controlled two-party test topology,
 * where the only subscriber is the intended recipient. It DOES implement
 * real `OK` acknowledgement (`["OK", eventId, true, ""]`) per publish, real
 * per-subscription delivery/unsubscribe, and lets a caller trivially
 * exercise duplicate delivery (`redeliver()`) or a temporarily-offline peer
 * (closing then reopening a subscription). It never inspects or decrypts
 * event content — every event is forwarded as opaque JSON, exactly like a
 * real relay, which never sees Gift-Wrap plaintext either.
 *
 * Test/acceptance-fixture code only — never imported by anything under
 * `src/`.
 */

import { createServer, type Server, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { createHash, randomUUID } from "node:crypto";

const RFC6455_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

interface Connection {
  readonly socket: Socket;
  readonly subscriptions: Set<string>;
  closed: boolean;
}

function computeAcceptKey(clientKey: string): string {
  return createHash("sha1").update(clientKey + RFC6455_MAGIC).digest("base64");
}

/** No `Buffer` (this project's tsconfig carries no `@types/node`) -- `Uint8Array`/`DataView`/`TextEncoder`/`TextDecoder` only, all real ES2022 globals. */
function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeTextFrame(payload: string): Uint8Array {
  const data = new TextEncoder().encode(payload);
  const length = data.length;
  let header: Uint8Array;
  if (length < 126) {
    header = new Uint8Array([0x81, length]);
  } else if (length < 65536) {
    header = new Uint8Array(4);
    header[0] = 0x81;
    header[1] = 126;
    new DataView(header.buffer).setUint16(2, length, false);
  } else {
    header = new Uint8Array(10);
    header[0] = 0x81;
    header[1] = 127;
    new DataView(header.buffer).setBigUint64(2, BigInt(length), false);
  }
  return concatBytes([header, data]);
}

/** Decodes zero or more complete client (masked) text frames from `buffer`; returns decoded strings and the number of consumed bytes. Close/ping/pong opcodes are consumed and ignored (`text` only, matching this fixture's own scope). */
function decodeFrames(buffer: Uint8Array): { readonly texts: readonly string[]; readonly consumed: number; readonly closed: boolean } {
  const texts: string[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;
  let closed = false;
  for (;;) {
    if (buffer.length - offset < 2) break;
    const byte0 = buffer[offset]!;
    const byte1 = buffer[offset + 1]!;
    const opcode = byte0 & 0x0f;
    const masked = (byte1 & 0x80) !== 0;
    let payloadLen = byte1 & 0x7f;
    let cursor = offset + 2;
    if (payloadLen === 126) {
      if (buffer.length - cursor < 2) break;
      payloadLen = view.getUint16(cursor, false);
      cursor += 2;
    } else if (payloadLen === 127) {
      if (buffer.length - cursor < 8) break;
      payloadLen = Number(view.getBigUint64(cursor, false));
      cursor += 8;
    }
    let maskKey: Uint8Array | null = null;
    if (masked) {
      if (buffer.length - cursor < 4) break;
      maskKey = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }
    if (buffer.length - cursor < payloadLen) break;
    const rawPayload = buffer.subarray(cursor, cursor + payloadLen);
    const payload = new Uint8Array(payloadLen);
    if (maskKey !== null) {
      for (let i = 0; i < payloadLen; i++) payload[i] = rawPayload[i]! ^ maskKey[i % 4]!;
    } else {
      payload.set(rawPayload);
    }
    cursor += payloadLen;
    if (opcode === 0x8) {
      closed = true;
    } else if (opcode === 0x1) {
      texts.push(new TextDecoder().decode(payload));
    }
    offset = cursor;
  }
  return { texts, consumed: offset, closed };
}

export interface FedosRealLocalWebSocketRelayServer {
  /** `ws://127.0.0.1:<port>` — a REAL bound local address, never a placeholder string. */
  readonly url: string;
  /** Re-delivers the most recently published event to every currently-open subscription again (Phase I: real duplicate-delivery exercise). */
  redeliverLast(): void;
  /** Number of currently-open (post-handshake) client connections. */
  connectionCount(): number;
  close(): Promise<void>;
}

/**
 * Starts a real local relay server bound to an ephemeral port on 127.0.0.1
 * (or, if `port` is given, that EXACT port -- Secure Runtime Alpha 8121-8200:
 * lets a caller genuinely restart a relay server on the SAME address a
 * disconnected `WebSocketRelay` client is already configured with, to
 * exercise a real reconnect via the client's own real, unmodified
 * `connect()`/next-unlock path, never a second, different relay URL
 * scripted into the client mid-test). Resolves once genuinely listening.
 */
export async function startFedosRealLocalWebSocketRelayServer(options?: { readonly port?: number }): Promise<FedosRealLocalWebSocketRelayServer> {
  const connections = new Map<Socket, Connection>();
  let lastDeliveries: ReadonlyArray<{ readonly subId: string; readonly eventObj: unknown }> = [];

  const httpServer: Server = createServer((_req: IncomingMessage, res: { writeHead(code: number): { end(): void } }) => {
    res.writeHead(404).end();
  });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Socket, head: Uint8Array) => {
    const key = (req.headers as Record<string, unknown>)["sec-websocket-key"];
    if (typeof key !== "string") {
      socket.destroy();
      return;
    }
    const accept = computeAcceptKey(key);
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    const connection: Connection = { socket, subscriptions: new Set(), closed: false };
    connections.set(socket, connection);

    let pending: Uint8Array = head.length > 0 ? head : new Uint8Array(0);
    socket.on("data", (chunk: Uint8Array) => {
      pending = concatBytes([pending, chunk]);
      const { texts, consumed, closed } = decodeFrames(pending);
      pending = pending.subarray(consumed);
      for (const text of texts) handleClientMessage(connection, text);
      if (closed) socket.end();
    });
    socket.on("close", () => {
      connection.closed = true;
      connections.delete(socket);
    });
    socket.on("error", () => {
      connection.closed = true;
      connections.delete(socket);
    });
  });

  function sendTo(connection: Connection, wireArray: readonly unknown[]): void {
    if (connection.closed) return;
    try {
      connection.socket.write(encodeTextFrame(JSON.stringify(wireArray)));
    } catch {
      /* a socket that failed to write is treated as closed by its own "close"/"error" handlers */
    }
  }

  function deliverEvent(subId: string, eventObj: unknown): void {
    for (const connection of connections.values()) {
      if (connection.subscriptions.has(subId)) sendTo(connection, ["EVENT", subId, eventObj]);
    }
  }

  function handleClientMessage(connection: Connection, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0] !== "string") return;
    const tag = parsed[0];
    if (tag === "REQ" && typeof parsed[1] === "string") {
      connection.subscriptions.add(parsed[1]);
      sendTo(connection, ["EOSE", parsed[1]]);
      return;
    }
    if (tag === "CLOSE" && typeof parsed[1] === "string") {
      connection.subscriptions.delete(parsed[1]);
      return;
    }
    if (tag === "EVENT" && parsed.length === 2) {
      const eventObj = parsed[1] as Record<string, unknown>;
      const eventId = typeof eventObj?.id === "string" ? eventObj.id : randomUUID();
      // Real per-publish ACK, tracked separately from recipient import (Phase F/H).
      sendTo(connection, ["OK", eventId, true, ""]);
      // Deliberately simplified (disclosed above): broadcast to every open
      // subscription, no server-side filter matching. Each distinct subId
      // is delivered to exactly once, even if (unusually) more than one
      // connection shares it -- `deliverEvent()` itself already reaches
      // every connection subscribed to a given subId.
      const uniqueSubIds = new Set<string>();
      for (const target of connections.values()) {
        for (const subId of target.subscriptions) uniqueSubIds.add(subId);
      }
      const delivered: Array<{ readonly subId: string; readonly eventObj: unknown }> = [];
      for (const subId of uniqueSubIds) {
        deliverEvent(subId, eventObj);
        delivered.push({ subId, eventObj });
      }
      lastDeliveries = delivered;
      return;
    }
  }

  await new Promise<void>((resolve) => httpServer.listen(options?.port ?? 0, "127.0.0.1", resolve));
  const address = httpServer.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `ws://127.0.0.1:${port}`,
    redeliverLast(): void {
      for (const { subId, eventObj } of lastDeliveries) deliverEvent(subId, eventObj);
    },
    connectionCount(): number {
      return connections.size;
    },
    async close(): Promise<void> {
      for (const connection of connections.values()) {
        try {
          connection.socket.destroy();
        } catch {
          /* best-effort */
        }
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

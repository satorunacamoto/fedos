/**
 * nostr-window — public surface (Stage 1).
 *
 * A Reddit-style "window" into Nostr. This barrel re-exports the read-only
 * ingest building blocks. Threading, UI, replies, communities, content and
 * ads layer on in later stages behind the same adapter boundaries.
 */

// Nostr core
export type { NostrEvent, NostrTag, EventCore } from "./nostr/types.js";
export {
  validateEventStructure,
  isNostrEvent,
  serializeForId,
  computeEventId,
  verifyEventId,
  type StructureIssue,
} from "./nostr/event.js";
export {
  webCryptoSha256Hex,
  constantTimeHexEqual,
  type Sha256Hex,
} from "./nostr/crypto.js";
export {
  InMemoryRelayAdapter,
  eventMatchesFilter,
  eventMatchesAnyFilter,
  type RelayAdapter,
  type NostrFilter,
} from "./nostr/relay.js";
export {
  parseRelayMessage,
  isEventMessage,
  isEoseMessage,
  isNoticeMessage,
  type RelayMessage,
} from "./nostr/messages.js";
export {
  NoopSignatureVerifier,
  RejectAllSignatureVerifier,
  type SignatureVerifier,
} from "./nostr/signature.js";
export {
  WebSocketRelayAdapter,
  type WebSocketFactory,
  type WebSocketRelayOptions,
  type RelaySocketLike,
  type RelaySocketEvent,
  type RelaySocketEventType,
} from "./nostr/ws_relay.js";

// Ingest
export { ingestRawEvents, dedupeById } from "./ingest/ingest.js";
export type {
  IngestedEvent,
  RejectedEvent,
  IngestResult,
  IngestContext,
} from "./ingest/types.js";

// Thread builder (Stage 2)
export { buildThreads, getReplyTarget, getRootTarget } from "./thread/thread.js";
export type {
  ThreadNode,
  ThreadBuildResult,
  ThreadBuildWarning,
  ThreadWarningKind,
} from "./thread/types.js";

// Query / sort / filter policy (Stage 4)
export {
  queryThreads,
  scoreThread,
  countDescendants,
  filterThread,
  MAX_LIMIT,
} from "./query/thread_query.js";
export type {
  SortMode,
  ThreadQueryOptions,
  ResolvedQueryOptions,
  ThreadQueryResult,
} from "./query/types.js";

// Render layer (Stage 3, read-only demo)
export {
  escapeHtml,
  shortenHex,
  renderThreadNode,
  renderRoots,
  renderThreadList,
  renderWarnings,
  renderQueryStatus,
  renderNotice,
  renderPage,
  type QueryStatusView,
  type PageView,
} from "./render/html.js";
export { handleRequest } from "./worker.js";

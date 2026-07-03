/**
 * Stage 111 — `NoopChatProvider`: a chat/DM PROVIDER that does nothing.
 *
 * The only `ChatProvider` implementation this stage ships (see `./types.js`),
 * and the only one `createRuntime` selects. It is permanently `unavailable`:
 * it opens no relay/WebSocket connection, issues no `fetch`, encrypts/
 * decrypts nothing (no NIP-04/NIP-44/NIP-17), and holds no message content.
 * Every method is total and never throws.
 *
 * This is UNRELATED to the Stage 16 `ChatRoom`/`ChatMessage` model
 * (`./types.js`'s `ChatKind`/`ChatMessage`/`ChatDecision`) or `./policy.js` —
 * those already power the existing in-app chat rendering and are untouched
 * by this file. `NoopChatProvider` is the FUTURE transport seam only.
 *
 * NOT wired into `FederationProvider`, `StorageBackend`, any
 * `CryptoProvider`, or the Worker.
 */

import type {
  ChatFetchDecision,
  ChatFetchRequest,
  ChatProvider,
  ChatProviderStatus,
  ChatSendDecision,
  ChatSendRequest,
} from "./types.js";

export class NoopChatProvider implements ChatProvider {
  constructor() {
    // Does nothing: no relay/WebSocket session is opened.
  }

  status(): ChatProviderStatus {
    return { allowed: false, state: "unavailable", reason: "no chat provider is configured" };
  }

  async sendPlaceholder(_request: ChatSendRequest): Promise<ChatSendDecision> {
    // Reads nothing from the request; sends nothing; contacts no relay.
    return {
      allowed: false,
      state: "unavailable",
      reason: "no chat provider is configured (nothing sent)",
    };
  }

  async fetchPlaceholder(_request: ChatFetchRequest): Promise<ChatFetchDecision> {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no chat provider is configured (nothing fetched)",
      items: [],
    };
  }
}

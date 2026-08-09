/**
 * Fixed in-memory sample events for the read-only demo Worker.
 *
 * These are NOT real, signed Nostr events — `sig` is a placeholder and nothing
 * here is verified. They exist only to exercise ingest -> buildThreads ->
 * renderPage without any network. One reply intentionally contains HTML-special
 * characters to demonstrate that the render layer escapes event content.
 */

import type { NostrEvent } from "../../messenger/adapters/nostr/protocol/types.js";

const PUB_A = "a".repeat(64);
const PUB_B = "b".repeat(64);
const PUB_C = "c".repeat(64);
const SIG = "0".repeat(128);

const ROOT_ID = "1".repeat(64);
const REPLY_1_ID = "2".repeat(64);
const REPLY_2_ID = "3".repeat(64);
const NESTED_ID = "4".repeat(64);

export const SAMPLE_EVENTS: NostrEvent[] = [
  {
    id: ROOT_ID,
    pubkey: PUB_A,
    created_at: 1000,
    kind: 1,
    tags: [],
    content: "Welcome to nostr-window (read-only demo).",
    sig: SIG,
  },
  {
    id: REPLY_1_ID,
    pubkey: PUB_B,
    created_at: 1100,
    kind: 1,
    tags: [["e", ROOT_ID, "", "reply"]],
    content: 'A reply with <script> & "quotes" to prove escaping works.',
    sig: SIG,
  },
  {
    id: REPLY_2_ID,
    pubkey: PUB_C,
    created_at: 1200,
    kind: 1,
    tags: [["e", ROOT_ID, "", "reply"]],
    content: "A second top-level reply.",
    sig: SIG,
  },
  {
    id: NESTED_ID,
    pubkey: PUB_A,
    created_at: 1300,
    kind: 1,
    tags: [
      ["e", ROOT_ID, "", "root"],
      ["e", REPLY_1_ID, "", "reply"],
    ],
    content: "A nested reply under the first reply.",
    sig: SIG,
  },
  // Space-tagged events for the directory / landing pages (Stage 11).
  {
    id: "5".repeat(64),
    pubkey: PUB_A,
    created_at: 1400,
    kind: 1,
    tags: [["t", "space:general"]],
    content: "General community thread.",
    sig: SIG,
  },
  {
    id: "6".repeat(64),
    pubkey: PUB_A,
    created_at: 1500,
    kind: 1,
    tags: [["space", "announce"]],
    content: "Official announcement in the channel.",
    sig: SIG,
  },
  {
    id: "7".repeat(64),
    pubkey: PUB_B,
    created_at: 1600,
    kind: 1,
    tags: [["t", "space:lounge"]],
    content: "Lounge chatter.",
    sig: SIG,
  },
  {
    id: "8".repeat(64),
    pubkey: PUB_C,
    created_at: 1700,
    kind: 1,
    tags: [["space", "vault"]],
    content: "Secret vault note.",
    sig: SIG,
  },
];

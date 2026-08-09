/**
 * Secure Runtime Alpha 704 ("Local Runtime Publisher Construction") /
 * Alpha 702 ("Publisher Signing Authority Binding") — Stages 2/4 of Phase
 * B of the Alpha 681–720 Arc.
 *
 * The ONE production `FedosNostrBoardPublisherAdapterEventSource`
 * (`./fedos_nostr_board_publisher_adapter.js`, Alpha 496, UNCHANGED
 * contract) this Arc ships. Resolves the already-signed
 * `FedosNostrWireEvent` an Outbox intent needs by:
 *
 *   1. deserializing the intent (`deserializeFedosBoardOutboxIntent`,
 *      UNCHANGED), rejecting closed for a non-`"nostr"` target;
 *   2. reading the referenced `FedosBoardPost` via the injected
 *      `FedosBoardReader` (`postId` only — never a body duplicate stored
 *      anywhere else);
 *   3. mapping it to a `FedosNostrUnsignedEventRequest`
 *      (`./fedos_board_post_to_nostr_unsigned_event.js`, Alpha 703);
 *   4. signing it via the injected `FedosNostrSigningAuthority`, at the
 *      SAME fixed `accountIndex` this Runtime's own Nostr Identity-to-
 *      Signing Binding Authority (Phase A) already checked before the
 *      Outbox intent was ever created — Alpha 702's own "publisher
 *      registry entry owns a fixed local Nostr account" decision, applied
 *      as simply as the actual, tested V1 scope needs: ONE Local
 *      Runtime, ONE Nostr Publisher, ONE fixed account index, no
 *      per-intent account selection surface (Outbox V1 format is left
 *      byte-for-byte unchanged — no account field was ever added to it).
 *
 * Never signs for a mismatched/ineligible author — by the time an intent
 * reaches the Outbox at all, `FedosBoardRuntime` has already confirmed
 * eligibility (Phase A); this class re-derives nothing about identity, it
 * only re-reads the ALREADY-accepted post and signs under the SAME
 * account that made it eligible in the first place.
 *
 * Takes a `boardReader` ACCESSOR, `() => FedosBoardReader | null`, rather
 * than a plain `FedosBoardReader` — the same "return the owned instance
 * only when ready, else `null`" contract `FedosDesktopHost.board()`
 * itself already exposes. This resolves the ONE real construction-order
 * constraint Alpha 701's own inventory found: a `FedosBoardOutboxPublisher`
 * must exist BEFORE `FedosDesktopHost` is constructed (it is a
 * constructor dependency), yet `host.board()` itself returns `null`
 * until AFTER `host.start()` completes. Passing `() => host.board()`
 * defers the read to call time — by the time the Scheduler ever actually
 * invokes `resolveSignedEvent()` (during a `tick()`, always after
 * `startDelivery()`, always after `start()`), the accessor already
 * resolves a real reader. Fails closed (`null`) if the accessor itself
 * ever returns `null`.
 */

import { deserializeFedosBoardOutboxIntent } from "../../outbox/fedos_board_outbox_codec.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../../outbox/fedos_board_outbox_codec.js";
import type { FedosNostrBoardPublisherAdapterEventSource } from "./fedos_nostr_board_publisher_adapter.js";
import type { FedosBoardReader } from "../../repository/fedos_board_reader.js";
import type { FedosNostrSigningAuthority } from "../../../../../nostr/sign/fedos_nostr_signing_authority.js";
import { boardPostToNostrUnsignedEventRequest } from "./fedos_board_post_to_nostr_unsigned_event.js";

export class FedosSigningAuthorityBoardPostEventSource {
  readonly #boardReaderAccessor: () => FedosBoardReader | null;
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #accountIndex: number;

  constructor(
    boardReaderAccessor: () => FedosBoardReader | null,
    signingAuthority: FedosNostrSigningAuthority,
    accountIndex: number,
  ) {
    this.#boardReaderAccessor = boardReaderAccessor;
    this.#signingAuthority = signingAuthority;
    this.#accountIndex = accountIndex;
  }

  resolveSignedEvent: FedosNostrBoardPublisherAdapterEventSource = async (
    record: FedosPersistedBoardOutboxRecordV1,
  ) => {
    const intent = deserializeFedosBoardOutboxIntent(record);
    if (intent === null || intent.target.protocol !== "nostr") return null;

    const boardReader = this.#boardReaderAccessor();
    if (boardReader === null) return null;

    const post = boardReader.findPost(intent.postId);
    if (post === null) return null;

    const request = boardPostToNostrUnsignedEventRequest(post, this.#accountIndex);
    return this.#signingAuthority.signEvent(request);
  };
}

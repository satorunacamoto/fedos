/**
 * Secure Runtime Alpha 933 ("Account Index Resolution") — Stage 3 of the
 * Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * `docs/secure_runtime_alpha_689_account_index_authority.md` (Alpha 689,
 * the Nostr Identity Binding & Outbound Delivery Activation Arc)
 * compared four options for resolving a LOCAL account index and adopted:
 * "a fixed, injected configuration value, defaulting to 0, NEVER
 * inferred from a `publicIdentifier`" — because a caller-controlled or
 * descriptor-embedded account index would let a caller silently select
 * which cryptographic identity a call binds against. This file adopts
 * the IDENTICAL decision for the Conversation Encryption domain, rather
 * than re-opening that already-settled question: `FedosBoardRuntimeDependencies.nostrAccountIndex`
 * (`../../../board/runtime/fedos_board_runtime.ts`) is this codebase's
 * own precedent for exactly this shape.
 *
 * "Resolution" here therefore means "read the one configured value" —
 * never a search, guess, or lookup keyed by identity. The genuine
 * SECURITY check (does this account index really belong to the resolved
 * local participant?) is Alpha 935's own job
 * (`./fedos_conversation_key_resolver.ts`), composed over the EXISTING
 * Alpha 681–720 Nostr Identity Binding Authority — never performed here.
 */

export interface FedosConversationLocalAccountIndexAuthority {
  /** Total, never throws, never async — a fixed configuration read, never a lookup. */
  localAccountIndex(): number;
}

/**
 * The default, and the ONLY production implementation this Arc ships —
 * a fixed value, defaulting to `0` (Alpha 689's own default), with no
 * `process.env` read, no per-call parameter, and no inference path of
 * any kind.
 */
export class FixedFedosConversationLocalAccountIndexAuthority implements FedosConversationLocalAccountIndexAuthority {
  readonly #accountIndex: number;

  constructor(accountIndex: number = 0) {
    this.#accountIndex = Number.isInteger(accountIndex) && accountIndex >= 0 ? accountIndex : 0;
  }

  localAccountIndex(): number {
    return this.#accountIndex;
  }
}

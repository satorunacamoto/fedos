# Secure Runtime Alpha 493 — Canonical Delivery Observation Vocabulary

Stage 3 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. Decision: `FedosDeliveryObservation` is canonical, unchanged

Per Alpha 491 §3, `FedosDeliveryObservation` (`src/board/observation/`,
Alpha 462) already has:

- the EXACT required five-state vocabulary (`queued`/`publishing`/
  `accepted`/`rejected`/`failed`) — no rename needed;
- a separate type from any Publisher result (Alpha 492) or Outbox
  Intent (`fedos_board_outbox_types.ts`) — never merged;
- append-only, immutable, single fail-closed constructor
  (`createFedosDeliveryObservation`), `Object.freeze`d output;
- protocol-neutral `subjectId` (opaque, caller-supplied, not derived
  from any Board/Outbox/Nostr identifier);
- no `arbitrary metadata` field, no raw relay text, no `Error`/stack
  field of any kind (`reason?: string` is the only optional field,
  already present, already a plain human-readable string);
- a full durable stack already built and committed: Codec (Alpha 463),
  Persistence port + in-memory backend (Alpha 464/465), Repository
  (Alpha 466), Query (Alpha 467).

**Zero changes to `fedos_delivery_observation*.ts` in this Stage or any
later Stage of this Arc.** It is adopted exactly as it stands.

## 2. `FedosBoardOutboxObservation` — deprecated, isolated via adapter, NOT removed

`FedosBoardOutboxObservation` (`src/board/outbox/`, Alpha 475) remains
in the repository, byte-for-byte unchanged — `FedosPublishScheduler`
(Alpha 476, also unchanged, see Alpha 497) still constructs it
internally on every `tick()`, and removing or editing either file would
violate this Arc's own "既存Interfaceを変更しない" instruction for no
reconciliation benefit (the Scheduler's own internal bookkeeping is not
the caller-facing surface this Arc reconciles).

Per this Arc's own explicit instruction ("古いObservation型を残す場合
は、明確なdeprecated adapter boundaryを置くこと"), a single, pure,
explicit adapter function — `fedosBoardOutboxObservationToDeliveryObservation`
(`fedos_board_outbox_observation_to_delivery_observation.ts`, Alpha 497)
— is the ONLY sanctioned bridge between the two vocabularies. No other
file may hand-translate one to the other.

## 3. Kind/state mapping (five old, five new — not 1:1, decided explicitly)

| `FedosBoardOutboxObservationKind` | → | `FedosDeliveryObservationState` | rationale |
|---|---|---|---|
| `attempt-started` | → | `publishing` | an attempt in flight, not yet resolved |
| `delivered` | → | `accepted` | matches Alpha 492 §3's own outcome rename |
| `rejected` | → | `rejected` | verbatim — one of the two names already shared (Alpha 491 §5) |
| `failed` | → | `failed` | verbatim — the other shared name |
| `abandoned` | → | `failed` | **not verbatim** — see §4 |

No `queued` mapping exists in this table, because the OLD vocabulary
has no equivalent: `attempt-started` is the Scheduler's own FIRST
observation for an intent, matching this Arc's own transition graph's
(Alpha 494) allowance for `publishing` as a legal first-ever state when
no prior `queued` fact was ever recorded by a different producer (Alpha
415's own "queued belongs to intent creation" boundary, which this Arc
still does not touch).

## 4. Why `abandoned` maps to `failed`, not a sixth canonical state

This Arc's own required vocabulary is fixed at five states — adding a
sixth (`abandoned`) is out of scope (this Arc reconciles existing
vocabularies into the required five; it does not extend the required
five). `abandoned` (Alpha 474 §4: "the intent is added to an in-memory
abandoned set... every future `tick()` filters it out") is, from the
canonical vocabulary's own point of view, indistinguishable from a
terminal `failed` fact: delivery did not succeed, and no further
attempt will occur. The DISTINCTION Alpha 474 §4 itself calls out
(`abandoned` vs plain `failed`, so a consumer can tell "never attempted
again" from "one attempt failed") is preserved at the OLD-vocabulary
layer (unchanged) and simply not carried across this particular bridge
— a real, named narrowing, not an oversight.

## 5. See also

- `docs/secure_runtime_alpha_491_implementation_inventory.md`
- `docs/secure_runtime_alpha_462_delivery_observation_state_model.md`
- `docs/secure_runtime_alpha_475_outbox_observation_realization.md`

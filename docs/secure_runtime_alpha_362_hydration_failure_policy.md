# Secure Runtime Alpha 362 — Hydration Failure Policy

**Status: this Stage is POLICY/DESIGN — it fixes the INTENDED
semantics; it makes NO code change of any kind.** Stage 2 of the
Alpha 361–370 Board Recovery & Host Robustness Arc.

## 1. Why now

Alpha 361 inventoried six failure paths and found one — a thrown
exception from `persistence.listPosts()` during hydration — where
`FedosDesktopHost.start()`'s own observable behavior (`state()`
reporting `"starting"` forever) diverges from what `FedosDesktopHostState`'s
own design (Alpha 333) clearly intends. Before deciding whether that
divergence is a defect (Alpha 370), this Stage fixes, in writing, what
the CORRECT policy has always been meant to be — so the eventual
Completion Declaration is judging the implementation against an
explicit standard, not an implicit assumption.

## 2. The policy, stated explicitly

**Any failure to produce a usable, hydrated `FedosBoardService` during
`FedosDesktopHost.start()` — regardless of whether that failure is
communicated by a RETURNED non-`"hydrated"` outcome or by a THROWN
exception — MUST result in `state() === "failed"` before `start()`'s
own rejection reaches its caller.**

This is not a new rule invented by this Stage — it is the policy
`FedosDesktopHostState`'s own Alpha 333 design already states: the
required transition is `starting → failed`, unconditionally, on any
startup failure; the state model draws NO distinction between "a
failure the code anticipated in advance" and "a failure that
manifests as a thrown exception." Alpha 335's own original
implementation simply did not yet have a real backend capable of
proving the distinction mattered.

## 3. Two failure SIGNALING shapes, one required OUTCOME

- **Returned outcome** — `FedosBoardHydrationResult.outcome !==
  "hydrated"` (Alpha 318's own two rejection tokens,
  `"rejected-corrupt-record"`/`"rejected-unresolvable-thread-integrity"`).
  Already handled correctly (Alpha 361 row 1).
- **Thrown exception** — `persistence.listPosts()` itself throws
  (Alpha 357's own fail-closed design for a malformed/truncated log
  line, or a conflicting duplicate). NOT currently handled (Alpha 361
  row 3, §"the confirmed defect").

**Both shapes MUST produce the identical caller-visible result:**
`state() === "failed"`, and `start()`'s own `Promise` rejects with
information about the underlying cause. The signaling MECHANISM
(return value vs. exception) is an implementation detail of WHICH
layer detected the problem — the port (Alpha 315, permits throwing),
or `hydrateFedosBoardService`'s own internal record validation (Alpha
318, returns a token) — never something a Host-level caller should
need to know or handle differently.

## 4. Why the policy does not distinguish WHERE the failure occurred

A caller of `FedosDesktopHost` — by design (Alpha 336's own access
boundary) — never sees `FedosBoardPersistence`, `FedosBoardService`,
or any persistence-layer detail directly. It would therefore be
inconsistent for the OBSERVABLE `state()` behavior to depend on which
internal layer happened to detect a given corruption — that is
exactly the kind of internal-detail leak Alpha 336's own "smallest
practical boundary" Decision was built to prevent one layer up (public
API surface); this Stage extends the same reasoning to STATE
observability specifically.

## 5. What this Stage does NOT do

No code is written or changed anywhere in this Stage. This is a policy
statement only — Alpha 370 will judge the actual implementation
against it and, if warranted, sketch (not implement) a fix.

## 6. Conclusion

The policy is: hydration failure, by whatever mechanism it manifests,
must always result in `state() === "failed"`. Alpha 361 already proved
the current implementation satisfies this for one signaling shape and
violates it for the other — this Stage fixes WHY that is a violation,
not merely THAT it is one.

## 7. See also

- `docs/secure_runtime_alpha_361_host_failure_inventory.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`

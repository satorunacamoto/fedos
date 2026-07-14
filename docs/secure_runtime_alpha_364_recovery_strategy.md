# Secure Runtime Alpha 364 — Recovery Strategy

**Status: this Stage is DESIGN ONLY — it makes NO code change of any
kind. No recovery tool is implemented anywhere in this Arc.** Stage 4
of the Alpha 361–370 Board Recovery & Host Robustness Arc.

## 1. Why now

Alpha 363 classified every corruption shape. This Stage designs — in
prose and pseudocode only — how an OPERATOR would recover from each
recoverable category, without implementing any of it. "Never repair
automatically" (Alpha 357) remains absolute: nothing in this design
proposes AppendOnlyFedosBoardPersistence itself ever silently fixing
anything. Recovery, if it is ever built, is a SEPARATE, explicitly
operator-invoked action — never a hidden side effect of `putPost`/
`getPost`/`listPosts`.

## 2. Which categories are recoverable at all

Referring to Alpha 363's own table:

- **B (malformed/truncated line)** — recoverable: the corrupt line is
  almost always the LAST one (a crash mid-write), and every record
  before it remains intact and salvageable.
- **C (conflicting duplicate)** — recoverable, but requires an
  OPERATOR DECISION (which of the two conflicting records is correct)
  that no automated process can safely make — this is exactly why
  Alpha 357 throws rather than guessing.
- **D/E (semantic/graph corruption)** — recoverable in principle by
  identifying and removing the offending record(s), but requires
  understanding WHICH record is invalid, which needs a human or a
  separate diagnostic pass, not proposed by this Stage.
- **F/G (I/O failures)** — not "corruption" to recover FROM at all;
  the fix is environmental (restore permissions, free disk space, fix
  a missing directory), outside this Arc's own scope entirely.

## 3. A design for salvage recovery (category B), in pseudocode only

```
function salvageAppendOnlyLog(sourcePath, destinationPath):
    lines = read sourcePath, split on "\n"
    salvaged = []
    for line in lines:
        if line is blank: continue
        try:
            record = JSON.parse(line)
            salvaged.append(record)
        catch:
            # Stop at the FIRST unparseable line -- do not skip past it
            # and keep scanning; a crash produces at most ONE trailing
            # partial line (Alpha 352 §2), so anything AFTER an
            # unparseable line is itself suspect and must not be
            # silently trusted.
            break
    write each record in `salvaged`, one JSON line each, to a NEW file
    at destinationPath (never overwriting sourcePath)
    return { salvagedCount: salvaged.length, sourcePath, destinationPath }
```

**This is NOT automatic repair** — it is a separate, explicit function
an operator (or a future CLI, itself out of scope per Alpha 338) would
choose to invoke, reading FROM the corrupt file and writing TO a
DIFFERENT, new file — the original corrupt file is NEVER modified or
deleted by this design, preserving it as forensic evidence and as a
fallback if the salvage itself is ever found to be wrong.

## 4. Why "stop at the first unparseable line" is the correct policy, not "skip and continue"

A design that SKIPPED an unparseable line and kept scanning for more
valid records AFTER it would risk silently including a record that
LOOKS structurally valid JSON but was never actually durably written
as a coherent unit (e.g. two half-writes from two SEPARATE crashed
attempts, coincidentally forming valid-looking JSON when concatenated)
— an extremely unlikely but non-zero risk that "stop at the first
failure" eliminates entirely, at the cost of only ever losing
strictly-after-the-first-failure data, which — per Alpha 352 §2's own
crash assumption — should be empty in the overwhelming majority of
real crash scenarios anyway (a crash produces AT MOST one trailing
partial line).

## 5. Why category C (conflicting duplicate) is NOT given an automated resolution

Any automated "pick the first/last/longest one" rule would be an
actual repair decision — indistinguishable in effect from the
"silent guess" Alpha 357 already rejected. This Stage's own design
therefore proposes only DETECTION tooling for category C (a function
that reports the conflicting `id` and both candidate records to a
human), never a resolution rule.

## 6. What this Stage does NOT do

No file is created. No function is implemented. `salvageAppendOnlyLog`
above is pseudocode for a FUTURE Arc to build, review, and test
properly — this Stage's own deliverable is the design and its
reasoning, nothing more.

## 7. Conclusion

Recovery is possible and well-defined for category B (salvage,
stop-at-first-failure, write-to-a-new-file, never touch the original),
partially possible but requiring a human decision for category C
(detect and report, never auto-resolve), and out of scope for D/E/F/G
for the reasons stated. None of this is implemented in this Arc.

## 8. See also

- `docs/secure_runtime_alpha_363_corruption_classification.md`
- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_352_append_only_record_format.md`

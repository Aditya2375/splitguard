# Interval and counting contract

## Invented events

The fixture has no features, target values, prices, returns or dates. It contains 60 events. An integer seed from 1 to 9999 initializes an unsigned 32-bit state. Each event uses two LCG steps:

```
s = (1664525 * s + 1013904223) mod 2^32
```

Time starts at zero. The first state advances time by `1 + s mod 3`, so prediction times strictly increase. The second sets `end = start + 1 + s mod horizon`. Horizon ranges from 1 to 24 ticks; label lengths range from 1 to horizon. Seed changes starts and lengths. Horizon leaves prediction times unchanged. This generator is a fixture, not a claim about market dynamics, random-process quality or cryptographic security.

The UI accepts 3 to 8 folds, an embargo from 0 to 16 integer ticks and a seed from 1 to 9999. The generic splitter accepts 2 to 256 events. Starts must be nonnegative and strictly increasing. Each integer end must exceed its start and be at most 1,000,000. Generic embargo duration is an integer from 0 to 1,000,000.

JS rejects missing, null, sparse, nonfinite and noninteger input. Java uses typed integer records and checks nulls. The input array is copied. Java Event records are immutable; JS copies each event object. Returned arrays are not deeply immutable security boundaries.

For N events, k folds and zero-based fold f:

```
q = floor(N / k)
r = N mod k
from = f * q + min(f, r)
to = from + q + (f < r ? 1 : 0)
```

Earlier folds receive the remainder. Generic bounds support `2 <= k <= N` and `0 <= f < k`. Every event is held out exactly once, and test fold sizes differ by at most one. The split API accepts a contiguous, nonempty test block `[from, to)` smaller than the dataset. It does not implement random shuffling, groups, disjoint test blocks or CPCV.

## Exact half-open geometry

Each label `[p, e)` has positive integer duration. Candidate i and test event j overlap if:

```
max(p[i], p[j]) < min(e[i], e[j])
```

Touching endpoints are not overlap. A positive intersection has duration `min(e[i], e[j]) - max(p[i], p[j])`; otherwise its duration is zero.

Test intervals are sorted by start. The union builder merges a new interval when its start is at most the current end. It uses the larger of both ends, including nested labels and labels whose ends are not ordered. Merging intervals that touch preserves the same half-open union and creates no false overlap.

Candidate classification checks this exact union, not its convex hull. The audit separately enumerates the original test events to calculate conflict count, summed pair-ticks and the first conflict index. The engine refuses an internal disagreement between union classification and the pair audit.

Let B be the largest end among all test labels, not the end of the last test event or the last test prediction. An embargo excludes a remaining candidate when `start >= B` and `start < B + embargo`. Duration zero excludes nothing. This is not a row count or a fraction of the sample. Other packages can choose different anchors or endpoints; no compatibility is claimed.

For example, test label `[4, 8)` and candidate `[0, 4)` do not overlap. Candidate `[0, 5)` overlaps by one tick. With B = 8 and embargo = 2, a start at 8 is embargoed and a start at 10 is not. Test labels may overlap one another, but their audit counts are zero because these diagnostics describe candidate/test pairs, not pairs within the test set.

Classification order is TEST, PURGED, EMBARGO, TRAIN. PURGED means a positive intersection with at least one test label. Extra embargo removals count only candidates not already purged. `inEmbargo` reports the raw start-window predicate separately. With positive forward label intervals, a purged candidate cannot start at or beyond the largest test end. Thus purging and this particular embargo cannot conflict. That property should not be assumed for other conventions.

## Counts and numerical bounds

Every fold satisfies:

```
tests + candidates = N
tests + purged + embargoed + train = N
past + future = train
```

Past means an event index before `from`; future means an index at or after `to`. Retaining future events is deliberate k-fold resampling, not a past-only deployment simulation. An empty training set is allowed and reported. There is no fallback that weakens the split.

`pairs` sums conflict counts across all non-test candidates. `overlapTicks` sums the length of every candidate/test intersection before removal. Several pairs may count the same tick. Neither quantity is a probability, a count of independent trials or unique shared time. `firstConflict` is the first test index in prediction order, not the largest overlap. The UI uses one-based event numbers; the API uses -1 for none. These diagnostics exclude pairs within the test set.

At the generic bound of 256 events, the maximum candidate/test pair count is 16,384. One row's summed pair-ticks fit in a Java int, but the aggregate can exceed 32 bits and is bounded above by 16.384 billion. The Java summary uses long. JS integer arithmetic remains exact below 2^53. Embargo end is at most 2 million. The LCG intermediate also stays below 2^53 before modular reduction. Timing, counts and membership use no floating-point arithmetic. Only SVG coordinates use floating point; display rounding never affects a split.

## Analytic and independent checks

A six-event fixture has starts 0, 2, 4, 6, 8, 10 and ends 5, 3, 7, 8, 10, 12. With test indices `[2, 4)` and embargo 2, roles are:

```
PURGED, TRAIN, TEST, TEST, EMBARGO, TRAIN
```

The test union is `[4, 8)`, pair count is 1, summed pair-ticks are 1, retained count is 2 (one past and one future), B is 8 and embargo end is 10. Boundary fixtures cover touching endpoints, an earlier test label ending after the last test label, disjoint union segments, zero embargo and zero retained rows. A 256-event fixture with all ends at 1 million has 16,384 pairs and aggregate pair-ticks above `Integer.MAX_VALUE`. Both languages check its exact value.

Java grids use seeds 1, 17, 101 and 9999; folds 3 to 8; horizons 1, 2, 8, 12 and 24; and embargo durations 0, 1, 4 and 16. They check every row's role and pair diagnostics, summary totals, union truth against direct pair checks, partition identities, zero-embargo monotonicity, caller immutability and input refusal. Generic fold tests cover N from 2 to 256 for contiguous boundaries, balanced sizes and complete coverage.

JS also tests sparse arrays, frozen inputs, finite integers and invalid values. Increasing embargo cannot increase retained membership or change which labels are purged. Java/JS parity compares every event, fold summary, union interval and row field exactly on 81 scenarios.

The independent Python reference builds sets of covered integer ticks and reconstructs unions from adjacent unit intervals, rather than using production interval merging. Pair intersections are set intersections, rather than copies of production inequality diagnostics. It has its own generator and compares every field on 81 scenarios using only the standard library. It covers the fixed synthetic domain and does not allocate million-tick sets for generic inputs.

Browser checks cover all 480 ledger cells, every fold count, all 11 audit values, four metrics, every K-by-60 matrix role, union intervals and the pixel coordinates of selected and embargo intervals. Cases cover all folds, first/middle/last events, all four membership roles, long and short horizons, zero embargo, extreme controls, invalid input retention and dirty edits during resize or inspection. Widths 1440, 768, 390, 360 and 320 are checked for page overflow, input margins of at least 17 px, control heights of at least 44 px, metric and audit containment, and local table scrolling. Network requests, exceptions, storage and CSP are checked too.

Matrix letters use a white stylesheet fill, not CSP-blocked inline styles. The mobile timeline redraws at its actual width with stacked labels, so its data stays visible without horizontal scrolling. Native Safari and Android are untested. Tests are not proof of statistical validity or generalization.

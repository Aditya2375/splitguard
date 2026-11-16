# splitguard

A Java-first purged cross-validation engine and interval audit. Separating row indices does not necessarily separate the information used to form their labels. Inspect exactly which candidate labels intersect held-out labels, which starts fall in a post-test embargo and how much training data remains.

## Complete v1

- 60 invented events with irregular prediction times and variable forward label lengths. No market data, features, outcomes, fitted model or performance scores.
- Balanced contiguous k-fold test blocks. Every event is held out once; all other events start as training candidates.
- Exact half-open label-overlap purging, followed by an explicit duration embargo anchored at the latest test label end.
- Full fold-by-event matrix, selected-event interval timeline, 11-field audit, all-fold counts and 60-row membership ledger.
- Own Java engine and browser mirror, independent Python integer reference, hand fixtures, boundary/monotonicity tests and full-state parity.

This is a split-membership demonstration, not evidence that a model generalizes, that an embargo removes dependence or that purging improves a score. Purged k-fold can retain future training events. It is not a past-only walk-forward backtest. No trading, investment edge or forecast is implied.

## Run locally

Java 21+, Node 22+ and Python 3.12+ for the reference. No application runtime dependencies or package installation.

```sh
javac -d build/classes src/splitguard/*.java tools/*.java tests/splitguard/*.java
java -cp build/classes splitguard.TestRunner
node tests/parity.mjs
node tests/domain.mjs
python3 tests/reference.py
node tools/build-web.mjs
python3 -m http.server 8080 --directory docs
```

Open the local server in a browser. `JAVA` overrides the Java executable used by parity/reference tests. `node tests/browser-smoke.mjs` requires `google-chrome`. `SMOKE_URL` tests a deployed site; `SMOKE_SHOTS=1` captures screenshots. Native Safari/Android untested. `docs/` is a byte-for-byte copy of the four `web/` assets.

## The split contract

Each event has a prediction/start time p and label evaluation/end time e, with p < e. Its label interval is [p, e). For candidate i and test j:

```
overlap(i,j) = p[i] < e[j] AND p[j] < e[i]
```

Touching endpoints are not overlap. A candidate is purged if it overlaps any test label. The engine merges the test-label union for classification and separately checks all candidate/test pairs for the audit. It does not substitute a single convex hull for that union.

Let B=max(e[j]) over all test events. After purging, exclude a candidate if its prediction time is in [B, B+embargo). Embargo is an integer duration in invented ticks, not a number of rows or fraction of the sample. Zero duration excludes nothing; a start exactly at B is excluded when duration is positive, and a start exactly at B+embargo is not.

Membership precedence is TEST, PURGED, EMBARGO, TRAIN. TEST rows are not candidates and their conflict diagnostics are zero, not within-test overlap measurements. TRAIN means it passes this membership contract, not that it is independent, causal for a deployment question or free of every leak. Empty training is a reported result, with no automatic fallback.

Pair-ticks sum intersection lengths over every candidate/test pair before removal. Shared ticks can appear in several pairs, so the sum is not unique exposure time or a probability. Counts for each fold satisfy test + purged + embargo + retained = N. Retained is partitioned into past/future event positions relative to the test block. Reused events make fold scores dependent even if a later application fits a model.

## Controls and APIs

UI: folds 3..8, maximum label horizon 1..24 ticks, embargo 0..16 ticks, seed 1..9999. Fixed N=60, default 5/12/4/17. Inspect fold and event separately. Changing a control does not apply it until submit. Invalid input keeps the prior applied result. Matrix and tables own their scrolling; the timeline redraws with stacked labels on narrow screens rather than shrinking its text.

`Engine.split(events, from, to, embargo)` takes a contiguous zero-based test block [from, to), nonempty and smaller than the dataset. Generic events: 2..256, strictly increasing nonnegative starts, integer ends greater than starts and at most 1,000,000. Embargo 0..1,000,000. It copies caller arrays; Java Event records are immutable. JS refuses sparse, nonfinite and noninteger inputs. Output arrays are not immutable security boundaries. `bounds(n,k,f)` balances sizes with earlier folds receiving the remainder. `run(params)` generates the fixture and splits all folds.

See [NUMERICS.md](NUMERICS.md) for exact generation, endpoint examples, numerical bounds and testing details.

## What this does not solve

No features or outcomes are supplied, so the app measures neither empirical leakage bias nor generalization. It does not fix future-aware features, globally fitted preprocessing, duplicate entities, revised source data, repeated holdout tuning, nonstationarity or unrealistic trading assumptions. Any learned transformation must be fitted inside the training split. A valid deployment study may need past-only training, group separation, nested selection, an untouched holdout and other controls.

Embargo conventions differ across implementations. Some use observation counts, a fraction or closed endpoints, and some anchor after test positions rather than label evaluation. Our stated convention is an explicit modeling choice, not a universal recommended setting or drop-in compatibility promise. No CPCV paths, statistical significance, Sharpe correction or model selection is implemented here.

No accounts, uploads, browser storage, cookies, telemetry or runtime network calls after static assets load. No third-party code, datasets, fonts, papers or assets bundled.

## Background

Own implementation of published splitting ideas; not a copy or fork of these packages.

- [purgedcv methodology and limitations](https://eslazarev.github.io/purged-cross-validation/methodology/).
- [purgedcv interval and embargo conventions](https://eslazarev.github.io/purged-cross-validation/api/primitives/).
- [mlfinlab's documented PurgedKFold interface](https://github.com/hudson-and-thames/mlfinlab/blob/master/mlfinlab/cross_validation/cross_validation.py).
- [scikit-learn TimeSeriesSplit: chronological training and a row gap](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html).
- [scikit-learn validation and model-selection cautions](https://scikit-learn.org/stable/modules/cross_validation.html).
- [QuantInsti: prediction/event times, purging and embargo](https://blog.quantinsti.com/cross-validation-embargo-purging-combinatorial/).
- [python.financial: interval overlap and remaining leakage channels](https://python.financial/concepts/purged-cross-validation/).
- [purgedcv authors' methodology manuscript](https://github.com/eslazarev/purged-cross-validation/blob/main/paper/arxiv_paper.tex). This is a project manuscript, not presented as independently validated research.

Purging and embargo are described by Marcos Lopez de Prado in _Advances in Financial Machine Learning_, chapter 7. No book excerpt or implementation is bundled.

## License

Original code copyright 2026 Aditya Kulkarni, licensed under **MIT OR Apache-2.0**, at your option. See [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).

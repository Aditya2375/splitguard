export const defaults = { folds: 5, horizon: 12, embargo: 4, seed: 17 };
const integer = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
export function validate(p) {
  if (
    !p ||
    !integer(p.folds, 3, 8) ||
    !integer(p.horizon, 1, 24) ||
    !integer(p.embargo, 0, 16) ||
    !integer(p.seed, 1, 9999)
  )
    throw Error("Controls outside bounds");
}
export function generate(horizon, seed) {
  if (!integer(horizon, 1, 24) || !integer(seed, 1, 9999))
    throw Error("Generator bounds");
  let s = seed,
    t = 0;
  return Array.from({ length: 60 }, () => {
    s = (1664525 * s + 1013904223) >>> 0;
    t += 1 + (s % 3);
    s = (1664525 * s + 1013904223) >>> 0;
    return { start: t, end: t + 1 + (s % horizon) };
  });
}
export function checked(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 256)
    throw Error("2..256 events required");
  let last = -1;
  return Array.from(input, (e) => {
    if (
      !e ||
      !integer(e.start, 0, 999999) ||
      e.start <= last ||
      !integer(e.end, e.start + 1, 1000000)
    )
      throw Error("Strict starts and nonempty bounded intervals required");
    last = e.start;
    return { ...e };
  });
}
export function bounds(n, k, f) {
  if (!integer(n, 2, 256) || !integer(k, 2, n) || !integer(f, 0, k - 1))
    throw Error("Fold bounds");
  let q = Math.floor(n / k),
    r = n % k,
    start = f * q + Math.min(f, r);
  return [start, start + q + (f < r ? 1 : 0)];
}
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;
export function split(input, from, to, embargo) {
  const a = checked(input),
    n = a.length;
  if (
    !integer(from, 0, n - 1) ||
    !integer(to, from + 1, n) ||
    to - from === n ||
    !integer(embargo, 0, 1000000)
  )
    throw Error("Split bounds");
  const union = [];
  let boundary = 0;
  for (let j = from; j < to; j++) {
    const e = a[j];
    boundary = Math.max(boundary, e.end);
    const u = union.at(-1);
    if (u && e.start <= u.end) u.end = Math.max(u.end, e.end);
    else union.push({ ...e });
  }
  let purged = 0,
    embargoed = 0,
    train = 0,
    past = 0,
    future = 0,
    pairs = 0,
    overlapTicks = 0;
  const embargoEnd = boundary + embargo;
  const rows = a.map((e, i) => {
    const test = i >= from && i < to,
      inEmbargo = embargo > 0 && e.start >= boundary && e.start < embargoEnd;
    let conflicts = 0,
      ticks = 0,
      firstConflict = -1,
      role;
    if (test) role = "TEST";
    else {
      const hit = union.some((u) => e.start < u.end && u.start < e.end);
      for (let j = from; j < to; j++)
        if (overlaps(e, a[j])) {
          conflicts++;
          ticks += Math.min(e.end, a[j].end) - Math.max(e.start, a[j].start);
          if (firstConflict < 0) firstConflict = j;
        }
      if (hit !== conflicts > 0) throw Error("Union mismatch");
      pairs += conflicts;
      overlapTicks += ticks;
      if (hit) {
        role = "PURGED";
        purged++;
      } else if (inEmbargo) {
        role = "EMBARGO";
        embargoed++;
      } else {
        role = "TRAIN";
        train++;
        if (i < from) past++;
        else future++;
      }
    }
    return {
      index: i,
      start: e.start,
      end: e.end,
      role,
      conflicts,
      overlapTicks: ticks,
      firstConflict,
      inEmbargo,
    };
  });
  return {
    from,
    to,
    boundary,
    embargoEnd,
    union,
    rows,
    tests: to - from,
    candidates: n - (to - from),
    purged,
    embargoed,
    train,
    past,
    future,
    pairs,
    overlapTicks,
  };
}
export function run(p) {
  validate(p);
  const events = generate(p.horizon, p.seed),
    splits = Array.from({ length: p.folds }, (_, f) =>
      split(events, ...bounds(events.length, p.folds, f), p.embargo),
    );
  return { events, splits };
}
export function packed(r) {
  return {
    events: r.events.map((e) => [e.start, e.end]),
    splits: r.splits.map((s) => ({
      summary: [
        s.from,
        s.to,
        s.boundary,
        s.embargoEnd,
        s.tests,
        s.candidates,
        s.purged,
        s.embargoed,
        s.train,
        s.past,
        s.future,
        s.pairs,
        s.overlapTicks,
      ],
      union: s.union.map((u) => [u.start, u.end]),
      rows: s.rows.map((r) => [
        r.index,
        r.start,
        r.end,
        r.role,
        r.conflicts,
        r.overlapTicks,
        r.firstConflict,
        r.inEmbargo,
      ]),
    })),
  };
}

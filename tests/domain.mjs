import assert from "node:assert/strict";
import {
  defaults,
  run,
  split,
  checked,
  generate,
  bounds,
  overlaps,
  validate,
} from "../web/src/model.js";
let count = 0;
function ok(x) {
  assert(x);
  count++;
}
function bad(f) {
  assert.throws(f);
  count++;
}
const a = [
  { start: 0, end: 5 },
  { start: 2, end: 3 },
  { start: 4, end: 7 },
  { start: 6, end: 8 },
  { start: 8, end: 10 },
  { start: 10, end: 12 },
];
const copy = JSON.stringify(a),
  s = split(a, 2, 4, 2);
assert.deepEqual(
  s.rows.map((x) => x.role),
  ["PURGED", "TRAIN", "TEST", "TEST", "EMBARGO", "TRAIN"],
);
count += 6;
ok(
  s.train === 2 &&
    s.pairs === 1 &&
    s.overlapTicks === 1 &&
    s.past === 1 &&
    s.future === 1,
);
ok(JSON.stringify(a) === copy);
ok(!overlaps({ start: 0, end: 4 }, { start: 4, end: 9 }));
for (const seed of [1, 17, 101, 9999])
  for (let folds = 3; folds <= 8; folds++)
    for (const horizon of [1, 2, 8, 12, 24])
      for (const embargo of [0, 1, 4, 16]) {
        const r = run({ seed, folds, horizon, embargo });
        const seen = Array(60).fill(0);
        for (const s of r.splits) {
          ok(s.train + s.tests + s.purged + s.embargoed === 60);
          ok(s.past + s.future === s.train);
          let pairs = 0,
            ticks = 0;
          for (const row of s.rows) {
            if (row.role === "TEST") {
              seen[row.index]++;
              continue;
            }
            const es = r.events.slice(s.from, s.to);
            const c = es.filter((e) => overlaps(e, row));
            ok(row.conflicts === c.length);
            ok((row.role === "PURGED") === c.length > 0);
            ok(
              row.overlapTicks ===
                c.reduce(
                  (s, e) =>
                    s + Math.min(e.end, row.end) - Math.max(e.start, row.start),
                  0,
                ),
            );
            if (row.role === "TRAIN") ok(!row.inEmbargo && c.length === 0);
            pairs += row.conflicts;
            ticks += row.overlapTicks;
          }
          ok(pairs === s.pairs && ticks === s.overlapTicks);
          const z = split(r.events, s.from, s.to, 0);
          ok(z.purged === s.purged && z.train >= s.train);
          const more = split(r.events, s.from, s.to, embargo + 1);
          ok(more.purged === s.purged && more.train <= s.train);
        }
        for (const n of seen) ok(n === 1);
      }
for (const v of [
  null,
  {},
  [],
  new Array(2),
  [{ start: 0, end: 1 }, undefined],
  [
    { start: 0, end: 1 },
    { start: 0, end: 2 },
  ],
  [
    { start: 0, end: Infinity },
    { start: 1, end: 2 },
  ],
  [
    { start: 0, end: 1.5 },
    { start: 1, end: 2 },
  ],
  [
    { start: 0, end: 0 },
    { start: 1, end: 2 },
  ],
])
  bad(() => checked(v));
for (const key of Object.keys(defaults))
  for (const value of [NaN, Infinity, undefined, "3", 1.5, -1, 100000])
    bad(() => validate({ ...defaults, [key]: value }));
bad(() => split(a, 0, 6, 0));
bad(() => split(a, 0, 1, NaN));
bad(() => bounds(60, 3, 3));
bad(() => generate(0, 1));
const frozen = Object.freeze(a.map(Object.freeze));
split(frozen, 2, 4, 2);
count++;
const c = checked(a);
c[0].end = 99;
ok(a[0].end === 5);
console.log(`${count} JS domain assertions passed`);

const large = Array.from({ length: 256 }, (_, i) => ({
    start: i,
    end: 1000000,
  })),
  ls = split(large, 64, 192, 1000000);
let exactTicks = 0;
for (let i = 0; i < 256; i++)
  if (i < 64 || i >= 192)
    for (let j = 64; j < 192; j++) exactTicks += 1000000 - Math.max(i, j);
ok(
  exactTicks > 2147483647 &&
    ls.overlapTicks === exactTicks &&
    ls.pairs === 16384 &&
    ls.train === 0,
);
console.log("Large generic pair-tick fixture passed");

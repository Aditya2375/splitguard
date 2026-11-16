import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { run, packed } from "../web/src/model.js";
let count = 0;
function compare(a, b) {
  if (Array.isArray(a)) {
    assert(Array.isArray(b));
    assert.equal(a.length, b.length);
    a.forEach((v, i) => compare(v, b[i]));
  } else if (a && typeof a === "object") {
    assert.deepEqual(Object.keys(a), Object.keys(b));
    Object.keys(a).forEach((k) => compare(a[k], b[k]));
  } else {
    assert.equal(a, b);
    count++;
  }
}
for (const seed of [1, 17, 9999])
  for (const folds of [3, 5, 8])
    for (const horizon of [1, 12, 24])
      for (const embargo of [0, 4, 16]) {
        const p = { folds, horizon, embargo, seed };
        const j = JSON.parse(
          execFileSync(
            process.env.JAVA || "java",
            ["-cp", "build/classes", "Dump", ...Object.values(p).map(String)],
            { encoding: "utf8" },
          ),
        );
        compare(packed(run(p)), j);
      }
console.log(`${count} Java/JS exact field comparisons passed`);

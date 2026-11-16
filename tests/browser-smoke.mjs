import { run, defaults } from "../web/src/model.js";
import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "node:fs";

const HTTP_PORT = 8998;
const CDP_PORT = 9399;
const SHOTS = process.env.SMOKE_SHOTS === "1";
const root = new URL("..", import.meta.url).pathname;

const profile = mkdtempSync("/tmp/splitguard-chrome-");
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    String(HTTP_PORT),
    "--bind",
    "127.0.0.1",
    "--directory",
    `${root}docs`,
  ],
  { stdio: "ignore", detached: true },
);
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: true },
);

const cleanup = async (code) => {
  for (const child of [chrome, server]) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await Promise.all(
    [chrome, server].map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => child.once("exit", r)),
    ),
  );
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};
const timeout = setTimeout(() => {
  console.error("smoke: timeout");
  cleanup(1);
}, 90000);
process.on("SIGINT", () => cleanup(2));
process.on("uncaughtException", (e) => {
  console.error(e);
  cleanup(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  cleanup(1);
});

async function waitFor(fn, label, timeoutMs = 60000) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - start > timeoutMs)
      throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(
    `${ok ? "ok" : "NOT OK"} - ${name}${detail ? " - " + detail : ""}`,
  );
};

await waitFor(
  async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok,
  "chrome devtools",
);
const target = await (
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let mid = 0;
const rpcPending = new Map();
const consoleErrors = [];
const requests = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.requestWillBeSent")
    requests.push(msg.params.request.url);
  if (msg.id && rpcPending.has(msg.id)) {
    rpcPending.get(msg.id)(msg);
    rpcPending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown")
    consoleErrors.push(
      msg.params.exceptionDetails?.exception?.description ?? "page exception",
    );
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++mid;
    rpcPending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails)
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};
const shot = async (name) => {
  if (!SHOTS) return;
  await new Promise((r) => setTimeout(r, 900));
  const metrics = await cdp("Page.getLayoutMetrics");
  const size = metrics.result.cssContentSize;
  const r = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: await evaluate("innerWidth"),
      height: size.height,
      scale: 1,
    },
  });
  writeFileSync(
    `${root}smoke-${name}.png`,
    Buffer.from(r.result.data, "base64"),
  );
};

await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
const url = process.env.SMOKE_URL || `http://127.0.0.1:${HTTP_PORT}/`;
await cdp("Page.navigate", { url });
await waitFor(
  async () =>
    await evaluate(`document.querySelectorAll('#ledger tbody tr').length===60`),
  "rendered",
);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const input = (id, v) =>
  evaluate(
    `(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(v))};return true})()`,
  );
const change = (id) =>
  evaluate(
    `document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('change',{bubbles:true}));true`,
  );
const submit = () =>
  evaluate(
    `document.getElementById('controls').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));true`,
  );
async function snap() {
  return evaluate(
    `(()=>{const t=id=>[...document.getElementById(id).tBodies[0].rows].map(r=>[...r.cells].map(e=>e.textContent));return{mobile:innerWidth<=520,timelineWidth:Number(document.getElementById("timeline").getAttribute("viewBox").split(" ")[2]),ledger:t('ledger'),folds:t('foldtable'),audit:[...document.querySelectorAll('#audit code')].map(e=>e.textContent),metrics:[...document.querySelectorAll('.metric strong')].map(e=>e.textContent),selection:document.getElementById('selection').textContent,status:document.getElementById('status').textContent,matrix:[...document.querySelectorAll('#matrix rect[data-role]')].map(e=>[Number(e.dataset.fold),Number(e.dataset.event),e.dataset.role]),testIntervals:[...document.querySelectorAll('#timeline rect[data-start]')].map(e=>[Number(e.dataset.start),Number(e.dataset.end)]),selected:[...document.querySelectorAll('#selected-interval')].map(e=>[Number(e.getAttribute('x')),Number(e.getAttribute('width'))]),embargo:[...document.querySelectorAll('#embargo-interval')].map(e=>[Number(e.getAttribute('x')),Number(e.getAttribute('width'))])}})()`,
  );
}
async function verify(p, f, i, label) {
  const r = run(p),
    s = r.splits[f],
    row = s.rows[i],
    v = await snap();
  check(
    label + " ledger480cells",
    eq(
      v.ledger,
      s.rows.map((x) =>
        [
          x.index + 1,
          x.start,
          x.end,
          x.role,
          x.conflicts,
          x.firstConflict < 0 ? "-" : x.firstConflict + 1,
          x.overlapTicks,
          x.inEmbargo ? "Yes" : "No",
        ].map(String),
      ),
    ),
  );
  check(
    label + " foldcounts",
    eq(
      v.folds,
      r.splits.map((s, f) =>
        [
          f + 1,
          s.tests,
          s.candidates,
          s.purged,
          s.embargoed,
          s.train,
          s.past,
          s.future,
          s.pairs,
          s.overlapTicks,
        ].map(String),
      ),
    ),
  );
  check(
    label + " audit11",
    eq(
      v.audit,
      [
        `${s.from + 1} to ${s.to}`,
        `[${row.start}, ${row.end})`,
        row.end - row.start,
        row.role,
        row.conflicts,
        row.firstConflict < 0 ? "-" : row.firstConflict + 1,
        row.overlapTicks,
        s.boundary,
        s.embargoEnd,
        row.inEmbargo ? "Yes" : "No",
        s.union.length,
      ].map(String),
    ),
  );
  check(
    label + " metrics",
    eq(v.metrics, [s.candidates, s.purged, s.embargoed, s.train].map(String)),
  );
  check(
    label + " matrixall",
    eq(
      v.matrix,
      r.splits.flatMap((s, f) => s.rows.map((x) => [f, x.index, x.role])),
    ),
  );
  check(
    label + " union",
    eq(
      v.testIntervals,
      s.union.map((u) => [u.start, u.end]),
    ),
  );
  const max = Math.max(...r.events.map((e) => e.end), s.embargoEnd) + 2;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  check(
    label + " selected interval pixels",
    v.selected.length === 1 &&
      near(
        v.selected[0][0],
        (v.mobile ? 12 : 150) +
          (row.start / max) * (v.mobile ? v.timelineWidth - 24 : 820),
      ) &&
      near(
        v.selected[0][1],
        ((row.end - row.start) / max) * (v.mobile ? v.timelineWidth - 24 : 820),
      ),
  );
  check(
    label + " embargo interval pixels",
    p.embargo === 0
      ? v.embargo.length === 0
      : v.embargo.length === 1 &&
          near(
            v.embargo[0][0],
            (v.mobile ? 12 : 150) +
              (s.boundary / max) * (v.mobile ? v.timelineWidth - 24 : 820),
          ) &&
          near(
            v.embargo[0][1],
            (p.embargo / max) * (v.mobile ? v.timelineWidth - 24 : 820),
          ),
  );
  check(label + " status applied", v.status.includes(`seed ${p.seed}`));
  check(
    label + " selection",
    v.selection.includes(`event ${i + 1}: ${row.role}`),
  );
}
await verify(defaults, 2, 36, "default");
for (const i of [24, 32, 36, 39]) {
  await input("event", i + 1);
  await change("event");
  await verify(defaults, 2, i, "role" + i);
}
await input("event", 37);
await change("event");
await shot("default");
for (const f of [0, 1, 3, 4]) {
  await input("fold", f + 1);
  await change("fold");
  for (const i of [0, 11, 24, 59]) {
    await input("event", i + 1);
    await change("event");
    await verify(defaults, f, i, `fold${f}event${i}`);
  }
}
const scenarios = [
  { folds: 8, horizon: 24, embargo: 16, seed: 9999 },
  { folds: 3, horizon: 1, embargo: 0, seed: 1 },
  { folds: 5, horizon: 12, embargo: 0, seed: 17 },
];
for (let j = 0; j < scenarios.length; j++) {
  const p = scenarios[j];
  for (const [k, v] of Object.entries(p)) await input(k, v);
  await submit();
  await input("fold", p.folds);
  await change("fold");
  await input("event", 60);
  await change("event");
  await verify(p, p.folds - 1, 59, "scenario" + j);
  await shot("scenario" + j);
}
for (const [k, v] of Object.entries(defaults)) await input(k, v);
await submit();
await input("fold", 3);
await change("fold");
await input("event", 37);
await change("event");
let before = await snap();
for (const [id, value] of [
  ["folds", ""],
  ["horizon", "NaN"],
  ["embargo", 17],
  ["seed", 0],
  ["folds", 3.5],
]) {
  await input(id, value);
  await submit();
  let after = await snap();
  check(
    `invalid ${id}:${value}`,
    eq(before.ledger, after.ledger) &&
      eq(before.matrix, after.matrix) &&
      after.status.includes("Not applied"),
  );
  await input(id, defaults[id]);
}
await submit();
for (const [id, value] of [
  ["fold", 0],
  ["event", 61],
  ["fold", ""],
  ["event", 1.5],
]) {
  await input(id, value);
  await change(id);
  let after = await snap();
  check(
    `inspector ${id}:${value}`,
    eq(before.ledger, after.ledger) &&
      eq(before.audit, after.audit) &&
      after.selection.includes("Invalid inspector"),
  );
}
await input("event", 37);
await change("event");
await input("seed", 999);
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 768,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await verify(defaults, 2, 36, "dirtyResize");
await input("event", 38);
await change("event");
await verify(defaults, 2, 37, "dirtyInspector");
await input("seed", 17);
await submit();
for (const width of [1440, 768, 390, 360, 320]) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  let layout = await evaluate(
    `(()=>{const boxes=[...document.querySelectorAll('input')].map(e=>e.getBoundingClientRect());const contain=[...document.querySelectorAll('.metric,.auditrow')].every(e=>e.scrollWidth<=e.clientWidth+1);return{width:innerWidth,scroll:document.documentElement.scrollWidth,inputs:boxes.map(b=>({left:b.left,right:b.right,height:b.height})),contain,matrix:document.querySelector('.matrixscroll').scrollWidth>document.querySelector('.matrixscroll').clientWidth,ledger:document.querySelector('.ledger').scrollHeight>document.querySelector('.ledger').clientHeight}})()`,
  );
  check(width + " page bounds", layout.scroll <= width);
  check(
    width + " input margins",
    layout.inputs.every((b) => b.left >= 17 && b.right <= width - 17),
  );
  check(
    width + " input heights",
    layout.inputs.every((b) => b.height >= 44),
  );
  check(width + " metric audit containment", layout.contain);
  check(width + " ledger scroll", layout.ledger);
  if (width <= 768) check(width + " matrix scroll", layout.matrix);
  await verify(defaults, 2, 37, "width" + width);
  if ([1440, 768, 360, 320].includes(width)) await shot("width" + width);
}
await evaluate(
  `document.querySelector('.matrixscroll').scrollLeft=10000;document.querySelector('.ledger').scrollLeft=10000;true`,
);
await shot("mobile-right");
check(
  "matrixLettersWhite",
  await evaluate(
    `getComputedStyle(document.querySelector("#matrix .matrixletter")).fill==="rgb(255, 255, 255)"`,
  ),
);
check(
  "noInlineStyles",
  await evaluate(`document.querySelectorAll("[style]").length===0`),
);
check("noExceptions", consoleErrors.length === 0, consoleErrors.join(";"));
check(
  "sameOriginOnly",
  requests.every(
    (r) =>
      r === "about:blank" ||
      r.startsWith(new URL(url).origin + "/") ||
      r.startsWith("data:"),
  ),
);
check(
  "noStorage",
  await evaluate(
    `localStorage.length===0&&sessionStorage.length===0&&document.cookie===''`,
  ),
);
check(
  "CSP",
  await evaluate(
    `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'")`,
  ),
);
writeFileSync(`${root}browser-checks.json`, JSON.stringify(checks, null, 2));
let failures = checks.filter((c) => !c.ok);
console.log(`${checks.length} Chrome checks, ${failures.length} failures`);
clearTimeout(timeout);
ws.close();
await cleanup(failures.length ? 1 : 0);

import { defaults, run } from "./model.js";
const $ = (id) => document.getElementById(id),
  NS = "http://www.w3.org/2000/svg";
const colors = {
    TEST: "#43567b",
    PURGED: "#925044",
    EMBARGO: "#68547d",
    TRAIN: "#2d6657",
  },
  letters = { TEST: "X", PURGED: "P", EMBARGO: "E", TRAIN: "T" };
let applied = { ...defaults },
  result = run(applied),
  fold = 2,
  event = 36;
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function svg(parent, tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent.append(e);
  return e;
}
function clear(e) {
  e.replaceChildren();
}
function text(parent, x, y, t, size = 12, extra = {}) {
  return svg(parent, "text", { x, y, "font-size": size, ...extra }, t);
}
function line(parent, x1, y1, x2, y2, color = "#b7c4c0", width = 1) {
  return svg(parent, "line", {
    x1,
    y1,
    x2,
    y2,
    stroke: color,
    "stroke-width": width,
  });
}
function metric(label, value, note) {
  let e = el("div", undefined, "metric");
  e.append(el("small", label), el("strong", value), el("p", note));
  $("metrics").append(e);
}
function table(id, heads, rows, selected) {
  const t = $(id),
    head = t.querySelector("thead"),
    body = t.querySelector("tbody");
  clear(head);
  clear(body);
  const tr = el("tr");
  for (const h of heads) {
    let e = el("th", h);
    e.scope = "col";
    tr.append(e);
  }
  head.append(tr);
  rows.forEach((values, i) => {
    const tr = el("tr", undefined, i === selected ? "selected" : "");
    for (const v of values) tr.append(el("td", v));
    body.append(tr);
  });
}
function matrix() {
  const m = $("matrix");
  clear(m);
  const height = 70 + result.splits.length * 44;
  m.setAttribute("viewBox", `0 0 1000 ${height}`);
  text(m, 0, 19, "FOLD / EVENT", 11);
  [1, 10, 20, 30, 40, 50, 60].forEach((i) =>
    text(m, 90 + (i - 0.5) * 15, 19, i, 11, { "text-anchor": "middle" }),
  );
  result.splits.forEach((s, f) => {
    const y = 35 + f * 44;
    text(m, 25, y + 22, `${f + 1}`, 13);
    for (const r of s.rows) {
      const x = 90 + r.index * 15;
      svg(m, "rect", {
        x,
        y,
        width: 14,
        height: 32,
        fill: colors[r.role],
        "data-fold": f,
        "data-event": r.index,
        "data-role": r.role,
      });
      text(m, x + 7, y + 21, letters[r.role], 9, {
        "text-anchor": "middle",
        class: "matrixletter",
      });
    }
    if (f === fold)
      svg(m, "rect", {
        x: 87,
        y: y - 3,
        width: 906,
        height: 38,
        fill: "none",
        stroke: "#213638",
        "stroke-width": 2,
      });
  });
  line(
    m,
    90 + (event + 0.5) * 15,
    30,
    90 + (event + 0.5) * 15,
    height - 5,
    "#213638",
    2,
  );
}
function timeline(s, r) {
  const t = $("timeline");
  clear(t);
  const mobile = innerWidth <= 520,
    W = mobile ? Math.max(280, t.parentElement.clientWidth) : 1000,
    left = mobile ? 12 : 150,
    span = mobile ? W - 24 : 820;
  t.setAttribute("viewBox", `0 0 ${W} 370`);
  const max = Math.max(...result.events.map((e) => e.end), s.embargoEnd) + 2,
    x = (v) => left + (v / max) * span;
  for (let k = 0; k <= 4; k++) {
    let tick = Math.round((max * k) / 4);
    line(t, x(tick), 40, x(tick), 315, "#d0d8d2");
    text(t, x(tick), 343, tick, 13, { "text-anchor": "middle" });
  }
  text(t, left, 366, "INVENTED TIME / TICKS", 11);
  const names = ["Test-label union", "Selected label", "Post-test embargo"];
  [80, 165, 250].forEach((y, i) => {
    text(
      t,
      0,
      mobile ? y - 25 : y + 5,
      mobile && i === 1
        ? `Event ${event + 1}: [${r.start}, ${r.end})`
        : names[i],
      13,
    );
    line(t, left, y, left + span, y);
  });
  for (const u of s.union)
    svg(t, "rect", {
      x: x(u.start),
      y: 65,
      width: x(u.end) - x(u.start),
      height: 30,
      fill: colors.TEST,
      "data-start": u.start,
      "data-end": u.end,
    });
  svg(t, "rect", {
    x: x(r.start),
    y: 150,
    width: x(r.end) - x(r.start),
    height: 30,
    fill: colors[r.role],
    id: "selected-interval",
  });
  if (applied.embargo > 0)
    svg(t, "rect", {
      x: x(s.boundary),
      y: 235,
      width: x(s.embargoEnd) - x(s.boundary),
      height: 30,
      fill: colors.EMBARGO,
      id: "embargo-interval",
    });
  else text(t, mobile ? 12 : 170, 280, "Zero duration: no embargo", 12);
  if (!mobile)
    text(
      t,
      150,
      30,
      `Selected event ${event + 1}: [${r.start}, ${r.end}) · test latest end B=${s.boundary}`,
      14,
    );
  text(
    t,
    mobile ? 0 : 150,
    302,
    `Embargo start window [${s.boundary}, ${s.embargoEnd})`,
    13,
  );
}
function render() {
  const s = result.splits[fold],
    r = s.rows[event];
  $("fold").max = String(applied.folds);
  $("fold").value = String(fold + 1);
  $("event").value = String(event + 1);
  clear($("metrics"));
  metric(
    "Ordinary candidate rows",
    s.candidates,
    "All non-test events in selected fold",
  );
  metric(
    "Overlapping candidates",
    s.purged,
    `${s.pairs} intersecting candidate/test pairs`,
  );
  metric(
    "Extra embargo removals",
    s.embargoed,
    `Starts in [${s.boundary}, ${s.embargoEnd}), after purging`,
  );
  metric(
    "Retained training rows",
    s.train,
    `${s.past} past / ${s.future} future. Not walk-forward.`,
  );
  $("status").textContent =
    `APPLIED / ${applied.folds} folds · max horizon ${applied.horizon} ticks · embargo ${applied.embargo} ticks · seed ${applied.seed}`;
  let reason =
    r.role === "TEST"
      ? "Held out by fold position; not a training candidate."
      : r.role === "PURGED"
        ? `Its label intersects ${r.conflicts} test label${r.conflicts === 1 ? "" : "s"}; first conflict is event ${r.firstConflict + 1}.`
        : r.role === "EMBARGO"
          ? "No label overlap, but its start is inside the post-test embargo."
          : "No label overlap and no start inside the embargo. Retained is not a guarantee of independence.";
  $("selection").textContent =
    `Fold ${fold + 1}, event ${event + 1}: ${r.role}. ${reason}`;
  clear($("audit"));
  for (const [k, v] of [
    ["Test event block", `${s.from + 1} to ${s.to}`],
    ["Selected label", `[${r.start}, ${r.end})`],
    ["Label length / ticks", r.end - r.start],
    ["Membership", r.role],
    ["Conflicting test labels", r.conflicts],
    ["First conflict / event", r.firstConflict < 0 ? "-" : r.firstConflict + 1],
    ["Pair-ticks / summed", r.overlapTicks],
    ["Latest test label end", s.boundary],
    ["Embargo end / exclusive", s.embargoEnd],
    ["Start in embargo?", r.inEmbargo ? "Yes" : "No"],
    ["Merged test intervals", s.union.length],
  ]) {
    let e = el("div", undefined, "auditrow");
    e.append(el("span", k), el("code", v));
    $("audit").append(e);
  }
  matrix();
  timeline(s, r);
  table(
    "foldtable",
    [
      "Fold",
      "Test",
      "Candidates",
      "Purged",
      "Embargo",
      "Retained",
      "Past",
      "Future",
      "Overlap pairs",
      "Pair-ticks",
    ],
    result.splits.map((s, f) => [
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
    ]),
    fold,
  );
  table(
    "ledger",
    [
      "Event",
      "Start",
      "End",
      "Membership",
      "Conflicts",
      "First conflict",
      "Pair-ticks",
      "Start in embargo",
    ],
    s.rows.map((r) => [
      r.index + 1,
      r.start,
      r.end,
      r.role,
      r.conflicts,
      r.firstConflict < 0 ? "-" : r.firstConflict + 1,
      r.overlapTicks,
      r.inEmbargo ? "Yes" : "No",
    ]),
    event,
  );
}
$("controls").addEventListener("submit", (e) => {
  e.preventDefault();
  const p = {};
  for (const k of Object.keys(defaults)) {
    const value = $(k).value.trim();
    if (!value) {
      $("status").textContent =
        "Not applied: enter all four integer controls. Previous split retained.";
      return;
    }
    p[k] = Number(value);
  }
  try {
    const next = run(p);
    applied = p;
    result = next;
    fold = Math.min(fold, p.folds - 1);
    render();
  } catch {
    $("status").textContent =
      "Not applied: use integers within the labelled bounds. Previous split retained.";
  }
});
for (const [id, key, max] of [
  ["fold", "fold", () => applied.folds],
  ["event", "event", () => 60],
])
  $(id).addEventListener("change", () => {
    const raw = $(id).value.trim(),
      v = Number(raw);
    if (!raw || !Number.isInteger(v) || v < 1 || v > max()) {
      $("selection").textContent =
        "Invalid inspector: previous fold and event retained.";
      $(id).value = String((key === "fold" ? fold : event) + 1);
      return;
    }
    if (key === "fold") fold = v - 1;
    else event = v - 1;
    render();
  });
addEventListener("resize", () =>
  timeline(result.splits[fold], result.splits[fold].rows[event]),
);
render();

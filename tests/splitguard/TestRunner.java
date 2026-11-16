package splitguard;

import java.util.*;

public final class TestRunner {
  static int count;

  static void ok(boolean b) {
    count++;
    if (!b) throw new AssertionError("Check " + count);
  }

  static void bad(Runnable f) {
    try {
      f.run();
      throw new AssertionError("Expected refusal");
    } catch (IllegalArgumentException e) {
      count++;
    }
  }

  public static void main(String[] args) {
    var a =
        new Engine.Event[] {
          new Engine.Event(0, 5),
          new Engine.Event(2, 3),
          new Engine.Event(4, 7),
          new Engine.Event(6, 8),
          new Engine.Event(8, 10),
          new Engine.Event(10, 12)
        };
    var s = Engine.split(a, 2, 4, 2);
    String[] expected = {"PURGED", "TRAIN", "TEST", "TEST", "EMBARGO", "TRAIN"};
    for (int i = 0; i < a.length; i++) ok(s.rows()[i].role().equals(expected[i]));
    ok(
        s.pairs() == 1
            && s.overlapTicks() == 1
            && s.past() == 1
            && s.future() == 1
            && s.train() == 2
            && s.boundary() == 8
            && s.embargoEnd() == 10);
    ok(s.rows()[0].firstConflict() == 2 && s.rows()[0].conflicts() == 1);
    ok(s.union().length == 1 && s.union()[0].start() == 4 && s.union()[0].end() == 8);
    ok(!Engine.overlaps(new Engine.Event(0, 4), new Engine.Event(4, 8)));
    ok(Engine.overlaps(new Engine.Event(0, 5), new Engine.Event(4, 8)));
    var m =
        new Engine.Event[] {
          new Engine.Event(0, 20),
          new Engine.Event(2, 3),
          new Engine.Event(4, 5),
          new Engine.Event(20, 21),
          new Engine.Event(22, 23)
        };
    s = Engine.split(m, 0, 3, 2);
    ok(
        s.boundary() == 20
            && s.rows()[3].role().equals("EMBARGO")
            && s.rows()[4].role().equals("TRAIN"));
    var gaps =
        new Engine.Event[] {
          new Engine.Event(0, 1),
          new Engine.Event(4, 5),
          new Engine.Event(8, 9),
          new Engine.Event(12, 13)
        };
    s = Engine.split(gaps, 1, 3, 0);
    ok(s.union().length == 2 && s.train() == 2);
    ok(!s.rows()[3].inEmbargo());
    var all =
        new Engine.Event[] {
          new Engine.Event(0, 100), new Engine.Event(1, 100), new Engine.Event(2, 100)
        };
    ok(Engine.split(all, 1, 2, 0).train() == 0);
    for (int seed : new int[] {1, 17, 101, 9999})
      for (int k = 3; k <= 8; k++)
        for (int h : new int[] {1, 2, 8, 12, 24})
          for (int emb : new int[] {0, 1, 4, 16}) {
            var p = new Engine.Params(k, h, emb, seed);
            var r = Engine.run(p);
            int[] seen = new int[60];
            int last = 0;
            for (int f = 0; f < k; f++) {
              var x = r.splits()[f];
              ok(x.from() == last);
              last = x.to();
              ok(x.to() > x.from());
              ok(x.train() + x.tests() + x.purged() + x.embargoed() == 60);
              ok(x.candidates() == 60 - x.tests());
              ok(x.past() + x.future() == x.train());
              int c = 0, t = 0;
              for (var row : x.rows()) {
                int i = row.index();
                ok(row.start() == r.events()[i].start() && row.end() == r.events()[i].end());
                if (row.role().equals("TEST")) {
                  seen[i]++;
                  ok(i >= x.from() && i < x.to());
                  ok(row.conflicts() == 0 && row.firstConflict() == -1);
                } else {
                  int hits = 0, ticks = 0, first = -1;
                  for (int j = x.from(); j < x.to(); j++) {
                    int lo = Math.max(r.events()[i].start(), r.events()[j].start()),
                        hi = Math.min(r.events()[i].end(), r.events()[j].end());
                    if (hi > lo) {
                      hits++;
                      ticks += hi - lo;
                      if (first < 0) first = j;
                    }
                  }
                  ok(
                      hits == row.conflicts()
                          && ticks == row.overlapTicks()
                          && first == row.firstConflict());
                  ok(row.role().equals("PURGED") == (hits > 0));
                  if (row.role().equals("TRAIN")) ok(hits == 0 && !row.inEmbargo());
                  if (row.role().equals("EMBARGO")) ok(hits == 0 && row.inEmbargo());
                  c += hits;
                  t += ticks;
                }
                ok(
                    row.inEmbargo()
                        == (emb > 0
                            && row.start() >= x.boundary()
                            && row.start() < x.embargoEnd()));
              }
              ok(c == x.pairs() && t == x.overlapTicks());
              var zero = Engine.split(r.events(), x.from(), x.to(), 0);
              ok(zero.purged() == x.purged() && zero.train() >= x.train());
              for (int i = 0; i < 60; i++)
                if (x.rows()[i].role().equals("TRAIN")) ok(zero.rows()[i].role().equals("TRAIN"));
            }
            ok(last == 60);
            for (int n : seen) ok(n == 1);
          }
    var large = new Engine.Event[256];
    for (int i = 0; i < 256; i++) large[i] = new Engine.Event(i, 1000000);
    var ls = Engine.split(large, 64, 192, 1000000);
    long exactTicks = 0;
    for (int i = 0; i < 256; i++)
      if (i < 64 || i >= 192) for (int j = 64; j < 192; j++) exactTicks += 1000000 - Math.max(i, j);
    ok(
        exactTicks > Integer.MAX_VALUE
            && ls.overlapTicks() == exactTicks
            && ls.pairs() == 16384
            && ls.train() == 0);
    var original = a.clone();
    Engine.split(a, 2, 4, 2);
    ok(Arrays.equals(a, original));
    bad(() -> Engine.checked(null));
    bad(() -> Engine.checked(new Engine.Event[1]));
    bad(() -> Engine.checked(new Engine.Event[] {null, null}));
    bad(() -> Engine.checked(new Engine.Event[] {new Engine.Event(1, 2), new Engine.Event(1, 3)}));
    bad(() -> Engine.checked(new Engine.Event[] {new Engine.Event(0, 0), new Engine.Event(1, 2)}));
    bad(() -> Engine.split(a, 0, a.length, 0));
    bad(() -> Engine.split(a, 3, 2, 0));
    bad(() -> Engine.split(a, 0, 1, -1));
    bad(() -> Engine.bounds(10, 11, 0));
    bad(() -> Engine.bounds(10, 3, 3));
    bad(() -> Engine.validate(new Engine.Params(9, 12, 4, 17)));
    bad(() -> Engine.generate(25, 1));
    bad(() -> Engine.generate(1, 0));
    for (int n = 2; n <= 256; n++)
      for (int k = 2; k <= Math.min(8, n); k++) {
        int end = 0, min = 1000, max = 0;
        for (int f = 0; f < k; f++) {
          int[] b = Engine.bounds(n, k, f);
          ok(b[0] == end && b[1] > b[0]);
          end = b[1];
          min = Math.min(min, b[1] - b[0]);
          max = Math.max(max, b[1] - b[0]);
        }
        ok(end == n && max - min <= 1);
      }
    System.out.println(count + " Java assertions passed");
  }
}

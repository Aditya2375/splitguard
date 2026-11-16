package splitguard;

import java.util.*;

public final class Engine {
  private Engine() {}

  public record Params(int folds, int horizon, int embargo, int seed) {}

  public record Event(int start, int end) {}

  public record Interval(int start, int end) {}

  public record Row(
      int index,
      int start,
      int end,
      String role,
      int conflicts,
      int overlapTicks,
      int firstConflict,
      boolean inEmbargo) {}

  public record Split(
      int from,
      int to,
      int boundary,
      int embargoEnd,
      Interval[] union,
      Row[] rows,
      int tests,
      int candidates,
      int purged,
      int embargoed,
      int train,
      int past,
      int future,
      int pairs,
      long overlapTicks) {}

  public record Result(Event[] events, Split[] splits) {}

  public static Params defaults() {
    return new Params(5, 12, 4, 17);
  }

  public static void validate(Params p) {
    if (p == null
        || p.folds < 3
        || p.folds > 8
        || p.horizon < 1
        || p.horizon > 24
        || p.embargo < 0
        || p.embargo > 16
        || p.seed < 1
        || p.seed > 9999) throw new IllegalArgumentException("Controls outside bounds");
  }

  public static Event[] generate(int horizon, int seed) {
    if (horizon < 1 || horizon > 24 || seed < 1 || seed > 9999)
      throw new IllegalArgumentException("Generator bounds");
    Event[] a = new Event[60];
    long s = seed;
    int t = 0;
    for (int i = 0; i < a.length; i++) {
      s = (1664525 * s + 1013904223) & 0xffffffffL;
      t += 1 + (int) (s % 3);
      s = (1664525 * s + 1013904223) & 0xffffffffL;
      a[i] = new Event(t, t + 1 + (int) (s % horizon));
    }
    return a;
  }

  public static Event[] checked(Event[] a) {
    if (a == null || a.length < 2 || a.length > 256)
      throw new IllegalArgumentException("2..256 events required");
    a = a.clone();
    int last = -1;
    for (Event e : a) {
      if (e == null || e.start < 0 || e.start <= last || e.end <= e.start || e.end > 1000000)
        throw new IllegalArgumentException("Strict starts and nonempty bounded intervals required");
      last = e.start;
    }
    return a;
  }

  public static int[] bounds(int n, int k, int f) {
    if (n < 2 || n > 256 || k < 2 || k > n || f < 0 || f >= k)
      throw new IllegalArgumentException("Fold bounds");
    int q = n / k, r = n % k, start = f * q + Math.min(f, r);
    return new int[] {start, start + q + (f < r ? 1 : 0)};
  }

  public static boolean overlaps(Event a, Event b) {
    return a.start < b.end && b.start < a.end;
  }

  public static Split split(Event[] input, int from, int to, int embargo) {
    Event[] a = checked(input);
    int n = a.length;
    if (from < 0 || to > n || to <= from || to - from == n || embargo < 0 || embargo > 1000000)
      throw new IllegalArgumentException("Split bounds");
    List<Interval> u = new ArrayList<>();
    int boundary = 0;
    for (int j = from; j < to; j++) {
      Event e = a[j];
      boundary = Math.max(boundary, e.end);
      if (!u.isEmpty() && e.start <= u.get(u.size() - 1).end) {
        Interval p = u.remove(u.size() - 1);
        u.add(new Interval(p.start, Math.max(p.end, e.end)));
      } else u.add(new Interval(e.start, e.end));
    }
    Row[] rows = new Row[n];
    int purged = 0, embargoed = 0, train = 0, past = 0, future = 0, pairs = 0;
    long ticks = 0;
    int end = boundary + embargo;
    for (int i = 0; i < n; i++) {
      Event e = a[i];
      boolean test = i >= from && i < to,
          inEmbargo = embargo > 0 && e.start >= boundary && e.start < end;
      int c = 0, t = 0, first = -1;
      String role;
      if (test) {
        role = "TEST";
      } else {
        // Union classification and pairwise audit are separate checks of the same geometry.
        boolean hit = false;
        for (Interval v : u)
          if (e.start < v.end && v.start < e.end) {
            hit = true;
            break;
          }
        for (int j = from; j < to; j++)
          if (overlaps(e, a[j])) {
            c++;
            t += Math.min(e.end, a[j].end) - Math.max(e.start, a[j].start);
            if (first < 0) first = j;
          }
        if (hit != (c > 0)) throw new IllegalStateException("Union mismatch");
        pairs += c;
        ticks += t;
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
      rows[i] = new Row(i, e.start, e.end, role, c, t, first, inEmbargo);
    }
    return new Split(
        from,
        to,
        boundary,
        end,
        u.toArray(Interval[]::new),
        rows,
        to - from,
        n - (to - from),
        purged,
        embargoed,
        train,
        past,
        future,
        pairs,
        ticks);
  }

  public static Result run(Params p) {
    validate(p);
    Event[] a = generate(p.horizon, p.seed);
    Split[] out = new Split[p.folds];
    for (int f = 0; f < p.folds; f++) {
      int[] b = bounds(a.length, p.folds, f);
      out[f] = split(a, b[0], b[1], p.embargo);
    }
    return new Result(a, out);
  }
}

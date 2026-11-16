import splitguard.Engine;

public final class Dump {
  static String row(Engine.Row r) {
    return "["
        + r.index()
        + ","
        + r.start()
        + ","
        + r.end()
        + ",\""
        + r.role()
        + "\","
        + r.conflicts()
        + ","
        + r.overlapTicks()
        + ","
        + r.firstConflict()
        + ","
        + r.inEmbargo()
        + "]";
  }

  public static void main(String[] args) {
    var r =
        Engine.run(
            new Engine.Params(
                Integer.parseInt(args[0]),
                Integer.parseInt(args[1]),
                Integer.parseInt(args[2]),
                Integer.parseInt(args[3])));
    StringBuilder b = new StringBuilder("{\"events\":[");
    for (int i = 0; i < r.events().length; i++) {
      if (i > 0) b.append(',');
      var e = r.events()[i];
      b.append("[").append(e.start()).append(',').append(e.end()).append(']');
    }
    b.append("],\"splits\":[");
    for (int f = 0; f < r.splits().length; f++) {
      if (f > 0) b.append(',');
      var s = r.splits()[f];
      b.append("{\"summary\":[")
          .append(s.from())
          .append(',')
          .append(s.to())
          .append(',')
          .append(s.boundary())
          .append(',')
          .append(s.embargoEnd())
          .append(',')
          .append(s.tests())
          .append(',')
          .append(s.candidates())
          .append(',')
          .append(s.purged())
          .append(',')
          .append(s.embargoed())
          .append(',')
          .append(s.train())
          .append(',')
          .append(s.past())
          .append(',')
          .append(s.future())
          .append(',')
          .append(s.pairs())
          .append(',')
          .append(s.overlapTicks())
          .append("],\"union\":[");
      for (int i = 0; i < s.union().length; i++) {
        if (i > 0) b.append(',');
        var u = s.union()[i];
        b.append('[').append(u.start()).append(',').append(u.end()).append(']');
      }
      b.append("],\"rows\":[");
      for (int i = 0; i < s.rows().length; i++) {
        if (i > 0) b.append(',');
        b.append(row(s.rows()[i]));
      }
      b.append("]}");
    }
    System.out.println(b.append("]}"));
  }
}

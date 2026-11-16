import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync("docs/src", { recursive: true });
for (const n of ["index.html", "styles.css", "src/app.js", "src/model.js"])
  copyFileSync(`web/${n}`, `docs/${n}`);

// Copies the committed fixture DB into place so the DemoSite boots straight into the seeded
// backoffice content instead of running a fresh unattended install. Used both locally (via
// `npm run restore-seed-db`) and in CI (.github/workflows/ci.yml's `e2e` job) - see
// tests/e2e/README.md for the full explanation and regeneration steps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const SOURCE = path.join(__dirname, "../fixtures/seed.Umbraco.sqlite.db");
const DEST_DIR = path.join(repoRoot, "src/Umbraco.Community.TipTopTipTap.DemoSite/umbraco/Data");
const DEST = path.join(DEST_DIR, "Umbraco.sqlite.db");

fs.mkdirSync(DEST_DIR, { recursive: true });

// Remove any stale WAL/SHM files and a previous db so Umbraco doesn't try to reconcile the
// journal of a different database against the freshly-restored fixture.
for (const suffix of ["", "-wal", "-shm"]) {
  const p = DEST + suffix;
  if (fs.existsSync(p)) fs.rmSync(p);
}

fs.copyFileSync(SOURCE, DEST);
console.log(`Restored seed database to ${DEST}`);

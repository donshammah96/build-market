import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const STATUTORY_AUTHORITIES = [
  "nca",
  "epra",
  "boraqs",
  "ebk",
  "earb",
  "vrb",
  "isk",
];

const REQUIRED_FIXTURES = [
  "exact_match.json",
  "not_found.json",
  "suspended.json",
  "malformed.json",
];

let errorsFound = 0;

console.log("🔍 Checking Regulator Verification Contract & Test Coverage Drift...\n");

for (const authority of STATUTORY_AUTHORITIES) {
  const adapterDir = path.join(
    projectRoot,
    "app",
    "lib",
    "domains",
    "regulator-verification",
    "adapters",
    authority,
  );

  const contractPath = path.join(adapterDir, "contract.ts");
  const pathBuilderPath = path.join(adapterDir, "path.ts");
  const testPath = path.join(adapterDir, `${authority}.contract.test.ts`);
  const fixturesDir = path.join(adapterDir, "fixtures");

  if (!fs.existsSync(contractPath)) {
    console.error(`❌ [${authority.toUpperCase()}] Missing contract file: ${contractPath}`);
    errorsFound++;
  }

  if (!fs.existsSync(pathBuilderPath)) {
    console.error(`❌ [${authority.toUpperCase()}] Missing path builder file: ${pathBuilderPath}`);
    errorsFound++;
  }

  if (!fs.existsSync(testPath)) {
    console.error(`❌ [${authority.toUpperCase()}] Missing contract test file: ${testPath}`);
    errorsFound++;
  }

  if (!fs.existsSync(fixturesDir)) {
    console.error(`❌ [${authority.toUpperCase()}] Missing fixtures directory: ${fixturesDir}`);
    errorsFound++;
  } else {
    for (const fixture of REQUIRED_FIXTURES) {
      const fixturePath = path.join(fixturesDir, fixture);
      if (!fs.existsSync(fixturePath)) {
        console.error(
          `❌ [${authority.toUpperCase()}] Missing required fixture: ${fixturePath}`,
        );
        errorsFound++;
      }
    }
  }
}

if (errorsFound > 0) {
  console.error(`\n💥 Regulator contract drift check failed with ${errorsFound} error(s).`);
  process.exit(1);
} else {
  console.log("✅ All 7 statutory regulator contracts, path builders, fixtures, and test suites are verified.");
  process.exit(0);
}

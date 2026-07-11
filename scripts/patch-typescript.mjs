import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const rootDir = path.resolve(__dirname, "..");

  // Resolve paths in the workspace node_modules
  const tsDir = path.dirname(
    path.resolve(rootDir, "node_modules", "typescript", "package.json"),
  );
  const ts6Dir = path.dirname(
    path.resolve(
      rootDir,
      "node_modules",
      "@typescript",
      "typescript6",
      "package.json",
    ),
  );

  // Check if directories exist (they might not during bootstrap/clean state)
  if (!fs.existsSync(tsDir)) {
    console.warn(
      "typescript package not found in node_modules, skipping patch.",
    );
    process.exit(0);
  }
  if (!fs.existsSync(ts6Dir)) {
    console.warn(
      "@typescript/typescript6 package not found in node_modules, skipping patch.",
    );
    process.exit(0);
  }

  const libDir = path.join(tsDir, "lib");
  fs.mkdirSync(libDir, { recursive: true });

  const dummyFile = path.join(libDir, "typescript.js");
  const versionFile = path.join(libDir, "version.cjs");

  // Compute portable relative path from typescript/lib to @typescript/typescript6/lib/typescript.js
  const ts6RelativePath = path
    .relative(libDir, path.join(ts6Dir, "lib", "typescript.js"))
    .replace(/\\/g, "/");

  fs.writeFileSync(
    dummyFile,
    `module.exports = require("${ts6RelativePath}");\n`,
  );
  fs.writeFileSync(
    versionFile,
    `const ts6 = require("${ts6RelativePath}");\nmodule.exports = ts6;\n`,
  );

  console.log("Successfully patched typescript (v7.0.2) with TS6 bridge.");
} catch (e) {
  console.error("Failed to patch typescript:", e);
}

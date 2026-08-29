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

  // Update typescript's package.json to be CommonJS for standard compiler require compatibility
  const pkgJsonPath = path.join(tsDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    let pkg = {};
    try {
      const rawContent = fs.readFileSync(pkgJsonPath, "utf8").replace(/\0/g, "").trim();
      if (rawContent) {
        pkg = JSON.parse(rawContent);
      }
    } catch (e) {
      console.warn("Failed to parse existing package.json, re-creating clean manifest:", e.message);
    }
    delete pkg.type;
    pkg.name = pkg.name || "typescript";
    pkg.version = pkg.version || "7.0.2";
    pkg.main = "./lib/typescript.js";
    pkg.exports = {
      ".": "./lib/typescript.js",
      "./package.json": "./package.json",
    };
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
  }

  const libDir = path.join(tsDir, "lib");
  fs.mkdirSync(libDir, { recursive: true });

  const dummyFile = path.join(libDir, "typescript.js");
  const versionFile = path.join(libDir, "version.cjs");
  const tscFile = path.join(libDir, "tsc.js");

  const ts6Path = path.join(ts6Dir, "lib", "typescript.js").replace(/\\/g, "/");
  const ts6TscPath = path.join(ts6Dir, "lib", "tsc.js").replace(/\\/g, "/");

  fs.writeFileSync(
    dummyFile,
    `module.exports = require("${ts6Path}");\n`,
  );
  fs.writeFileSync(
    versionFile,
    `module.exports = require("${ts6Path}");\n`,
  );
  fs.writeFileSync(
    tscFile,
    `module.exports = require("${ts6TscPath}");\n`,
  );

  console.log("Successfully patched typescript (v7.0.2) with TS6 bridge.");
} catch (e) {
  console.error("Failed to patch typescript:", e);
}

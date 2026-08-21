import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function patchFile(filePath, searchStr, replaceStr) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes(replaceStr)) return true;
  if (!content.includes(searchStr)) return false;
  fs.writeFileSync(filePath, content.replace(searchStr, replaceStr));
  return true;
}

try {
  // 1. Find all bundle-server.js in node_modules
  const findFiles = (dir, pattern, results = []) => {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".git" && entry.name !== ".next" && entry.name !== ".open-next") {
          findFiles(fullPath, pattern, results);
        }
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  };

  const bundleServerFiles = findFiles(rootDir, /^bundle-server\.js$/);
  for (const file of bundleServerFiles) {
    if (file.includes("@opennextjs")) {
      const content = fs.readFileSync(file, "utf8");
      if (!content.includes("stub-sharp-plugin")) {
        const target = "plugins: [";
        const replacement = `plugins: [
            {
                name: "stub-sharp-plugin",
                setup(build) {
                    build.onResolve({ filter: /(^sharp($|\\/)|^@img\\/sharp)/ }, () => ({
                        path: "sharp-stub",
                        namespace: "sharp-stub-ns",
                    }));
                    build.onLoad({ filter: /.*/, namespace: "sharp-stub-ns" }, () => ({
                        contents: "function sharpStub(){throw new Error('Sharp is not supported in Cloudflare Workers isolate.');}module.exports=sharpStub;module.exports.default=sharpStub;",
                        loader: "js",
                    }));
                },
            },`;
        if (content.includes(target)) {
          fs.writeFileSync(file, content.replace(target, replacement));
          console.log(`[patch-opennext] Successfully patched ${file}`);
        }
      }
    }
  }

  const helperFiles = findFiles(rootDir, /^helper\.js$/);
  for (const file of helperFiles) {
    if (file.includes("@opennextjs") && file.includes("build")) {
      const content = fs.readFileSync(file, "utf8");
      if (!content.includes(".node\": \"empty")) {
        const target = "sourcesContent: false,";
        const replacement = `sourcesContent: false,
        loader: {
            ".node": "empty",
        },`;
        if (content.includes(target)) {
          fs.writeFileSync(file, content.replaceAll(target, replacement));
          console.log(`[patch-opennext] Successfully patched ${file}`);
        }
      }
    }
  }
} catch (err) {
  console.warn("[patch-opennext] Warning while applying patches:", err.message);
}

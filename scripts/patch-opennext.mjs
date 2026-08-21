import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

try {
  // Search candidate directories for @opennextjs packages
  const candidateDirs = [
    path.join(rootDir, "node_modules", ".pnpm"),
    path.join(rootDir, "node_modules", "@opennextjs"),
    path.join(rootDir, "apps", "client", "node_modules"),
  ].filter((d) => fs.existsSync(d));

  const findFiles = (dir, pattern, results = []) => {
    if (!fs.existsSync(dir)) return results;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Only traverse into opennextjs directories in .pnpm
          if (dir.endsWith(".pnpm") && !entry.name.startsWith("@opennextjs")) {
            continue;
          }
          findFiles(fullPath, pattern, results);
        } else if (pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch {
      // ignore access errors
    }
    return results;
  };

  const bundleServerFiles = [];
  const helperFiles = [];
  for (const cDir of candidateDirs) {
    findFiles(cDir, /^bundle-server\.js$/, bundleServerFiles);
    findFiles(cDir, /^helper\.js$/, helperFiles);
  }
  for (const file of bundleServerFiles) {
    if (file.includes("@opennextjs")) {
      let content = fs.readFileSync(file, "utf8");
      const stubPluginCode = `            {
                name: "stub-native-and-cf-plugin",
                setup(build) {
                    build.onResolve({ filter: /(sharp|\\.node$|pg-cloudflare)/ }, () => ({
                        path: "stub-native-and-cf",
                        namespace: "stub-native-ns",
                    }));
                    build.onLoad({ filter: /.*/, namespace: "stub-native-ns" }, () => ({
                        contents: "function stubFn(){return {};}module.exports=stubFn;module.exports.default=stubFn;module.exports.CloudflareSocket=class{};",
                        loader: "js",
                    }));
                },
            },`;

      if (content.includes("stub-sharp-plugin") || content.includes("stub-native-and-cf-plugin")) {
        // Replace existing stub plugin with updated version
        content = content.replace(/\{\s*name:\s*"(?:stub-sharp-plugin|stub-native-and-cf-plugin)"[\s\S]*?namespace:\s*"(?:sharp-stub-ns|stub-native-ns)"\s*\}\s*\);\s*\}\s*\},/, stubPluginCode.trim());
        fs.writeFileSync(file, content);
        console.log(`[patch-opennext] Successfully updated patch in ${file}`);
      } else if (content.includes("plugins: [")) {
        content = content.replace("plugins: [", `plugins: [\n${stubPluginCode}`);
        fs.writeFileSync(file, content);
        console.log(`[patch-opennext] Successfully patched ${file}`);
      }

      if (content.includes("minifyWhitespace: projectOpts.minify && !debug")) {
        content = content.replace("minifyWhitespace: projectOpts.minify && !debug", "minifyWhitespace: !debug");
        content = content.replace("minifySyntax: projectOpts.minify && !debug", "minifySyntax: !debug");
        fs.writeFileSync(file, content);
        console.log(`[patch-opennext] Enforced production minification in ${file}`);
      }
    }
  }

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

import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const instructionsRoot = path.join(repoRoot, ".github", "instructions");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".instructions.md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return { hasFrontmatter: false, hasDescription: false, hasApplyTo: false };
  }

  const frontmatter = frontmatterMatch[1];
  const hasDescription = /^\s*description\s*:\s*.+$/m.test(frontmatter);
  const hasApplyTo = /^\s*applyTo\s*:\s*.+$/m.test(frontmatter);

  return { hasFrontmatter: true, hasDescription, hasApplyTo };
}

async function main() {
  const instructionFiles = await walk(instructionsRoot);
  const failures = [];

  for (const filePath of instructionFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const { hasFrontmatter, hasDescription, hasApplyTo } =
      parseFrontmatter(content);

    if (!hasFrontmatter || !hasDescription || !hasApplyTo) {
      failures.push({
        filePath,
        hasFrontmatter,
        hasDescription,
        hasApplyTo,
      });
    }
  }

  if (failures.length > 0) {
    console.error(
      "Instruction frontmatter check failed. Each .instructions.md file must include description and applyTo.",
    );

    for (const failure of failures) {
      const relativePath = path
        .relative(repoRoot, failure.filePath)
        .replaceAll("\\", "/");
      console.error(
        `- ${relativePath}: frontmatter=${failure.hasFrontmatter}, description=${failure.hasDescription}, applyTo=${failure.hasApplyTo}`,
      );
    }

    process.exit(1);
  }

  console.log(
    `Instruction frontmatter check passed for ${instructionFiles.length} files.`,
  );
}

main().catch((error) => {
  console.error("Unexpected error while checking instruction frontmatter.");
  console.error(error);
  process.exit(1);
});

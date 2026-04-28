import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const repoRoot = process.cwd();
const instructionsRoot = path.join(repoRoot, ".github", "instructions");
const canonicalPath = ".github/copilot-instructions.md";
const force = process.argv.includes("--force");

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

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

function hasCanonicalChanges() {
  try {
    const unstaged = execSync(`git diff --name-only -- ${canonicalPath}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const staged = execSync(
      `git diff --name-only --cached -- ${canonicalPath}`,
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    return Boolean(unstaged || staged);
  } catch {
    return false;
  }
}

function updateAlignmentStamp(content, stampLine) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const hasTrailingNewline = content.endsWith(newline);
  const lines = content.split(/\r?\n/);

  // Remove empty trailing split element if file ended with newline.
  if (hasTrailingNewline && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const stampRegex = /^Last aligned with canonical on:\s*\d{4}-\d{2}-\d{2}\.$/;
  const existingIdx = lines.findIndex((line) => stampRegex.test(line.trim()));

  if (existingIdx >= 0) {
    if (lines[existingIdx] === stampLine) {
      return { changed: false, content };
    }

    lines[existingIdx] = stampLine;
    const nextContent = lines.join(newline) + newline;
    return { changed: true, content: nextContent };
  }

  const headingIdx = lines.findIndex((line) => /^#\s+/.test(line));
  if (headingIdx >= 0) {
    const insertAt = headingIdx + 1;
    const insertLines = [stampLine];

    if (lines[insertAt] !== "") {
      insertLines.push("");
    }

    lines.splice(insertAt, 0, ...insertLines);
    const nextContent = lines.join(newline) + newline;
    return { changed: true, content: nextContent };
  }

  // Fallback: insert after frontmatter when no heading is present.
  const firstDelim = lines.findIndex((line) => line.trim() === "---");
  if (firstDelim === 0) {
    const secondDelimRel = lines
      .slice(firstDelim + 1)
      .findIndex((line) => line.trim() === "---");

    if (secondDelimRel >= 0) {
      const secondDelim = firstDelim + 1 + secondDelimRel;
      const afterFrontmatter = secondDelim + 1;

      if (lines[afterFrontmatter] === "") {
        lines.splice(afterFrontmatter + 1, 0, stampLine, "");
      } else {
        lines.splice(afterFrontmatter, 0, "", stampLine, "");
      }

      const nextContent = lines.join(newline) + newline;
      return { changed: true, content: nextContent };
    }
  }

  return { changed: false, content };
}

async function main() {
  const shouldRun = force || hasCanonicalChanges();

  if (!shouldRun) {
    console.log(
      "Canonical policy unchanged; skipping instruction alignment stamp sync.",
    );
    return;
  }

  const stampLine = `Last aligned with canonical on: ${getTodayDateString()}.`;
  const instructionFiles = await walk(instructionsRoot);
  const updatedFiles = [];

  for (const filePath of instructionFiles) {
    const original = await fs.readFile(filePath, "utf8");
    const { changed, content: next } = updateAlignmentStamp(
      original,
      stampLine,
    );

    if (!changed) {
      continue;
    }

    await fs.writeFile(filePath, next, "utf8");
    updatedFiles.push(path.relative(repoRoot, filePath).replaceAll("\\", "/"));
  }

  if (updatedFiles.length === 0) {
    console.log("Instruction alignment stamp already up to date.");
    return;
  }

  console.log(
    `Updated alignment stamp in ${updatedFiles.length} instruction files to ${stampLine}`,
  );
  for (const file of updatedFiles) {
    console.log(`- ${file}`);
  }
}

main().catch((error) => {
  console.error("Failed to sync instruction alignment stamp.");
  console.error(error);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const APP_ROOT = process.cwd();
const PUBLIC_DIR = path.join(APP_ROOT, "public");

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MIN_OPTIMIZE_BYTES = Number.parseInt(
  process.env.IMAGE_OPTIMIZE_MIN_BYTES ?? `${8 * 1024 * 1024}`,
  10,
);
const HARD_LIMIT_BYTES = Number.parseInt(
  process.env.WORKERS_MAX_ASSET_BYTES ?? `${25 * 1024 * 1024}`,
  10,
);
const PRIMARY_MAX_WIDTH = Number.parseInt(
  process.env.IMAGE_OPTIMIZE_MAX_WIDTH ?? "2400",
  10,
);
const FALLBACK_MAX_WIDTH = Number.parseInt(
  process.env.IMAGE_OPTIMIZE_FALLBACK_WIDTH ?? "1800",
  10,
);

const ATTEMPTS = [
  { maxWidth: PRIMARY_MAX_WIDTH, quality: 82 },
  { maxWidth: PRIMARY_MAX_WIDTH, quality: 74 },
  { maxWidth: FALLBACK_MAX_WIDTH, quality: 70 },
  { maxWidth: Math.min(FALLBACK_MAX_WIDTH, 1400), quality: 64 },
];

function toMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function walkFiles(dirPath, acc) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        acc.push(fullPath);
      }
    }
  }
}

async function renderCandidate(filePath, ext, maxWidth, quality) {
  const metadata = await sharp(filePath).metadata();
  let pipeline = sharp(filePath, { limitInputPixels: false }).rotate();

  if (typeof metadata.width === "number" && metadata.width > maxWidth) {
    pipeline = pipeline.resize({
      width: maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (ext === ".png") {
    pipeline = pipeline.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
      quality,
      effort: 10,
    });
  } else if (ext === ".jpg" || ext === ".jpeg") {
    pipeline = pipeline.jpeg({
      quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: "4:2:0",
    });
  } else {
    pipeline = pipeline.webp({
      quality,
      effort: 6,
    });
  }

  const buffer = await pipeline.toBuffer();
  return {
    buffer,
    width: metadata.width,
    height: metadata.height,
  };
}

async function optimizeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const current = fs.statSync(filePath).size;

  if (current <= MIN_OPTIMIZE_BYTES) {
    return {
      optimized: false,
      reason: "below-threshold",
      before: current,
      after: current,
    };
  }

  let best = null;

  for (const attempt of ATTEMPTS) {
    const candidate = await renderCandidate(
      filePath,
      ext,
      attempt.maxWidth,
      attempt.quality,
    );

    if (!best || candidate.buffer.length < best.buffer.length) {
      best = {
        ...candidate,
        maxWidth: attempt.maxWidth,
        quality: attempt.quality,
      };
    }

    if (candidate.buffer.length <= HARD_LIMIT_BYTES) {
      best = {
        ...candidate,
        maxWidth: attempt.maxWidth,
        quality: attempt.quality,
      };
      break;
    }
  }

  if (!best) {
    return {
      optimized: false,
      reason: "no-candidate",
      before: current,
      after: current,
    };
  }

  if (best.buffer.length >= current) {
    return {
      optimized: false,
      reason: "not-smaller",
      before: current,
      after: current,
    };
  }

  fs.writeFileSync(filePath, best.buffer);

  return {
    optimized: true,
    reason: "optimized",
    before: current,
    after: best.buffer.length,
    maxWidth: best.maxWidth,
    quality: best.quality,
    sourceWidth: best.width,
    sourceHeight: best.height,
  };
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error("[optimize-public-images] Missing public directory.");
    process.exit(1);
  }

  sharp.cache(false);

  const files = [];
  walkFiles(PUBLIC_DIR, files);
  files.sort();

  let touched = 0;
  const unresolved = [];
  const failed = [];

  console.log(
    `[optimize-public-images] Found ${files.length} candidate files in public/.`,
  );

  for (const filePath of files) {
    const relativePath = path.relative(APP_ROOT, filePath).replace(/\\/g, "/");
    let result;
    try {
      result = await optimizeFile(filePath);
    } catch (error) {
      const before = fs.statSync(filePath).size;
      failed.push({
        relativePath,
        before,
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(
        `[optimize-public-images] failed ${relativePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (before > HARD_LIMIT_BYTES) {
        unresolved.push({
          relativePath,
          before,
          after: before,
        });
      }
      continue;
    }

    if (result.optimized) {
      touched += 1;
      console.log(
        `[optimize-public-images] optimized ${relativePath}: ${toMiB(result.before)} MiB -> ${toMiB(result.after)} MiB (maxWidth=${result.maxWidth}, quality=${result.quality})`,
      );
    }

    if (result.after > HARD_LIMIT_BYTES) {
      unresolved.push({
        relativePath,
        before: result.before,
        after: result.after,
      });
    }
  }

  console.log(
    `[optimize-public-images] Completed. Optimized ${touched} files.`,
  );

  if (unresolved.length > 0) {
    console.error(
      `[optimize-public-images] ${unresolved.length} files still exceed ${toMiB(HARD_LIMIT_BYTES)} MiB after optimization.`,
    );
    for (const item of unresolved) {
      console.error(
        `  - ${item.relativePath}: ${toMiB(item.before)} MiB -> ${toMiB(item.after)} MiB`,
      );
    }
  }

  if (failed.length > 0) {
    console.error(
      `[optimize-public-images] ${failed.length} files could not be decoded or transformed.`,
    );
    for (const item of failed) {
      console.error(
        `  - ${item.relativePath}: ${toMiB(item.before)} MiB (${item.error})`,
      );
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[optimize-public-images] Unexpected failure.");
  console.error(error);
  process.exit(1);
});

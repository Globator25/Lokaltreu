import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const scanRootDefs = [
  { base: path.join(repoRoot, "work", "step14-admin-auth", "logs"), includeEvidence: false, literal: true },
];

const ignoreDirNames = new Set(["node_modules", "dist", ".next", "coverage"]);
const allowedExtensions = new Set([".log", ".txt", ".json", ".ndjson", ".csv"]);
const maxFileSize = 2 * 1024 * 1024; // 2 MB

const patternDefs = [
  { type: "email", source: "\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", flags: "gi" },
  { type: "iban", source: "\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b", flags: "g" },
  { type: "phone_plus", source: "\\B\\+\\d[\\d\\s().-]{7,}\\d\\b", flags: "g" },
  {
    type: "phone_labeled",
    source: "(?:tel|phone|telefon|mobile|handy)\\s*[:=]\\s*(\\+?\\d[\\d\\s().-]{7,}\\d)",
    flags: "gi",
  },
];

const evidenceDir = path.join(repoRoot, "work", "step14-admin-auth", "evidence");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function shouldIncludeEvidence() {
  return process.env.SCAN_EVIDENCE === "1";
}

async function collectTargetDirs(baseDir, options = { includeEvidence: false }) {
  const targets = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoreDirNames.has(entry.name)) {
          continue;
        }
        const dirPath = path.join(current, entry.name);
        const shouldAdd =
          entry.name === "logs" ||
          (options.includeEvidence && entry.name === "evidence");
        if (shouldAdd) {
          targets.push(dirPath);
        }
        await walk(dirPath);
      }
    }
  }

  if (await pathExists(baseDir)) {
    await walk(baseDir);
  }
  return targets;
}

async function gatherRoots() {
  const roots = [];
  const includeEvidence = shouldIncludeEvidence();
  const scanAllWork = process.env.SCAN_ALL_WORK_LOGS === "1";

  for (const def of scanRootDefs) {
    if (def.literal) {
      if (await pathExists(def.base)) {
        roots.push(def.base);
      }
      continue;
    }
    const dirs = await collectTargetDirs(def.base, {
      includeEvidence: includeEvidence && def.includeEvidence !== false,
    });
    roots.push(...dirs);
  }

  if (scanAllWork) {
    const extraDirs = await collectTargetDirs(path.join(repoRoot, "work"), { includeEvidence });
    roots.push(...extraDirs);
  }
  return roots;
}

function matchPatterns(line) {
  const matches = [];
  for (const def of patternDefs) {
    const regex = new RegExp(def.source, def.flags);
    let match;
    while ((match = regex.exec(line))) {
      matches.push({
        type: def.type,
        excerpt: constrainContext(line, match.index),
      });
    }
  }
  return matches;
}

function constrainContext(line, index) {
  const snippet = line.slice(Math.max(index - 40, 0), index + 80);
  return snippet.replace(/\s+/g, " ").slice(0, 120);
}

async function scanFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const lineMatches = matchPatterns(line);
    for (const match of lineMatches) {
      hits.push({
        file: filePath,
        line: i + 1,
        type: match.type,
        context: match.excerpt,
      });
    }
  }
  return hits;
}

async function scanDir(dirPath, stats) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirNames.has(entry.name)) continue;
      await scanDir(fullPath, stats);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExtensions.has(ext)) continue;
      const fileNameLower = entry.name.toLowerCase();
      if (
        !process.env.SCAN_TRANSCRIPTS &&
        (fileNameLower.startsWith("transcript-") || fullPath.toLowerCase().includes(path.sep + "transcript-"))
      ) {
        stats.skippedTranscripts.push(fullPath);
        continue;
      }
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }
      if (stat.size > maxFileSize) {
        stats.skippedTooLarge.push(fullPath);
        continue;
      }
      stats.scannedFiles.push(fullPath);
      const hits = await scanFile(fullPath);
      if (hits.length > 0) {
        for (const hit of hits) {
          stats.matches.push(hit);
          if (hit.type === "phone_plus") {
            stats.matchCounts.phone_plus += 1;
          } else if (hit.type === "phone_labeled") {
            stats.matchCounts.phone_labeled += 1;
          }
        }
      }
    }
  }
}

async function main() {
  const startTime = new Date();
  await ensureDir(evidenceDir);
  const roots = await gatherRoots();
  const stats = {
    scannedFiles: [],
    skippedTooLarge: [],
    skippedTranscripts: [],
    matches: [],
    matchCounts: {
      phone_plus: 0,
      phone_labeled: 0,
    },
  };

  for (const root of roots) {
    await scanDir(root, stats);
  }

  const reportLines = [
    `scan_time=${startTime.toISOString()}`,
    `repo_root=${repoRoot}`,
    `roots=${roots.length > 0 ? roots.join(";") : "<none>"}`,
    `files_scanned=${stats.scannedFiles.length}`,
    `skipped_too_large=${stats.skippedTooLarge.length}`,
    `skipped_transcripts=${stats.skippedTranscripts.length}`,
    `matches=${stats.matches.length}`,
    `matches_phone_plus=${stats.matchCounts.phone_plus}`,
    `matches_phone_labeled=${stats.matchCounts.phone_labeled}`,
  ];

  if (stats.skippedTooLarge.length > 0) {
    reportLines.push("skipped_files:");
    for (const file of stats.skippedTooLarge) {
      reportLines.push(`  - ${path.relative(repoRoot, file)}`);
    }
  }
  if (stats.skippedTranscripts.length > 0) {
    reportLines.push("skipped_transcripts_list:");
    for (const file of stats.skippedTranscripts) {
      reportLines.push(`  - ${path.relative(repoRoot, file)}`);
    }
  }

  if (stats.matches.length > 0) {
    reportLines.push("match_details:");
    for (const match of stats.matches) {
      reportLines.push(
        `  - file=${path.relative(repoRoot, match.file)} line=${match.line} type=${match.type} context="${match.context}"`
      );
    }
  }

  const timestamp = startTime.toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(evidenceDir, `scan-logs-no-pii-${timestamp}.txt`);
  await fs.writeFile(reportPath, reportLines.join("\n"), "utf8");

  console.log(`Scan completed. Evidence: ${path.relative(repoRoot, reportPath)}`);
  console.log(
    `Files scanned: ${stats.scannedFiles.length}, skipped: ${stats.skippedTooLarge.length}, matches: ${stats.matches.length}`,
  );

  if (stats.matches.length > 0) {
    process.exit(2);
  }
  process.exit(0);
}

main().catch(async (error) => {
  await ensureDir(evidenceDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(evidenceDir, `scan-logs-no-pii-${timestamp}-error.txt`);
  const message = `error=${error instanceof Error ? error.message : String(error)}`;
  await fs.writeFile(reportPath, message, "utf8");
  console.error(`Scan failed: ${message}`);
  process.exit(1);
});

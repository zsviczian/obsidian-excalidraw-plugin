import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const OUTPUT = "repository.zip";

const IGNORE_DIRS = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "dist",
  ".next",
  ".nuxt",
  ".cache",
  ".parcel-cache",
  ".turbo",
  ".idea",
  ".vscode",
  ".tools",
  "coverage",
  "build",
  "out",
  "output",
  "secrets",
  ".claude",
  "__MACOSX",
]);

const IGNORE_FILENAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "REPOSITORY_STRUCTURE.md",
  "REPOSITORY_CONTENTS.md",
  OUTPUT,
]);

const IGNORE_EXTENSIONS = [
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".ico",
  ".icns",
  ".avif",
  ".heic",
  ".heif",
  ".svgz",

  // PDF / ebook / office containers
  ".pdf",
  ".epub",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",

  // Audio
  ".mp3",
  ".wav",
  ".flac",
  ".aac",
  ".m4a",
  ".ogg",
  ".opus",
  ".wma",

  // Video
  ".mp4",
  ".mov",
  ".mkv",
  ".avi",
  ".webm",
  ".m4v",
  ".mpeg",
  ".mpg",

  // Fonts
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",

  // Archives / compressed files
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",

  // Native binaries / executables / compiled objects
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".com",
  ".app",
  ".msi",
  ".o",
  ".obj",
  ".a",
  ".lib",
  ".class",
  ".jar",
  ".war",
  ".wasm",
  ".node",

  // Binary databases / data formats
  ".db",
  ".sqlite",
  ".sqlite3",
  ".parquet",
  ".arrow",
  ".feather",
];

function isIgnoredExtension(filename) {
  const lower = filename.toLowerCase();
  return IGNORE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function looksBinary(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.length === 0) return false;

  if (buffer.includes(0)) return true;

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return true;
  }

  let suspiciousControls = 0;
  for (const byte of buffer) {
    const allowedControl = byte === 8 || byte === 9 || byte === 10 || byte === 12 || byte === 13;
    if ((byte < 32 && !allowedControl) || byte === 127) {
      suspiciousControls += 1;
    }
  }

  return suspiciousControls / buffer.length > 0.01;
}

function copyPreservingMetadata(source, destination) {
  mkdirSync(resolve(destination, ".."), { recursive: true });
  copyFileSync(source, destination);

  const stat = statSync(source);
  chmodSync(destination, stat.mode);
  utimesSync(destination, stat.atime, stat.mtime);
}

function collectFiles(root) {
  const files = [];
  const stats = {
    included: 0,
    skippedBinary: 0,
    skippedType: 0,
    skippedName: 0,
    skippedDir: 0,
    skippedOther: 0,
  };

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) {
          stats.skippedDir += 1;
          continue;
        }
        walk(fullPath);
        continue;
      }

      // Match the old `find . -type f` behavior: do not include symlinks,
      // sockets, devices, or other non-regular filesystem entries.
      if (!entry.isFile()) {
        stats.skippedOther += 1;
        continue;
      }

      if (IGNORE_FILENAMES.has(entry.name)) {
        stats.skippedName += 1;
        continue;
      }

      if (isIgnoredExtension(entry.name)) {
        stats.skippedType += 1;
        continue;
      }

      if (looksBinary(fullPath)) {
        stats.skippedBinary += 1;
        continue;
      }

      files.push(fullPath);
      stats.included += 1;
    }
  }

  walk(root);
  return { files, stats };
}

function createZipWithZipCommand(stageDir, outputPath) {
  const result = spawnSync("zip", ["-q", "-r", outputPath, "."], {
    cwd: stageDir,
    stdio: "inherit",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error("'zip' is required on macOS/Linux but was not found in PATH.");
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`zip exited with status ${result.status ?? "unknown"}.`);
  }
}

function createZipWithPowerShell(stageDir, outputPath) {
  const command = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem;",
    "[System.IO.Compression.ZipFile]::CreateFromDirectory(",
    "$env:REPO_EXPORT_STAGE,",
    "$env:REPO_EXPORT_OUTPUT,",
    "[System.IO.Compression.CompressionLevel]::Optimal,",
    "$false",
    ")",
  ].join(" ");

  const env = {
    ...process.env,
    REPO_EXPORT_STAGE: stageDir,
    REPO_EXPORT_OUTPUT: outputPath,
  };

  let lastError;
  for (const executable of ["powershell.exe", "pwsh.exe"]) {
    const result = spawnSync(
      executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      { env, stdio: "inherit" },
    );

    if (result.error?.code === "ENOENT") {
      lastError = result.error;
      continue;
    }
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${executable} exited with status ${result.status ?? "unknown"}.`);
    }
    return;
  }

  throw new Error(
    `PowerShell is required on Windows but was not found.${lastError ? ` ${lastError.message}` : ""}`,
  );
}

const root = process.cwd();
const outputPath = join(root, OUTPUT);
const stageDir = mkdtempSync(join(tmpdir(), "ea-repo-export-"));

try {
  const { files, stats } = collectFiles(root);

  if (files.length === 0) {
    console.log("No files matched the inclusion rules; no ZIP created.");
    process.exitCode = 0;
  } else {
    for (const source of files) {
      const relativePath = relative(root, source);
      const destination = join(stageDir, ...relativePath.split(sep));
      copyPreservingMetadata(source, destination);
    }

    rmSync(outputPath, { force: true });

    if (process.platform === "win32") {
      createZipWithPowerShell(stageDir, outputPath);
    } else {
      createZipWithZipCommand(stageDir, outputPath);
    }

    console.log(`Created ${basename(outputPath)}`);
    console.log(`Included files: ${stats.included}`);
    console.log(`Skipped ignored folders: ${stats.skippedDir}`);
    console.log(`Skipped because of ignored filenames: ${stats.skippedName}`);
    console.log(`Skipped because of ignored file types: ${stats.skippedType}`);
    console.log(`Skipped because binary content was detected: ${stats.skippedBinary}`);
    if (stats.skippedOther > 0) {
      console.log(`Skipped non-regular filesystem entries: ${stats.skippedOther}`);
    }
  }
} finally {
  if (existsSync(stageDir)) {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

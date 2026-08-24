#!/usr/bin/env bash
# generate-repository-zip.sh
#
# Run from the root of a repository:
#
#   bash generate-repository-zip.sh
#
# Generates:
#   ./repository.zip
#
# The ZIP preserves the repository-relative directory structure while excluding:
# - node_modules, dist, and other ignored folders
# - __MACOSX folders
# - .DS_Store and other ignored filenames
# - common binary/media/archive/executable file types
# - files detected as binary even if their extension is unknown
#
# Requirements:
# - bash
# - find
# - file
# - zip
#
# Edit IGNORE_DIRS, IGNORE_FILENAMES, and IGNORE_EXTENSIONS below to customize.

set -euo pipefail

OUTPUT="repository.zip"

# ---------------------------------------------------------------------------
# Folder exclusions
# ---------------------------------------------------------------------------
# Folder names are matched at any depth.
IGNORE_DIRS=(
  ".git"
  ".svn"
  ".hg"

  "node_modules"
  "dist"

  ".next"
  ".nuxt"
  ".cache"
  ".parcel-cache"
  ".turbo"
  ".idea"
  ".vscode"
  ".tools"

  "coverage"
  "build"
  "out"
  "output"

  "secrets"
  ".claude"

  "__MACOSX"
)

# ---------------------------------------------------------------------------
# Filename exclusions
# ---------------------------------------------------------------------------
# Exact filenames are matched at any depth.
IGNORE_FILENAMES=(
  ".DS_Store"
  "Thumbs.db"

  "REPOSITORY_STRUCTURE.md"
  "REPOSITORY_CONTENTS.md"

  # Never package a previously generated repository archive.
  "repository.zip"
)

# ---------------------------------------------------------------------------
# File-type exclusions
# ---------------------------------------------------------------------------
# Extensions are lowercase and include the leading dot.
IGNORE_EXTENSIONS=(
  # Images
  ".png"
  ".jpg"
  ".jpeg"
  ".gif"
  ".webp"
  ".bmp"
  ".tif"
  ".tiff"
  ".ico"
  ".icns"
  ".avif"
  ".heic"
  ".heif"
  ".svg"
  ".svgz"

  # PDF / ebook / office containers
  ".pdf"
  ".epub"
  ".doc"
  ".docx"
  ".xls"
  ".xlsx"
  ".ppt"
  ".pptx"

  # Audio
  ".mp3"
  ".wav"
  ".flac"
  ".aac"
  ".m4a"
  ".ogg"
  ".opus"
  ".wma"

  # Video
  ".mp4"
  ".mov"
  ".mkv"
  ".avi"
  ".webm"
  ".m4v"
  ".mpeg"
  ".mpg"

  # Fonts
  ".ttf"
  ".otf"
  ".woff"
  ".woff2"
  ".eot"

  # Archives / compressed files
  ".zip"
  ".tar"
  ".gz"
  ".tgz"
  ".bz2"
  ".xz"
  ".7z"
  ".rar"

  # Native binaries / executables / compiled objects
  ".exe"
  ".dll"
  ".so"
  ".dylib"
  ".bin"
  ".com"
  ".app"
  ".msi"
  ".o"
  ".obj"
  ".a"
  ".lib"
  ".class"
  ".jar"
  ".war"
  ".wasm"
  ".node"

  # Binary databases / data formats
  ".db"
  ".sqlite"
  ".sqlite3"
  ".parquet"
  ".arrow"
  ".feather"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

contains_exact() {
  local needle="$1"
  shift

  local item
  for item in "$@"; do
    [[ "$needle" == "$item" ]] && return 0
  done

  return 1
}

path_has_ignored_dir() {
  local relative_path="$1"
  local dir

  for dir in "${IGNORE_DIRS[@]}"; do
    if [[ "$relative_path" == "$dir/"* || "$relative_path" == *"/$dir/"* ]]; then
      return 0
    fi
  done

  return 1
}

is_ignored_filename() {
  local filename="$1"
  contains_exact "$filename" "${IGNORE_FILENAMES[@]}"
}

is_ignored_extension() {
  local filename="$1"
  local lower
  lower="$(printf '%s' "$filename" | tr '[:upper:]' '[:lower:]')"

  local ext
  for ext in "${IGNORE_EXTENSIONS[@]}"; do
    [[ "$lower" == *"$ext" ]] && return 0
  done

  return 1
}

looks_binary() {
  local file_path="$1"

  # Empty files are harmless text-like repository artifacts.
  [[ ! -s "$file_path" ]] && return 1

  # `file --mime-encoding` returns "binary" for binary data on macOS/Linux.
  local encoding
  encoding="$(file -b --mime-encoding "$file_path" 2>/dev/null || true)"

  [[ "$encoding" == "binary" ]]
}

# ---------------------------------------------------------------------------
# Build file list
# ---------------------------------------------------------------------------

command -v zip >/dev/null 2>&1 || {
  echo "Error: 'zip' is required but was not found." >&2
  exit 1
}

command -v file >/dev/null 2>&1 || {
  echo "Error: 'file' is required but was not found." >&2
  exit 1
}

TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_LIST"' EXIT

included=0
skipped_binary=0
skipped_type=0
skipped_name=0
skipped_dir=0

while IFS= read -r -d '' full_path; do
  relative_path="${full_path#./}"
  filename="${relative_path##*/}"

  if path_has_ignored_dir "$relative_path"; then
    ((skipped_dir += 1))
    continue
  fi

  if is_ignored_filename "$filename"; then
    ((skipped_name += 1))
    continue
  fi

  if is_ignored_extension "$filename"; then
    ((skipped_type += 1))
    continue
  fi

  if looks_binary "$full_path"; then
    ((skipped_binary += 1))
    continue
  fi

  printf '%s\n' "$relative_path" >> "$TMP_LIST"
  ((included += 1))
done < <(find . -type f -print0)

# Remove any previous archive before creating the new one.
rm -f "$OUTPUT"

if [[ ! -s "$TMP_LIST" ]]; then
  echo "No files matched the inclusion rules; no ZIP created."
  exit 0
fi

# -q  quiet
# -@  read file paths from stdin
#
# Repository-relative paths are stored in the archive, not absolute paths.
zip -q "$OUTPUT" -@ < "$TMP_LIST"

echo "Created $OUTPUT"
echo "Included files: $included"
echo "Skipped because of ignored folders: $skipped_dir"
echo "Skipped because of ignored filenames: $skipped_name"
echo "Skipped because of ignored file types: $skipped_type"
echo "Skipped because binary content was detected: $skipped_binary"

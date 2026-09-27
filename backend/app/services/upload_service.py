import os
import shutil
import uuid
import zipfile
from pathlib import Path

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.config import get_settings
from app.models.file import File
from app.repositories import file_repo

settings = get_settings()

# Directories we never want to import into a project (build artifacts,
# dependency folders, VCS internals) — these add no review value and
# would blow up storage/DB size for no reason.
IGNORED_DIR_NAMES = {
    "node_modules", ".git", ".next", "dist", "build",
    "__pycache__", ".venv", "venv", ".idea", ".vscode",
}

# Extensions we treat as binary/non-reviewable outright, so we don't even
# attempt to read them as text later (images, archives, compiled objects).
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".pdf",
    ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".pyc",
    ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".db",
}

# Extension -> language map, used both for storage metadata and later
# for syntax highlighting in the frontend (Phase 3) and prompt building (Phase 5).
LANGUAGE_MAP = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".json": "json",
    ".html": "html", ".css": "css", ".md": "markdown",
    ".java": "java", ".go": "go", ".rb": "ruby", ".php": "php",
    ".c": "c", ".cpp": "cpp", ".yml": "yaml", ".yaml": "yaml",
    ".sql": "sql", ".sh": "bash",
}

MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB cap — reject absurd uploads early


def _is_within_directory(base_dir: Path, target_path: Path) -> bool:
    """
    CORE PATH-TRAVERSAL GUARD.
    A malicious ZIP can contain an entry like '../../etc/passwd' or an
    absolute path. If we extracted it naively, it could write files
    OUTSIDE our intended storage folder — a classic "zip slip" attack.

    We resolve both paths to their absolute, symlink-free form and check
    that target_path is actually a child of base_dir. If not, we reject it.
    """
    try:
        base_resolved = base_dir.resolve()
        target_resolved = target_path.resolve()
        return str(target_resolved).startswith(str(base_resolved) + os.sep) or target_resolved == base_resolved
    except (OSError, ValueError):
        return False


def _should_ignore(relative_path: Path) -> bool:
    # If ANY path segment matches an ignored directory name, skip the whole entry.
    # e.g. "src/node_modules/lodash/index.js" -> ignored because "node_modules" is a segment.
    return any(part in IGNORED_DIR_NAMES for part in relative_path.parts)


def _is_binary_file(file_path: Path) -> bool:
    """
    Two-layer check:
    1. Fast path: known binary extensions (images, archives, etc.)
    2. Fallback: sniff the first 1KB for null bytes — text files essentially
       never contain null bytes, binary files usually do. This catches
       binaries with unrecognized/missing extensions.
    """
    if file_path.suffix.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            return b"\x00" in chunk
    except OSError:
        return True  # if we can't even read it, treat it as non-reviewable


def _detect_language(extension: str) -> str | None:
    return LANGUAGE_MAP.get(extension.lower())


def extract_and_store_zip(
    db: Session,
    project_id: uuid.UUID,
    zip_bytes: bytes,
) -> tuple[int, int]:
    """
    Main entry point called by the router/service for POST /projects/{id}/upload.

    Steps:
    1. Validate it's actually a ZIP and not oversized.
    2. Create a dedicated storage folder for this project.
    3. Extract entries ONE BY ONE (never zip.extractall — that's what
       enables zip-slip attacks), validating each path before writing.
    4. Skip ignored directories and binary files (but still record
       binary files as metadata rows, just without indexing their content).
    5. Insert File rows (including directory rows) so the tree can be
       reconstructed later via parent_id.

    Returns (file_count, ignored_count) for the API response.
    """
    if len(zip_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload exceeds the 100MB limit.",
        )

    project_storage_root = Path(settings.storage_root) / str(project_id)
    project_storage_root.mkdir(parents=True, exist_ok=True)

    # Write the uploaded zip to a temp file so zipfile can read it
    # (zipfile needs a file-like object or path; bytes-in-memory also works
    # via io.BytesIO, but a temp file keeps memory usage flat for large uploads).
    temp_zip_path = project_storage_root / "_upload_temp.zip"
    with open(temp_zip_path, "wb") as f:
        f.write(zip_bytes)

    file_count = 0
    ignored_count = 0
    # Track which directory paths we've already created a File row for,
    # so we don't insert duplicate directory rows for shared parent folders.
    created_dir_ids: dict[str, uuid.UUID] = {}
    file_rows: list[File] = []

    try:
        with zipfile.ZipFile(temp_zip_path) as zf:
            for entry in zf.infolist():
                # Reject symlinks outright — a symlink inside a zip can point
                # anywhere on disk and is a common path-traversal vector.
                is_symlink = (entry.external_attr >> 16) & 0o170000 == 0o120000
                if is_symlink:
                    ignored_count += 1
                    continue

                raw_name = entry.filename
                if raw_name.endswith("/"):
                    # This entry is a directory marker inside the zip — we
                    # derive directories from file paths ourselves below,
                    # so we don't need to act on these directly, just skip.
                    continue

                relative_path = Path(raw_name)

                # Reject absolute paths and any ".." segments outright,
                # BEFORE even attempting to resolve them.
                if relative_path.is_absolute() or ".." in relative_path.parts:
                    ignored_count += 1
                    continue

                if _should_ignore(relative_path):
                    ignored_count += 1
                    continue

                destination_path = project_storage_root / relative_path

                # Second layer of defense: even after the checks above,
                # explicitly verify the resolved destination is still
                # inside project_storage_root before writing anything.
                if not _is_within_directory(project_storage_root, destination_path):
                    ignored_count += 1
                    continue

                # Ensure parent directories exist on disk
                destination_path.parent.mkdir(parents=True, exist_ok=True)

                # Extract this single file's bytes and write it to disk
                with zf.open(entry) as source, open(destination_path, "wb") as target:
                    shutil.copyfileobj(source, target)

                # ---- Build File DB rows for this entry's directory chain ----
                # Walk each directory level of the path (e.g. "src", "src/utils")
                # and ensure a File row with is_directory=True exists for each,
                # linked to its own parent, so the tree is fully reconstructable.
                parent_id = None
                accumulated = Path()
                for part in relative_path.parts[:-1]:  # all parts except the filename itself
                    accumulated = accumulated / part
                    key = str(accumulated)
                    if key not in created_dir_ids:
                        dir_id = uuid.uuid4()
                        created_dir_ids[key] = dir_id
                        file_rows.append(File(
                            id=dir_id,
                            project_id=project_id,
                            parent_id=parent_id,
                            path=key,
                            name=part,
                            extension=None,
                            language=None,
                            is_directory=True,
                            storage_path=None,
                            size=None,
                        ))
                    parent_id = created_dir_ids[key]

                # ---- Build the File row for the actual file ----
                extension = destination_path.suffix
                is_binary = _is_binary_file(destination_path)
                file_size = destination_path.stat().st_size

                file_rows.append(File(
                    id=uuid.uuid4(),
                    project_id=project_id,
                    parent_id=parent_id,
                    path=str(relative_path),
                    name=relative_path.name,
                    extension=extension or None,
                    # Binary files get no language tag — nothing to highlight/review as text
                    language=None if is_binary else _detect_language(extension),
                    is_directory=False,
                    storage_path=str(destination_path),
                    size=file_size,
                ))
                file_count += 1

        # Bulk insert all directory + file rows in one DB transaction
        file_repo.bulk_create(db, file_rows)

    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid ZIP archive.",
        )
    finally:
        # Always clean up the temp zip file, even if extraction failed partway
        if temp_zip_path.exists():
            temp_zip_path.unlink()

    return file_count, ignored_count
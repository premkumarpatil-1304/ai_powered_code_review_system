import uuid
from pathlib import Path

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.file import File
from app.repositories import file_repo
from app.schemas.file import FileNode, FilePreview

# Cap how much text we return in a single preview call — protects the API
# from someone previewing a 50MB minified JS file and blowing up the response.
MAX_PREVIEW_CHARS = 200_000


def build_file_tree(db: Session, project_id: uuid.UUID) -> list[FileNode]:
    """
    The `files` table is FLAT (each row just knows its own parent_id).
    This function turns that flat list into a NESTED tree structure that
    the frontend can render directly as a folder/file explorer.

    Approach:
    1. Fetch all file/folder rows for the project in one query.
    2. Build a FileNode for each row, with an empty children list.
    3. Walk the rows again, attaching each node to its parent's children
       list (or to the root list if parent_id is None).

    This is O(n) — a single pass to build nodes, a single pass to link them.
    """
    rows = file_repo.list_for_project(db, project_id)

    # Map of row id -> FileNode, so we can attach children by parent_id lookup
    nodes_by_id: dict[uuid.UUID, FileNode] = {}
    for row in rows:
        nodes_by_id[row.id] = FileNode(
            id=row.id,
            name=row.name,
            path=row.path,
            is_directory=row.is_directory,
            extension=row.extension,
            language=row.language,
            size=row.size,
            children=[],
        )

    root_nodes: list[FileNode] = []
    for row in rows:
        node = nodes_by_id[row.id]
        if row.parent_id is None:
            # No parent = top-level item (sits at the root of the project)
            root_nodes.append(node)
        else:
            parent_node = nodes_by_id.get(row.parent_id)
            if parent_node is not None:
                parent_node.children.append(node)
            else:
                # Defensive fallback: parent row missing somehow — surface
                # this file at root rather than silently dropping it.
                root_nodes.append(node)

    return root_nodes


def _is_probably_binary(content_bytes: bytes) -> bool:
    # Same null-byte heuristic used during upload, applied again here in
    # case a file's binary status needs re-checking at preview time.
    return b"\x00" in content_bytes[:1024]


def get_file_preview(db: Session, user_id: uuid.UUID, file_id: uuid.UUID) -> FilePreview:
    """
    Reads a file's actual content from disk (not from the DB — the DB only
    stores metadata) and returns it for the code viewer.
    """
    file_row: File | None = file_repo.get_by_id_for_user(db, user_id, file_id)

    if file_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    if file_row.is_directory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot preview a directory.",
        )

    storage_path = Path(file_row.storage_path) if file_row.storage_path else None

    if storage_path is None or not storage_path.exists():
        # Metadata row exists but the actual file is missing on disk —
        # shouldn't normally happen, but fail clearly instead of crashing.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content is missing from storage.",
        )

    raw_bytes = storage_path.read_bytes()

    if _is_probably_binary(raw_bytes) or file_row.language is None and file_row.extension in {
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".exe", ".dll"
    }:
        # Binary file — don't attempt to decode/display raw bytes as text
        return FilePreview(
            id=file_row.id,
            name=file_row.name,
            path=file_row.path,
            language=file_row.language,
            size=file_row.size,
            content=None,
            is_binary=True,
            truncated=False,
        )

    # Decode as UTF-8, replacing any invalid bytes rather than crashing
    # (some files may have mixed/unusual encodings).
    text_content = raw_bytes.decode("utf-8", errors="replace")

    truncated = len(text_content) > MAX_PREVIEW_CHARS
    if truncated:
        text_content = text_content[:MAX_PREVIEW_CHARS]

    return FilePreview(
        id=file_row.id,
        name=file_row.name,
        path=file_row.path,
        language=file_row.language,
        size=file_row.size,
        content=text_content,
        is_binary=False,
        truncated=truncated,
    )
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.file import File
from app.repositories import file_repo

# Rough character budget for how much source code we send to the LLM.
# ~4 chars per token as a rule of thumb, so this keeps us comfortably
# under most models' context windows even for a "whole project" review.
MAX_CONTEXT_CHARS = 60_000


def _read_file_content(file_row: File) -> str | None:
    if file_row.is_directory or not file_row.storage_path:
        return None
    path = Path(file_row.storage_path)
    if not path.exists():
        return None
    try:
        raw = path.read_bytes()
        if b"\x00" in raw[:1024]:
            return None  # binary file, skip — nothing useful to review as text
        return raw.decode("utf-8", errors="replace")
    except OSError:
        return None


def build_context_for_files(db: Session, file_ids: list) -> list[dict]:
    """
    Used for scope='file' or scope='files'. Reads exactly the requested
    files' content from disk and returns them as a list of
    {path, content} dicts, respecting the overall character budget.
    """
    context_files = []
    remaining_budget = MAX_CONTEXT_CHARS

    for file_id in file_ids:
        file_row = file_repo.get_by_id(db, file_id)
        if file_row is None:
            continue
        content = _read_file_content(file_row)
        if content is None:
            continue

        if len(content) > remaining_budget:
            content = content[:remaining_budget] + "\n... [truncated]"

        context_files.append({"path": file_row.path, "content": content})
        remaining_budget -= len(content)
        if remaining_budget <= 0:
            break

    return context_files


def build_context_for_project(db: Session, project_id) -> list[dict]:
    """
    Used for scope='project'. Pulls ALL non-directory files for the
    project, ordered by path, and fills the context budget greedily
    until it runs out — this is the "simple context retrieval" approach
    (no embeddings/vector DB, as required).
    """
    all_files = file_repo.list_for_project(db, project_id)
    context_files = []
    remaining_budget = MAX_CONTEXT_CHARS

    for file_row in all_files:
        if file_row.is_directory:
            continue
        content = _read_file_content(file_row)
        if content is None:
            continue
        if remaining_budget <= 0:
            break
        if len(content) > remaining_budget:
            content = content[:remaining_budget] + "\n... [truncated]"

        context_files.append({"path": file_row.path, "content": content})
        remaining_budget -= len(content)

    return context_files
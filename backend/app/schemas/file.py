import uuid
from pydantic import BaseModel, ConfigDict


class FileNode(BaseModel):
    # One node in the file tree — used recursively to represent folders + files
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    path: str
    is_directory: bool
    extension: str | None
    language: str | None
    size: int | None
    children: list["FileNode"] = []   # populated only for directories; empty list for files


# Needed because FileNode references itself (a directory contains FileNode children)
FileNode.model_rebuild()


class FilePreview(BaseModel):
    # Response for GET /api/files/{file_id} — actual file content + metadata
    id: uuid.UUID
    name: str
    path: str
    language: str | None
    size: int | None
    content: str | None          # None if binary/unreadable
    is_binary: bool
    truncated: bool              # True if we cut off content for very large files
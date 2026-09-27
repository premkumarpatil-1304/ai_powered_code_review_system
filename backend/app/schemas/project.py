import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    # Expected JSON body for POST /api/projects
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ProjectOut(BaseModel):
    # What we send back to the client for a single project
    model_config = ConfigDict(from_attributes=True)  # lets us return a SQLAlchemy Project object directly

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime


class UploadResult(BaseModel):
    # Response shape after a ZIP upload finishes
    file_count: int        # how many real files were stored
    ignored_count: int     # how many entries were skipped (node_modules, .git, binaries, etc.)
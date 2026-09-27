import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class ReviewScope(str, Enum):
    # Matches the "scope" column values used in the reviews table
    FILE = "file"
    FILES = "files"
    PROJECT = "project"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReviewCreate(BaseModel):
    # Request body for POST /api/projects/{id}/reviews
    template_slug: str = Field(min_length=1)        # 'security' | 'performance' | 'code_quality'
    provider_id: uuid.UUID
    scope: ReviewScope
    file_ids: list[uuid.UUID] = []                   # required for scope=file/files, ignored for scope=project


class Issue(BaseModel):
    # ONE issue found by the LLM — this shape is enforced on the LLM's
    # JSON output via response_parser.py, so the frontend can always rely on it.
    title: str
    severity: Severity
    file_path: str
    line_start: int | None = None
    line_end: int | None = None
    description: str
    recommendation: str


class ReviewResultPayload(BaseModel):
    # The structured shape we ask the LLM to return, validated before storage
    summary: str
    issues: list[Issue] = []
    recommendations: list[str] = []


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    template_id: uuid.UUID
    provider_id: uuid.UUID
    scope: str
    target_file_ids: list[str]
    status: str
    summary: str | None
    issues: list[dict] | None
    recommendations: list[str] | None
    error_message: str | None
    created_at: datetime


class ReviewTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    description: str
    focus_areas: list[str]
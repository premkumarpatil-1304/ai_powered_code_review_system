import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProviderCreate(BaseModel):
    # Request body for POST /api/providers
    name: str = Field(min_length=1, max_length=100)
    provider_type: str = Field(min_length=1)   # 'openai' | 'lm_studio' | 'ollama' | 'openrouter' | 'custom'
    base_url: str = Field(min_length=1)         # e.g. https://api.openai.com/v1
    api_key: str | None = None                  # plain text IN the request; we encrypt before storing
    model_name: str = Field(min_length=1)
    is_default: bool = False


class ProviderUpdate(BaseModel):
    # All optional — PUT can update just one field if desired
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model_name: str | None = None
    is_default: bool | None = None


class ProviderOut(BaseModel):
    # Response shape — notice: NO api_key or api_key_encrypted field at all.
    # We never send the key back to the client once it's stored, even encrypted.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    provider_type: str
    base_url: str
    model_name: str
    is_default: bool
    has_api_key: bool   # just a boolean flag so the UI knows a key IS set, without exposing it
    created_at: datetime


class TestConnectionResult(BaseModel):
    success: bool
    message: str
    latency_ms: int | None = None
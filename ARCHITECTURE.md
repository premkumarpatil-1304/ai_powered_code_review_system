# Architecture — AI Code Review Assistant

This document describes the high-level design, request flows, module boundaries, explicit trade-offs, and security properties of the AI Code Review Assistant. It's meant for engineers reviewing or extending the codebase.

---

## 1. System architecture (high level)

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js SPA)                        │
│  /login · /register · /dashboard · /projects/[id] · /providers     │
│  /history · /projects/[id]/chat (stub UI + types only)            │
└──────────────┬─────────────────────────────────────────────────────────┘
           │ HTTPS (fetch via lib/api/client.ts)
           ▼
┌────────────────────────────────────────────────────────────────────┐
│                        FastAPI (ASGI)                            │
│  CORSMiddleware (allow_origins=[localhost:3000])                │
│  Routers → auth · projects · files · providers ·                │
│            review-templates · reviews                                │
└──┬────────────────────────────────────────────────────────────┘
   │                                                              │
   ▼ Services (business logic)                                        │
┌───────────────────────────────────┐    ┌────────────────────────┐   │
│         ReviewService (orchestration)    │    │    ProviderService     │   │
│  ├─ project ownership check   │    │  ├─ create / list /  │   │
│  ├─ ContextBuilder          │    │  │     update / delete      │   │
│  ├─ PromptBuilder           │    │  ├─ test_connection / test-preview │
│  ├─ AIProviderFactory        │    │  └─ list_models / models-preview │
│  └─ ResponseParser          │    └────────────────────────┘   │
└──────────────┬────────────────────┘                            │
             │                                                          │
             ▼                                                    ▼
┌──────────────────────────────┐               ┌─────────────────────────────┐
│        Repositories          │               │   AI (pure layer)          │
│ user_repo  project_repo   │               │ ┌──────────────────────┐ │
│ file_repo  provider_repo  │               │ │  AIProviderFactory    │ │
│ review_repo review_tpl_repo  │               │ │  ·decrypts key on  │ │
│ (all scoped by user_id) │               │ │   use             │ │
└──────────────┬───────────────┘               │ └──────────────────────┘ │
               │                               │ ┌──────────────────────┐ │
               │                               │ │ OpenAICompatibleProv │ │
               ▼                               │ │  ├─ chat_completion │ │
        ┌────────────┐                           │ │  ├─ test_connection │ │
        │PostgreSQL  │                           │ │  └─ list_models    │ │
        │ (psycopg2 │                           │ └──────────────────────┘ │
        └─────┬──────┘                           └──────────┬───────────┘
                                                          │
                                                     ▲
            ┌──────────────────────────────────────────────┘
            │  generic OpenAI-compatible HTTP API
            ▼
 ┌──────────┬──────────────┬──────────────┬──────────────────┐
 │ LM Studio │  OpenAI   │  OpenRouter │ Custom endpoint │
 │ localhost │ api.openai.com  openrouter.ai  any URL │
 └──────────┴──────────────┴──────────────┴──────────────────┘
```

Key properties:

- **Strict layered architecture.** Routers → Services → Repositories → DB. AI layer is pure and reusable (no DB/web imports); routers are thin (HTTP parsing only, no SQL, no vendor logic).
- **Single-vendor-generic AI client.** One `OpenAICompatibleProvider` talks to every provider; no `OpenAIReviewService`, no `LMStudioReviewService`.
- **Pluggable encryption.** Provider API keys are Fernet-encrypted at rest, decrypted only at the moment of use inside `AIProviderFactory.create()`.
- **Stateless auth.** JWT (HS256) sessions.

---

## 2. Review pipeline (end to end)

This is the authoritative call graph for the user action *"Run a review on project P using provider X with template Y scoped to files F"*.

```
HTTP  ┌─ POST /api/projects/{projectId}/reviews  (Reviews router, router level)
│    └─ ReviewCreate parsed: template_slug, provider_id, scope, file_ids
│
SVC  ┌─ review_service.create_review(db, user_id, project_id, payload)
│    │
│    1. project_service.get_project_or_404    ownership (user_id)
│    2. review_template_repo.get_by_slug(slug) → system_prompt, focus_areas
│    3. provider_repo.get_for_user(user_id, provider_id) ───┐
│    │                                                    │
│    4. context_builder.build_context_for_project or            │
│    │       build_context_for_files(file_ids)               │
│    │       └─ reads File rows from DB, reads bytes from      │
│    │          disk under ./storage/<project>/ respecting    │
│    │          MAX_CONTEXT_CHARS budget (~60k chars)              │
│    │                                                       │
│    5. prompt_builder.build_review_prompt(                    │
│    │      project_name, template.system_prompt,            │
│    │      template.name, focus_areas, context_files)       │
│    │      → (system_message: str, user_message: str)
│    │                                                        │
│    6. review_repo.create(Review status='pending') ←── provider_id FK ┘
│    │
│    7. AIProviderFactory.create(provider_row)
│    │    ├─ decrypt api_key_encrypted → api_key (plaintext, in memory)
│    │    └─ return OpenAICompatibleProvider(
│    │              base_url=provider_row.base_url,
│    │              api_key=..., model_name=..., provider_type)
│    │
│    8. client.chat_completion(messages=[ChatMessage(role=system, ...ChatMessage(role=user, ...)], temperature=0.2, max_tokens=4000)
│    │    └─ httpx.POST("{base_url}/chat/completions",
│    │            headers[Authorization] only if _has_real_api_key)
│    │            json = { model, messages, temperature, max_tokens}
│    │
│    9. response_parser.parse_review_response(result.content)
│    │    ├─ _strip_code_fences() → strips \`\`\`json ... \`\`\` wrappers
│    └─ json.loads() → ReviewResultPayload.model_validate()
│    │          → summary, issues[], recommendations[])
│    │
│    10. review_repo.update(
│          status='completed', summary, issues, recommendations)
│
DB   └─ return ReviewOut → 200 JSON to frontend
```

**Error branches within the pipeline:

| Step | Failure mode                 | Handling |
|------|------------------------------|----------|
| 8   | 401/403/404/500/timeout/connect on upstream | `OpenAICompatibleProvider` translates status into a RuntimeError with user-safe message |
| 8   | Network / HTTP errors | `Review.status = 'failed', `Review.error_message` = friendly string  RuntimeError string. Stored, returned. Returned 200 with status='failed' (not 500). |
| 9   | LLM returned invalid JSON or wrong shape | Same: 'failed', error message describes *why. |

This design turns transient provider failures into domain objects (`Review with status='failed'`, which is a core UX choice.

---

## 3. Module contracts & responsibilities

Every module below lives under `backend/app/` and `frontend/app`.* strictly by design.

### 3.1 Backend

| Path | Layer | Responsibility | Must NOT do |
|---|---|---|---|
| `routers/*.py | Thin HTTP | Paths, status codes, Depends(), response models. | Business logic, SQL, vendor code. |
| `services/*.py | Business glue | Orchestrate steps; ownership; validation that needs DB state; compose repository + AI layer together | Raw SQL, raw HTTP to vendors |
| `repositories/*_repo.py | Data access | SQLAlchemy queries, scoped by user. SQL. One table. ORM queries. No HTTP response models. |
| `models/*.py` | ORM | Table schema, relationships, column types. | Anything not a column. |
| `schemas/*.py` | Serialization | Pydantic request/response shapes. Validation rules, field descriptions. | DB access, vendor calls. |
| `ai/base.py | AI abstraction | ChatMessage, CompletionResult, AIProvider ABC. | Concrete implementations. |
| `ai/factory.py` | Provider factory | Load DB row → decrypt key → return concrete AIProvider. | Any HTTP to vendors, any parsing. |
| `ai/openai_compatible.py` | Concrete provider | httpx client. Send requests, translate errors into user-safe RuntimeErrors. | DB, passwords, JWT. |
| `ai/context_builder.py` | Context retrieval | File budget reading on-disk files into [{path, content} budget. | Prompt formatting, vendor calls. |
| `ai/prompt_builder.py` | Prompt construction | Format template + files into SYSTEM + USER chat strings. | Any I/O. |
| `ai/response_parser.py` | Output contract | Strip JSON, validate against ReviewResultPayload. Raise ReviewParseError only. | Any I/O. |
| `ai/templates/*.py | Seed content | Default system prompts / focus areas seed_templates.py. | Runtime logic. |
| `config.py` | Settings | .env loading + `DATABASE_URL, SECRET_KEY, etc. | Secrets never default secrets. |
| `database.py` | Engine | SQLAlchemy engine, SessionLocal, Base, get_db. | App logic. |
| `deps.py` | Auth dependency | Decode JWT, look up User. Return User or HTTP 401. | Issue tokens, encryption. |
| `security.py` | Cryptography | bcrypt password hashing; JWT encode/decode; Fernet encrypt/decrypt for api keys. | DB access. |
| `main.py` | Composition root | FastAPI app, middleware, include_router calls. | Route handlers. |

### 3.2 Frontend

| Path | Layer | Responsibility |
|---|---|---|
| `lib/api/client.ts` | HTTP client | fetch + JWT attach base URL, error detail parsing, 401 redirect, `ApiError` class, all TS types for every domain object. |
| `contexts/AuthContext.tsx` | Session | React provider exposes user state. |
| `components/app-shell.tsx shell chrome, SectionLabel, Severity badge. |
| `components/require-auth.tsx` | Gate | Wraps pages and redirects to /login |
| `app/providers/page.tsx | Provider UI | Add / list / test / delete providers; **Fetch models; **Test connection before save; auto-fill presets. |
| `app/projects/[projectId]/page.tsx | Workspace | 3-pane file tree / preview / run-review panel. Upload ZIP action. Provider selector dropdown. |
| `app/history/page.tsx | Browse reviews | Filter by status, template, text search. |
| `app/projects/[projectId]/page, new, dashboard, login, register, page.tsx layouts routing structure. |

---

## 4. AI provider plug-in design

This is the most important architectural choice in the system, so it deserves its own section.

### 4.1 Problem statement

The assessment requires configurable AI providers without rewriting the review engine. Every supported vendor must share one provider implementation.

### 4.2 Solution

```
Provider DB Row (ai_providers table)
  │ base_url, api_key_encrypted, model_name, provider_type
  ▼
AIProviderFactory.create(row)     ← only place that decrypts keys
  │ decrypt_value(row.api_key_encrypted)
  │ (provider_type is metadata only, for UI display
  ▼
OpenAICompatibleProvider(base_url, api_key, model_name, provider_type)
  │
  ├─ chat_completion() → POST {base_url}/chat/completions
  │                       header: Authorization only if _has_real_api_key
  │                       json: model=model_name, messages=..., temperature=0.2, max_tokens=4000
  │
  ├─ test_connection() → tiny chat completion request with max_tokens=5
  │
  └─ list_models()      → GET {base_url}/models
                          returns [{"id": "model-id-1}, ...]
```

**provider_type is purely UI metadata.** It selects friendly error messages (e.g. LM Studio 404 → "Start the LM Studio local server and load a model") and selects a harmless placeholder string for empty api_keys (`lm-studio` for provider_type==lm_studio, else local). **It does not branch implementations. It does not select a class. It never switches which

### 4.3 API keys — header policy

| Situation | `self.api_key` attribute (never None) | `_has_real_api_key | Authorization header sent? |
|-----------|--------------------------------------|-------------------|--------------------------|
| User saved LM Studio, api_key empty | `'lm-studio'` (placeholder) | `False` | **No sent |
| User saved Ollama, api_key empty | `'local'` (placeholder) | `False` | No |
| User saved OpenAI, api_key=`sk-real` | `sk-real` | `True` | `Bearer sk-real` |
| Test-preview with empty key same rules apply) | same rules | Same rules |

This keeps `openai` Python SDK ever swaps in later: it always gets non-empty constructor arg but Authorization header never leaks placeholder strings.

### 4.4 Why httpx, not the SDK?

One `openai` SDK for all endpoints are:
1. Zero dependencies: the vendor SDKs are a vendor lock-in by deps. Only httpx works for every endpoint.
2. Control error translation happens once.
3. Authorization header control omission possible).
4. No async? Not needed.

### 4.5 Error translation table (how each upstream status → user message)

| Upstream status code / error | Frontend sees |
|---|---|
| 401/403 + provider=openai | "Authentication failed for OpenAI. Check your API key." |
| 401/403 + openrouter | "Authentication failed for OpenRouter. Check your API key." |
| 401/403 + lm_studio/ollama | "Authentication failed for X at Y. Local providers usually do not require an API key — try clearing the key." |
| Connection refused / DNS + lm_studio | "Cannot connect to LM Studio at http://Y. Start the LM Studio local server and try again." |
| 404 + lm_studio | "Cannot reach LM Studio at Y. Start the LM Studio local server, load a model, enable API on port 1234." |
| 400 "model not found text | "Configured model was not found on this provider. Check the model name or click Fetch available models." |
| 5xx | "{provider_name returned server error (status). Try again later. |
| Any TimeoutException | "The AI provider took too long to respond. Try again, or use a smaller review scope." |
| Malformed JSON choices[0]messagecontent missing | "Unexpected response shape from {name}." |

Every path goes through `_sanitize() which strips Bearer fragments and truncates long bodies before the error message never contains any token never leaks.

---

## 5. Data model

All tables live in single `code_review_db` under public schema. Migrations are versioned in `alembic/versions/`.

### 5.1 users

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | String unique, not null | indexed |
| password_hash | String | bcrypt, never plaintext password |
| created_at | timestamptz | server_default now() |

Relationships: `projects`, `ai_providers` → CASCADE delete.

### 5.2 projects

| Column | Type | Notes |
|---|---|---|
| id | UUID PK |
| user_id | UUID FK users.id | NOT NULL, ownership |
| name | String | |
| description | Text nullable | |
| created_at | timestamptz | |

Relationships: `files`, `reviews`, `chat_sessions` cascade.

### 5.3 files (uploaded code tree)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK |
| project_id | UUID FK projects.id | ownership via project → user |
| path | String | like "src/app.tsx" |
| name | String | basename |
| is_directory | Boolean | |
| extension | String nullable | ".tsx", ".py", etc. |
| language | String nullable | detected on upload from ext. |
| size | BigInt nullable | bytes |
| storage_path | String nullable | where on disk (null when is_directory=True) |
| parent_id | UUID FK files.id nullable | tree structure |
| created_at | timestamptz | |

### 5.4 ai_providers (most security-sensitive table)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK users.id | |
| name | String | display name |
| provider_type | String | `lm_studio / openai / openrouter / ollama / custom |
| base_url | String | NOT NULL. e.g. `http://localhost:1234/v1` |
| api_key_encrypted | String nullable | ** Fernet-encrypted. NULL for LM Studio / empty. |
| model_name | String | NOT NULL. e.g. `gpt-4o`, `microsoft-phi-4-mini-instruct |
| is_default | Boolean | per user exactly one row True enforced by unset_all_defaults |
| created_at | timestamptz | |

Note: `api_key_encrypted` is nullable. → LM Studio / Ollama keys → NULL, nullable DB-level optional.

### 5.5 review_templates (seeded by seed_templates.py)
| Column | Type | Values at seeding |
|---|---|---|
| id (UUID PK) | | |
| name | String | Security Review, Performance Review, Code Quality Review |
| slug | String unique | security / performance / code_quality |
| description | Text | |
| system_prompt | Text | long system prompt text |
| focus_areas | JSONB list | strings. e.g. ["OWASP Top 10", Injection |
| created_at | timestamptz | |

### 5.6 reviews (each = one LLM run)
| Column | Type |
|---|---|
| id | UUID PK |
| project_id | UUID FK projects.id |
| template_id | UUID FK review_templates.id |
| provider_id | UUID FK ai_providers.id |
| scope | String: file/files/project |
| target_file_ids | JSONB list of file UUIDs |
| status | String: pending / completed / failed |
| summary | Text nullable |
| issues | JSONB nullable: array of Issue objects |
| recommendations | JSONB nullable: list of strings |
| error_message | Text nullable: friendly) |
| created_at | timestamptz | |

Each issue object in JSONB is stable contract:
```json
{
  "title": "...",
  "severity": "critical | high | medium | low",
  "file_path": "src/file.py",
  "line_start": 42,
  "line_end": 49,
  "description": "...",
  "recommendation": "..."
}
```
Enforced server-side by ReviewResultPayload Pydantic model BEFORE storage.)

### 5.7 chat_sessions & chat_messages (chat stub tables)
Present but review pipeline; the chat project page that is currently ready future conversation history.

---

## 6. Tradeoffs / explicit non-goals

These choices were made deliberately for assessment deliver. Reconsider them if scope changes:

1. **Synchronous review endpoint.** `POST /api/projects/{id}/reviews waits synchronously blocks the whole LLM call 120s httpx timeout). No queue, no polling, no WebSocket streaming, no background worker, no Redis, no Kafka. Why: MVP simplicity, keeps deployable on a single process. Cost: user's browser waits on long reviews. Mitigation: scope selector lets user reduce scope; 120s timeout; friendly user message.

2. **Simple ContextBuilder.** Files pulled greedily (no embedding DB; no vector DB; no semantic chunking retrieves files sorted file_repository for project; chars; truncates to MAX_CONTEXT_CHARS. Why: assessment specified simple retrieval approach; works well for code review;

3. **Raw httpx instead of OpenAI SDK.** Shown above §4.5.

4. **One encryption key two keys; Fernet), same SECRET_KEY for JWT + Fernet API via SHA-256 hash of SECRET_KEY for Fernet 32 bytes. Why one fewer secrets to manage than introducing an FERNET_KEY separately. Risk: if compromised both are leaked, both auth and encrypted.

5. **One default provider per user only; not per project.** Why: simplicitly per-project selection dropdown project panel always has explicit selection.

---

## 7. Security architecture)

End-to-end security properties of the design:

1. Defense-in-depth for API keys
   - Stored Fernet-encrypted at rest.
   - Decrypted ONLY in `AIProviderFactory.create()`; returned plaintext scoped to the request.
   - `ProviderOut` never includes them, only boolean has_api_key).
   - 5xx paths: 401 404 scoped per user_id at repository level.
   - "Test preview endpoints: require get_current_user, can't probe urls) without a token.
   - Friendly 3. Transport: browser → backend (in development expect TLS terminator (production) do NOT deploy over HTTP).
   - sanitizer) 4. Database: PostgreSQL role & ownership checks project ownership first.
   - 5. CORS: allow_orgins=[":3000 only
   - 6. CSRF: SameSite, (manual registration login endpoints accept JSON → CSRF via POST body requests.
7. **Frontend never renders raw errors are displayed 4. Detail formatted 5.

— never any LLM output stored issues text only stored only strings. stored JSON is the issue descriptions are 100% user controlled HTML escaped by JSX not via React text text rendering.

---

## 8. Extension points

| Want to add? | Where? |
|---|---|
| New review template | Insert row into review_templates with a unique slug) — no code change |
| Brand new provider class, not OpenAI-compatible (e.g. anthropic raw REST? Implement AIProvider base, register it in AIProviderFactory switch.ai/factory.py. The review_service.py changes only factory file. No routers/repositories routers. |
| Streaming reviews | Keep ReviewService calls client.chat_completion wrap; SSE/WebSocket route; don't touch the rest. |
| Background job queue | Move the body of review_service.create_review Celery/RQ worker; router returns 202; review_id. Frontend polls GET /reviews/{id}. The pipeline itself unchanged. |
| Vector RAG retrieval | Swap ContextBuilder implementation; Prompt unchanged. |
| per-project provider defaults | Add default provider_id add column to projects; wire in project_service; everything else unchanged. |
| SSO login (OAuth) | auth_service.py + routers/auth.py add routes; keep deps.get_current_user unchanged (it only needs User model back). |

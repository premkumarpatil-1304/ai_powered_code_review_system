# AI-Powered Code Review Assistant

Full-stack engineering assessment project. A web application that lets engineers upload source code, configure an AI provider, and run structured, template-driven code reviews — then browse the findings per project.

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL + Alembic
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **AI layer:** 100% pluggable OpenAI-compatible client. Works with **LM Studio (local/free)**, OpenAI, OpenRouter, Ollama, or any custom OpenAI-compatible endpoint — no vendor lock-in, no hardcoded URLs.

---

## 1. Quick start

### Prerequisites

- Python **3.11+**
- Node.js **18+** (recommended: 20 LTS)
- PostgreSQL **14+** running locally on port 5432
- *(Optional, for zero-cost reviews)* **LM Studio** running with a local model and the API server enabled on port 1234.

### 1.1 Database

```sql
-- run in psql
CREATE DATABASE code_review_db;
-- the default .env.example expects user=postgres password=postgres;
-- change backend/.env if your local credentials differ
```

### 1.2 Backend (FastAPI, http://localhost:8000)

```bash
cd backend

# 1. Virtual environment + dependencies
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# 2. Environment (customize DATABASE_URL if needed)
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux

# 3. Create tables (Alembic)
alembic upgrade head

# 4. Seed the three built-in review templates
python seed_templates.py

# 5. Run the dev server
uvicorn app.main:app --reload --port 8000
```

Health check in another terminal:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

### 1.3 Frontend (Next.js, http://localhost:3000)

```bash
cd frontend

npm install

# Backend API base URL. Defaults to http://localhost:8000 — explicit export shown here:
# (Windows PowerShell)
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"; npm run dev
# (bash)
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

Open <http://localhost:3000>, register an account, and continue with **§2 LM Studio setup** to run a review without a paid API key.

---

## 2. LM Studio setup (free local reviews — no OpenAI key needed)

1. Open LM Studio → **Server** (left sidebar).
2. Load a model with chat/instruct capability (e.g. `microsoft-phi-4-mini-instruct`, `qwen2.5-coder:7b`, `llama-3.1-8b-instruct`).
3. Verify the server is listening on **<http://localhost:1234>** (the default).
4. In the app → **AI Providers** → **Add a provider**:
   - Provider type = **LM Studio (free · local)**
   - Base URL is auto-filled → `http://localhost:1234/v1`
   - API key → **leave blank**
   - Click **Fetch** next to Model name → after a second a list of locally loaded model IDs appears as chips. Click one.
   - Click **Test connection (before save)**. You should see a green *"Connected successfully (XX ms)"* banner using a real `POST /v1/chat/completions` call against your local LM Studio server.
   - *(Optional)* Tick **Set as default provider**.
   - Click **Add provider**.

If Test connection shows *"Cannot connect to LM Studio at http://localhost:1234. Start the LM Studio local server and try again."* — the LM Studio API server isn't running. Fix that before saving.

### Other supported provider types

| Provider      | Preset Base URL                    | API key | Example model                |
|---------------|------------------------------------|---------|------------------------------|
| LM Studio     | `http://localhost:1234/v1`         | Optional| `microsoft-phi-4-mini-instruct` |
| Ollama        | `http://localhost:11434/v1`        | Optional| `qwen2.5-coder:7b`            |
| OpenAI        | `https://api.openai.com/v1`        | Required| `gpt-4o`, `gpt-4o-mini`       |
| OpenRouter    | `https://openrouter.ai/api/v1`     | Required| `anthropic/claude-sonnet-4`, `openai/gpt-4o` |
| Custom        | *(user supplied, any OpenAI-compatible endpoint)* | Optional | whatever the endpoint reports |

All five are served by **the same** generic `OpenAICompatibleProvider` — no per-vendor review engine branching. See [ARCHITECTURE.md](file:///d:/ai_review_system/ARCHITECTURE.md) §4.

---

## 3. Using the application

### Typical workflow

1. **Register / log in** → `/register`, `/login`. Passwords are stored as bcrypt hashes only; sessions are stateless JWTs (HS256, 60-minute default expiration).
2. **New Project** → `/projects/new`. Give it a name and optional description.
3. **Upload code** → inside the project workspace (three-panel UI), click **Upload ZIP**. Only `.zip` is accepted; it is extracted server-side into `backend/storage/<projectId>/` and a tree of `File` rows is written.
4. **Code Explorer** → browse the file tree on the left; text files open in a syntax-highlighted editor on the middle panel. Binary files and unreadable files are skipped gracefully.
5. **Run a review** → right-side review panel:
   - Pick a **Review template** (Security / Performance / Code Quality — pre-seeded in the `review_templates` table).
   - Pick an **AI Provider** (dropdown shows every provider you added, flags the default one, warns when no API key is stored).
   - Pick **Review scope** = `project` (all text files) / `files` (multi-select) / `file` (currently open file).
   - Click **Run review**. The request goes to `POST /api/projects/{id}/reviews`, which runs the full pipeline described in [ARCHITECTURE.md](file:///d:/ai_review_system/ARCHITECTURE.md) §3 and returns a structured `Review` row including `status`, `summary`, `issues[]`, `recommendations[]`, `error_message`.
6. **Review history** → `/history`. Filters by status (pending/completed/failed), template, and free-text search across summary fields.

### Project chat (stub structure ready)

`/projects/[projectId]/chat` has a wired-up page shell, types, and a backend `ChatSession` / `ChatMessage` model. The REST layer for it can be added without touching the review or provider code paths.

---

## 4. Security

Items below are implemented and worth knowing about:

- **Passwords never stored plaintext.** bcrypt via `passlib` in [security.py](file:///d:/ai_review_system/backend/app/security.py).
- **JWT-only sessions.** No server-side session store; `Authorization: Bearer <token>` on every protected call. Missing or invalid 401s trigger a redirect to `/login` automatically on the frontend.
- **API keys never leave the backend.**
  - Stored in `ai_providers.api_key_encrypted` via Fernet symmetric encryption keyed off `SECRET_KEY` from `.env` (see `encrypt_value` / `decrypt_value` in [security.py](file:///d:/ai_review_system/backend/app/security.py#L52-L70)).
  - `ProviderOut` JSON schema has **no `api_key` field**; it exposes only a boolean `has_api_key` so the UI can show a warning or an "✓ already set" indicator. The encrypted blob is never serialized to the frontend.
  - The two "preview" endpoints (`POST /api/providers/test-preview` and `/models-preview`) accept a plaintext key in the request body exactly the same way the regular `POST /api/providers` create endpoint does — and they also never echo it back.
- **Multitenancy enforced in the data-access layer.** Every repository query scopes by `user_id` (see `*_for_user` methods in [repositories/](file:///d:/ai_review_system/backend/app/repositories)). Users can never read or mutate another user's projects, files, providers, or reviews by guessing UUIDs.
- **User-safe errors only.** `OpenAICompatibleProvider` strips Bearer fragments from upstream error strings, truncates long payloads, and never re-raises raw exceptions into the HTTP layer. Review failures persist just a sanitized `error_message` string on the `Review` row.
- **CORS is explicitly narrow.** Only `http://localhost:3000` is allowed (see [main.py](file:///d:/ai_review_system/backend/app/main.py#L17-L25)). Tighten this further in production.

Do **not** commit `backend/.env` or put real keys in `.env.example`. The repo's `.gitignore` already excludes `.env`.

---

## 5. API reference (highlights)

All endpoints live under `/api`. Every endpoint except `/api/auth/register`, `/api/auth/login`, and `/api/health` requires the `Authorization: Bearer <JWT>` header.

| Method   | Path                                          | Purpose                                    |
|----------|-----------------------------------------------|--------------------------------------------|
| POST     | `/api/auth/register`                          | Create a user account (email + password)   |
| POST     | `/api/auth/login`                             | Exchange email/password for JWT access token |
| GET      | `/api/auth/me`                                | Current user info                          |
| POST/GET | `/api/projects`                               | Create / list projects                     |
| GET/DELETE | `/api/projects/{id}`                         | Get / delete project by id                 |
| POST     | `/api/projects/{id}/upload`                   | Upload ZIP of source code                  |
| GET      | `/api/projects/{id}/files`                    | Project file tree (nested JSON)            |
| GET      | `/api/files/{id}`                             | Single file preview (content, size, binary flag) |
| POST/GET | `/api/providers`                              | Create / list AI provider configs          |
| PUT/DELETE | `/api/providers/{id}`                        | Update / delete provider                   |
| POST     | `/api/providers/{id}/test`                    | Test saved provider connection            |
| GET      | `/api/providers/{id}/models`                  | Fetch models from a saved provider's endpoint |
| POST     | `/api/providers/test-preview`                 | **Test unsaved** provider config (before save) |
| POST     | `/api/providers/models-preview`               | **Fetch models for unsaved** config (before save) |
| GET      | `/api/review-templates`                       | List built-in review templates             |
| POST/GET | `/api/projects/{id}/reviews`                  | Run review / list reviews for a project    |
| GET      | `/api/reviews/{id}`                           | Get single review + findings by id         |
| GET      | `/api/health`                                 | Server liveness probe                      |

Full OpenAPI schema + Swagger UI at <http://localhost:8000/docs> when the backend is running.

---

## 6. Project structure

```
ai_review_system/
├── backend/
│   ├── alembic/               # DB migrations (Alembic)
│   │   └── versions/
│   ├── app/
│   │   ├── ai/                # Review engine (pure — no DB/web concerns)
│   │   │   ├── base.py            # abstract AIProvider interface
│   │   │   ├── factory.py         # AIProviderFactory — DB row → callable client
│   │   │   ├── openai_compatible.py  # ONE generic httpx-based client (all vendors)
│   │   │   ├── prompt_builder.py     # turns templates + source files into chat messages
│   │   │   ├── context_builder.py    # reads source files from disk within a token budget
│   │   │   ├── response_parser.py    # strips code fences + validates LLM JSON output
│   │   │   └── templates/           # seeded security/performance/code_quality templates
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── repositories/        # DB access layer (user-scoped queries)
│   │   ├── routers/             # FastAPI route handlers (HTTP concerns only)
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Business logic glue layer
│   │   ├── config.py            # pydantic-settings .env loader
│   │   ├── database.py          # SQLAlchemy engine/Session/Base
│   │   ├── deps.py              # get_current_user dependency
│   │   ├── main.py              # FastAPI app + CORS + router registration
│   │   └── security.py          # bcrypt, JWT, Fernet API-key encryption
│   ├── storage/                # Uploaded files (one folder per project) — gitignored
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic.ini
│   └── seed_templates.py       # Inserts the three default ReviewTemplate rows
│
└── frontend/
    ├── app/                    # Next.js App Router pages
    │   ├── login/
    │   ├── register/
    │   ├── dashboard/
    │   ├── projects/
    │   │   ├── new/
    │   │   └── [projectId]/
    │   │       ├── chat/
    │   │       └── page.tsx    # 3-panel workspace + run review UI
    │   ├── providers/          # Add/list/test providers, model discovery
    │   ├── history/            # Review search/filters
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/             # AppShell, RequireAuth
    ├── contexts/               # AuthContext
    ├── lib/api/client.ts       # fetch wrapper: API_BASE_URL, JWT attach, 401 redirect, error-detail formatter
    ├── package.json            # Next 16, React 19, Tailwind v4, lucide-react, react-syntax-highlighter
    └── tsconfig.json           # strict mode, path alias @/* → ./*
```

For the call flow, data flow, design decisions, and tradeoffs, see **[ARCHITECTURE.md](file:///d:/ai_review_system/ARCHITECTURE.md)**.

---

## 7. Troubleshooting

### Review fails immediately with 401 "Incorrect API key provided"

**Cause:** The provider you selected earlier was saved with `base_url = https://api.openai.com/v1` and a dummy `sk-...` key. The backend correctly sends the request exactly there, and OpenAI rejects it.

**Fix:** Use LM Studio as described in **§2**, or add a real OpenAI/OpenRouter key to a new provider and then select that provider in the review panel's dropdown.

### LM Studio "Cannot connect to…" error

LM Studio's API server is not running on the expected host/port. Checklist:
- Server tab is open in LM Studio.
- A model is actually loaded (not just downloaded).
- Port matches the saved Base URL (default preset → 1234).
- If the backend runs inside a Docker container but LM Studio runs on the host, `localhost` inside the container points at the container, not the host. Use `host.docker.internal` or the host's LAN IP instead. The preset intentionally stays `localhost:1234` because the reference setup runs both processes natively on the same machine.

### "No models returned" when clicking Fetch

- LM Studio: load a model into the **Server** tab first. LM Studio's `/v1/models` reports only loaded models, not all downloaded ones.
- Ollama: `ollama serve` and `ollama pull <model>` first.
- OpenAI/OpenRouter: confirm the API key has permissions. The backend will surface the provider-specific auth failure message (e.g. *"Authentication failed for OpenRouter. Check your API key."*).

### Alembic migration "key 'fkey_xxx' is not present in table '…'"

Alembic autogenerate occasionally needs a tiny manual fix when you add columns. The initial migration already shipped as `alembic/versions/59b974c8416c_initial_tables.py`; apply it with `alembic upgrade head` before any further edits.

### npm install fails on node_modules

Delete `frontend/node_modules` + `frontend/package-lock.json` and reinstall with a matching Node LTS (18 or 20). `next@16` + `tailwindcss@4` require recent npm.

---

## 8. Validation & checks

```bash
# Backend import + constructor sanity
cd backend && .venv\Scripts\python.exe -c "from app.ai.openai_compatible import OpenAICompatibleProvider; p=OpenAICompatibleProvider(base_url='http://localhost:1234/v1', api_key=None, model_name='x', provider_type='lm_studio'); print(p.api_key, p._has_real_api_key, 'Authorization' in p._headers())"

# Frontend strict type check
cd frontend && npx tsc --noEmit

# Frontend lint
cd frontend && npm run lint

# Frontend production build (crashes if anything is broken)
cd frontend && npm run build
```

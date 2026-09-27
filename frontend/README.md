# ReviewPilot frontend

Next.js App Router + TypeScript + Tailwind frontend for the AI-Powered Code Review Assistant.

## Run locally

```bash
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

Open `http://localhost:3000`.

## Implemented routes

- `/login`, `/register` — JWT login/register with token storage and 401 handling
- `/dashboard` — overview, metrics, projects, latest findings
- `/projects/new` — project creation entry point
- `/projects/[projectId]` — three-panel code workspace, file tree, ZIP upload control, syntax highlighting, review controls/results
- `/projects/[projectId]/chat` — project chat UI with session-ready messaging flow
- `/providers` — provider cards, connection test UI, add-provider form
- `/history` — review search and filters

## API client

`lib/api/client.ts` prepends `NEXT_PUBLIC_API_BASE_URL`, attaches bearer tokens, parses backend `detail` errors, and redirects to `/login` on 401.

The workspace includes representative project/review data for the visual shell while the REST client and auth calls are ready for the existing FastAPI endpoints. Provider, review, project, and chat controls are structured to connect to the supplied API contract.

## Validation

- `npm run build` passes
- `npm run lint` passes with warnings only from Next.js navigation guidance and unused icon imports
- Local smoke tests return `200` for `/`, `/login`, `/register`, `/providers`, `/history`, `/projects/demo`, and `/projects/demo/chat`

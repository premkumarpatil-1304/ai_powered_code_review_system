from app.routers import reviews

from app.routers import review_templates
from app.routers import providers
from app.services import provider_service
from app.routers import files
from app.services import file_service
from app.services import file_service
from app.routers import projects
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth

app = FastAPI(title="AI Code Review Assistant API")

# CORS: without this, your Next.js app (running on :3000) would be blocked
# by the browser from calling this API (running on :8000) — different ports = different "origin".
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # only allow requests from your frontend's dev URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# register all the auth routes (register/login/me) onto the app
app.include_router(auth.router)
app.include_router(projects.router)  # NEW: registers all /api/projects/* routes
app.include_router(files.router)
app.include_router(providers.router)
app.include_router(review_templates.router)  # NEW
app.include_router(reviews.router)  

@app.get("/api/health")
def health():
    # simple endpoint to confirm the server is alive — useful for deployment checks later
    return {"status": "ok"}
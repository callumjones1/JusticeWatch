"""Justice Watch Network API.

Run locally (from backend/, with venv active):
    uvicorn api.main:app --reload --port 8000

Docs at http://localhost:8000/docs once running.
"""

from __future__ import annotations

import base64
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes.events import router as events_router
from etl.db import get_engine
from etl.models import Base

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Site-wide HTTP Basic Auth gate -- set SITE_USERNAME + SITE_PASSWORD in
# Render's dashboard to turn it on (soft-launch / pre-announcement gate,
# not real access control). Unset locally, so local dev is never gated.
SITE_USERNAME = os.getenv("SITE_USERNAME")
SITE_PASSWORD = os.getenv("SITE_PASSWORD")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-destructive: only creates tables/indexes that don't exist yet. The
    # actual data comes from etl/load_events.py -- a large batch job run
    # separately, not on every app boot.
    Base.metadata.create_all(get_engine())
    yield


app = FastAPI(title="Justice Watch Network API", lifespan=lifespan)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def basic_auth_gate(request: Request, call_next):
    if not SITE_USERNAME or not SITE_PASSWORD:
        return await call_next(request)  # gate disabled unless both are set
    if request.url.path == "/api/health":
        return await call_next(request)  # keep-alive pings / platform health checks stay unauthenticated

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Basic "):
        try:
            decoded = base64.b64decode(auth_header[len("Basic "):]).decode("utf-8")
            username, _, password = decoded.partition(":")
        except (ValueError, UnicodeDecodeError):
            username, password = "", ""
        if secrets.compare_digest(username, SITE_USERNAME) and secrets.compare_digest(password, SITE_PASSWORD):
            return await call_next(request)

    return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Justice Watch Network"'})


app.include_router(events_router)


@app.get("/api/health")
def health():
    return {"status": "healthy", "message": "Justice Watch Network API"}


# Serves the built frontend (frontend/ -> vite build -> backend/static/, see
# vite.config.ts). Mounted last so it never shadows the /api/* routes above --
# Starlette matches routes in registration order and this Mount matches
# every remaining path. Only present in the production container; local dev
# uses `npm run dev` + the Vite proxy instead, so this is skipped if the
# static build isn't there.
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

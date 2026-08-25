"""Justice Watch Network API.

Run locally (from backend/, with venv active):
    uvicorn api.main:app --reload --port 8000

Docs at http://localhost:8000/docs once running.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes.events import router as events_router
from etl.db import get_engine
from etl.models import Base

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


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

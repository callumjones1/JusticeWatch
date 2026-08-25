# ---- Frontend build ----
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend ----
# Pinned to bookworm explicitly (not the floating python:3.11-slim tag) for a
# stable, reproducible base.
FROM python:3.11-slim-bookworm AS backend

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
# vite.config.ts builds to ../backend/static (relative to the frontend
# stage's WORKDIR /app/frontend), so the output lands at /app/backend/static
# there -- matches STATIC_DIR in api/main.py.
COPY --from=frontend /app/backend/static ./static

ENV PORT=8000
EXPOSE 8000

# The production data lives in Postgres (DATABASE_URL, e.g. Neon) -- nothing
# here runs the ETL loader or needs the raw JSON; see .dockerignore.
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT}

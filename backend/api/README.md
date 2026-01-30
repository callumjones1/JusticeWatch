# API

REST API for the Justice Watch Network.

## Tech Stack

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database access
- **Pydantic** - Data validation

## Structure

```
api/
├── routes/       # API endpoint definitions
├── services/     # Business logic
└── README.md
```

## Endpoints (Planned)

### Cases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cases` | List cases with filtering |
| GET | `/api/cases/{id}` | Get case details |
| GET | `/api/cases/{id}/charges` | Get case charges |
| GET | `/api/cases/{id}/sources` | Get case sources |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Full-text search |
| GET | `/api/search/advanced` | Advanced filtered search |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/overview` | Summary statistics |
| GET | `/api/stats/by-jurisdiction` | Cases by jurisdiction |
| GET | `/api/stats/by-category` | Cases by category |
| GET | `/api/stats/timeline` | Cases over time |

### Reference Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jurisdictions` | List jurisdictions |
| GET | `/api/categories` | List categories |
| GET | `/api/tags` | List tags |

## Running the API

```bash
# From backend directory
uvicorn api.main:app --reload --port 8000
```

## API Documentation

When running, interactive docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

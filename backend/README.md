# Justice Watch Network - Backend

Python backend for the Justice Watch Network platform.

## Tech Stack

- **FastAPI** - REST API framework
- **PostgreSQL** - Database
- **SQLAlchemy** - ORM
- **BeautifulSoup** - Web scraping

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 14+

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Copy config file
cp config/settings.example.yml config/settings.yml
```

### Database Setup

```bash
# Create database
createdb justice_watch

# Run schema
psql -d justice_watch -f db/schema.sql
```

### Running the API

```bash
uvicorn api.main:app --reload --port 8000
```

API documentation will be available at `http://localhost:8000/docs`.

## Project Structure

```
backend/
├── api/           # REST API
│   ├── routes/    # Endpoint definitions
│   └── services/  # Business logic
├── config/        # Configuration files
├── data/          # Data storage
│   ├── raw/       # Original scraped data
│   └── processed/ # Cleaned data
├── db/            # Database
│   ├── schema.sql # Database schema
│   └── migrations/
└── scrapers/      # Data collection scripts
```

## Development

```bash
# Run tests
pytest

# Format code
black .

# Lint
ruff check .

# Type check
mypy .
```

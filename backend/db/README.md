# Database

PostgreSQL database configuration for the Justice Watch Network.

## Setup

### Prerequisites

- PostgreSQL 14+

### Create Database

```bash
createdb justice_watch

# Run schema
psql -d justice_watch -f schema.sql
```

## Schema Overview

| Table | Description |
|-------|-------------|
| `jurisdictions` | AU states/territories and NZ |
| `categories` | Case type categories |
| `cases` | Main prosecution records |
| `individuals` | People involved in cases |
| `charges` | Specific charges/offences |
| `sources` | Document and media sources |
| `tags` | Flexible tagging system |

## Migrations

Database migrations are stored in the `migrations/` directory. Use a migration tool like:
- [golang-migrate](https://github.com/golang-migrate/migrate)
- [Alembic](https://alembic.sqlalchemy.org/) (Python)
- [dbmate](https://github.com/amacneil/dbmate)

### Migration naming convention

```
YYYYMMDDHHMMSS_description.sql
```

Example: `20240115120000_add_appeal_status.sql`

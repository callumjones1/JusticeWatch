# Scrapers

Web scrapers and data collection tools for the Justice Watch Network.

## Overview

This directory contains scripts for collecting prosecution data from various sources.

## Planned Scrapers

### Australia

| Source | Status | Notes |
|--------|--------|-------|
| AustLII | Planned | Australian Legal Information Institute |
| Federal Court | Planned | Federal Court of Australia judgments |
| NSW Caselaw | Planned | NSW court decisions |
| Victorian Reports | Planned | Victorian court decisions |

### New Zealand

| Source | Status | Notes |
|--------|--------|-------|
| NZLII | Planned | New Zealand Legal Information Institute |
| Courts of NZ | Planned | Official court decisions |

## Usage

```bash
# Activate virtual environment
source ../venv/bin/activate

# Run a scraper
python scraper_name.py --output ../data/raw/
```

## Guidelines

1. **Respect rate limits** - Include delays between requests
2. **Check robots.txt** - Honour website scraping policies
3. **Store raw data** - Never modify original scraped content
4. **Log everything** - Track what was collected and when
5. **Handle errors** - Graceful failure with retry logic

## Output Format

Scrapers should output JSON files with this structure:

```json
{
  "source": "source_name",
  "scraped_at": "ISO8601 timestamp",
  "records": [
    {
      "source_url": "url",
      "raw_content": "...",
      "metadata": {}
    }
  ]
}
```

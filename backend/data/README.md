# Data Directory

This directory contains prosecution case data for the Justice Watch Network.

## Structure

```
data/
├── raw/          # Original scraped or imported data
├── processed/    # Cleaned and transformed data
└── README.md
```

## Raw Data

The `raw/` directory stores original data as collected from sources:
- Court records
- Media reports
- Legislative databases
- Freedom of Information requests

**Important**: Raw data should never be modified. Always create processed versions.

## Processed Data

The `processed/` directory contains cleaned and normalised data ready for database import:
- Deduplicated records
- Standardised field formats
- Validated entries

## Data Format

Case data should follow this structure:

```json
{
  "case_id": "string",
  "title": "string",
  "jurisdiction": "AU" | "NZ",
  "state": "string",
  "date_filed": "YYYY-MM-DD",
  "date_resolved": "YYYY-MM-DD",
  "category": "environmental" | "animal_rights" | "far_right" | "other",
  "charges": ["string"],
  "outcome": "string",
  "sources": ["url"]
}
```

## Privacy & Ethics

- Personal information must be handled in accordance with privacy laws
- Only publicly available court information should be included
- Sensitive victim information must be redacted

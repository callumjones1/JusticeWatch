-- Justice Watch Network Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jurisdictions lookup table
CREATE TABLE jurisdictions (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL
);

INSERT INTO jurisdictions (code, name, country) VALUES
    ('AU-NSW', 'New South Wales', 'Australia'),
    ('AU-VIC', 'Victoria', 'Australia'),
    ('AU-QLD', 'Queensland', 'Australia'),
    ('AU-WA', 'Western Australia', 'Australia'),
    ('AU-SA', 'South Australia', 'Australia'),
    ('AU-TAS', 'Tasmania', 'Australia'),
    ('AU-ACT', 'Australian Capital Territory', 'Australia'),
    ('AU-NT', 'Northern Territory', 'Australia'),
    ('AU-FED', 'Federal', 'Australia'),
    ('NZ', 'New Zealand-Aotearoa', 'New Zealand');

-- Case categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

INSERT INTO categories (name, description) VALUES
    ('environmental', 'Environmental activism and protest'),
    ('animal_rights', 'Animal rights activism'),
    ('far_right', 'Far-right and neo-fascist violence'),
    ('indigenous_rights', 'Indigenous rights activism'),
    ('labour', 'Labour and union activism'),
    ('other', 'Other political activism or violence');

-- Main cases table
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    jurisdiction_code VARCHAR(10) REFERENCES jurisdictions(code),
    court VARCHAR(200),
    date_filed DATE,
    date_resolved DATE,
    category_id INTEGER REFERENCES categories(id),
    summary TEXT,
    outcome VARCHAR(100),
    outcome_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individuals involved in cases
CREATE TABLE individuals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- defendant, plaintiff, witness
    name VARCHAR(200),
    organisation VARCHAR(200),
    notes TEXT
);

-- Charges/offences
CREATE TABLE charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    offence VARCHAR(500) NOT NULL,
    legislation VARCHAR(500),
    section VARCHAR(100),
    outcome VARCHAR(100),
    sentence TEXT
);

-- Source documents
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- court_document, media, legislation
    title VARCHAR(500),
    url TEXT,
    publication_date DATE,
    accessed_date DATE,
    notes TEXT
);

-- Tags for flexible categorisation
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE case_tags (
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (case_id, tag_id)
);

-- Indexes for common queries
CREATE INDEX idx_cases_jurisdiction ON cases(jurisdiction_code);
CREATE INDEX idx_cases_category ON cases(category_id);
CREATE INDEX idx_cases_date_filed ON cases(date_filed);
CREATE INDEX idx_cases_outcome ON cases(outcome);
CREATE INDEX idx_charges_case ON charges(case_id);
CREATE INDEX idx_sources_case ON sources(case_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TABLE dsl_catalog (
    character text PRIMARY KEY,
    revision integer NOT NULL CHECK (revision > 0),
    entries json NOT NULL,
    published_at timestamptz NOT NULL
);

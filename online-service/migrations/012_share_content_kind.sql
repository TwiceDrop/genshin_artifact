ALTER TABLE axis_shares ADD COLUMN kind text NOT NULL DEFAULT 'axis'
    CHECK (kind IN ('axis', 'dsl', 'preset'));
